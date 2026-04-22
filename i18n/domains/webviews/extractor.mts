import type { CatalogIssue, OutputReference, SourceOccurrence, SourceReference } from '../../core/model.mts';
import {
	createAuthorityId,
	createContentHash,
	createOccurrenceId,
	createPatternFingerprint,
	parseMessagePattern,
	sanitizeKeySegment,
	shortHash,
} from '../../core/model.mts';

import {
	collectElementContentPattern,
	findAttributeValueRange,
	getClassList,
	isTranslatableLiteralText,
	parseHtmlDocument,
	shouldExtractElementContent,
	shouldSkipLocalizationSubtree,
	visitHtmlElements,
	type HtmlElementNode,
} from './html.mts';

export interface WebviewsExtractionResult {
	readonly occurrences: SourceOccurrence[];
	readonly issues: CatalogIssue[];
}

interface ExtractionTarget {
	readonly file: string;
	readonly html: string;
	readonly shell: 'settings';
}

interface MatchDefinition {
	readonly kind: 'text' | 'attribute';
	readonly start: number;
	readonly end: number;
	readonly text: string;
	readonly attribute?: string;
	readonly context: string;
}

const translatableAttributes = new Set(['title', 'aria-label', 'placeholder']);

export function extractSupportedWebviewOccurrences(targets: readonly ExtractionTarget[]): WebviewsExtractionResult {
	const occurrences: SourceOccurrence[] = [];
	const issues: CatalogIssue[] = [];
	const seenIds = new Set<string>();

	for (const target of targets) {
		const matches = extractHtmlMatches(target.html);
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

function createOccurrence(target: ExtractionTarget, match: MatchDefinition): SourceOccurrence {
	const reference = createSourceReference(target.file, target.html, match.start, match.end, match.attribute);
	const key = createRuntimeOutputKey(target, match);
	const output: OutputReference = {
		kind: 'runtime-key',
		bundle: 'settings',
		key: key,
	};
	const anchor = `webviews.settings.${key}`;
	const slot = match.attribute == null ? 'text' : match.attribute;
	const pattern = parseMessagePattern(match.text);
	const authorityId = createAuthorityId(pattern);

	return {
		id: createOccurrenceId('webviews', anchor, slot),
		domain: 'webviews',
		scope: 'webviews.settings.shell',
		anchor: anchor,
		slot: slot,
		authorityId: authorityId,
		pattern: pattern,
		patternFingerprint: createPatternFingerprint(pattern),
		sourceText: match.text,
		sourceHash: createContentHash(match.text),
		reference: reference,
		output: output,
	};
}

function createRuntimeOutputKey(target: ExtractionTarget, match: MatchDefinition): string {
	const digestSource = `${target.shell}:${match.kind}:${match.context}:${match.attribute ?? 'text'}:${match.text}`;
	const suffix = shortHash(digestSource);
	const context = sanitizeKeySegment(match.context).replaceAll('.', '-');
	const attribute = match.attribute == null ? 'text' : sanitizeKeySegment(match.attribute);
	return `${target.shell}.${context}.${attribute}.${suffix}`;
}

function createSourceReference(
	file: string,
	html: string,
	startOffset: number,
	endOffset: number,
	attribute?: string,
): SourceReference {
	const start = offsetToLineColumn(html, startOffset);
	const end = offsetToLineColumn(html, Math.max(startOffset, endOffset));

	return {
		kind: 'source',
		file: file,
		syntax: 'html',
		start: start,
		end: end,
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

function extractHtmlMatches(html: string): MatchDefinition[] {
	const matches: MatchDefinition[] = [];
	const root = parseHtmlDocument(html);

	visitHtmlElements(root, element => {
		if (isInSkippedSubtree(element)) return;

		addAttributeMatches(matches, html, element);
		if (!shouldExtractElementContent(element)) return;

		const pattern = collectElementContentPattern(element);
		if (pattern == null) return;

		matches.push({
			kind: 'text',
			start: element.openTagEnd,
			end: element.closeTagStart,
			text: pattern.text,
			context: element.path,
		});
	});

	return matches;
}

function addAttributeMatches(matches: MatchDefinition[], html: string, element: HtmlElementNode): void {
	const rawTag = html.slice(element.start, element.openTagEnd);
	for (const [attribute, value] of Object.entries(element.attributes)) {
		if (!translatableAttributes.has(attribute)) continue;
		if (!isTranslatableLiteralText(value)) continue;

		const valueRange = findAttributeValueRange(rawTag, attribute);
		if (valueRange == null) continue;

		matches.push({
			kind: 'attribute',
			start: element.start + valueRange.start,
			end: element.start + valueRange.end,
			text: value,
			attribute: attribute,
			context: `${element.path}@${attribute}`,
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
	return classList.includes('section__preview');
}
