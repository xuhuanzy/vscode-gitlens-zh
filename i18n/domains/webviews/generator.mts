import * as ts from 'typescript';

import type { AuthorityBundle, SourceOccurrence } from '../../core/model.mts';
import { resolveOccurrenceTranslation, type ResolvedTranslation } from '../../core/authority.mts';

import {
	collectElementContentPattern,
	getContentRangeKey,
	parseHtmlDocument,
	shouldExtractRootContent,
	visitHtmlElements,
	type HtmlElementNode,
	type HtmlNode,
} from './html.mts';
import { extractHtmlMatches } from './extractor.mts';
import {
	buildSyntheticHtmlTemplateFragment,
	buildSyntheticTextTemplateFragment,
	getSyntheticHtmlTemplateSlotContext,
} from './template.mts';

export interface GeneratedWebviewShellOutputs {
	readonly localizedHtml: string;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
}

export interface GeneratedWebviewLocalizedSourceFile {
	readonly contents: string;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
}

interface ResolvedHtmlOccurrence {
	readonly start: number;
	readonly end: number;
	readonly attribute?: string;
	readonly resolved: ResolvedTranslation;
}

const translatableJsxAttributeNames = new Set([
	'title',
	'aria-label',
	'placeholder',
	'tooltip',
	'label',
	'alt-label',
	'banner-title',
	'primary-button',
	'secondary-button',
]);
const translatableAttributesByTag = new Map([['gl-tooltip', new Set(['content'])]]);

export function generateLocalizedSettingsShell(
	englishHtml: string,
	occurrences: readonly SourceOccurrence[],
	bundle: AuthorityBundle,
): GeneratedWebviewShellOutputs {
	const resolvedOccurrences: ResolvedHtmlOccurrence[] = [];
	let unresolvedCount = 0;

	for (const occurrence of occurrences) {
		if (occurrence.reference.kind !== 'source') continue;
		if (occurrence.output?.kind !== 'runtime-key' || occurrence.output.bundle !== 'settings') continue;

		const resolved = resolveOccurrenceTranslation(occurrence, bundle);
		if (resolved == null) {
			unresolvedCount++;
			continue;
		}

		resolvedOccurrences.push({
			start: lineColumnToOffset(englishHtml, occurrence.reference.start.line, occurrence.reference.start.column),
			end: lineColumnToOffset(englishHtml, occurrence.reference.end.line, occurrence.reference.end.column),
			attribute: occurrence.reference.attribute,
			resolved: resolved,
		});
	}

	return localizeHtmlFragment(englishHtml, resolvedOccurrences, {
		htmlLang: 'zh-CN',
		unresolvedCount: unresolvedCount,
	});
}

export function generateLocalizedSourceFile(
	sourceText: string,
	sourceFilePath: string,
	bundleName: string,
	occurrences: readonly SourceOccurrence[],
	bundle: AuthorityBundle,
): GeneratedWebviewLocalizedSourceFile {
	const relevantOccurrences = occurrences.filter(
		occurrence =>
			occurrence.output?.kind === 'runtime-key' &&
			occurrence.output.bundle === bundleName &&
			occurrence.reference.kind === 'source' &&
			occurrence.reference.file === sourceFilePath,
	);
	const availableSourceTexts = new Set(relevantOccurrences.map(occurrence => occurrence.sourceText));
	const resolvedBySourceText = new Map<string, ResolvedTranslation>();

	for (const occurrence of relevantOccurrences) {
		const resolved = resolveOccurrenceTranslation(occurrence, bundle);
		if (resolved == null || resolvedBySourceText.has(occurrence.sourceText)) continue;

		resolvedBySourceText.set(occurrence.sourceText, resolved);
	}

	const sourceFile = ts.createSourceFile(
		sourceFilePath,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		getScriptKindFromFilePath(sourceFilePath),
	);
	const replacements: Array<{ readonly start: number; readonly end: number; readonly value: string }> = [];
	let translatedCount = 0;
	let unresolvedCount = 0;

	const visit = (node: ts.Node): void => {
		ts.forEachChild(node, visit);

		if (ts.isTaggedTemplateExpression(node) && isHtmlTemplateTag(node.tag, sourceFile)) {
			const localized = localizeRuntimeTemplate(
				node.template,
				sourceFile,
				availableSourceTexts,
				resolvedBySourceText,
				replacements,
			);
			translatedCount += localized.translatedCount;
			unresolvedCount += localized.unresolvedCount;

			if (localized.value != null) {
				replacements.push({
					start: node.template.getStart(sourceFile),
					end: node.template.getEnd(),
					value: localized.value,
				});
			}
		}

		if (ts.isJsxText(node)) {
			const localized = localizeJsxTextNode(node, sourceFile, availableSourceTexts, resolvedBySourceText);
			translatedCount += localized.translatedCount;
			unresolvedCount += localized.unresolvedCount;

			if (localized.value != null) {
				replacements.push({
					start: node.getStart(sourceFile),
					end: node.getEnd(),
					value: localized.value,
				});
			}
		}

		if (ts.isJsxAttribute(node)) {
			const localized = localizeJsxAttribute(node, sourceFile, availableSourceTexts, resolvedBySourceText);
			translatedCount += localized.translatedCount;
			unresolvedCount += localized.unresolvedCount;

			if (localized.value != null && node.initializer != null) {
				replacements.push({
					start: node.initializer.getStart(sourceFile),
					end: node.initializer.getEnd(),
					value: localized.value,
				});
			}
		}

		if (ts.isPropertyAssignment(node)) {
			const localized = localizeImperativePropertyAssignment(
				node,
				sourceFile,
				availableSourceTexts,
				resolvedBySourceText,
			);
			translatedCount += localized.translatedCount;
			unresolvedCount += localized.unresolvedCount;

			if (localized.value != null) {
				replacements.push({
					start: node.initializer.getStart(sourceFile),
					end: node.initializer.getEnd(),
					value: localized.value,
				});
			}
		}

		if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
			const localized = localizeImperativeDisplayNode(
				node,
				sourceFile,
				availableSourceTexts,
				resolvedBySourceText,
				replacements,
			);
			translatedCount += localized.translatedCount;
			unresolvedCount += localized.unresolvedCount;

			if (localized.value != null) {
				replacements.push({
					start: node.getStart(sourceFile),
					end: node.getEnd(),
					value: localized.value,
				});
			}
		}
	};

	visit(sourceFile);
	const effectiveReplacements = filterNestedReplacements(replacements);

	return {
		contents: repairTemplateArgumentSeparators(applyReplacements(sourceText, effectiveReplacements)),
		translatedCount: translatedCount,
		unresolvedCount: unresolvedCount,
	};
}

function localizeHtmlFragment(
	englishHtml: string,
	occurrences: readonly ResolvedHtmlOccurrence[],
	options?: {
		readonly htmlLang?: string;
		readonly unresolvedCount?: number;
	},
): GeneratedWebviewShellOutputs {
	const root = parseHtmlDocument(englishHtml);
	const elements: HtmlElementNode[] = [];
	const contentNodes = new Map<string, HtmlElementNode>();
	if (shouldExtractRootContent(root)) {
		contentNodes.set(getContentRangeKey(root.openTagEnd, root.closeTagStart), root);
	}
	visitHtmlElements(root, element => {
		elements.push(element);
		contentNodes.set(getContentRangeKey(element.openTagEnd, element.closeTagStart), element);
	});

	const contentOccurrences = new Map<string, ResolvedHtmlOccurrence>();
	const attributeOccurrencesByElementStart = new Map<number, ResolvedHtmlOccurrence[]>();
	let translatedCount = 0;
	let unresolvedCount = options?.unresolvedCount ?? 0;

	for (const occurrence of occurrences) {
		if (occurrence.attribute == null) {
			const key = getContentRangeKey(occurrence.start, occurrence.end);
			if (!contentNodes.has(key)) {
				unresolvedCount++;
				continue;
			}

			contentOccurrences.set(key, occurrence);
			translatedCount++;
			continue;
		}

		const owner = findOwningElement(elements, occurrence.start, occurrence.end);
		if (owner == null) {
			unresolvedCount++;
			continue;
		}

		const existing = attributeOccurrencesByElementStart.get(owner.start);
		if (existing == null) {
			attributeOccurrencesByElementStart.set(owner.start, [occurrence]);
		} else {
			existing.push(occurrence);
		}
		translatedCount++;
	}

	const renderCache = new Map<string, string>();
	const replacements: Array<{ readonly start: number; readonly end: number; readonly value: string }> = [];
	const topLevelContentOccurrences = [...contentOccurrences.values()].filter(
		occurrence =>
			![...contentOccurrences.values()].some(
				other =>
					other !== occurrence &&
					other.start <= occurrence.start &&
					other.end >= occurrence.end &&
					(other.start !== occurrence.start || other.end !== occurrence.end),
			),
	);

	for (const resolvedOccurrence of topLevelContentOccurrences) {
		const node = contentNodes.get(getContentRangeKey(resolvedOccurrence.start, resolvedOccurrence.end));
		if (node == null) continue;
		replacements.push({
			start: resolvedOccurrence.start,
			end: resolvedOccurrence.end,
			value: renderPatternContent(
				node,
				resolvedOccurrence.resolved,
				englishHtml,
				contentOccurrences,
				attributeOccurrencesByElementStart,
				renderCache,
			),
		});
	}

	for (const attributeOccurrences of attributeOccurrencesByElementStart.values()) {
		for (const resolvedOccurrence of attributeOccurrences) {
			if (isWithinAnyRange(resolvedOccurrence.start, resolvedOccurrence.end, topLevelContentOccurrences)) {
				continue;
			}

			replacements.push({
				start: resolvedOccurrence.start,
				end: resolvedOccurrence.end,
				value: escapeHtmlAttribute(resolvedOccurrence.resolved.pattern.text),
			});
		}
	}

	let localizedHtml = applyReplacements(englishHtml, replacements);
	if (options?.htmlLang != null) {
		localizedHtml = localizedHtml.replace(
			/<html\b([^>]*)\blang="en"([^>]*)>/u,
			`<html$1lang="${options.htmlLang}"$2>`,
		);
	}

	return {
		localizedHtml: localizedHtml,
		translatedCount: translatedCount,
		unresolvedCount: unresolvedCount,
	};
}

function renderNodeHtml(
	node: HtmlNode,
	englishHtml: string,
	contentOccurrences: ReadonlyMap<string, ResolvedHtmlOccurrence>,
	attributeOccurrencesByElementStart: ReadonlyMap<number, readonly ResolvedHtmlOccurrence[]>,
	cache: Map<string, string>,
): string {
	if (node.kind === 'text') {
		return englishHtml.slice(node.start, node.end);
	}

	const cacheKey = `${node.start}:${node.end}`;
	const cached = cache.get(cacheKey);
	if (cached != null) return cached;

	let openTag = englishHtml.slice(node.start, node.openTagEnd);
	const attributeOccurrences = attributeOccurrencesByElementStart.get(node.start) ?? [];
	if (attributeOccurrences.length !== 0) {
		openTag = applyReplacements(
			openTag,
			attributeOccurrences.map(occurrence => ({
				start: occurrence.start - node.start,
				end: occurrence.end - node.start,
				value: escapeHtmlAttribute(occurrence.resolved.pattern.text),
			})),
		);
	}

	if (node.end === node.openTagEnd) {
		cache.set(cacheKey, openTag);
		return openTag;
	}

	const rendered = `${openTag}${renderElementInnerHtml(
		node,
		englishHtml,
		contentOccurrences,
		attributeOccurrencesByElementStart,
		cache,
	)}${englishHtml.slice(node.closeTagStart, node.end)}`;
	cache.set(cacheKey, rendered);
	return rendered;
}

function renderElementInnerHtml(
	element: HtmlElementNode,
	englishHtml: string,
	contentOccurrences: ReadonlyMap<string, ResolvedHtmlOccurrence>,
	attributeOccurrencesByElementStart: ReadonlyMap<number, readonly ResolvedHtmlOccurrence[]>,
	cache: Map<string, string>,
): string {
	const contentOccurrence = contentOccurrences.get(getContentRangeKey(element.openTagEnd, element.closeTagStart));
	if (contentOccurrence != null) {
		return renderPatternContent(
			element,
			contentOccurrence.resolved,
			englishHtml,
			contentOccurrences,
			attributeOccurrencesByElementStart,
			cache,
		);
	}

	return element.children
		.map(child => renderNodeHtml(child, englishHtml, contentOccurrences, attributeOccurrencesByElementStart, cache))
		.join('');
}

function renderPatternContent(
	element: HtmlElementNode,
	resolved: ResolvedTranslation,
	englishHtml: string,
	contentOccurrences: ReadonlyMap<string, ResolvedHtmlOccurrence>,
	attributeOccurrencesByElementStart: ReadonlyMap<number, readonly ResolvedHtmlOccurrence[]>,
	cache: Map<string, string>,
): string {
	switch (resolved.pattern.kind) {
		case 'template': {
			const pattern = collectElementContentPattern(element);
			if (pattern == null) {
				return escapeHtmlText(resolved.pattern.text);
			}

			const slotHtml = new Map(
				pattern.slots.map(slot => [
					slot.name,
					renderNodeHtml(
						slot.node,
						englishHtml,
						contentOccurrences,
						attributeOccurrencesByElementStart,
						cache,
					),
				]),
			);
			const preserveHtml = pattern.preserves.map(preserve => ({
				gapIndex: preserve.gapIndex,
				html: renderNodeHtml(
					preserve.node,
					englishHtml,
					contentOccurrences,
					attributeOccurrencesByElementStart,
					cache,
				),
			}));
			return renderLocalizedPattern(resolved.pattern.text, slotHtml, preserveHtml);
		}
		case 'literal':
		case 'rich':
		case 'plural':
		case 'select':
			return renderLocalizedPattern(
				resolved.pattern.text,
				new Map<string, string>(),
				(collectElementContentPattern(element)?.preserves ?? []).map(preserve => ({
					gapIndex: preserve.gapIndex,
					html: renderNodeHtml(
						preserve.node,
						englishHtml,
						contentOccurrences,
						attributeOccurrencesByElementStart,
						cache,
					),
				})),
			);
	}
}

function renderLocalizedPattern(
	text: string,
	slotHtml: ReadonlyMap<string, string>,
	preserveHtml: ReadonlyArray<{ readonly gapIndex: number; readonly html: string }>,
): string {
	const segments: string[] = [];
	let lastIndex = 0;
	for (const match of text.matchAll(/\$\{([^}]+)\}/gu)) {
		const [placeholder, slotName] = match;
		const matchIndex = match.index ?? 0;
		const literal = text.slice(lastIndex, matchIndex);
		if (literal.length !== 0) {
			segments.push(escapeHtmlText(literal));
		}
		segments.push(slotHtml.get(slotName) ?? placeholder);
		lastIndex = matchIndex + placeholder.length;
	}

	const tail = text.slice(lastIndex);
	if (tail.length !== 0) {
		segments.push(escapeHtmlText(tail));
	}

	return mergePreservedHtml(segments, preserveHtml);
}

function mergePreservedHtml(
	segments: readonly string[],
	preserveHtml: ReadonlyArray<{ readonly gapIndex: number; readonly html: string }>,
): string {
	if (segments.length === 0 && preserveHtml.length === 0) return '';

	const byGap = new Map<number, string[]>();
	for (const preserve of preserveHtml) {
		const entries = byGap.get(preserve.gapIndex);
		if (entries == null) {
			byGap.set(preserve.gapIndex, [preserve.html]);
		} else {
			entries.push(preserve.html);
		}
	}

	let result = (byGap.get(0) ?? []).join('');
	for (let index = 0; index < segments.length; index++) {
		result += segments[index];
		result += (byGap.get(index + 1) ?? []).join('');
	}

	for (const [gapIndex, html] of byGap) {
		if (gapIndex <= segments.length) continue;
		result += html.join('');
	}

	return result;
}

function findOwningElement(
	elements: readonly HtmlElementNode[],
	start: number,
	end: number,
): HtmlElementNode | undefined {
	return elements.find(element => element.start <= start && element.openTagEnd >= end);
}

function applyReplacements(
	source: string,
	replacements: ReadonlyArray<{ readonly start: number; readonly end: number; readonly value: string }>,
): string {
	let result = source;
	for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
		result = `${result.slice(0, replacement.start)}${replacement.value}${result.slice(replacement.end)}`;
	}
	return result;
}

function repairTemplateArgumentSeparators(source: string): string {
	// Localized template-expression replacements can occasionally swallow the original comma that
	// separates the next literal argument in bundled JS callsites.
	return source.replace(/(`(?:\\.|[^`\n])*`)(\s+)(["'])/gu, '$1,$2$3');
}

function isWithinAnyRange(
	start: number,
	end: number,
	ranges: ReadonlyArray<{ readonly start: number; readonly end: number }>,
): boolean {
	return ranges.some(range => range.start <= start && range.end >= end);
}

function escapeHtmlText(text: string): string {
	const preservedEntities: string[] = [];
	const protectedText = text.replace(/&(?:#(?:x[a-fA-F0-9]+|\d+)|[a-zA-Z][a-zA-Z0-9]+);/gu, entity => {
		preservedEntities.push(entity);
		return `__GL_I18N_ENTITY_${preservedEntities.length - 1}__`;
	});

	return protectedText
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replace(/__GL_I18N_ENTITY_(\d+)__/gu, (_, index: string) => preservedEntities[Number(index)] ?? '');
}

function escapeHtmlAttribute(text: string): string {
	return escapeHtmlText(text).replaceAll('"', '&quot;');
}

function lineColumnToOffset(text: string, line: number, column: number): number {
	let currentLine = 1;
	let currentColumn = 1;
	for (let index = 0; index < text.length; index++) {
		if (currentLine === line && currentColumn === column) {
			return index;
		}

		if (text[index] === '\n') {
			currentLine++;
			currentColumn = 1;
		} else {
			currentColumn++;
		}
	}

	return text.length;
}

function localizeRuntimeTemplate(
	template: ts.TemplateLiteral,
	sourceFile: ts.SourceFile,
	availableSourceTexts: ReadonlySet<string>,
	resolvedBySourceText: ReadonlyMap<string, ResolvedTranslation>,
	existingReplacements: ReadonlyArray<{ readonly start: number; readonly end: number; readonly value: string }>,
): { readonly value?: string; readonly translatedCount: number; readonly unresolvedCount: number } {
	const fragment = buildSyntheticHtmlTemplateFragment(
		template,
		sourceFile,
		expression => `\${${getNodeTextWithNestedReplacements(expression, sourceFile, existingReplacements)}}`,
	);
	if (!hasLocalizableLiteralHtml(fragment.html)) {
		return {
			translatedCount: 0,
			unresolvedCount: 0,
		};
	}
	const resolvedOccurrences: ResolvedHtmlOccurrence[] = [];
	let unresolvedCount = 0;

	for (const match of extractHtmlMatches(fragment.html)) {
		if (shouldPreserveEnglishSourceText(sourceFile.fileName, match.text)) continue;
		if (!availableSourceTexts.has(match.text)) continue;

		const resolved = resolvedBySourceText.get(match.text);
		if (resolved == null) {
			unresolvedCount++;
			continue;
		}

		resolvedOccurrences.push({
			start: match.start,
			end: match.end,
			attribute: match.attribute,
			resolved: resolved,
		});
	}

	if (resolvedOccurrences.length === 0) {
		return {
			translatedCount: 0,
			unresolvedCount: unresolvedCount,
		};
	}

	const localized = localizeHtmlFragment(fragment.html, resolvedOccurrences, {
		unresolvedCount: unresolvedCount,
	});
	const value = `\`${renderLocalizedTemplateLiteralContent(localized.localizedHtml, fragment.expressions)}\``;
	const currentValue = getNodeTextWithNestedReplacements(template, sourceFile, existingReplacements);

	return {
		value: value === currentValue ? undefined : value,
		translatedCount: localized.translatedCount,
		unresolvedCount: localized.unresolvedCount,
	};
}

function hasLocalizableLiteralHtml(html: string): boolean {
	const stripped = html
		.replace(/<gl-i18n-slot data-slot="slot\d+"><\/gl-i18n-slot>/gu, '')
		.replace(/__GL_I18N_SLOT_slot\d+__/gu, '')
		.trim();

	return /[\p{L}\p{N}]/u.test(stripped);
}

function getNodeTextWithNestedReplacements(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	replacements: ReadonlyArray<{ readonly start: number; readonly end: number; readonly value: string }>,
): string {
	const start = node.getStart(sourceFile);
	const end = node.getEnd();
	const nested = filterNestedReplacements(
		replacements.filter(replacement => replacement.start >= start && replacement.end <= end),
	);
	if (nested.length === 0) {
		return sourceFile.text.slice(start, end);
	}

	return applyReplacements(
		sourceFile.text.slice(start, end),
		nested.map(replacement => ({
			start: replacement.start - start,
			end: replacement.end - start,
			value: replacement.value,
		})),
	);
}

function filterNestedReplacements(
	replacements: ReadonlyArray<{ readonly start: number; readonly end: number; readonly value: string }>,
): Array<{ readonly start: number; readonly end: number; readonly value: string }> {
	return replacements.filter(
		replacement =>
			!replacements.some(
				other =>
					other !== replacement &&
					other.start <= replacement.start &&
					other.end >= replacement.end &&
					(other.start !== replacement.start || other.end !== replacement.end),
			),
	);
}

function localizeImperativePropertyAssignment(
	node: ts.PropertyAssignment,
	sourceFile: ts.SourceFile,
	availableSourceTexts: ReadonlySet<string>,
	resolvedBySourceText: ReadonlyMap<string, ResolvedTranslation>,
): { readonly value?: string; readonly translatedCount: number; readonly unresolvedCount: number } {
	const propertyName = getPropertyName(node.name);
	if (propertyName !== 'title') {
		return {
			translatedCount: 0,
			unresolvedCount: 0,
		};
	}

	const text = getStaticStringValue(node.initializer);
	if (text == null || !availableSourceTexts.has(text)) {
		return {
			translatedCount: 0,
			unresolvedCount: 0,
		};
	}

	const resolved = resolvedBySourceText.get(text);
	if (resolved == null) {
		return {
			translatedCount: 0,
			unresolvedCount: 1,
		};
	}

	const value = JSON.stringify(resolved.pattern.text);
	const currentValue = sourceFile.text.slice(node.initializer.getStart(sourceFile), node.initializer.getEnd());

	return {
		value: value === currentValue ? undefined : value,
		translatedCount: 1,
		unresolvedCount: 0,
	};
}

function localizeImperativeDisplayNode(
	node: ts.StringLiteralLike | ts.TemplateExpression,
	sourceFile: ts.SourceFile,
	availableSourceTexts: ReadonlySet<string>,
	resolvedBySourceText: ReadonlyMap<string, ResolvedTranslation>,
	existingReplacements: ReadonlyArray<{ readonly start: number; readonly end: number; readonly value: string }>,
): { readonly value?: string; readonly translatedCount: number; readonly unresolvedCount: number } {
	if (!shouldLocalizeImperativeDisplayNode(node, sourceFile)) {
		return {
			translatedCount: 0,
			unresolvedCount: 0,
		};
	}

	const source = getImperativeDisplaySource(node, sourceFile, existingReplacements);
	if (
		source == null ||
		shouldPreserveEnglishSourceText(sourceFile.fileName, source.text) ||
		!availableSourceTexts.has(source.text)
	) {
		return {
			translatedCount: 0,
			unresolvedCount: 0,
		};
	}

	const resolved = resolvedBySourceText.get(source.text);
	if (resolved == null) {
		return {
			translatedCount: 0,
			unresolvedCount: 1,
		};
	}

	if (!shouldApplyImperativeDisplayTranslation(node, resolved)) {
		return {
			translatedCount: 0,
			unresolvedCount: 0,
		};
	}

	const value = renderLocalizedImperativeDisplayValue(node, resolved.pattern.text, source.expressions);
	const currentValue = getNodeTextWithNestedReplacements(node, sourceFile, existingReplacements);

	return {
		value: value === currentValue ? undefined : value,
		translatedCount: 1,
		unresolvedCount: 0,
	};
}

function localizeJsxTextNode(
	node: ts.JsxText,
	sourceFile: ts.SourceFile,
	availableSourceTexts: ReadonlySet<string>,
	resolvedBySourceText: ReadonlyMap<string, ResolvedTranslation>,
): { readonly value?: string; readonly translatedCount: number; readonly unresolvedCount: number } {
	const text = normalizeJsxText(node.getText(sourceFile));
	if (!availableSourceTexts.has(text)) {
		return {
			translatedCount: 0,
			unresolvedCount: 0,
		};
	}

	const resolved = resolvedBySourceText.get(text);
	if (resolved == null) {
		return {
			translatedCount: 0,
			unresolvedCount: 1,
		};
	}

	const value = renderLocalizedJsxText(resolved.pattern.text);
	const currentValue = sourceFile.text.slice(node.getStart(sourceFile), node.getEnd());

	return {
		value: value === currentValue ? undefined : value,
		translatedCount: 1,
		unresolvedCount: 0,
	};
}

function localizeJsxAttribute(
	node: ts.JsxAttribute,
	sourceFile: ts.SourceFile,
	availableSourceTexts: ReadonlySet<string>,
	resolvedBySourceText: ReadonlyMap<string, ResolvedTranslation>,
): { readonly value?: string; readonly translatedCount: number; readonly unresolvedCount: number } {
	const attributeName = getJsxAttributeName(node.name);
	if (attributeName == null || !isTranslatableAttribute(attributeName, getJsxElementTagName(node))) {
		return {
			translatedCount: 0,
			unresolvedCount: 0,
		};
	}

	if (node.initializer == null) {
		return {
			translatedCount: 0,
			unresolvedCount: 0,
		};
	}

	const text = getStaticJsxAttributeValue(node.initializer);
	if (text == null || !availableSourceTexts.has(text)) {
		return {
			translatedCount: 0,
			unresolvedCount: 0,
		};
	}

	const resolved = resolvedBySourceText.get(text);
	if (resolved == null) {
		return {
			translatedCount: 0,
			unresolvedCount: 1,
		};
	}

	const value = renderLocalizedJsxAttributeValue(node.initializer, resolved.pattern.text);
	const currentValue = sourceFile.text.slice(node.initializer.getStart(sourceFile), node.initializer.getEnd());

	return {
		value: value === currentValue ? undefined : value,
		translatedCount: 1,
		unresolvedCount: 0,
	};
}

function shouldLocalizeImperativeDisplayNode(
	node: ts.StringLiteralLike | ts.TemplateExpression,
	sourceFile: ts.SourceFile,
): boolean {
	if (ts.isTaggedTemplateExpression(node.parent) && node.parent.template === node) return false;
	if (ts.isJsxAttribute(node.parent)) return false;
	if (ts.isJsxExpression(node.parent) && ts.isJsxAttribute(node.parent.parent)) return false;
	if (ts.isPropertyAssignment(node.parent)) {
		const propertyName = getPropertyName(node.parent.name);
		if (propertyName != null && propertyName === 'title') return false;
	}

	return (
		hasHtmlTemplateAncestor(node, sourceFile) ||
		hasRenderedJsxExpressionAncestor(node) ||
		hasImperativeDisplayContextAncestor(node, sourceFile)
	);
}

function getImperativeDisplaySource(
	node: ts.StringLiteralLike | ts.TemplateExpression,
	sourceFile: ts.SourceFile,
	existingReplacements: ReadonlyArray<{ readonly start: number; readonly end: number; readonly value: string }>,
): { readonly text: string; readonly expressions: ReadonlyMap<string, string> } | undefined {
	if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return buildSyntheticTextTemplateFragment(
			node,
			sourceFile,
			expression => `\${${getNodeTextWithNestedReplacements(expression, sourceFile, existingReplacements)}}`,
		);
	}

	return {
		text: node.text,
		expressions: new Map<string, string>(),
	};
}

function renderLocalizedImperativeDisplayValue(
	node: ts.StringLiteralLike | ts.TemplateExpression,
	text: string,
	expressions: ReadonlyMap<string, string>,
): string {
	if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return `\`${renderLocalizedPlainTemplateLiteralContent(text, expressions)}\``;
	}

	return JSON.stringify(text);
}

function shouldApplyImperativeDisplayTranslation(
	node: ts.StringLiteralLike | ts.TemplateExpression,
	resolved: ResolvedTranslation,
): boolean {
	if (!ts.isTemplateExpression(node) && !ts.isNoSubstitutionTemplateLiteral(node)) {
		return true;
	}

	return resolved.pattern.kind === 'template';
}

function shouldPreserveEnglishSourceText(sourceFilePath: string, text: string): boolean {
	const normalizedPath = sourceFilePath.replaceAll('\\', '/');
	if (!normalizedPath.endsWith('src/webviews/apps/shared/components/search/search-box.ts')) {
		return false;
	}

	return text === 'No' || text === '${slot1} of ${slot2} ${slot3}';
}

function renderLocalizedTemplateLiteralContent(
	localizedHtml: string,
	expressions: ReadonlyMap<string, string>,
): string {
	const placeholder = /<gl-i18n-slot data-slot="(slot\d+)"><\/gl-i18n-slot>|__GL_I18N_SLOT_(slot\d+)__/gu;
	let result = '';
	let lastIndex = 0;

	for (const match of localizedHtml.matchAll(placeholder)) {
		const [raw, elementSlotName, attributeSlotName] = match;
		const slotName = elementSlotName ?? attributeSlotName;
		const index = match.index ?? 0;
		result += escapeTemplateLiteralText(localizedHtml.slice(lastIndex, index));
		result += expressions.get(slotName) ?? escapeTemplateLiteralText(raw);
		lastIndex = index + raw.length;
	}

	result += escapeTemplateLiteralText(localizedHtml.slice(lastIndex));
	return result;
}

function renderLocalizedPlainTemplateLiteralContent(text: string, expressions: ReadonlyMap<string, string>): string {
	let result = '';
	let lastIndex = 0;
	for (const match of text.matchAll(/\$\{([^}]+)\}/gu)) {
		const [placeholder, slotName] = match;
		const index = match.index ?? 0;
		result += escapeTemplateLiteralText(text.slice(lastIndex, index));
		result += expressions.get(slotName) ?? escapeTemplateLiteralText(placeholder);
		lastIndex = index + placeholder.length;
	}

	result += escapeTemplateLiteralText(text.slice(lastIndex));
	return result;
}

function escapeTemplateLiteralText(text: string): string {
	return text.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
}

function renderLocalizedJsxText(text: string): string {
	if (/[{}<>]/u.test(text)) {
		return `{${JSON.stringify(text)}}`;
	}

	return text;
}

function renderLocalizedJsxAttributeValue(initializer: ts.JsxAttributeValue, text: string): string {
	if (ts.isStringLiteral(initializer)) {
		return JSON.stringify(text);
	}

	return `{${JSON.stringify(text)}}`;
}

function isHtmlTemplateTag(tag: ts.LeftHandSideExpression, sourceFile: ts.SourceFile): boolean {
	return /\bhtml\b/u.test(tag.getText(sourceFile));
}

function hasHtmlTemplateAncestor(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	for (let current = node.parent; current != null; current = current.parent) {
		if (ts.isTaggedTemplateExpression(current) && isHtmlTemplateTag(current.tag, sourceFile)) {
			return true;
		}
		if (ts.isSourceFile(current)) break;
	}

	return false;
}

function hasRenderedJsxExpressionAncestor(node: ts.Node): boolean {
	for (let current = node.parent; current != null; current = current.parent) {
		if (ts.isJsxAttribute(current)) return false;
		if (ts.isJsxExpression(current)) {
			return !ts.isJsxAttribute(current.parent);
		}
		if (ts.isSourceFile(current)) break;
	}

	return false;
}

function isImperativeDisplayPropertyValue(parent: ts.Node | undefined): boolean {
	if (parent == null || !ts.isPropertyAssignment(parent)) return false;

	const propertyName = getPropertyName(parent.name);
	return (
		propertyName === 'label' || propertyName === 'message' || propertyName === 'title' || propertyName === 'tooltip'
	);
}

function hasImperativeDisplayContextAncestor(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	const withinDisplayProducer = hasDisplayProducingAncestor(node, sourceFile);

	for (let child: ts.Node = node, current = node.parent; current != null; child = current, current = current.parent) {
		if (isImperativeDisplayPropertyValue(current)) return true;
		if (ts.isVariableDeclaration(current) && current.initializer === child) {
			return variableDeclarationFlowsToDisplay(current, sourceFile);
		}
		if (ts.isReturnStatement(current) && current.expression === child) {
			return returnStatementFlowsToNamedDisplayProducer(current);
		}
		if (withinDisplayProducer) {
			if (isImperativeDisplayCallArgument(current, child)) return true;
			if (isImperativeDisplayAssignment(current, child)) return true;
		}
		if (ts.isSourceFile(current)) break;
	}

	return false;
}

function returnStatementFlowsToNamedDisplayProducer(node: ts.ReturnStatement): boolean {
	for (let current = node.parent; current != null; current = current.parent) {
		if (isFunctionLike(current)) {
			const name = getFunctionLikeName(current);
			return name != null && looksLikeTextReturnProducerName(name);
		}
		if (ts.isSourceFile(current)) break;
	}

	return false;
}

function hasDisplayProducingAncestor(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	for (let current = node.parent; current != null; current = current.parent) {
		if (isFunctionLike(current) && functionProducesDisplay(current, sourceFile)) {
			return true;
		}
		if (ts.isSourceFile(current)) break;
	}

	return false;
}

function functionProducesDisplay(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	const name = getFunctionLikeName(node);
	if (name != null && looksLikeDisplayProducerName(name)) {
		return true;
	}

	const body = getFunctionLikeBody(node);
	return body != null && bodyContainsHtmlTemplate(body, sourceFile);
}

function looksLikeDisplayProducerName(name: string): boolean {
	return /(label|message|placeholder|render|text|title|tooltip)/iu.test(name);
}

function looksLikeTextReturnProducerName(name: string): boolean {
	return /(label|message|placeholder|text|title|tooltip)/iu.test(name);
}

function bodyContainsHtmlTemplate(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	let found = false;
	const visit = (child: ts.Node): void => {
		if (found) return;
		if (ts.isTaggedTemplateExpression(child) && isHtmlTemplateTag(child.tag, sourceFile)) {
			found = true;
			return;
		}

		ts.forEachChild(child, visit);
	};

	visit(node);
	return found;
}

function isImperativeDisplayCallArgument(current: ts.Node, child: ts.Node): boolean {
	if (!ts.isCallExpression(current)) return false;

	const expression = current.expression;
	if (ts.isPropertyAccessExpression(expression)) {
		const method = expression.name.text;
		return (
			(method === 'setAttribute' || method === 'toggleAttribute') &&
			current.arguments[1] === child &&
			getStaticStringValue(current.arguments[0] as ts.Expression) != null
		);
	}

	return false;
}

function isImperativeDisplayAssignment(current: ts.Node, child: ts.Node): boolean {
	return (
		ts.isBinaryExpression(current) &&
		current.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
		current.right === child &&
		isDisplayAssignmentTarget(current.left)
	);
}

function isDisplayAssignmentTarget(node: ts.Node): boolean {
	if (ts.isIdentifier(node)) {
		return looksLikeDisplayAssignmentTargetName(node.text);
	}

	if (ts.isPropertyAccessExpression(node)) {
		return looksLikeDisplayAssignmentTargetName(node.name.text);
	}

	return false;
}

function looksLikeDisplayAssignmentTargetName(name: string): boolean {
	return /^(?:label|message|title|tooltip|placeholder|ariaLabel)$/iu.test(name);
}

function variableDeclarationFlowsToDisplay(node: ts.VariableDeclaration, sourceFile: ts.SourceFile): boolean {
	if (!ts.isIdentifier(node.name)) return false;
	if (node.initializer == null) return false;

	const scopeRoot = getVariableUsageScope(node);
	if (scopeRoot == null) return false;

	const usageContexts = collectVariableUsageDisplayContexts(node.name.text, scopeRoot, sourceFile, node.end);
	if (usageContexts.length === 0) return false;

	return usageContexts.every(context => context.kind === 'display');
}

function collectVariableUsageDisplayContexts(
	name: string,
	scopeRoot: ts.Node,
	sourceFile: ts.SourceFile,
	declarationEnd: number,
): Array<{ readonly kind: 'display' | 'non-display'; readonly node: ts.Identifier }> {
	const usages: Array<{ readonly kind: 'display' | 'non-display'; readonly node: ts.Identifier }> = [];

	const visit = (node: ts.Node): void => {
		if (node.getEnd() <= declarationEnd) return;
		if (ts.isIdentifier(node) && node.text === name && isVariableUsageIdentifier(node)) {
			usages.push({
				kind: identifierFlowsToDisplay(node) ? 'display' : 'non-display',
				node: node,
			});
		}

		ts.forEachChild(node, visit);
	};

	ts.forEachChild(scopeRoot, visit);
	void sourceFile;
	return usages;
}

function getVariableUsageScope(node: ts.VariableDeclaration): ts.Node | undefined {
	for (let current: ts.Node | undefined = node.parent; current != null; current = current.parent) {
		if (
			ts.isBlock(current) ||
			ts.isCaseClause(current) ||
			ts.isCatchClause(current) ||
			ts.isDefaultClause(current) ||
			ts.isForInStatement(current) ||
			ts.isForOfStatement(current) ||
			ts.isForStatement(current) ||
			ts.isModuleBlock(current) ||
			ts.isSourceFile(current)
		) {
			return current;
		}
	}

	return undefined;
}

function isVariableUsageIdentifier(node: ts.Identifier): boolean {
	const parent = node.parent;
	if (parent == null) return false;
	if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
	if (ts.isParameter(parent) && parent.name === node) return false;
	if (
		ts.isBinaryExpression(parent) &&
		parent.left === node &&
		parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
	) {
		return false;
	}
	if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
	if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
	if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) return false;
	if (ts.isBindingElement(parent) && parent.name === node) return false;
	if (ts.isImportClause(parent) || ts.isImportSpecifier(parent) || ts.isNamespaceImport(parent)) return false;
	if (ts.isExportSpecifier(parent)) return false;

	return true;
}

function identifierFlowsToDisplay(node: ts.Identifier): boolean {
	let current: ts.Node = node;
	let parent = node.parent;

	while (parent != null) {
		if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent)) {
			current = parent;
			parent = parent.parent;
			continue;
		}

		if (ts.isPropertyAccessExpression(parent) && parent.expression === current) {
			return false;
		}

		if (ts.isCallExpression(parent) && parent.expression === current) {
			return false;
		}

		if (ts.isTaggedTemplateExpression(parent) && parent.tag === current) {
			return false;
		}

		if (ts.isTemplateSpan(parent) && parent.expression === current) {
			const templateContext = templateSpanDisplayContext(parent, node.getSourceFile());
			if (templateContext != null) return templateContext;

			current = parent.parent;
			parent = current.parent;
			continue;
		}

		if (ts.isReturnStatement(parent) && parent.expression === current) {
			return returnStatementFlowsToNamedDisplayProducer(parent);
		}

		if (ts.isJsxExpression(parent) && parent.expression === current) {
			return jsxExpressionDisplayContext(parent);
		}

		if (ts.isJsxAttribute(parent)) {
			const attributeName = getJsxAttributeName(parent.name);
			return attributeName != null && isTranslatableAttribute(attributeName, getJsxElementTagName(parent));
		}

		if (
			ts.isBinaryExpression(parent) &&
			parent.right === current &&
			parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
		) {
			return isDisplayAssignmentTarget(parent.left);
		}

		if (ts.isPropertyAssignment(parent) && parent.initializer === current) {
			return isImperativeDisplayPropertyValue(parent);
		}

		if (ts.isConditionalExpression(parent)) {
			if (parent.whenTrue === current || parent.whenFalse === current) {
				current = parent;
				parent = parent.parent;
				continue;
			}

			return false;
		}

		if (
			ts.isBinaryExpression(parent) &&
			(parent.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
				parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
				parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
		) {
			current = parent;
			parent = parent.parent;
			continue;
		}

		return false;
	}

	return false;
}

function templateSpanDisplayContext(span: ts.TemplateSpan, sourceFile: ts.SourceFile): boolean | undefined {
	const template = span.parent;
	const templateParent = template.parent;
	if (!ts.isTaggedTemplateExpression(templateParent) || templateParent.template !== template) {
		return undefined;
	}

	if (!isHtmlTemplateTag(templateParent.tag, sourceFile) || !ts.isTemplateExpression(template)) {
		return false;
	}

	const slotIndex = template.templateSpans.indexOf(span);
	if (slotIndex === -1) return false;

	const slotContext = getSyntheticHtmlTemplateSlotContext(template, slotIndex);
	if (slotContext == null) return false;
	if (slotContext.kind === 'text') return true;

	return slotContext.attribute != null && isTranslatableAttribute(slotContext.attribute, slotContext.tag);
}

function jsxExpressionDisplayContext(node: ts.JsxExpression): boolean {
	const parent = node.parent;
	if (ts.isJsxAttribute(parent)) {
		const attributeName = getJsxAttributeName(parent.name);
		return attributeName != null && isTranslatableAttribute(attributeName, getJsxElementTagName(parent));
	}

	return !ts.isJsxAttribute(parent);
}

function isFunctionLike(node: ts.Node): boolean {
	return (
		ts.isArrowFunction(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isMethodDeclaration(node)
	);
}

function getFunctionLikeBody(node: ts.Node): ts.ConciseBody | undefined {
	if (
		ts.isArrowFunction(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isMethodDeclaration(node)
	) {
		return node.body;
	}

	return undefined;
}

function getFunctionLikeName(node: ts.Node): string | undefined {
	if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) {
		return node.name?.getText();
	}

	if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.parent != null) {
		if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
			return node.parent.name.text;
		}

		if (ts.isPropertyAssignment(node.parent)) {
			return getPropertyName(node.parent.name);
		}
	}

	return undefined;
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

function getStaticJsxAttributeValue(initializer: ts.JsxAttributeValue): string | undefined {
	if (ts.isStringLiteral(initializer)) {
		return initializer.text;
	}

	if (!ts.isJsxExpression(initializer) || initializer.expression == null) {
		return undefined;
	}

	return getStaticStringValue(initializer.expression);
}

function isTranslatableAttribute(attribute: string, tag?: string): boolean {
	if (translatableJsxAttributeNames.has(attribute)) return true;

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

function normalizeJsxText(text: string): string {
	return text.replace(/\s+/gu, ' ').trim();
}

function getScriptKindFromFilePath(filePath: string): ts.ScriptKind {
	if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
	if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
	if (filePath.endsWith('.ts')) return ts.ScriptKind.TS;
	return ts.ScriptKind.JS;
}

function getPropertyName(name: ts.PropertyName): string | undefined {
	if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
		return name.text;
	}

	return undefined;
}
