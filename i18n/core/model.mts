import { createHash } from 'node:crypto';

export const translationStatuses = ['pending', 'translated', 'needsReview', 'approved'] as const;
export const i18nDomains = ['manifest', 'webviews', 'quickpicks', 'formatter', 'webviewHost'] as const;

export type TranslationStatus = (typeof translationStatuses)[number];
export type I18nDomain = (typeof i18nDomains)[number];
export type I18nLocale = string;

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

type MessagePatternOfKind<TKind extends MessagePattern['kind']> = Extract<MessagePattern, { kind: TKind }>;

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

export type SourceReference =
	| {
			readonly kind: 'json';
			readonly file: string;
			readonly pointer: string;
			readonly segments: JsonPathSegment[];
	  }
	| {
			readonly kind: 'source';
			readonly file: string;
			readonly syntax: string;
			readonly start: {
				readonly line: number;
				readonly column: number;
			};
			readonly end: {
				readonly line: number;
				readonly column: number;
			};
			readonly attribute?: string;
	  };

export type OutputReference =
	| {
			readonly kind: 'manifest-key';
			readonly key: string;
	  }
	| {
			readonly kind: 'runtime-key';
			readonly bundle: string;
			readonly key: string;
	  };

export interface SourceOccurrence {
	readonly id: string;
	readonly domain: I18nDomain;
	readonly scope: string;
	readonly anchor: string;
	readonly slot: string;
	readonly authorityId: string;
	readonly pattern: MessagePattern;
	readonly sourceText: string;
	readonly sourceHash: string;
	readonly reference: SourceReference;
	readonly output?: OutputReference;
}

export type ReconciliationChange = 'added' | 'changed' | 'moved' | 'removed' | 'ambiguous';

export interface CatalogIssue {
	readonly occurrenceId?: string;
	readonly anchor?: string;
	readonly reference?: SourceReference;
	readonly output?: OutputReference;
	readonly reason: string;
}

export interface CatalogReconciliationEntry {
	readonly occurrenceId: string;
	readonly change: ReconciliationChange;
	readonly anchor?: string;
	readonly previousReference?: SourceReference;
	readonly currentReference?: SourceReference;
	readonly previousSourceHash?: string;
	readonly currentSourceHash?: string;
	readonly output?: OutputReference;
	readonly reason?: string;
}

export interface SourceCatalogFile {
	readonly $schema: string;
	readonly version: 3;
	readonly domain: I18nDomain;
	readonly generatedAt: string;
	readonly deferredDomains: I18nDomain[];
	readonly occurrences: SourceOccurrence[];
}

export interface ReconciliationReportFile {
	readonly $schema: string;
	readonly version: 1;
	readonly domain: I18nDomain;
	readonly generatedAt: string;
	readonly entries: CatalogReconciliationEntry[];
	readonly summary: Record<ReconciliationChange, number>;
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

export type OverrideSelector =
	| {
			readonly kind: 'occurrence';
			readonly occurrenceId: string;
	  }
	| {
			readonly kind: 'anchor';
			readonly anchor: string;
	  }
	| {
			readonly kind: 'scope';
			readonly scope: string;
	  }
	| {
			readonly kind: 'output';
			readonly output: OutputReference;
	  };

export interface AuthorityOverrideEntry {
	readonly selector: OverrideSelector;
	readonly translationPattern: MessagePattern;
	readonly updatedAt: string;
	readonly note?: string;
}

export type AuthorityEntryKind = 'messages' | 'terms' | 'aliases' | 'overrides';

export interface AuthorityEntryFile<TKind extends AuthorityEntryKind, TEntry> {
	readonly $schema: string;
	readonly version: 2;
	readonly kind: TKind;
	readonly locale: I18nLocale;
	readonly updatedAt: string;
	readonly entries: TEntry[];
}

export interface AuthorityBundle {
	readonly messages: AuthorityEntryFile<'messages', AuthorityMessageEntry>;
	readonly terms: AuthorityEntryFile<'terms', AuthorityTermEntry>;
	readonly aliases: AuthorityEntryFile<'aliases', AuthorityAliasEntry>;
	readonly overrides: AuthorityEntryFile<'overrides', AuthorityOverrideEntry>;
}

export type WorksetMessageRecord = BilingualMessageRecord<MessageTranslation>;

export type TranslationWorksetEntry = WorksetMessageRecord & {
	readonly sourceHash: string;
	readonly occurrenceIds: string[];
	readonly status: TranslationStatus;
	readonly note?: string;
};

export interface TranslationWorksetFile {
	readonly $schema: string;
	readonly version: 2;
	readonly locale: I18nLocale;
	readonly domain: I18nDomain;
	readonly generatedAt: string;
	readonly entries: TranslationWorksetEntry[];
}

export interface PendingReportItem {
	readonly id: string;
	readonly status: TranslationStatus;
	readonly occurrenceIds: string[];
}

export interface PendingReportFile {
	readonly $schema: string;
	readonly version: 1;
	readonly locale: I18nLocale;
	readonly domain: I18nDomain;
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

const markdownPattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__(?:.+?)__|(^|\n)(?:[-*]|\d+\.)\s|\n\n|command:)/m;
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
		case 'template': {
			const compatibleTranslationPattern = translationPattern as
				| MessagePatternOfKind<'template'>
				| null
				| undefined;

			return {
				id: id,
				kind: sourcePattern.kind,
				source: sourcePattern.text,
				translation: translationPattern?.text ?? null,
				slots: [...sourcePattern.slots],
			};
		}
		case 'rich': {
			const compatibleTranslationPattern = translationPattern as MessagePatternOfKind<'rich'> | null | undefined;

			return {
				id: id,
				kind: sourcePattern.kind,
				source: sourcePattern.text,
				translation: compatibleTranslationPattern?.text ?? null,
				format: sourcePattern.format,
				slots: [...sourcePattern.slots],
			};
		}
		case 'plural':
		case 'select': {
			const compatibleTranslationPattern = translationPattern as
				| MessagePatternOfKind<'plural' | 'select'>
				| null
				| undefined;

			return {
				id: id,
				kind: sourcePattern.kind,
				source: sourcePattern.text,
				translation: compatibleTranslationPattern?.text ?? null,
				selector: sourcePattern.selector,
				cases: Object.fromEntries(
					Object.entries(sourcePattern.cases).map(([key, source]) => [
						key,
						{
							source: source,
							translation: compatibleTranslationPattern?.cases[key] ?? null,
						},
					]),
				),
			};
		}
	}
}

export function cloneMessageRecord<TRecord extends WorksetMessageRecord>(record: TRecord): TRecord {
	return JSON.parse(JSON.stringify(record)) as TRecord;
}

export function hasTranslation(record: WorksetMessageRecord): record is AuthorityMessageEntry {
	if (!isNonEmptyTranslation(record.translation)) return false;

	if (record.kind !== 'plural' && record.kind !== 'select') {
		return true;
	}

	return Object.values(record.cases).every(entry => isNonEmptyTranslation(entry.translation));
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

export function createPatternFingerprint(pattern: MessagePattern): string {
	return createContentHash(stableStringify(toCanonicalPattern(pattern)));
}

export function createAuthorityId(pattern: MessagePattern): string {
	return `message.${createPatternFingerprint(pattern)}`;
}

export function createOccurrenceId(domain: I18nDomain, anchor: string, slot: string): string {
	return `${domain}:${anchor}#${slot}`;
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

	return `/${segments.map(segment => String(segment).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}

export function createJsonSourceReference(file: string, segments: readonly JsonPathSegment[]): SourceReference {
	return {
		kind: 'json',
		file: file,
		pointer: toJsonPointer(segments),
		segments: [...segments],
	};
}

export function isJsonSourceReference(
	reference: SourceReference,
): reference is Extract<SourceReference, { readonly kind: 'json' }> {
	return reference.kind === 'json';
}

export function outputReferenceId(output: OutputReference): string {
	switch (output.kind) {
		case 'manifest-key':
			return `manifest-key:${output.key}`;
		case 'runtime-key':
			return `runtime-key:${output.bundle}:${output.key}`;
	}
}

export function overrideSelectorId(selector: OverrideSelector): string {
	switch (selector.kind) {
		case 'occurrence':
			return `occurrence:${selector.occurrenceId}`;
		case 'anchor':
			return `anchor:${selector.anchor}`;
		case 'scope':
			return `scope:${selector.scope}`;
		case 'output':
			return `output:${outputReferenceId(selector.output)}`;
	}
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

export function cloneSourceReference<TReference extends SourceReference | undefined>(
	reference: TReference,
): TReference {
	if (reference == null) return reference;
	return JSON.parse(JSON.stringify(reference)) as TReference;
}

export function cloneOutputReference<TOutput extends OutputReference | undefined>(output: TOutput): TOutput {
	if (output == null) return output;
	return JSON.parse(JSON.stringify(output)) as TOutput;
}

function dedupe(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function assertCompatibleMessagePatterns(
	sourcePattern: MessagePattern,
	translationPattern?: MessagePattern | null,
): void {
	if (translationPattern == null) return;
	if (sourcePattern.kind !== translationPattern.kind) {
		throw new Error(`Mismatched message kinds: ${sourcePattern.kind} !== ${translationPattern.kind}`);
	}

	switch (sourcePattern.kind) {
		case 'literal':
			return;
		case 'template': {
			const compatibleTranslationPattern = translationPattern as MessagePatternOfKind<'template'>;

			assertStringArraysMatch(sourcePattern.slots, compatibleTranslationPattern.slots, 'template slots');
			return;
		}
		case 'rich': {
			const compatibleTranslationPattern = translationPattern as MessagePatternOfKind<'rich'>;

			if (sourcePattern.format !== compatibleTranslationPattern.format) {
				throw new Error(
					`Mismatched rich formats: ${sourcePattern.format} !== ${compatibleTranslationPattern.format}`,
				);
			}
			assertStringArraysMatch(sourcePattern.slots, compatibleTranslationPattern.slots, 'rich slots');
			return;
		}
		case 'plural':
		case 'select': {
			const compatibleTranslationPattern = translationPattern as MessagePatternOfKind<'plural' | 'select'>;

			if (sourcePattern.selector !== compatibleTranslationPattern.selector) {
				throw new Error(`Mismatched ${sourcePattern.kind} selectors`);
			}
			assertStringArraysMatch(
				Object.keys(sourcePattern.cases),
				Object.keys(compatibleTranslationPattern.cases),
				`${sourcePattern.kind} cases`,
			);
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

function isNonEmptyTranslation(translation: string | null): translation is string {
	return translation != null && translation.length !== 0;
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
