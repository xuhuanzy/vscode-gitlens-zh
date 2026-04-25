import * as ts from 'typescript';

import type {
	CatalogIssue,
	I18nDomain,
	OutputReference,
	SourceOccurrence,
	SourceReference,
} from '../../core/model.mts';
import {
	createAuthorityId,
	createContentHash,
	createOccurrenceId,
	parseMessagePattern,
	sanitizeKeySegment,
	shortHash,
} from '../../core/model.mts';

export interface RuntimeDynamicSourceTarget {
	readonly domain: 'formatter' | 'quickpicks' | 'webviewHost';
	readonly group: string;
	readonly file: string;
	readonly source: string;
	readonly syntax: 'ts' | 'tsx';
}

export interface RuntimeDynamicExtractionResult {
	readonly occurrences: SourceOccurrence[];
	readonly issues: CatalogIssue[];
}

export interface RuntimeDynamicMatch {
	readonly kind: 'string-literal' | 'template-expression' | 'markdown-title' | 'markdown-label' | 'html-title';
	readonly start: number;
	readonly end: number;
	readonly text: string;
	readonly context: string;
	readonly slot: string;
	readonly quote?: '"' | "'" | '`';
	readonly slotExpressions?: readonly RuntimeDynamicSlotExpression[];
}

export interface RuntimeDynamicSlotExpression {
	readonly name: string;
	readonly expression: string;
}

const uiPropertyNames = new Set([
	'description',
	'detail',
	'empty',
	'hint',
	'label',
	'message',
	'statusText',
	'title',
	'tooltip',
	'working',
]);
const uiVariableNames = new Set(['description', 'detail', 'label', 'message', 'tooltip']);
const uiFunctionNamesByArgument = new Map([
	['createQuickPickSeparator', new Set([0])],
	['formatAuthor', new Set([0])],
	['showInformationMessage', new Set([0])],
]);
const uiConstructorNamesByArgument = new Map([['GitWizardQuickPickItem', new Set([0])]]);
const uiReturnFunctionNames = new Set(['getNameFromRemoteResource']);
const nonTranslatableUiText = new Set(['HEAD', 'actions-row', 'footnote']);

export function extractRuntimeDynamicOccurrences(
	targets: readonly RuntimeDynamicSourceTarget[],
): RuntimeDynamicExtractionResult {
	const occurrences: SourceOccurrence[] = [];
	const issues: CatalogIssue[] = [];
	const seenIds = new Set<string>();

	for (const target of targets) {
		const extraction = extractRuntimeDynamicMatches(target);
		issues.push(...extraction.issues);

		for (const match of extraction.matches) {
			const occurrence = createOccurrence(target, match);
			if (seenIds.has(occurrence.id)) {
				issues.push({
					occurrenceId: occurrence.id,
					anchor: occurrence.anchor,
					reference: occurrence.reference,
					output: occurrence.output,
					reason: `duplicate runtime dynamic occurrence id: ${occurrence.id}`,
				});
				continue;
			}

			seenIds.add(occurrence.id);
			occurrences.push(occurrence);
		}
	}

	return {
		occurrences: occurrences.sort((left, right) => left.id.localeCompare(right.id)),
		issues: issues.sort((left, right) => (left.reason < right.reason ? -1 : left.reason > right.reason ? 1 : 0)),
	};
}

export function extractRuntimeDynamicMatches(target: RuntimeDynamicSourceTarget): {
	readonly matches: RuntimeDynamicMatch[];
	readonly issues: CatalogIssue[];
} {
	const sourceFile = ts.createSourceFile(
		target.file,
		target.source,
		ts.ScriptTarget.Latest,
		true,
		target.syntax === 'tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
	const matches: RuntimeDynamicMatch[] = [];
	const issues: CatalogIssue[] = [];

	const visit = (node: ts.Node): void => {
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			addStringLiteralMatch(target, sourceFile, node, matches);
		}

		if (ts.isTemplateExpression(node)) {
			addTemplateExpressionMatch(target, sourceFile, node, matches, issues);
		}

		if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) {
			addMarkdownLabelMatches(target, sourceFile, node, matches, issues);
			addMarkdownTitleMatches(target, sourceFile, node, matches, issues);
			addHtmlTitleMatches(target, sourceFile, node, matches, issues);
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return {
		matches: dedupeMatches(matches),
		issues: issues,
	};
}

function addTemplateExpressionMatch(
	target: RuntimeDynamicSourceTarget,
	sourceFile: ts.SourceFile,
	node: ts.TemplateExpression,
	matches: RuntimeDynamicMatch[],
	issues: CatalogIssue[],
): void {
	if (!isSupportedStringLiteralSlot(target, node)) return;

	const template = createTemplateTextFromTemplateExpression(node, sourceFile);
	if (template == null || !hasStaticTranslatableUiText(template.text) || !isTranslatableUiText(template.text)) {
		return;
	}

	const deferredReason = getDeferredTemplateExpressionReason(template.slotExpressions);
	if (deferredReason != null) {
		issues.push({
			reference: createSourceReference(
				target.file,
				target.source,
				node.getStart(sourceFile),
				node.getEnd(),
				'template',
			),
			output: createRuntimeOutputReference(target.domain, `deferred.${target.group}.template`),
			reason: `deferred ${target.domain}.${target.group}: ${deferredReason} in '${template.text}'`,
		});
		return;
	}

	const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
	matches.push({
		kind: 'template-expression',
		start: node.getStart(sourceFile),
		end: node.getEnd(),
		text: template.text,
		context: `template.${line + 1}.${character + 1}`,
		slot: getStringLiteralSlot(node),
		quote: '`',
		slotExpressions: template.slotExpressions,
	});
}

function addHtmlTitleMatches(
	target: RuntimeDynamicSourceTarget,
	sourceFile: ts.SourceFile,
	node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral | ts.StringLiteral,
	matches: RuntimeDynamicMatch[],
	issues: CatalogIssue[],
): void {
	if (target.domain !== 'formatter') return;

	const start = node.getStart(sourceFile);
	const raw = target.source.slice(start, node.getEnd());
	for (const match of findHtmlTitleMatches(raw)) {
		const absoluteStart = start + match.start;
		const absoluteEnd = start + match.end;
		const reference = createSourceReference(target.file, target.source, absoluteStart, absoluteEnd, 'html-title');
		if (match.text.includes('${')) {
			issues.push({
				reference: reference,
				output: createRuntimeOutputReference(target.domain, `deferred.${target.group}.html-title`),
				reason: `deferred ${target.domain}.${target.group}: dynamic html title '${match.text}'`,
			});
			continue;
		}

		if (!isTranslatableUiText(match.text)) continue;

		const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, absoluteStart);
		matches.push({
			kind: 'html-title',
			start: absoluteStart,
			end: absoluteEnd,
			text: unescapeHtmlTitle(match.text),
			context: `html-title.${line + 1}.${character + 1}`,
			slot: 'html-title',
			quote: match.quote,
		});
	}
}

function addStringLiteralMatch(
	target: RuntimeDynamicSourceTarget,
	sourceFile: ts.SourceFile,
	node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
	matches: RuntimeDynamicMatch[],
): void {
	const supported = isSupportedStringLiteralSlot(target, node);
	const nestedFallback = supported ? undefined : getSupportedNestedFallbackStringLiteralSlot(target, node);
	if (!supported && nestedFallback == null) return;
	if (!isTranslatableUiText(node.text)) return;

	const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
	matches.push({
		kind: 'string-literal',
		start: node.getStart(sourceFile),
		end: node.getEnd(),
		text: node.text,
		context: `string.${line + 1}.${character + 1}`,
		slot: nestedFallback ?? getStringLiteralSlot(node),
		quote: getQuoteKind(sourceFile, node),
	});
}

function addMarkdownTitleMatches(
	target: RuntimeDynamicSourceTarget,
	sourceFile: ts.SourceFile,
	node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral | ts.StringLiteral,
	matches: RuntimeDynamicMatch[],
	issues: CatalogIssue[],
): void {
	if (target.domain !== 'formatter') return;

	const start = node.getStart(sourceFile);
	const raw = target.source.slice(start, node.getEnd());
	for (const match of findMarkdownTitleMatches(raw)) {
		const absoluteStart = start + match.start;
		const absoluteEnd = start + match.end;
		const reference = createSourceReference(
			target.file,
			target.source,
			absoluteStart,
			absoluteEnd,
			'markdown-title',
		);
		const template = createDynamicTemplateText(match.text);
		if (match.text.includes('${') && template == null) {
			issues.push({
				reference: reference,
				output: createRuntimeOutputReference(target.domain, `deferred.${target.group}.markdown-title`),
				reason: `deferred ${target.domain}.${target.group}: dynamic markdown title '${match.text}'`,
			});
			continue;
		}

		const text = template?.text ?? unescapeMarkdownTitle(match.text);
		if (!isTranslatableUiText(text)) continue;

		const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, absoluteStart);
		matches.push({
			kind: 'markdown-title',
			start: absoluteStart,
			end: absoluteEnd,
			text: text,
			context: `markdown-title.${line + 1}.${character + 1}`,
			slot: 'markdown-title',
			slotExpressions: template?.slotExpressions,
		});
	}
}

function addMarkdownLabelMatches(
	target: RuntimeDynamicSourceTarget,
	sourceFile: ts.SourceFile,
	node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral | ts.StringLiteral,
	matches: RuntimeDynamicMatch[],
	issues: CatalogIssue[],
): void {
	if (target.domain !== 'formatter') return;

	const start = node.getStart(sourceFile);
	const raw = target.source.slice(start, node.getEnd());
	for (const match of findMarkdownLabelMatches(raw)) {
		const absoluteStart = start + match.start;
		const absoluteEnd = start + match.end;
		const reference = createSourceReference(
			target.file,
			target.source,
			absoluteStart,
			absoluteEnd,
			'markdown-label',
		);
		const template = createDynamicTemplateText(match.text);
		if (match.text.includes('${') && template == null) {
			if (isSupportedMarkdownLabelRawText(match.text)) {
				issues.push({
					reference: reference,
					output: createRuntimeOutputReference(target.domain, `deferred.${target.group}.markdown-label`),
					reason: `deferred ${target.domain}.${target.group}: dynamic markdown label '${match.text}'`,
				});
			}
			continue;
		}

		const text = template?.text ?? unescapeMarkdownTitle(match.text);
		if (!isSupportedMarkdownLabelText(text) || !isTranslatableUiText(text)) continue;

		const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, absoluteStart);
		matches.push({
			kind: 'markdown-label',
			start: absoluteStart,
			end: absoluteEnd,
			text: text,
			context: `markdown-label.${line + 1}.${character + 1}`,
			slot: 'markdown-label',
			slotExpressions: template?.slotExpressions,
		});
	}
}

function findMarkdownTitleMatches(
	raw: string,
): Array<{ readonly start: number; readonly end: number; readonly text: string }> {
	const matches: Array<{ readonly start: number; readonly end: number; readonly text: string }> = [];
	const pattern = /\]\([\s\S]*?\s"((?:\\.|[^"\\])*)"\)/gu;

	for (const match of raw.matchAll(pattern)) {
		if (match.index == null) continue;

		const title = match[1];
		const titleStart = match.index + match[0].lastIndexOf(`"${title}"`) + 1;
		matches.push({
			start: titleStart,
			end: titleStart + title.length,
			text: title,
		});
	}

	return matches;
}

function findMarkdownLabelMatches(
	raw: string,
): Array<{ readonly start: number; readonly end: number; readonly text: string }> {
	const matches: Array<{ readonly start: number; readonly end: number; readonly text: string }> = [];
	const pattern = /\[([\s\S]*?)\]\(/gu;

	for (const match of raw.matchAll(pattern)) {
		if (match.index == null) continue;

		const label = match[1];
		const textOffset = getMarkdownLabelTextOffset(label);
		if (textOffset == null) continue;

		const labelStart = match.index + 1;
		matches.push({
			start: labelStart + textOffset,
			end: labelStart + label.length,
			text: label.slice(textOffset),
		});
	}

	return matches;
}

function getMarkdownLabelTextOffset(label: string): number | undefined {
	const codicon = /^\$\([^)]+\)\s*/u.exec(label);
	const offset = codicon?.[0].length ?? 0;
	if (offset >= label.length) return undefined;

	return offset;
}

function findHtmlTitleMatches(
	raw: string,
): Array<{ readonly start: number; readonly end: number; readonly text: string; readonly quote: '"' | "'" }> {
	const matches: Array<{
		readonly start: number;
		readonly end: number;
		readonly text: string;
		readonly quote: '"' | "'";
	}> = [];
	const pattern = /\btitle=(["'])((?:\\.|(?!\1)[^\\])*)\1/gu;

	for (const match of raw.matchAll(pattern)) {
		if (match.index == null) continue;

		const title = match[2];
		const titleStart = match.index + match[0].lastIndexOf(`${match[1]}${title}${match[1]}`) + 1;
		matches.push({
			start: titleStart,
			end: titleStart + title.length,
			text: title,
			quote: match[1] as '"' | "'",
		});
	}

	return matches;
}

function createDynamicTemplateText(
	rawText: string,
): { readonly text: string; readonly slotExpressions: readonly RuntimeDynamicSlotExpression[] } | undefined {
	if (!rawText.includes('${')) return undefined;
	if (rawText.includes('`')) return undefined;

	let text = '';
	const slotExpressions: RuntimeDynamicSlotExpression[] = [];
	let index = 0;
	while (index < rawText.length) {
		const expressionStart = rawText.indexOf('${', index);
		if (expressionStart === -1) {
			const staticText = rawText.slice(index);
			if (hasUnsupportedDynamicStaticText(staticText)) return undefined;

			text += unescapeMarkdownTitle(staticText);
			break;
		}

		const staticText = rawText.slice(index, expressionStart);
		if (hasUnsupportedDynamicStaticText(staticText)) return undefined;

		text += unescapeMarkdownTitle(staticText);
		const expressionEnd = findTemplateExpressionEnd(rawText, expressionStart + 2);
		if (expressionEnd == null) return undefined;

		const slotName = `slot${slotExpressions.length + 1}`;
		const expression = rawText.slice(expressionStart, expressionEnd + 1);
		if (expression.includes('\\n') || expression.includes('\\r')) return undefined;

		slotExpressions.push({
			name: slotName,
			expression: expression,
		});
		text += `\${${slotName}}`;
		index = expressionEnd + 1;
	}

	if (slotExpressions.length === 0) return undefined;
	if (!looksLikeSafeDynamicMarkdownTitle(text)) return undefined;

	return {
		text: text,
		slotExpressions: slotExpressions,
	};
}

function hasUnsupportedDynamicStaticText(text: string): boolean {
	return text.includes('\n') || text.includes('\r') || text.includes('\\n') || text.includes('\\r');
}

function createTemplateTextFromTemplateExpression(
	node: ts.TemplateExpression,
	sourceFile: ts.SourceFile,
): { readonly text: string; readonly slotExpressions: readonly RuntimeDynamicSlotExpression[] } | undefined {
	let text = node.head.text;
	const slotExpressions: RuntimeDynamicSlotExpression[] = [];

	for (const span of node.templateSpans) {
		const slotName = `slot${slotExpressions.length + 1}`;
		slotExpressions.push({
			name: slotName,
			expression: `\${${span.expression.getText(sourceFile)}}`,
		});
		text += `\${${slotName}}${span.literal.text}`;
	}

	if (slotExpressions.length === 0) return undefined;
	if (!looksLikeSafeDynamicUiTemplate(text)) return undefined;

	return {
		text: text,
		slotExpressions: slotExpressions,
	};
}

function getDeferredTemplateExpressionReason(
	slotExpressions: readonly RuntimeDynamicSlotExpression[],
): string | undefined {
	const expression = slotExpressions.find(slot => /\bpluralize\s*\(/u.test(slot.expression));
	if (expression == null) return undefined;

	return `slot expression '${expression.expression}' requires pluralization modeling`;
}

function findTemplateExpressionEnd(text: string, start: number): number | undefined {
	let depth = 1;
	let quote: '"' | "'" | undefined;
	let escaped = false;

	for (let index = start; index < text.length; index++) {
		const char = text[index];
		if (escaped) {
			escaped = false;
			continue;
		}

		if (char === '\\') {
			escaped = true;
			continue;
		}

		if (quote != null) {
			if (char === quote) {
				quote = undefined;
			}
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}

		if (char === '{') {
			depth++;
			continue;
		}

		if (char !== '}') continue;

		depth--;
		if (depth === 0) return index;
	}

	return undefined;
}

function looksLikeSafeDynamicMarkdownTitle(text: string): boolean {
	if (!/^[\p{L}\p{N}][\p{L}\p{N}\p{P}\p{Zs}$}{#]+$/u.test(text)) return false;
	if (!/\$\{slot\d+\}/u.test(text)) return false;
	if (text.includes('\\n')) return false;

	return true;
}

function isSupportedMarkdownLabelRawText(text: string): boolean {
	return text === 'Explain' || text.startsWith('Connect to ');
}

function isSupportedMarkdownLabelText(text: string): boolean {
	return text === 'Explain' || text.startsWith('Connect to ');
}

function looksLikeSafeDynamicUiTemplate(text: string): boolean {
	if (text.includes('\n') || text.includes('\r')) return false;
	if (!/\$\{slot\d+\}/u.test(text)) return false;
	if (!hasStaticTranslatableUiText(text)) return false;
	if (/^[\s\p{P}$}{\d]+$/u.test(text.replace(/\$\{slot\d+\}/gu, ''))) return false;
	if (looksLikeHtmlWrapperTemplate(text)) return false;

	return true;
}

function looksLikeHtmlWrapperTemplate(text: string): boolean {
	const withoutSlots = text.replace(/\$\{slot\d+\}/gu, '');
	if (!/[<>]/u.test(withoutSlots)) return false;

	const withoutTags = withoutSlots.replace(/<\/?[\p{L}\p{N}:-]+(?:\s+[^<>]*)?>/gu, '');
	return !/[A-Za-z]/.test(withoutTags);
}

function isSupportedStringLiteralSlot(
	target: RuntimeDynamicSourceTarget,
	node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression,
): boolean {
	if (isImportOrExportSpecifier(node)) return false;

	const parent = node.parent;
	if (
		target.domain === 'quickpicks' &&
		ts.isCallExpression(parent) &&
		parent.expression.kind === ts.SyntaxKind.SuperKeyword
	) {
		return parent.arguments[0] === node;
	}

	if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
		const propertyName = getPropertyName(parent.name);
		if (target.domain === 'webviewHost') {
			return propertyName === 'title' && isWebviewRegistrationDescriptor(parent);
		}

		return propertyName != null && uiPropertyNames.has(propertyName) && !isTelemetrySourceDetail(parent);
	}

	if (ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isIdentifier(parent.name)) {
		return uiVariableNames.has(parent.name.text);
	}

	if (ts.isReturnStatement(parent) && parent.expression === node) {
		const name = getEnclosingFunctionName(parent);
		return name != null && uiReturnFunctionNames.has(name);
	}

	if (ts.isShorthandPropertyAssignment(parent)) return false;

	if (
		ts.isBinaryExpression(parent) &&
		parent.right === node &&
		(parent.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
			parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken)
	) {
		const name = getExpressionName(parent.left);
		return name != null && uiVariableNames.has(name);
	}

	if (ts.isCallExpression(parent)) {
		const name = getCallIdentifier(parent.expression);
		const supportedArgs = name == null ? undefined : uiFunctionNamesByArgument.get(name);
		if (supportedArgs == null) return false;

		return supportedArgs.has(parent.arguments.indexOf(node));
	}

	if (ts.isNewExpression(parent)) {
		const name = getCallIdentifier(parent.expression);
		const supportedArgs = name == null ? undefined : uiConstructorNamesByArgument.get(name);
		if (supportedArgs == null) return false;

		return supportedArgs.has(getArgumentIndex(parent.arguments, node));
	}

	return false;
}

function getSupportedNestedFallbackStringLiteralSlot(
	target: RuntimeDynamicSourceTarget,
	node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
): string | undefined {
	let current: ts.Node = node;
	for (let parent = node.parent; parent != null; parent = parent.parent) {
		if (ts.isTemplateExpression(parent)) {
			const template = createTemplateTextFromTemplateExpression(parent, parent.getSourceFile());
			if (
				isSupportedStringLiteralSlot(target, parent) &&
				template != null &&
				hasStaticTranslatableUiText(template.text) &&
				isTranslatableUiText(template.text)
			) {
				return undefined;
			}
		}

		if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
			const args = parent.arguments ?? [];
			const argumentIndex = args.findIndex(argument => argument === current || isDescendantOf(current, argument));
			if (argumentIndex === -1) return undefined;

			if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.SuperKeyword) {
				return argumentIndex === 0 ? 'fallback' : undefined;
			}

			const name = getCallIdentifier(parent.expression);
			const supportedArgs =
				name == null
					? undefined
					: ts.isCallExpression(parent)
						? uiFunctionNamesByArgument.get(name)
						: uiConstructorNamesByArgument.get(name);
			return supportedArgs?.has(argumentIndex) === true ? 'fallback' : undefined;
		}

		if (!isSafeNestedFallbackExpression(parent, current)) return undefined;
		current = parent;
	}

	return undefined;
}

function isSafeNestedFallbackExpression(parent: ts.Node, child: ts.Node): boolean {
	if (
		ts.isBinaryExpression(parent) &&
		parent.right === child &&
		parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
	) {
		return true;
	}

	if (ts.isParenthesizedExpression(parent) && parent.expression === child) return true;
	if (ts.isAsExpression(parent) && parent.expression === child) return true;
	if (ts.isNonNullExpression(parent) && parent.expression === child) return true;

	return false;
}

function isDescendantOf(node: ts.Node, ancestor: ts.Node): boolean {
	for (let current = node.parent; current != null; current = current.parent) {
		if (current === ancestor) return true;
	}

	return false;
}

function getStringLiteralSlot(
	node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression,
): string {
	const parent = node.parent;
	if (ts.isPropertyAssignment(parent)) {
		return getPropertyName(parent.name) ?? 'text';
	}
	if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
		return parent.name.text;
	}
	if (ts.isReturnStatement(parent)) {
		return `${getEnclosingFunctionName(parent) ?? 'return'}-return`;
	}
	if (ts.isBinaryExpression(parent)) {
		return getExpressionName(parent.left) ?? 'text';
	}
	if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.SuperKeyword) {
		return 'label';
	}
	if (ts.isCallExpression(parent)) {
		return `${getCallIdentifier(parent.expression) ?? 'call'}-argument-${parent.arguments.indexOf(node) + 1}`;
	}
	if (ts.isNewExpression(parent)) {
		return `${getCallIdentifier(parent.expression) ?? 'constructor'}-argument-${
			getArgumentIndex(parent.arguments, node) + 1
		}`;
	}
	return 'text';
}

function createOccurrence(target: RuntimeDynamicSourceTarget, match: RuntimeDynamicMatch): SourceOccurrence {
	const pattern = parseMessagePattern(match.text);
	const output = createRuntimeOutputReference(target.domain, createRuntimeOutputKey(target, match));
	const anchor = `${target.domain}.${target.group}.${output.key}`;

	return {
		id: createOccurrenceId(target.domain, anchor, match.slot),
		domain: target.domain,
		scope: `${target.domain}.${target.group}`,
		anchor: anchor,
		slot: match.slot,
		authorityId: createAuthorityId(pattern),
		pattern: pattern,
		sourceText: match.text,
		sourceHash: createContentHash(match.text),
		reference: createSourceReference(target.file, target.source, match.start, match.end, match.slot),
		output: output,
	};
}

function createRuntimeOutputKey(target: RuntimeDynamicSourceTarget, match: RuntimeDynamicMatch): string {
	const context = sanitizeKeySegment(match.context).replaceAll('.', '-');
	const slot = sanitizeKeySegment(match.slot);
	const suffix = shortHash(
		`${target.domain}:${target.group}:${target.file}:${match.context}:${match.slot}:${match.text}`,
	);
	return `${target.group}.${context}.${slot}.${suffix}`;
}

function createRuntimeOutputReference(bundle: string, key: string): OutputReference {
	return {
		kind: 'runtime-key',
		bundle: bundle,
		key: key,
	};
}

function createSourceReference(
	file: string,
	source: string,
	startOffset: number,
	endOffset: number,
	attribute?: string,
): SourceReference {
	return {
		kind: 'source',
		file: file,
		syntax: file.endsWith('.tsx') ? 'tsx' : 'ts',
		start: offsetToLineColumn(source, startOffset),
		end: offsetToLineColumn(source, endOffset),
		attribute: attribute,
	};
}

function offsetToLineColumn(text: string, offset: number): { readonly line: number; readonly column: number } {
	let line = 1;
	let column = 1;
	for (let index = 0; index < offset; index++) {
		if (text[index] === '\n') {
			line++;
			column = 1;
		} else {
			column++;
		}
	}

	return { line: line, column: column };
}

function isImportOrExportSpecifier(node: ts.Node): boolean {
	let current: ts.Node | undefined = node.parent;
	while (current != null) {
		if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current)) return true;
		if (ts.isSourceFile(current)) return false;
		current = current.parent;
	}
	return false;
}

function getPropertyName(name: ts.PropertyName): string | undefined {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
	return undefined;
}

function getExpressionName(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
	return undefined;
}

function getCallIdentifier(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
	return undefined;
}

function getEnclosingFunctionName(node: ts.Node): string | undefined {
	for (let current = node.parent; current != null; current = current.parent) {
		if (
			ts.isFunctionDeclaration(current) ||
			ts.isMethodDeclaration(current) ||
			ts.isGetAccessorDeclaration(current)
		) {
			return current.name?.getText();
		}
		if ((ts.isFunctionExpression(current) || ts.isArrowFunction(current)) && current.parent != null) {
			if (ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) {
				return current.parent.name.text;
			}
			if (ts.isPropertyAssignment(current.parent)) {
				return getPropertyName(current.parent.name);
			}
		}
		if (ts.isSourceFile(current)) return undefined;
	}

	return undefined;
}

function isWebviewRegistrationDescriptor(titleProperty: ts.PropertyAssignment): boolean {
	const descriptor = titleProperty.parent;
	if (!ts.isObjectLiteralExpression(descriptor)) return false;

	const call = descriptor.parent;
	if (!ts.isCallExpression(call) || !call.arguments.includes(descriptor)) return false;
	if (getCallIdentifier(call.expression) !== 'registerWebviewView') return false;

	const id = descriptor.properties.find(
		(property): property is ts.PropertyAssignment =>
			ts.isPropertyAssignment(property) && getPropertyName(property.name) === 'id',
	);
	return id != null && getStringLiteralValue(id.initializer)?.startsWith('gitlens.views.') === true;
}

function getStringLiteralValue(expression: ts.Expression): string | undefined {
	if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
	return undefined;
}

function getQuoteKind(
	sourceFile: ts.SourceFile,
	node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
): '"' | "'" | '`' {
	const text = node.getText(sourceFile);
	const first = text[0];
	return first === "'" || first === '`' ? first : '"';
}

function isTranslatableUiText(text: string): boolean {
	const trimmed = text.trim();
	if (trimmed.length < 2) return false;
	if (nonTranslatableUiText.has(trimmed)) return false;
	if (!/[A-Za-z]/.test(trimmed)) return false;
	if (/^(?:[.#@/]|\.\.?\/)/.test(trimmed)) return false;
	if (/^(?:gitlens|vscode|command|editor|quick-wizard)(?:[.:/-]|$)/i.test(trimmed)) return false;
	if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(trimmed)) return false;
	if (/^[A-Za-z]:[\\/]/.test(trimmed)) return false;
	if (/^[\w.-]+\.(?:js|ts|tsx|scss|css|json|html)$/i.test(trimmed)) return false;
	if (/^\$\([^)]+\)$/.test(trimmed)) return false;

	return true;
}

function hasStaticTranslatableUiText(text: string): boolean {
	return /[A-Za-z]/.test(text.replace(/\$\{slot\d+\}/gu, ''));
}

function isTelemetrySourceDetail(parent: ts.PropertyAssignment): boolean {
	if (getPropertyName(parent.name) !== 'detail') return false;

	const object = parent.parent;
	if (!ts.isObjectLiteralExpression(object)) return false;

	return object.properties.some(
		property => ts.isPropertyAssignment(property) && getPropertyName(property.name) === 'source',
	);
}

function unescapeMarkdownTitle(text: string): string {
	return text.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function unescapeHtmlTitle(text: string): string {
	return text
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/\\"/g, '"')
		.replace(/\\'/g, "'")
		.replace(/\\\\/g, '\\');
}

function dedupeMatches(matches: readonly RuntimeDynamicMatch[]): RuntimeDynamicMatch[] {
	const seen = new Set<string>();
	const results: RuntimeDynamicMatch[] = [];

	for (const match of [...matches].sort((left, right) => left.start - right.start || left.end - right.end)) {
		const key = `${match.start}:${match.end}:${match.kind}`;
		if (seen.has(key)) continue;

		seen.add(key);
		results.push(match);
	}

	return results;
}

function getArgumentIndex(argumentsList: ts.NodeArray<ts.Expression> | undefined, node: ts.Node): number {
	return argumentsList?.findIndex(argument => argument === node) ?? -1;
}
