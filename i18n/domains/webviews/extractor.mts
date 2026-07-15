import * as ts from "typescript";

import type { CatalogIssue, OutputReference, SourceOccurrence, SourceReference } from "../../core/model.mts";
import {
	createAuthorityId,
	createOccurrenceId,
	parseMessagePattern,
	sanitizeKeySegment,
	shortHash,
} from "../../core/model.mts";

import {
	collectElementContentPattern,
	findAttributeValueRange,
	getClassList,
	isDateFormatTokenText,
	isTranslatableLiteralText,
	parseHtmlDocument,
	shouldExtractRootContent,
	shouldExtractElementContent,
	shouldSkipLocalizationSubtree,
	visitHtmlElements,
	type HtmlElementNode,
} from "./html.mts";
import { buildSyntheticHtmlTemplateFragment, buildSyntheticTextTemplateFragment } from "./template.mts";
import { createDisplayContextAnalyzer } from "./displayContext.mts";

export interface WebviewsExtractionResult {
	readonly occurrences: SourceOccurrence[];
	readonly issues: CatalogIssue[];
}

export interface HtmlExtractionTarget {
	readonly kind: "html";
	readonly file: string;
	readonly html: string;
	readonly shell: "settings";
}

export interface RuntimeSourceTarget {
	readonly kind: "source";
	readonly file: string;
	readonly source: string;
	readonly syntax: "ts" | "tsx" | "jsx";
	readonly bundle: string;
	readonly mode?: "supported" | "deferred";
	readonly deferredReason?: string;
}

type ExtractionTarget = HtmlExtractionTarget | RuntimeSourceTarget;

interface MatchDefinition {
	readonly kind: "text" | "attribute";
	readonly start: number;
	readonly end: number;
	readonly text: string;
	readonly attribute?: string;
	readonly context: string;
	readonly sourceKind: "html" | "lit" | "imperative";
}

const translatableAttributes = new Set([
	"title",
	"aria-label",
	"placeholder",
	"tooltip",
	"label",
	"alt-label",
	"banner-title",
	"primary-button",
	"secondary-button",
]);
const translatableAttributesByTag = new Map([["gl-tooltip", new Set(["content"])]]);
const translatablePropertyAssignmentNames = new Set(["title"]);
const translatablePropertyDeclarationNames = new Set(["explanationLabel", "placeholder"]);
const localizationHelperNames = new Set(["localizeWebviewText", "localizeWebviewTemplate"]);
const {
	hasHtmlTemplateAncestor,
	hasRenderedJsxExpressionAncestor,
	hasImperativeDisplayContextAncestor,
	isImperativeDisplayPropertyValue,
	templateSpanDisplayContext,
} = createDisplayContextAnalyzer({
	isHtmlTemplateTag: (tag) => isLitTemplateTag(tag),
	getPropertyName: getPropertyName,
	getStaticStringValue: getStaticStringValue,
	getJsxAttributeName: getJsxAttributeName,
	getJsxElementTagName: getJsxElementTagName,
	isTranslatableAttribute: isTranslatableAttribute,
});
const litTemplateTagNames = new Set(["html"]);

/** 从受支持的 HTML 和源码目标中提取 webview occurrence, 延后目标只记录问题. */
export function extractSupportedWebviewOccurrences(targets: readonly ExtractionTarget[]): WebviewsExtractionResult {
	const occurrences: SourceOccurrence[] = [];
	const issues: CatalogIssue[] = [];
	const seenIds = new Set<string>();

	for (const target of targets) {
		if (target.kind === "source" && target.mode === "deferred") {
			issues.push(...extractDeferredSourceIssues(target));
			continue;
		}

		const matches = target.kind === "html" ? extractHtmlMatches(target.html) : extractSourceMatches(target, issues);
		for (const match of matches) {
			const occurrence = createOccurrence(target, match);
			if (seenIds.has(occurrence.id)) {
				issues.push({
					occurrenceId: occurrence.id,
					anchor: occurrence.anchor,
					reference: occurrence.reference,
					output: occurrence.output,
					reason: `duplicate webview occurrence id: ${occurrence.id}`,
				});
				continue;
			}

			seenIds.add(occurrence.id);
			occurrences.push(occurrence);
		}
	}

	return {
		occurrences: occurrences.sort((left, right) => left.id.localeCompare(right.id)),
		issues: issues,
	};
}

function extractDeferredSourceIssues(target: RuntimeSourceTarget): CatalogIssue[] {
	const sourceFile = ts.createSourceFile(
		target.file,
		target.source,
		ts.ScriptTarget.Latest,
		true,
		getScriptKind(target.syntax),
	);

	const issues: CatalogIssue[] = [];
	const matches = extractSourceMatches(target, issues);
	for (const match of matches) {
		issues.push(
			createDeferredIssue(
				target,
				createSourceReference(target.file, target.source, match.start, match.end, match.attribute),
				`deferred ${target.bundle}: ${target.deferredReason ?? `unsupported ${target.syntax} or follow-up runtime path`} (${match.context})`,
				match.context,
			),
		);
	}

	if (target.syntax === "tsx" || target.syntax === "jsx") {
		scanDeferredJsxNodes(target, sourceFile, issues);
	}

	return issues;
}

function extractSourceMatches(target: RuntimeSourceTarget, issues: CatalogIssue[]): MatchDefinition[] {
	const sourceFile = ts.createSourceFile(
		target.file,
		target.source,
		ts.ScriptTarget.Latest,
		true,
		getScriptKind(target.syntax),
	);

	const matches: MatchDefinition[] = [];
	let litTemplateIndex = 0;

	const visit = (node: ts.Node): void => {
		if (ts.isTaggedTemplateExpression(node) && isLitTemplateTag(node.tag)) {
			litTemplateIndex++;
			matches.push(...extractLitTemplateMatches(target, node, sourceFile, litTemplateIndex));
		}

		if (ts.isCallExpression(node)) {
			const helperMatches = extractImperativeLocalizationMatches(target, node, sourceFile, issues);
			if (helperMatches.length !== 0) {
				matches.push(...helperMatches);
			}
		}

		if (ts.isPropertyAssignment(node)) {
			const propertyMatches = extractImperativePropertyMatches(target, node, sourceFile);
			if (propertyMatches.length !== 0) {
				matches.push(...propertyMatches);
			}
		}

		if (ts.isPropertyDeclaration(node)) {
			const propertyMatches = extractImperativePropertyDeclarationMatches(target, node, sourceFile);
			if (propertyMatches.length !== 0) {
				matches.push(...propertyMatches);
			}
		}

		if (ts.isJsxText(node)) {
			const jsxTextMatch = extractJsxTextMatch(node, sourceFile);
			if (jsxTextMatch != null) {
				matches.push(jsxTextMatch);
			}
		}

		if (ts.isJsxAttribute(node)) {
			const jsxAttributeMatch = extractJsxAttributeMatch(node, sourceFile);
			if (jsxAttributeMatch != null) {
				matches.push(jsxAttributeMatch);
			}
		}

		if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
			const displayMatch = extractImperativeDisplayMatch(target, node, sourceFile);
			if (displayMatch != null) {
				matches.push(displayMatch);
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return matches;
}

function extractLitTemplateMatches(
	target: RuntimeSourceTarget,
	node: ts.TaggedTemplateExpression,
	sourceFile: ts.SourceFile,
	templateIndex: number,
): MatchDefinition[] {
	if (node.getText(sourceFile).includes("localizeWebview")) {
		return [];
	}

	const syntheticHtml = buildSyntheticLitHtml(node.template);
	if (syntheticHtml.length === 0) return [];

	const templateStart = node.template.getStart(sourceFile);
	const templateEnd = node.template.getEnd();
	return extractHtmlMatches(syntheticHtml).map((match) => ({
		...match,
		start: templateStart,
		end: templateEnd,
		context: `lit.template-${templateIndex}.${match.context}`,
		sourceKind: "lit",
	}));
}

function extractImperativeLocalizationMatches(
	target: RuntimeSourceTarget,
	node: ts.CallExpression,
	sourceFile: ts.SourceFile,
	issues: CatalogIssue[],
): MatchDefinition[] {
	const helperName = getCallIdentifier(node.expression);
	if (helperName == null || !localizationHelperNames.has(helperName)) return [];

	const sourceArgument = node.arguments[1];
	if (sourceArgument == null) {
		issues.push({
			reference: createSourceReference(target.file, target.source, node.getStart(sourceFile), node.getEnd()),
			output: createRuntimeOutputReference(target.bundle, `deferred.${helperName}`),
			reason: `deferred ${helperName}: missing source text argument`,
		});
		return [];
	}

	const text = getStaticStringValue(sourceArgument);
	if (text == null) {
		issues.push({
			reference: createSourceReference(
				target.file,
				target.source,
				sourceArgument.getStart(sourceFile),
				sourceArgument.getEnd(),
			),
			output: createRuntimeOutputReference(target.bundle, `deferred.${helperName}`),
			reason: `deferred ${helperName}: source text must be a static string literal`,
		});
		return [];
	}

	if (!isTranslatableSourceText(text)) {
		return [];
	}

	const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, sourceArgument.getStart(sourceFile));
	return [
		{
			kind: "text",
			start: sourceArgument.getStart(sourceFile),
			end: sourceArgument.getEnd(),
			text: text,
			context: `imperative.${helperName}.${line + 1}.${character + 1}`,
			sourceKind: "imperative",
		},
	];
}

function createOccurrence(target: ExtractionTarget, match: MatchDefinition): SourceOccurrence {
	const sourceText = target.kind === "html" ? target.html : target.source;
	const reference = createSourceReference(target.file, sourceText, match.start, match.end, match.attribute);
	const output = createRuntimeOutputReference(getOutputBundle(target), createRuntimeOutputKey(target, match));
	const anchor = `webviews.${getOutputBundle(target)}.${output.key}`;
	const slot = match.attribute == null ? "text" : match.attribute;
	const pattern = parseMessagePattern(match.text);
	const authorityId = createAuthorityId(pattern);

	return {
		id: createOccurrenceId("webviews", anchor, slot),
		domain: "webviews",
		scope: target.kind === "html" ? `webviews.${target.shell}.shell` : `webviews.${target.bundle}.runtime`,
		anchor: anchor,
		slot: slot,
		authorityId: authorityId,
		pattern: pattern,
		reference: reference,
		output: output,
	};
}

function createRuntimeOutputKey(target: ExtractionTarget, match: MatchDefinition): string {
	const bundle = getOutputBundle(target);
	const digestSource = `${target.kind}:${bundle}:${match.sourceKind}:${match.kind}:${match.context}:${match.attribute ?? "text"}:${match.text}`;
	const suffix = shortHash(digestSource);
	const context = sanitizeKeySegment(match.context).replaceAll(".", "-");
	const attribute = match.attribute == null ? "text" : sanitizeKeySegment(match.attribute);
	return `${bundle}.${context}.${attribute}.${suffix}`;
}

function getOutputBundle(target: ExtractionTarget): string {
	return target.kind === "html" ? target.shell : target.bundle;
}

function createRuntimeOutputReference(bundle: string, key: string): OutputReference {
	return {
		kind: "runtime-key",
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
	const start = offsetToLineColumn(source, startOffset);
	const end = offsetToLineColumn(source, Math.max(startOffset, endOffset));

	return {
		kind: "source",
		file: file,
		syntax: file.endsWith(".html") ? "html" : file.endsWith(".tsx") || file.endsWith(".jsx") ? "tsx" : "ts",
		start: start,
		end: end,
		attribute: attribute,
	};
}

function createDeferredIssue(
	target: RuntimeSourceTarget,
	reference: SourceReference,
	reason: string,
	context: string,
): CatalogIssue {
	return {
		reference: reference,
		output: createRuntimeOutputReference(
			target.bundle,
			`deferred.${sanitizeKeySegment(context).replaceAll(".", "-")}`,
		),
		reason: reason,
	};
}

function offsetToLineColumn(text: string, offset: number): { readonly line: number; readonly column: number } {
	let line = 1;
	let column = 1;
	for (let index = 0; index < offset; index++) {
		if (text[index] === "\n") {
			line++;
			column = 1;
		} else {
			column++;
		}
	}

	return { line: line, column: column };
}

/** 从 HTML 文档中提取可翻译文本与属性范围, 同时跳过受保护的结构子树. */
export function extractHtmlMatches(html: string): MatchDefinition[] {
	const matches: MatchDefinition[] = [];
	const root = parseHtmlDocument(html);

	if (shouldExtractRootContent(root)) {
		const pattern = collectElementContentPattern(root);
		if (pattern != null && !isPureStructuralTemplateText(pattern.text.trim())) {
			matches.push({
				kind: "text",
				start: root.openTagEnd,
				end: root.closeTagStart,
				text: pattern.text,
				context: root.path,
				sourceKind: "html",
			});
		}
	}

	visitHtmlElements(root, (element) => {
		if (isInSkippedSubtree(element)) return;

		addAttributeMatches(matches, html, element);
		if (!shouldExtractElementContent(element)) return;

		const pattern = collectElementContentPattern(element);
		if (pattern == null) return;
		if (isPureStructuralTemplateText(pattern.text.trim())) return;

		matches.push({
			kind: "text",
			start: element.openTagEnd,
			end: element.closeTagStart,
			text: pattern.text,
			context: element.path,
			sourceKind: "html",
		});
	});

	return matches;
}

function extractJsxTextMatch(node: ts.JsxText, sourceFile: ts.SourceFile): MatchDefinition | undefined {
	const text = normalizeJsxText(node.getText(sourceFile));
	if (!isTranslatableSourceText(text)) return undefined;

	const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
	return {
		kind: "text",
		start: node.getStart(sourceFile),
		end: node.getEnd(),
		text: text,
		context: `jsx.text.${line + 1}.${character + 1}`,
		sourceKind: "imperative",
	};
}

function extractJsxAttributeMatch(node: ts.JsxAttribute, sourceFile: ts.SourceFile): MatchDefinition | undefined {
	const attribute = getJsxAttributeName(node.name);
	if (attribute == null) return undefined;
	if (!isTranslatableAttribute(attribute, getJsxElementTagName(node))) return undefined;

	const initializer = node.initializer;
	if (initializer == null) return undefined;

	const text = getJsxAttributeStaticStringValue(initializer);
	if (text == null || !isTranslatableSourceText(text)) return undefined;

	const start = initializer.getStart(sourceFile);
	const end = initializer.getEnd();
	const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, start);
	return {
		kind: "attribute",
		start: start,
		end: end,
		text: text,
		attribute: attribute,
		context: `jsx.attribute-${attribute}.${line + 1}.${character + 1}`,
		sourceKind: "imperative",
	};
}
function extractImperativePropertyMatches(
	target: RuntimeSourceTarget,
	node: ts.PropertyAssignment,
	sourceFile: ts.SourceFile,
): MatchDefinition[] {
	const propertyName = getPropertyName(node.name);
	if (propertyName == null || !translatablePropertyAssignmentNames.has(propertyName)) return [];

	const text = getStaticStringValue(node.initializer);
	if (text == null || !isTranslatableSourceText(text)) return [];

	const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.initializer.getStart(sourceFile));
	return [
		{
			kind: "text",
			start: node.initializer.getStart(sourceFile),
			end: node.initializer.getEnd(),
			text: text,
			context: `imperative.property-${propertyName}.${line + 1}.${character + 1}`,
			sourceKind: "imperative",
		},
	];
}

function extractImperativePropertyDeclarationMatches(
	target: RuntimeSourceTarget,
	node: ts.PropertyDeclaration,
	sourceFile: ts.SourceFile,
): MatchDefinition[] {
	const propertyName = getPropertyName(node.name);
	if (propertyName == null || !translatablePropertyDeclarationNames.has(propertyName)) return [];

	const initializer = node.initializer;
	if (initializer == null) return [];

	const text = getStaticStringValue(initializer);
	if (text == null || !isTranslatableSourceText(text)) return [];

	const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, initializer.getStart(sourceFile));
	return [
		{
			kind: "text",
			start: initializer.getStart(sourceFile),
			end: initializer.getEnd(),
			text: text,
			context: `imperative.property-${propertyName}.${line + 1}.${character + 1}`,
			sourceKind: "imperative",
		},
	];
}

function addAttributeMatches(matches: MatchDefinition[], html: string, element: HtmlElementNode): void {
	const rawTag = html.slice(element.start, element.openTagEnd);
	for (const [attribute, value] of Object.entries(element.attributes)) {
		if (!isTranslatableAttribute(attribute, element.tag)) continue;
		if (!isTranslatableLiteralText(value)) continue;

		const valueRange = findAttributeValueRange(rawTag, attribute);
		if (valueRange == null) continue;

		matches.push({
			kind: "attribute",
			start: element.start + valueRange.start,
			end: element.start + valueRange.end,
			text: value,
			attribute: attribute,
			context: `${element.path}@${attribute}`,
			sourceKind: "html",
		});
	}
}

function isInSkippedSubtree(element: HtmlElementNode): boolean {
	let current: HtmlElementNode | undefined = element;
	while (current != null) {
		if (shouldSkipLocalizationSubtree(current)) return true;
		current = current.parent;
	}

	const classList = getClassList(element);
	return classList.includes("section__preview");
}

function buildSyntheticLitHtml(template: ts.TemplateLiteral): string {
	return buildSyntheticHtmlTemplateFragment(template).html;
}

function extractImperativeDisplayMatch(
	target: RuntimeSourceTarget,
	node: ts.StringLiteralLike | ts.TemplateExpression,
	sourceFile: ts.SourceFile,
): MatchDefinition | undefined {
	if (!shouldExtractImperativeDisplayNode(node, sourceFile)) return undefined;

	const source = getImperativeDisplaySource(node, sourceFile);
	if (
		source == null ||
		!isTranslatableSourceText(source.text) ||
		!looksLikeImperativeDisplayText(source.text, node)
	) {
		return undefined;
	}

	const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
	return {
		kind: "text",
		start: node.getStart(sourceFile),
		end: node.getEnd(),
		text: source.text,
		context: `imperative.display.${line + 1}.${character + 1}`,
		sourceKind: "imperative",
	};
}

function getImperativeDisplaySource(
	node: ts.StringLiteralLike | ts.TemplateExpression,
	sourceFile: ts.SourceFile,
): { readonly text: string } | undefined {
	if (ts.isTemplateExpression(node)) {
		return {
			text: buildSyntheticTextTemplateFragment(node, sourceFile).text,
		};
	}

	return {
		text: node.text,
	};
}

function shouldExtractImperativeDisplayNode(
	node: ts.StringLiteralLike | ts.TemplateExpression,
	sourceFile: ts.SourceFile,
): boolean {
	if (ts.isTaggedTemplateExpression(node.parent) && node.parent.template === node) return false;
	if (ts.isJsxAttribute(node.parent)) return false;
	if (ts.isJsxExpression(node.parent) && ts.isJsxAttribute(node.parent.parent)) return false;
	if (ts.isPropertyAssignment(node.parent)) {
		const propertyName = getPropertyName(node.parent.name);
		if (propertyName != null && translatablePropertyAssignmentNames.has(propertyName)) return false;
	}
	if (ts.isCallExpression(node.parent)) {
		const helperName = getCallIdentifier(node.parent.expression);
		if (helperName != null && localizationHelperNames.has(helperName)) return false;
	}

	const templateContext = containingLitTemplateExpressionDisplayContext(node);
	if (templateContext === false) return false;

	return (
		hasHtmlTemplateAncestor(node, sourceFile) ||
		hasRenderedJsxExpressionAncestor(node) ||
		hasImperativeDisplayContextAncestor(node, sourceFile)
	);
}

function containingLitTemplateExpressionDisplayContext(node: ts.Node): boolean | undefined {
	for (let child: ts.Node = node, current = node.parent; current != null; child = current, current = current.parent) {
		if (ts.isTemplateSpan(current) && current.expression === child) {
			return templateSpanDisplayContext(current);
		}
		if (ts.isSourceFile(current)) break;
	}

	return undefined;
}

function looksLikeImperativeDisplayText(text: string, node: ts.StringLiteralLike | ts.TemplateExpression): boolean {
	const trimmed = text.trim();
	if (trimmed.length === 0) return false;
	if (isPureStructuralTemplateText(trimmed)) return false;
	if (/^\[[A-Z][A-Z0-9_-]*\]\s/u.test(trimmed)) return false;
	if (/^@[\w-]+\s+can only be used on\b/u.test(trimmed)) return false;
	if (/\b(?:var|color-mix|rgba?|hsla?)\(/iu.test(trimmed)) return false;
	if (/^[.#]?[a-z][\w-]*(?:--[\w-]+)+(?:\s+[.#]?[a-z][\w-]*(?:--[\w-]+)+)*$/u.test(trimmed)) return false;
	if (/[<>=]/u.test(text) && /\b(?:class|role|aria-|tabindex|href|slot|style|content)\b/u.test(text)) return false;
	if (/^(?:[.#]?[a-z][\w-]*)(?:\s+[.#]?[a-z][\w-]*)+$/u.test(trimmed)) return false;
	if (isFileCountUnitConditionalBranch(node)) return true;
	if (/^[a-z0-9_.:/-]+$/u.test(trimmed)) return false;
	if (/^[A-Z][A-Z0-9._-]*$/u.test(trimmed)) return false;
	if (/^[A-Z][a-z]+[A-Z][A-Za-z]*$/u.test(text)) return false;
	if (/^[A-Z][a-z]+ing(?:[.!?…]+)?$/u.test(trimmed)) return true;
	if (/\s/u.test(text)) return true;
	if (/^[A-Z][a-z]+(?:\s|$)/u.test(text)) return true;
	if (isImperativeDisplayPropertyValue(node.parent)) return true;

	return false;
}

function isFileCountUnitConditionalBranch(node: ts.StringLiteralLike | ts.TemplateExpression): boolean {
	if (!ts.isStringLiteralLike(node)) return false;
	if (node.text !== "file" && node.text !== "files") return false;

	const conditional = node.parent;
	if (!ts.isConditionalExpression(conditional)) return false;

	const whenTrue = getStaticStringValue(conditional.whenTrue);
	const whenFalse = getStaticStringValue(conditional.whenFalse);
	if (whenTrue !== "file" || whenFalse !== "files") return false;

	return expressionFlowsToLitText(conditional);
}

function expressionFlowsToLitText(expression: ts.Expression): boolean {
	let current: ts.Node = expression;
	let parent = expression.parent;

	while (parent != null) {
		if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent)) {
			current = parent;
			parent = parent.parent;
			continue;
		}

		if (ts.isTemplateSpan(parent) && parent.expression === current) {
			return templateSpanDisplayContext(parent) === true;
		}

		if (ts.isConditionalExpression(parent) && (parent.whenTrue === current || parent.whenFalse === current)) {
			current = parent;
			parent = parent.parent;
			continue;
		}

		return false;
	}

	return false;
}

function isPureStructuralTemplateText(text: string): boolean {
	const withoutSlots = text.replace(/\$\{slot\d+\}/gu, "");
	if (!/\$\{slot\d+\}/u.test(text)) return false;
	if (withoutSlots.length === 0) return true;
	if (/^[\s\p{P}\p{S}]+$/u.test(withoutSlots)) return true;

	const words = [...withoutSlots.matchAll(/\p{L}+/gu)].map((match) => match[0].toLowerCase());
	if (words.length === 0) return false;
	if (words.every((word) => structuralGlueWords.has(word))) {
		const withoutGlueWords = withoutSlots.replace(/\p{L}+/gu, "");
		return /^[\s\p{P}\p{S}]*$/u.test(withoutGlueWords);
	}

	return false;
}

const structuralGlueWords = new Set([
	"a",
	"an",
	"and",
	"are",
	"at",
	"be",
	"been",
	"being",
	"by",
	"for",
	"from",
	"had",
	"has",
	"have",
	"in",
	"is",
	"more",
	"need",
	"needs",
	"of",
	"on",
	"or",
	"other",
	"require",
	"requires",
	"the",
	"to",
	"was",
	"were",
	"with",
]);

function scanDeferredJsxNodes(target: RuntimeSourceTarget, sourceFile: ts.SourceFile, issues: CatalogIssue[]): void {
	const visit = (node: ts.Node): void => {
		if (ts.isJsxText(node)) {
			const text = normalizeJsxText(node.getText(sourceFile));
			if (isTranslatableSourceText(text)) {
				issues.push(
					createDeferredIssue(
						target,
						createSourceReference(target.file, target.source, node.getStart(sourceFile), node.getEnd()),
						`deferred ${target.bundle}: unsupported JSX text`,
						`jsx.text.${positionContext(sourceFile, node.getStart(sourceFile))}`,
					),
				);
			}
		}

		if (ts.isJsxAttribute(node)) {
			const attribute = getJsxAttributeName(node.name);
			if (attribute == null || !isTranslatableAttribute(attribute, getJsxElementTagName(node))) {
				ts.forEachChild(node, visit);
				return;
			}

			const initializer = node.initializer;
			if (initializer == null) {
				ts.forEachChild(node, visit);
				return;
			}

			const text = getJsxAttributeStaticStringValue(initializer);
			if (text != null && isTranslatableSourceText(text)) {
				const start = initializer.getStart(sourceFile);
				const end = initializer.getEnd();
				issues.push(
					createDeferredIssue(
						target,
						createSourceReference(target.file, target.source, start, end, attribute),
						`deferred ${target.bundle}: unsupported JSX attribute "${attribute}"`,
						`jsx.attribute-${attribute}.${positionContext(sourceFile, start)}`,
					),
				);
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
}

function isTranslatableAttribute(attribute: string, tag?: string): boolean {
	if (translatableAttributes.has(attribute)) return true;

	const normalizedTag = tag?.toLowerCase();
	if (normalizedTag == null) return false;
	return translatableAttributesByTag.get(normalizedTag)?.has(attribute) ?? false;
}

function getJsxElementTagName(node: ts.JsxAttribute): string | undefined {
	const parent = node.parent;
	if (!ts.isJsxAttributes(parent)) return undefined;

	const element = parent.parent;
	if (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)) {
		return element.tagName.getText().toLowerCase();
	}

	return undefined;
}

function getJsxAttributeName(name: ts.JsxAttributeName): string | undefined {
	if (ts.isIdentifier(name)) return name.text;

	return undefined;
}

function getCallIdentifier(expression: ts.LeftHandSideExpression): string | undefined {
	if (ts.isIdentifier(expression)) {
		return expression.text;
	}

	return undefined;
}

function isLitTemplateTag(tag: ts.LeftHandSideExpression): boolean {
	const identifier = getCallIdentifier(tag);
	return identifier != null && litTemplateTagNames.has(identifier);
}

function getStaticStringValue(node: ts.Expression): string | undefined {
	if (ts.isStringLiteralLike(node)) {
		return node.text;
	}

	if (ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}

	return undefined;
}

function getJsxAttributeStaticStringValue(initializer: ts.JsxAttributeValue): string | undefined {
	if (ts.isStringLiteral(initializer)) {
		return initializer.text;
	}

	if (!ts.isJsxExpression(initializer) || initializer.expression == null) {
		return undefined;
	}

	return getStaticStringValue(initializer.expression);
}

function getPropertyName(name: ts.PropertyName): string | undefined {
	if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
		return name.text;
	}

	return undefined;
}

function isTranslatableSourceText(text: string): boolean {
	const patternText = parseMessagePattern(text).text;
	return patternText.length !== 0 && !isDateFormatTokenText(patternText) && /[\p{L}\p{N}]/u.test(text);
}

function normalizeJsxText(text: string): string {
	return text.replace(/\s+/gu, " ").trim();
}

function positionContext(sourceFile: ts.SourceFile, position: number): string {
	const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, position);
	return `${line + 1}.${character + 1}`;
}

function getScriptKind(syntax: RuntimeSourceTarget["syntax"]): ts.ScriptKind {
	switch (syntax) {
		case "tsx":
			return ts.ScriptKind.TSX;
		case "jsx":
			return ts.ScriptKind.JSX;
		default:
			return ts.ScriptKind.TS;
	}
}
