import * as ts from "typescript";

import type { MessagePattern } from "../../core/model.mts";

import {
	collectElementContentPattern,
	getContentRangeKey,
	parseHtmlDocument,
	shouldExtractRootContent,
	visitHtmlElements,
	type HtmlElementNode,
	type HtmlNode,
} from "./html.mts";
import type { WebviewLocalizationPlan } from "./sourcePlan.mts";
import { buildSyntheticHtmlTemplateFragment, buildSyntheticTextTemplateFragment } from "./template.mts";

interface GeneratedLocalizedHtmlFragment {
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
	readonly resolved: MessagePattern;
}

export function applyWebviewTranslations(
	plan: WebviewLocalizationPlan,
	translations: ReadonlyMap<string, MessagePattern>,
): GeneratedWebviewLocalizedSourceFile {
	const sourceFile = ts.createSourceFile(
		plan.file,
		plan.source,
		ts.ScriptTarget.Latest,
		true,
		getScriptKindFromFilePath(plan.file),
	);
	const templates = new Map<string, ts.TemplateLiteral>();
	const templateExpressions = new Map<string, ts.TemplateExpression>();
	const visit = (node: ts.Node): void => {
		if (ts.isTaggedTemplateExpression(node)) {
			templates.set(`${node.template.getStart(sourceFile)}:${node.template.getEnd()}`, node.template);
		}
		if (ts.isTemplateExpression(node)) {
			templateExpressions.set(`${node.getStart(sourceFile)}:${node.getEnd()}`, node);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);

	const sourceReplacements: Array<{ readonly start: number; readonly end: number; readonly value: string }> = [];
	let translatedCount = 0;
	let unresolvedCount = 0;
	for (const site of plan.sites) {
		if (site.replacement.kind !== "source") continue;
		const resolved = translations.get(site.id);
		if (resolved == null) {
			unresolvedCount++;
			continue;
		}

		let value: string;
		switch (site.replacement.format) {
			case "string-literal":
			case "jsx-attribute":
				value = JSON.stringify(resolved.text);
				break;
			case "template-expression": {
				const template = templateExpressions.get(`${site.replacement.start}:${site.replacement.end}`);
				if (template == null) {
					unresolvedCount++;
					continue;
				}
				const fragment = buildSyntheticTextTemplateFragment(template, sourceFile);
				value = `\`${renderLocalizedPlainTemplateLiteralContent(resolved.text, fragment.expressions)}\``;
				break;
			}
			case "jsx-text":
				value = renderLocalizedJsxText(resolved.text);
				break;
		}
		sourceReplacements.push({ start: site.replacement.start, end: site.replacement.end, value: value });
		translatedCount++;
	}

	const sitesByTemplate = new Map<string, typeof plan.sites>();
	for (const site of plan.sites) {
		if (site.replacement.kind !== "lit-template") continue;
		const key = `${site.replacement.start}:${site.replacement.end}`;
		const existing = sitesByTemplate.get(key);
		sitesByTemplate.set(key, existing == null ? [site] : [...existing, site]);
	}

	const replacements = [...sourceReplacements];
	const templateReplacements: Array<{ readonly start: number; readonly end: number; readonly value: string }> = [];
	const templateGroups = [...sitesByTemplate.entries()].sort((left, right) => {
		const [leftStart, leftEnd] = left[0].split(":").map(Number);
		const [rightStart, rightEnd] = right[0].split(":").map(Number);
		return leftEnd - leftStart - (rightEnd - rightStart);
	});
	for (const [key, sites] of templateGroups) {
		const template = templates.get(key);
		if (template == null) {
			unresolvedCount += sites.length;
			continue;
		}

		const fragment = buildSyntheticHtmlTemplateFragment(
			template,
			sourceFile,
			(expression) =>
				`\${${getNodeTextWithNestedReplacements(expression, sourceFile, [
					...sourceReplacements,
					...templateReplacements,
				])}}`,
		);
		const resolvedOccurrences: ResolvedHtmlOccurrence[] = [];
		for (const site of sites) {
			const resolved = translations.get(site.id);
			if (resolved == null) {
				unresolvedCount++;
				continue;
			}
			if (site.replacement.kind !== "lit-template") continue;
			resolvedOccurrences.push({
				start: site.replacement.innerStart,
				end: site.replacement.innerEnd,
				attribute: site.replacement.attribute,
				resolved: resolved,
			});
		}
		if (resolvedOccurrences.length === 0) continue;

		const localized = localizeHtmlFragment(fragment.html, resolvedOccurrences);
		const replacement = {
			start: template.getStart(sourceFile),
			end: template.getEnd(),
			value: `\`${renderLocalizedTemplateLiteralContent(localized.localizedHtml, fragment.expressions)}\``,
		};
		templateReplacements.push(replacement);
		replacements.push(replacement);
		translatedCount += localized.translatedCount;
		unresolvedCount += localized.unresolvedCount;
	}

	return {
		contents: applyReplacements(plan.source, filterNestedReplacements(replacements)),
		translatedCount: translatedCount,
		unresolvedCount: unresolvedCount,
	};
}

function localizeHtmlFragment(
	englishHtml: string,
	occurrences: readonly ResolvedHtmlOccurrence[],
	unresolvedCount = 0,
): GeneratedLocalizedHtmlFragment {
	const root = parseHtmlDocument(englishHtml);
	const elements: HtmlElementNode[] = [];
	const contentNodes = new Map<string, HtmlElementNode>();
	if (shouldExtractRootContent(root)) {
		contentNodes.set(getContentRangeKey(root.openTagEnd, root.closeTagStart), root);
	}
	visitHtmlElements(root, (element) => {
		elements.push(element);
		contentNodes.set(getContentRangeKey(element.openTagEnd, element.closeTagStart), element);
	});

	const contentOccurrences = new Map<string, ResolvedHtmlOccurrence>();
	const attributeOccurrencesByElementStart = new Map<number, ResolvedHtmlOccurrence[]>();
	let translatedCount = 0;
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
		(occurrence) =>
			![...contentOccurrences.values()].some(
				(other) =>
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
			if (isWithinAnyRange(resolvedOccurrence.start, resolvedOccurrence.end, topLevelContentOccurrences))
				continue;
			replacements.push({
				start: resolvedOccurrence.start,
				end: resolvedOccurrence.end,
				value: escapeHtmlAttribute(resolvedOccurrence.resolved.text),
			});
		}
	}

	return {
		localizedHtml: applyReplacements(englishHtml, replacements),
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
	if (node.kind === "text") return englishHtml.slice(node.start, node.end);
	const cacheKey = `${node.start}:${node.end}`;
	const cached = cache.get(cacheKey);
	if (cached != null) return cached;

	let openTag = englishHtml.slice(node.start, node.openTagEnd);
	const attributeOccurrences = attributeOccurrencesByElementStart.get(node.start) ?? [];
	if (attributeOccurrences.length !== 0) {
		openTag = applyReplacements(
			openTag,
			attributeOccurrences.map((occurrence) => ({
				start: occurrence.start - node.start,
				end: occurrence.end - node.start,
				value: escapeHtmlAttribute(occurrence.resolved.text),
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
		.map((child) =>
			renderNodeHtml(child, englishHtml, contentOccurrences, attributeOccurrencesByElementStart, cache),
		)
		.join("");
}

function renderPatternContent(
	element: HtmlElementNode,
	resolved: MessagePattern,
	englishHtml: string,
	contentOccurrences: ReadonlyMap<string, ResolvedHtmlOccurrence>,
	attributeOccurrencesByElementStart: ReadonlyMap<number, readonly ResolvedHtmlOccurrence[]>,
	cache: Map<string, string>,
): string {
	switch (resolved.kind) {
		case "template": {
			const pattern = collectElementContentPattern(element);
			if (pattern == null) return escapeHtmlText(resolved.text);
			const slotHtml = new Map(
				pattern.slots.map((slot) => [
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
			return renderLocalizedPattern(resolved.text, slotHtml);
		}
		case "literal":
		case "rich":
			return renderLocalizedPattern(resolved.text, new Map<string, string>());
	}
}

function renderLocalizedPattern(text: string, slotHtml: ReadonlyMap<string, string>): string {
	const segments: string[] = [];
	let lastIndex = 0;
	for (const match of text.matchAll(/\$\{([^}]+)\}/gu)) {
		const [placeholder, slotName] = match;
		const matchIndex = match.index ?? 0;
		const literal = text.slice(lastIndex, matchIndex);
		if (literal.length !== 0) segments.push(escapeHtmlText(literal));
		segments.push(slotHtml.get(slotName) ?? placeholder);
		lastIndex = matchIndex + placeholder.length;
	}
	const tail = text.slice(lastIndex);
	if (tail.length !== 0) segments.push(escapeHtmlText(tail));
	return segments.join("");
}

function findOwningElement(
	elements: readonly HtmlElementNode[],
	start: number,
	end: number,
): HtmlElementNode | undefined {
	return elements.find((element) => element.start <= start && element.openTagEnd >= end);
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

function isWithinAnyRange(
	start: number,
	end: number,
	ranges: ReadonlyArray<{ readonly start: number; readonly end: number }>,
): boolean {
	return ranges.some((range) => range.start <= start && range.end >= end);
}

function escapeHtmlText(text: string): string {
	const preservedEntities: string[] = [];
	const protectedText = text.replace(/&(?:#(?:x[a-fA-F0-9]+|\d+)|[a-zA-Z][a-zA-Z0-9]+);/gu, (entity) => {
		preservedEntities.push(entity);
		return `__GL_I18N_ENTITY_${preservedEntities.length - 1}__`;
	});
	return protectedText
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replace(/__GL_I18N_ENTITY_(\d+)__/gu, (_, index: string) => preservedEntities[Number(index)] ?? "");
}

function escapeHtmlAttribute(text: string): string {
	return escapeHtmlText(text).replaceAll('"', "&quot;");
}

function getNodeTextWithNestedReplacements(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	replacements: ReadonlyArray<{ readonly start: number; readonly end: number; readonly value: string }>,
): string {
	const start = node.getStart(sourceFile);
	const end = node.getEnd();
	const nested = filterNestedReplacements(
		replacements.filter((replacement) => replacement.start >= start && replacement.end <= end),
	);
	if (nested.length === 0) return sourceFile.text.slice(start, end);
	return applyReplacements(
		sourceFile.text.slice(start, end),
		nested.map((replacement) => ({
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
		(replacement) =>
			!replacements.some(
				(other) =>
					other !== replacement &&
					other.start <= replacement.start &&
					other.end >= replacement.end &&
					(other.start !== replacement.start || other.end !== replacement.end),
			),
	);
}

function renderLocalizedTemplateLiteralContent(
	localizedHtml: string,
	expressions: ReadonlyMap<string, string>,
): string {
	const placeholder = /<gl-i18n-slot data-slot="(slot\d+)"><\/gl-i18n-slot>|__GL_I18N_SLOT_(slot\d+)__/gu;
	let result = "";
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
	let result = "";
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
	return text.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
}

function renderLocalizedJsxText(text: string): string {
	return /[{}<>]/u.test(text) ? `{${JSON.stringify(text)}}` : text;
}

function getScriptKindFromFilePath(filePath: string): ts.ScriptKind {
	if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
	if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
	if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
	return ts.ScriptKind.JS;
}
