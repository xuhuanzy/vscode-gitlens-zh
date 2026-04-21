import { createHash } from 'node:crypto';

export const translationStatuses = ['pending', 'translated', 'needsReview', 'approved'] as const;

export type TranslationStatus = (typeof translationStatuses)[number];

export type MessagePattern =
	| {
			kind: 'literal';
			text: string;
	  }
	| {
			kind: 'template';
			text: string;
			slots: string[];
	  }
	| {
			kind: 'select';
			text: string;
			selector: string;
			cases: Record<string, string>;
	  }
	| {
			kind: 'plural';
			text: string;
			selector: string;
			cases: Record<string, string>;
	  }
	| {
			kind: 'rich';
			text: string;
			format: 'markdown';
			slots: string[];
	  };

export type JsonPathSegment = string | number;

export interface ManifestOccurrence {
	readonly occurrenceId: string;
	readonly domain: 'manifest';
	readonly scope: string;
	readonly anchor: string;
	readonly key: string;
	readonly authorityId: string;
	readonly pattern: MessagePattern;
	readonly patternFingerprint: string;
	readonly sourceText: string;
	readonly sourceHash: string;
	readonly pathPointer: string;
	readonly pathSegments: JsonPathSegment[];
	readonly slot: string;
	readonly businessId?: string;
	readonly extractedFrom: 'manifest' | 'package.nls';
	readonly currentTokenKey?: string;
}

export interface ManifestReconciliationEntry {
	readonly key: string;
	readonly change: 'added' | 'changed' | 'moved' | 'removed' | 'ambiguous';
	readonly anchor?: string;
	readonly previousPathPointer?: string;
	readonly currentPathPointer?: string;
	readonly previousSourceHash?: string;
	readonly currentSourceHash?: string;
	readonly reason?: string;
}

export interface ManifestCatalogFile {
	readonly $schema: string;
	readonly version: 1;
	readonly domain: 'manifest';
	readonly generatedAt: string;
	readonly deferredDomains: string[];
	readonly occurrences: ManifestOccurrence[];
	readonly reconciliation: {
		readonly entries: ManifestReconciliationEntry[];
		readonly summary: Record<ManifestReconciliationEntry['change'], number>;
	};
}

export interface AuthorityMessageEntry {
	readonly id: string;
	readonly patternFingerprint: string;
	readonly sourcePattern: MessagePattern;
	readonly translationPattern: MessagePattern;
	readonly promotedAt: string;
	readonly updatedAt: string;
}

export interface AuthorityTermEntry {
	readonly source: string;
	readonly translation: string;
	readonly updatedAt: string;
	readonly note?: string;
}

export interface AuthorityAliasEntry {
	readonly aliasId: string;
	readonly canonicalId: string;
	readonly updatedAt: string;
	readonly reason?: string;
}

export interface OverrideEntry {
	readonly id: string;
	readonly translationPattern: MessagePattern;
	readonly updatedAt: string;
	readonly note?: string;
}

export interface AuthorityEntryFile<TKind extends string, TEntry> {
	readonly $schema: string;
	readonly version: 1;
	readonly kind: TKind;
	readonly locale: 'zh-cn';
	readonly entries: TEntry[];
}

export interface TranslationWorksetEntry {
	readonly id: string;
	readonly sourcePattern: MessagePattern;
	readonly sourceHash: string;
	readonly keys: string[];
	readonly candidateTranslation?: MessagePattern;
	readonly status: TranslationStatus;
	readonly note?: string;
}

export interface TranslationWorksetFile {
	readonly $schema: string;
	readonly version: 1;
	readonly locale: 'zh-cn';
	readonly domain: 'manifest';
	readonly generatedAt: string;
	readonly entries: TranslationWorksetEntry[];
}

export interface PendingReportItem {
	readonly id: string;
	readonly status: TranslationStatus;
	readonly scope: string;
	readonly occurrences: number;
	readonly sourceText: string;
	readonly keys: string[];
}

export interface PendingReportFile {
	readonly $schema: string;
	readonly version: 1;
	readonly locale: 'zh-cn';
	readonly domain: 'manifest';
	readonly generatedAt: string;
	readonly baseRef?: string;
	readonly counts: {
		readonly total: number;
		readonly pending: number;
		readonly translated: number;
		readonly needsReview: number;
		readonly approved: number;
		readonly promotable: number;
	};
	readonly coverage: {
		readonly catalogOccurrences: number;
		readonly resolvedOccurrences: number;
		readonly unresolvedOccurrences: number;
		readonly readyForGeneration: boolean;
	};
	readonly sinceBase?: {
		readonly added: number;
		readonly changed: number;
		readonly removed: number;
	};
	readonly items: PendingReportItem[];
}

const markdownPattern =
	/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__(?:.+?)__|(^|\n)(?:[-*]|\d+\.)\s|\n\n|command:)/m;
const templateSlotPattern = /\$\{([^}]+)\}/g;

export function parseMessagePattern(text: string): MessagePattern {
	const slots = [...text.matchAll(templateSlotPattern)].map(match => match[1]);
	if (markdownPattern.test(text)) {
		return {
			kind: 'rich',
			text: text,
			format: 'markdown',
			slots: dedupe(slots),
		};
	}

	if (slots.length > 0) {
		return {
			kind: 'template',
			text: text,
			slots: dedupe(slots),
		};
	}

	return {
		kind: 'literal',
		text: text,
	};
}

export function createLiteralPattern(text: string): MessagePattern {
	return {
		kind: 'literal',
		text: text,
	};
}

export function createPatternFingerprint(pattern: MessagePattern): string {
	return createContentHash(stableStringify(toCanonicalPattern(pattern)));
}

export function createAuthorityId(pattern: MessagePattern): string {
	return `message.${createPatternFingerprint(pattern)}`;
}

export function createContentHash(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function stableStringify(value: unknown): string {
	return JSON.stringify(sortKeys(value));
}

export function nowIso(): string {
	return new Date().toISOString();
}

export function toJsonPointer(segments: readonly JsonPathSegment[]): string {
	if (segments.length === 0) return '';

	return `/${segments
		.map(segment => String(segment).replaceAll('~', '~0').replaceAll('/', '~1'))
		.join('/')}`;
}

export function sanitizeKeySegment(value: string): string {
	const sanitized = value
		.trim()
		.replaceAll('%', '')
		.replace(/[^\p{L}\p{N}._-]+/gu, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

	return sanitized.length === 0 ? 'item' : sanitized;
}

export function shortHash(value: string): string {
	return createContentHash(value).slice(0, 10);
}

export function clonePattern(pattern: MessagePattern): MessagePattern {
	return JSON.parse(JSON.stringify(pattern)) as MessagePattern;
}

function dedupe(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortKeys);
	}

	if (value == null || typeof value !== 'object') {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, nested]) => [key, sortKeys(nested)]),
	);
}

function toCanonicalPattern(pattern: MessagePattern): MessagePattern {
	switch (pattern.kind) {
		case 'literal':
			return {
				kind: pattern.kind,
				text: pattern.text,
			};
		case 'template':
			return {
				kind: pattern.kind,
				text: pattern.text,
				slots: [...pattern.slots].sort(),
			};
		case 'rich':
			return {
				kind: pattern.kind,
				text: pattern.text,
				format: pattern.format,
				slots: [...pattern.slots].sort(),
			};
		case 'plural':
		case 'select':
			return {
				kind: pattern.kind,
				text: pattern.text,
				selector: pattern.selector,
				cases: Object.fromEntries(
					Object.entries(pattern.cases).sort(([left], [right]) => left.localeCompare(right)),
				),
			};
	}
}
