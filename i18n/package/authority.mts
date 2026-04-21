import type {
	AuthorityMessageEntry,
	ManifestOccurrence,
	MessagePattern,
	OverrideEntry,
	TranslationWorksetEntry,
	TranslationWorksetFile,
} from '../shared/model.mts';
import { clonePattern, createPatternFingerprint, nowIso } from '../shared/model.mts';
import type { AuthorityBundle } from './store.mts';

export interface ResolvedTranslation {
	readonly pattern: MessagePattern;
	readonly source:
		| 'keyOverride'
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
	occurrence: ManifestOccurrence,
	bundle: AuthorityBundle,
): ResolvedTranslation | undefined {
	const keyOverride = lookupOverride(occurrence.key, bundle.keyOverrides.entries);
	if (keyOverride != null) {
		return {
			pattern: clonePattern(keyOverride.translationPattern),
			source: 'keyOverride',
		};
	}

	const anchorOverride = lookupOverride(occurrence.anchor, bundle.anchorOverrides.entries);
	if (anchorOverride != null) {
		return {
			pattern: clonePattern(anchorOverride.translationPattern),
			source: 'anchorOverride',
		};
	}

	const scopeOverride = lookupOverride(occurrence.scope, bundle.scopeOverrides.entries);
	if (scopeOverride != null) {
		return {
			pattern: clonePattern(scopeOverride.translationPattern),
			source: 'scopeOverride',
		};
	}

	const authorityId = canonicalAuthorityId(occurrence.authorityId, bundle);
	const authorityMessage = bundle.messages.entries.find(entry => entry.id === authorityId);
	if (authorityMessage != null) {
		return {
			pattern: clonePattern(authorityMessage.translationPattern),
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
	occurrences: readonly ManifestOccurrence[],
	bundle: AuthorityBundle,
): TranslationWorksetFile {
	const previousEntries = new Map(previousWorkset.entries.map(entry => [entry.id, entry]));
	const groupedOccurrences = groupUnresolvedOccurrences(occurrences, bundle);
	const entries: TranslationWorksetEntry[] = [];

	for (const [authorityId, grouped] of groupedOccurrences) {
		const previous = previousEntries.get(authorityId);
		const sourcePattern = clonePattern(grouped[0].pattern);
		const sourceHash = grouped[0].sourceHash;
		const keys = grouped.map(occurrence => occurrence.key).sort((left, right) => left.localeCompare(right));

		if (previous == null) {
			entries.push({
				id: authorityId,
				sourcePattern: sourcePattern,
				sourceHash: sourceHash,
				keys: keys,
				status: 'pending',
			});
			continue;
		}

		const sourceChanged = previous.sourceHash !== sourceHash;
		const hasCandidateTranslation = previous.candidateTranslation != null;
		const nextStatus = sourceChanged
			? hasCandidateTranslation
				? 'needsReview'
				: 'pending'
			: previous.status;

		entries.push({
			id: previous.id,
			sourcePattern: sourcePattern,
			sourceHash: sourceHash,
			keys: keys,
			candidateTranslation: previous.candidateTranslation,
			status: nextStatus,
			note: previous.note,
		});
	}

	return {
		$schema: '../schemas/translationWorkset.schema.json',
		version: 1,
		locale: 'zh-cn',
		domain: 'manifest',
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

	for (const entry of workset.entries) {
		if (entry.status !== 'approved' || entry.candidateTranslation == null) {
			retainedEntries.push(entry);
			continue;
		}

		promoted.push(entry.id);
		const existing = updatedMessages.find(message => message.id === entry.id);
		const nextMessage: AuthorityMessageEntry = {
			id: entry.id,
			patternFingerprint: createPatternFingerprint(entry.sourcePattern),
			sourcePattern: clonePattern(entry.sourcePattern),
			translationPattern: clonePattern(entry.candidateTranslation),
			promotedAt: timestamp,
			updatedAt: timestamp,
		};

		if (existing == null) {
			updatedMessages.push(nextMessage);
			continue;
		}

		const index = updatedMessages.indexOf(existing);
		updatedMessages[index] = nextMessage;
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
				entries: updatedMessages.sort((left, right) => left.id.localeCompare(right.id)),
			},
		},
		promoted: promoted,
	};
}

function groupUnresolvedOccurrences(
	occurrences: readonly ManifestOccurrence[],
	bundle: AuthorityBundle,
): Map<string, ManifestOccurrence[]> {
	const grouped = new Map<string, ManifestOccurrence[]>();

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

function lookupOverride(id: string, overrides: readonly OverrideEntry[]): OverrideEntry | undefined {
	return overrides.find(entry => entry.id === id);
}
