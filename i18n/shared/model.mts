import { createHash } from 'node:crypto';

export const translationStatuses = ['pending', 'translated', 'needsReview', 'approved'] as const;

export type TranslationStatus = (typeof translationStatuses)[number];

type MessageTranslation = string | null;

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

export interface MessageCaseRecord<TTranslation extends MessageTranslation = string> {
	readonly source: string;
	readonly translation: TTranslation;
}

export type BilingualMessageRecord<TTranslation extends MessageTranslation = string> =
	| {
			readonly id: string;
			readonly kind: 'literal';
			readonly source: string;
			readonly translation: TTranslation;
	  }
	| {
			readonly id: string;
			readonly kind: 'template';
			readonly source: string;
			readonly translation: TTranslation;
			readonly slots: string[];
	  }
	| {
			readonly id: string;
			readonly kind: 'select';
			readonly source: string;
			readonly translation: TTranslation;
			readonly selector: string;
			readonly cases: Record<string, MessageCaseRecord<TTranslation>>;
	  }
	| {
			readonly id: string;
			readonly kind: 'plural';
			readonly source: string;
			readonly translation: TTranslation;
			readonly selector: string;
			readonly cases: Record<string, MessageCaseRecord<TTranslation>>;
	  }
	| {
			readonly id: string;
			readonly kind: 'rich';
			readonly source: string;
			readonly translation: TTranslation;
			readonly format: 'markdown';
			readonly slots: string[];
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

export type AuthorityMessageEntry = BilingualMessageRecord<string>;

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
	readonly version: 2;
	readonly kind: TKind;
	readonly locale: 'zh-cn';
	readonly updatedAt: string;
	readonly entries: TEntry[];
}

export type WorksetMessageRecord = BilingualMessageRecord<MessageTranslation>;

export type TranslationWorksetEntry = WorksetMessageRecord & {
	readonly sourceHash: string;
	readonly keys: string[];
	readonly status: TranslationStatus;
	readonly note?: string;
};

export interface TranslationWorksetFile {
	readonly $schema: string;
	readonly version: 2;
	readonly locale: 'zh-cn';
	readonly domain: 'manifest';
	readonly generatedAt: string;
	readonly entries: TranslationWorksetEntry[];
}

export interface PendingReportItem {
	readonly id: string;
	readonly status: TranslationStatus;
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

export function createMessageRecord(
	id: string,
	sourcePattern: MessagePattern,
	translationPattern?: MessagePattern | null,
): WorksetMessageRecord {
	assertCompatibleMessagePatterns(sourcePattern, translationPattern);

	switch (sourcePattern.kind) {
		case 'literal':
			return {
				id: id,
				kind: sourcePattern.kind,
				source: sourcePattern.text,
				translation: translationPattern?.text ?? null,
			};
		case 'template':
			return {
				id: id,
				kind: sourcePattern.kind,
				source: sourcePattern.text,
				translation: translationPattern?.text ?? null,
				slots: [...sourcePattern.slots],
			};
		case 'rich':
			return {
				id: id,
				kind: sourcePattern.kind,
				source: sourcePattern.text,
				translation: translationPattern?.text ?? null,
				format: sourcePattern.format,
				slots: [...sourcePattern.slots],
			};
		case 'plural':
		case 'select':
			return {
				id: id,
				kind: sourcePattern.kind,
				source: sourcePattern.text,
				translation: translationPattern?.text ?? null,
				selector: sourcePattern.selector,
				cases: Object.fromEntries(
					Object.entries(sourcePattern.cases).map(([key, source]) => [
						key,
						{
							source: source,
							translation: translationPattern?.cases[key] ?? null,
						},
					]),
				),
			};
	}
}

export function cloneMessageRecord<TRecord extends WorksetMessageRecord>(record: TRecord): TRecord {
	return JSON.parse(JSON.stringify(record)) as TRecord;
}

export function hasTranslation(record: WorksetMessageRecord): record is AuthorityMessageEntry {
	if (record.translation == null) return false;

	if (record.kind !== 'plural' && record.kind !== 'select') {
		return true;
	}

	return Object.values(record.cases).every(entry => entry.translation != null);
}

export function toTranslationPattern(record: WorksetMessageRecord): MessagePattern | undefined {
	if (!hasTranslation(record)) return undefined;

	switch (record.kind) {
		case 'literal':
			return {
				kind: record.kind,
				text: record.translation,
			};
		case 'template':
			return {
				kind: record.kind,
				text: record.translation,
				slots: [...record.slots],
			};
		case 'rich':
			return {
				kind: record.kind,
				text: record.translation,
				format: record.format,
				slots: [...record.slots],
			};
		case 'plural':
		case 'select':
			return {
				kind: record.kind,
				text: record.translation,
				selector: record.selector,
				cases: Object.fromEntries(
					Object.entries(record.cases).map(([key, value]) => [key, value.translation ?? '']),
				),
			};
	}
}

export function toSourcePattern(record: WorksetMessageRecord): MessagePattern {
	switch (record.kind) {
		case 'literal':
			return {
				kind: record.kind,
				text: record.source,
			};
		case 'template':
			return {
				kind: record.kind,
				text: record.source,
				slots: [...record.slots],
			};
		case 'rich':
			return {
				kind: record.kind,
				text: record.source,
				format: record.format,
				slots: [...record.slots],
			};
		case 'plural':
		case 'select':
			return {
				kind: record.kind,
				text: record.source,
				selector: record.selector,
				cases: Object.fromEntries(Object.entries(record.cases).map(([key, value]) => [key, value.source])),
			};
	}
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

export function getTranslationText(record: WorksetMessageRecord): string | null {
	return record.translation;
}

function dedupe(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function assertCompatibleMessagePatterns(sourcePattern: MessagePattern, translationPattern?: MessagePattern | null): void {
	if (translationPattern == null) return;
	if (sourcePattern.kind !== translationPattern.kind) {
		throw new Error(`Mismatched message kinds: ${sourcePattern.kind} !== ${translationPattern.kind}`);
	}

	switch (sourcePattern.kind) {
		case 'literal':
			return;
		case 'template':
			assertStringArraysMatch(sourcePattern.slots, translationPattern.slots, 'template slots');
			return;
		case 'rich':
			if (sourcePattern.format !== translationPattern.format) {
				throw new Error(`Mismatched rich formats: ${sourcePattern.format} !== ${translationPattern.format}`);
			}
			assertStringArraysMatch(sourcePattern.slots, translationPattern.slots, 'rich slots');
			return;
		case 'plural':
		case 'select': {
			if (sourcePattern.selector !== translationPattern.selector) {
				throw new Error(`Mismatched ${sourcePattern.kind} selectors`);
			}
			assertStringArraysMatch(Object.keys(sourcePattern.cases), Object.keys(translationPattern.cases), `${sourcePattern.kind} cases`);
			return;
		}
	}
}

function assertStringArraysMatch(left: readonly string[], right: readonly string[], label: string): void {
	const sortedLeft = [...left].sort();
	const sortedRight = [...right].sort();
	if (sortedLeft.length !== sortedRight.length) {
		throw new Error(`Mismatched ${label}`);
	}

	for (let index = 0; index < sortedLeft.length; index++) {
		if (sortedLeft[index] !== sortedRight[index]) {
			throw new Error(`Mismatched ${label}`);
		}
	}
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
