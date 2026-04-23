import type {
	AuthorityBundle,
	AuthorityMessageEntry,
	AuthorityOverrideEntry,
	MessagePattern,
	SourceOccurrence,
	TranslationWorksetEntry,
	TranslationWorksetFile,
} from './model.mts';
import {
	cloneMessageRecord,
	clonePattern,
	createMessageRecord,
	hasTranslation,
	nowIso,
	overrideSelectorId,
	outputReferenceId,
	stableStringify,
	toTranslationPattern,
} from './model.mts';

export interface ResolvedTranslation {
	readonly pattern: MessagePattern;
	readonly source:
		| 'outputOverride'
		| 'occurrenceOverride'
		| 'anchorOverride'
		| 'scopeOverride'
		| 'authorityMessage'
		| 'authorityTerm';
}

export function canonicalAuthorityId(authorityId: string, bundle: AuthorityBundle): string {
	const alias = bundle.aliases.entries.find(entry => entry.aliasId === authorityId);
	return alias?.canonicalId ?? authorityId;
}

export function resolveOccurrenceTranslation(
	occurrence: SourceOccurrence,
	bundle: AuthorityBundle,
): ResolvedTranslation | undefined {
	const outputOverride =
		occurrence.output == null
			? undefined
			: lookupOverride(
					entry =>
						entry.selector.kind === 'output' &&
						outputReferenceId(entry.selector.output) === outputReferenceId(occurrence.output!),
					bundle.overrides.entries,
				);
	if (outputOverride != null) {
		return {
			pattern: clonePattern(outputOverride.translationPattern),
			source: 'outputOverride',
		};
	}

	const occurrenceOverride = lookupOverride(
		entry => entry.selector.kind === 'occurrence' && entry.selector.occurrenceId === occurrence.id,
		bundle.overrides.entries,
	);
	if (occurrenceOverride != null) {
		return {
			pattern: clonePattern(occurrenceOverride.translationPattern),
			source: 'occurrenceOverride',
		};
	}

	const anchorOverride = lookupOverride(
		entry => entry.selector.kind === 'anchor' && entry.selector.anchor === occurrence.anchor,
		bundle.overrides.entries,
	);
	if (anchorOverride != null) {
		return {
			pattern: clonePattern(anchorOverride.translationPattern),
			source: 'anchorOverride',
		};
	}

	const scopeOverride = lookupOverride(
		entry => entry.selector.kind === 'scope' && entry.selector.scope === occurrence.scope,
		bundle.overrides.entries,
	);
	if (scopeOverride != null) {
		return {
			pattern: clonePattern(scopeOverride.translationPattern),
			source: 'scopeOverride',
		};
	}

	const authorityId = canonicalAuthorityId(occurrence.authorityId, bundle);
	const authorityMessage = bundle.messages.entries.find(entry => entry.id === authorityId);
	if (authorityMessage != null) {
		const pattern = toTranslationPattern(authorityMessage);
		if (pattern == null) {
			return undefined;
		}

		return {
			pattern: pattern,
			source: 'authorityMessage',
		};
	}

	const term = bundle.terms.entries.find(entry => entry.source === occurrence.sourceText);
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

export function syncWorkset(
	previousWorkset: TranslationWorksetFile,
	occurrences: readonly SourceOccurrence[],
	bundle: AuthorityBundle,
): TranslationWorksetFile {
	const previousEntries = new Map(previousWorkset.entries.map(entry => [entry.id, entry]));
	const groupedOccurrences = groupUnresolvedOccurrences(occurrences, bundle);
	const entries: TranslationWorksetEntry[] = [];

	for (const [authorityId, grouped] of groupedOccurrences) {
		const previous = previousEntries.get(authorityId);
		const sourcePattern = clonePattern(grouped[0].pattern);
		const sourceHash = grouped[0].sourceHash;
		const occurrenceIds = grouped.map(occurrence => occurrence.id).sort((left, right) => left.localeCompare(right));

		if (previous == null) {
			entries.push({
				...createMessageRecord(authorityId, sourcePattern, null),
				sourceHash: sourceHash,
				occurrenceIds: occurrenceIds,
				status: 'pending',
			});
			continue;
		}

		const nextRecord = createMessageRecord(previous.id, sourcePattern, toTranslationPattern(previous) ?? null);
		const sourceChanged = previous.sourceHash !== sourceHash;
		const previousHasTranslation = hasTranslation(previous);
		const nextStatus = sourceChanged
			? previousHasTranslation
				? 'needsReview'
				: 'pending'
			: previousHasTranslation
				? previous.status
				: 'pending';

		entries.push({
			...nextRecord,
			sourceHash: sourceHash,
			occurrenceIds: occurrenceIds,
			status: nextStatus,
			note: previous.note,
		});
	}

	return {
		$schema: '../schemas/translationWorkset.schema.json',
		version: 2,
		locale: previousWorkset.locale,
		domain: previousWorkset.domain,
		generatedAt: nowIso(),
		entries: entries.sort((left, right) => left.id.localeCompare(right.id)),
	};
}

export function promoteApprovedEntries(
	workset: TranslationWorksetFile,
	bundle: AuthorityBundle,
): { readonly workset: TranslationWorksetFile; readonly bundle: AuthorityBundle; readonly promoted: string[] } {
	const promoted: string[] = [];
	const updatedMessages = [...bundle.messages.entries];
	const retainedEntries: TranslationWorksetEntry[] = [];
	const timestamp = nowIso();
	let messagesChanged = false;

	for (const entry of workset.entries) {
		if (entry.status !== 'approved' || !hasTranslation(entry)) {
			retainedEntries.push(entry);
			continue;
		}

		promoted.push(entry.id);
		const existing = updatedMessages.find(message => message.id === entry.id);
		const {
			sourceHash: _sourceHash,
			occurrenceIds: _occurrenceIds,
			status: _status,
			note: _note,
			...messageRecord
		} = entry;
		const nextMessage = cloneMessageRecord(messageRecord as AuthorityMessageEntry);

		if (existing == null) {
			updatedMessages.push(nextMessage);
			messagesChanged = true;
			continue;
		}

		const index = updatedMessages.indexOf(existing);
		if (stableStringify(existing) !== stableStringify(nextMessage)) {
			updatedMessages[index] = nextMessage;
			messagesChanged = true;
		}
	}

	return {
		workset: {
			...workset,
			generatedAt: timestamp,
			entries: retainedEntries.sort((left, right) => left.id.localeCompare(right.id)),
		},
		bundle: {
			...bundle,
			messages: {
				...bundle.messages,
				updatedAt: messagesChanged ? timestamp : bundle.messages.updatedAt,
				entries: updatedMessages.sort((left, right) => left.id.localeCompare(right.id)),
			},
			overrides: {
				...bundle.overrides,
				entries: [...bundle.overrides.entries].sort((left, right) =>
					overrideSelectorId(left.selector).localeCompare(overrideSelectorId(right.selector)),
				),
			},
		},
		promoted: promoted,
	};
}

function groupUnresolvedOccurrences(
	occurrences: readonly SourceOccurrence[],
	bundle: AuthorityBundle,
): Map<string, SourceOccurrence[]> {
	const grouped = new Map<string, SourceOccurrence[]>();

	for (const occurrence of occurrences) {
		if (resolveOccurrenceTranslation(occurrence, bundle) != null) continue;

		const authorityId = canonicalAuthorityId(occurrence.authorityId, bundle);
		const existing = grouped.get(authorityId);
		if (existing == null) {
			grouped.set(authorityId, [occurrence]);
			continue;
		}

		existing.push(occurrence);
	}

	return grouped;
}

function lookupOverride(
	matcher: (entry: AuthorityOverrideEntry) => boolean,
	overrides: readonly AuthorityOverrideEntry[],
): AuthorityOverrideEntry | undefined {
	return overrides.find(matcher);
}
