import { resolveOccurrenceTranslation, type ResolvedTranslation } from '../../core/authority.mts';
import {
	createAuthorityId,
	outputReferenceId,
	parseMessagePattern,
	type AuthorityBundle,
	type SourceOccurrence,
} from '../../core/model.mts';

import {
	extractRuntimeDynamicMatches,
	type RuntimeDynamicSourceTarget,
	type RuntimeDynamicMatch,
	type RuntimeDynamicSlotExpression,
} from './extractor.mts';

export interface GeneratedRuntimeDynamicSourceFile {
	readonly contents: string;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
}

export function generateLocalizedRuntimeDynamicSourceFile(
	target: RuntimeDynamicSourceTarget,
	occurrences: readonly SourceOccurrence[],
	bundle: AuthorityBundle,
): GeneratedRuntimeDynamicSourceFile {
	const relevantOccurrences = new Map<string, SourceOccurrence>();
	for (const occurrence of occurrences) {
		if (
			occurrence.domain !== target.domain ||
			occurrence.reference.kind !== 'source' ||
			occurrence.reference.file !== target.file ||
			occurrence.output == null
		) {
			continue;
		}

		relevantOccurrences.set(outputReferenceId(occurrence.output), occurrence);
	}

	const replacements: Array<{ readonly start: number; readonly end: number; readonly value: string }> = [];
	let translatedCount = 0;
	let unresolvedCount = 0;

	for (const match of extractRuntimeDynamicMatches(target).matches) {
		const occurrence = occurrences.find(
			item =>
				item.reference.kind === 'source' &&
				item.reference.file === target.file &&
				item.sourceText === match.text &&
				item.slot === match.slot &&
				item.scope === `${target.domain}.${target.group}`,
		);
		if (occurrence?.output == null || !relevantOccurrences.has(outputReferenceId(occurrence.output))) continue;

		const resolved = resolveOccurrenceTranslation(occurrence, bundle);
		if (resolved == null) {
			unresolvedCount++;
			continue;
		}

		replacements.push({
			start: match.start,
			end: match.end,
			value: renderReplacement(match, resolved.pattern.text, bundle),
		});
		translatedCount++;
	}

	return {
		contents: applyReplacements(target.source, replacements),
		translatedCount: translatedCount,
		unresolvedCount: unresolvedCount,
	};
}

function renderReplacement(match: RuntimeDynamicMatch, text: string, bundle: AuthorityBundle): string {
	switch (match.kind) {
		case 'template-expression':
			return renderTemplateExpression(text, match.slotExpressions, bundle);
		case 'markdown-title':
			return renderMarkdownTitleSlot(text, match.slotExpressions, bundle);
		case 'markdown-label':
			return renderMarkdownLabelSlot(text, match.slotExpressions, bundle);
		case 'html-title':
			return escapeHtmlTitleSlot(text, match.quote ?? '"');
		case 'string-literal':
			return `${match.quote ?? "'"}${escapeStringLiteralContent(text, match.quote ?? "'")}${match.quote ?? "'"}`;
	}
}

function renderTemplateExpression(
	text: string,
	slotExpressions: readonly RuntimeDynamicSlotExpression[] | undefined,
	bundle: AuthorityBundle,
): string {
	return `\`${renderTemplateExpressionContent(text, slotExpressions, bundle)}\``;
}

function renderMarkdownTitleSlot(
	text: string,
	slotExpressions: readonly RuntimeDynamicSlotExpression[] | undefined,
	bundle: AuthorityBundle,
): string {
	if (slotExpressions == null || slotExpressions.length === 0) return escapeMarkdownTitleSlot(text);

	const expressions = new Map(
		slotExpressions.map(slot => [slot.name, translateSlotExpression(slot.expression, bundle)]),
	);
	let result = '';
	let lastIndex = 0;
	for (const match of text.matchAll(/\$\{([^}]+)\}/gu)) {
		const [placeholder, slotName] = match;
		const index = match.index ?? 0;
		result += escapeMarkdownTitleSlot(text.slice(lastIndex, index));
		result += expressions.get(slotName) ?? escapeMarkdownTitleSlot(placeholder);
		lastIndex = index + placeholder.length;
	}

	result += escapeMarkdownTitleSlot(text.slice(lastIndex));
	return result;
}

function renderMarkdownLabelSlot(
	text: string,
	slotExpressions: readonly RuntimeDynamicSlotExpression[] | undefined,
	bundle: AuthorityBundle,
): string {
	if (slotExpressions == null || slotExpressions.length === 0) return escapeMarkdownLabelSlot(text);

	const expressions = new Map(
		slotExpressions.map(slot => [slot.name, translateSlotExpression(slot.expression, bundle)]),
	);
	let result = '';
	let lastIndex = 0;
	for (const match of text.matchAll(/\$\{([^}]+)\}/gu)) {
		const [placeholder, slotName] = match;
		const index = match.index ?? 0;
		result += escapeMarkdownLabelSlot(text.slice(lastIndex, index));
		result += expressions.get(slotName) ?? escapeMarkdownLabelSlot(placeholder);
		lastIndex = index + placeholder.length;
	}

	result += escapeMarkdownLabelSlot(text.slice(lastIndex));
	return result;
}

function renderTemplateExpressionContent(
	text: string,
	slotExpressions: readonly RuntimeDynamicSlotExpression[] | undefined,
	bundle: AuthorityBundle,
): string {
	if (slotExpressions == null || slotExpressions.length === 0) return escapeTemplateLiteralContent(text);

	const expressions = new Map(
		slotExpressions.map(slot => [slot.name, translateSlotExpression(slot.expression, bundle)]),
	);
	let result = '';
	let lastIndex = 0;
	for (const match of text.matchAll(/\$\{([^}]+)\}/gu)) {
		const [placeholder, slotName] = match;
		const index = match.index ?? 0;
		result += escapeTemplateLiteralContent(text.slice(lastIndex, index));
		result += expressions.get(slotName) ?? escapeTemplateLiteralContent(placeholder);
		lastIndex = index + placeholder.length;
	}

	result += escapeTemplateLiteralContent(text.slice(lastIndex));
	return result;
}

function translateSlotExpression(expression: string, bundle: AuthorityBundle): string {
	return expression.replace(
		/(['"])((?:\\.|(?!\1)[^\\])*)\1/gu,
		(match, quote: '"' | "'", rawContent: string): string => {
			const text = unescapeStringLiteralContent(rawContent);
			const translation = resolveLiteralTranslation(text, bundle);
			if (translation == null || translation.pattern.kind !== 'literal') return match;

			return `${quote}${escapeStringLiteralContent(translation.pattern.text, quote)}${quote}`;
		},
	);
}

function resolveLiteralTranslation(text: string, bundle: AuthorityBundle): ResolvedTranslation | undefined {
	const pattern = parseMessagePattern(text);
	if (pattern.kind !== 'literal') return undefined;

	const authorityId = createAuthorityId(pattern);
	const message = bundle.messages.entries.find(entry => entry.id === authorityId);
	if (message != null && message.translation != null && message.kind === 'literal') {
		return {
			pattern: {
				kind: 'literal',
				text: message.translation,
			},
			source: 'authorityMessage',
		};
	}

	const term = bundle.terms.entries.find(entry => entry.source === text);
	if (term != null) {
		return {
			pattern: {
				kind: 'literal',
				text: term.translation,
			},
			source: 'authorityTerm',
		};
	}

	return undefined;
}

function unescapeStringLiteralContent(text: string): string {
	return text
		.replaceAll('\\\\', '\\')
		.replaceAll("\\'", "'")
		.replaceAll('\\"', '"')
		.replaceAll('\\n', '\n')
		.replaceAll('\\r', '\r');
}

function escapeMarkdownTitleSlot(text: string): string {
	return text.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('${', '\\${');
}

function escapeMarkdownLabelSlot(text: string): string {
	return text.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]').replaceAll('${', '\\${');
}

function escapeHtmlTitleSlot(text: string, quote: '"' | "'" | '`'): string {
	let escaped = text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('\\', '\\\\')
		.replaceAll('`', '\\`')
		.replaceAll('${', '\\${');

	switch (quote) {
		case '"':
			escaped = escaped.replaceAll('"', '&quot;');
			break;
		case "'":
			escaped = escaped.replaceAll("'", '&#39;');
			break;
		case '`':
			break;
	}

	return escaped;
}

function escapeStringLiteralContent(text: string, quote: '"' | "'" | '`'): string {
	let escaped = text
		.replaceAll('\\', '\\\\')
		.replaceAll('\r', '\\r')
		.replaceAll('\n', '\\n')
		.replaceAll('${', '\\${');

	switch (quote) {
		case '"':
			escaped = escaped.replaceAll('"', '\\"');
			break;
		case "'":
			escaped = escaped.replaceAll("'", "\\'");
			break;
		case '`':
			escaped = escaped.replaceAll('`', '\\`');
			break;
	}

	return escaped;
}

function escapeTemplateLiteralContent(text: string): string {
	return text.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
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
