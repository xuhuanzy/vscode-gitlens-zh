import type { AuthorityBundle, SourceOccurrence } from '../../core/model.mts';
import { resolveOccurrenceTranslation, type ResolvedTranslation } from '../../core/authority.mts';

import {
	collectElementContentPattern,
	getContentRangeKey,
	parseHtmlDocument,
	visitHtmlElements,
	type HtmlElementNode,
	type HtmlNode,
} from './html.mts';

export interface GeneratedWebviewShellOutputs {
	readonly localizedHtml: string;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
}

interface ResolvedOccurrence {
	readonly occurrence: SourceOccurrence;
	readonly start: number;
	readonly end: number;
	readonly resolved: ResolvedTranslation;
}

export function generateLocalizedSettingsShell(
	englishHtml: string,
	occurrences: readonly SourceOccurrence[],
	bundle: AuthorityBundle,
): GeneratedWebviewShellOutputs {
	const root = parseHtmlDocument(englishHtml);
	const elements: HtmlElementNode[] = [];
	const contentNodes = new Map<string, HtmlElementNode>();
	visitHtmlElements(root, element => {
		elements.push(element);
		contentNodes.set(getContentRangeKey(element.openTagEnd, element.closeTagStart), element);
	});

	const contentOccurrences = new Map<string, ResolvedOccurrence>();
	const attributeOccurrencesByElementStart = new Map<number, ResolvedOccurrence[]>();
	let translatedCount = 0;
	let unresolvedCount = 0;

	for (const occurrence of occurrences) {
		if (occurrence.reference.kind !== 'source') continue;
		if (occurrence.output?.kind !== 'runtime-key' || occurrence.output.bundle !== 'settings') continue;

		const start = lineColumnToOffset(englishHtml, occurrence.reference.start.line, occurrence.reference.start.column);
		const end = lineColumnToOffset(englishHtml, occurrence.reference.end.line, occurrence.reference.end.column);
		const resolved = resolveOccurrenceTranslation(occurrence, bundle);
		if (resolved == null) {
			unresolvedCount++;
			continue;
		}

		const candidate: ResolvedOccurrence = {
			occurrence: occurrence,
			start: start,
			end: end,
			resolved: resolved,
		};

		if (occurrence.reference.attribute == null) {
			const key = getContentRangeKey(start, end);
			if (!contentNodes.has(key)) {
				unresolvedCount++;
				continue;
			}

			contentOccurrences.set(key, candidate);
			translatedCount++;
			continue;
		}

		const owner = findOwningElement(elements, start, end);
		if (owner == null) {
			unresolvedCount++;
			continue;
		}

		const existing = attributeOccurrencesByElementStart.get(owner.start);
		if (existing == null) {
			attributeOccurrencesByElementStart.set(owner.start, [candidate]);
		} else {
			existing.push(candidate);
		}
		translatedCount++;
	}

	const renderCache = new Map<string, string>();
	const replacements: Array<{ readonly start: number; readonly end: number; readonly value: string }> = [];
	const topLevelContentOccurrences = [...contentOccurrences.values()].filter(occurrence =>
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
			value: renderPatternContent(node, resolvedOccurrence.resolved, englishHtml, contentOccurrences, attributeOccurrencesByElementStart, renderCache),
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

	const localizedHtml = applyReplacements(englishHtml, replacements).replace(
		/<html\b([^>]*)\blang="en"([^>]*)>/u,
		'<html$1lang="zh-CN"$2>',
	);

	return {
		localizedHtml: localizedHtml,
		translatedCount: translatedCount,
		unresolvedCount: unresolvedCount,
	};
}

function renderNodeHtml(
	node: HtmlNode,
	englishHtml: string,
	contentOccurrences: ReadonlyMap<string, ResolvedOccurrence>,
	attributeOccurrencesByElementStart: ReadonlyMap<number, readonly ResolvedOccurrence[]>,
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
	contentOccurrences: ReadonlyMap<string, ResolvedOccurrence>,
	attributeOccurrencesByElementStart: ReadonlyMap<number, readonly ResolvedOccurrence[]>,
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
	contentOccurrences: ReadonlyMap<string, ResolvedOccurrence>,
	attributeOccurrencesByElementStart: ReadonlyMap<number, readonly ResolvedOccurrence[]>,
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
					renderNodeHtml(slot.node, englishHtml, contentOccurrences, attributeOccurrencesByElementStart, cache),
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
	preserveHtml: readonly Array<{ readonly gapIndex: number; readonly html: string }>,
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
	preserveHtml: readonly Array<{ readonly gapIndex: number; readonly html: string }>,
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
	replacements: readonly Array<{ readonly start: number; readonly end: number; readonly value: string }>,
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
	ranges: readonly Array<{ readonly start: number; readonly end: number }>,
): boolean {
	return ranges.some(range => range.start <= start && range.end >= end);
}

function escapeHtmlText(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
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
