import type {
	ManifestCatalogFile,
	ManifestOccurrence,
	ManifestReconciliationEntry,
} from '../shared/model.mts';
import { nowIso } from '../shared/model.mts';
import type { ManifestExtractionIssue } from './extractor.mts';

export function reconcileCatalog(
	previousCatalog: ManifestCatalogFile,
	currentOccurrences: readonly ManifestOccurrence[],
	issues: readonly ManifestExtractionIssue[],
): ManifestCatalogFile {
	const previousByKey = new Map(previousCatalog.occurrences.map(occurrence => [occurrence.key, occurrence]));
	const currentByKey = new Map(currentOccurrences.map(occurrence => [occurrence.key, occurrence]));
	const entries: ManifestReconciliationEntry[] = [];

	for (const occurrence of currentOccurrences) {
		const previous = previousByKey.get(occurrence.key);
		if (previous == null) {
			entries.push({
				key: occurrence.key,
				anchor: occurrence.anchor,
				change: 'added',
				currentPathPointer: occurrence.pathPointer,
				currentSourceHash: occurrence.sourceHash,
			});
			continue;
		}

		if (previous.sourceHash !== occurrence.sourceHash) {
			entries.push({
				key: occurrence.key,
				anchor: occurrence.anchor,
				change: 'changed',
				previousPathPointer: previous.pathPointer,
				currentPathPointer: occurrence.pathPointer,
				previousSourceHash: previous.sourceHash,
				currentSourceHash: occurrence.sourceHash,
			});
			continue;
		}

		if (previous.pathPointer !== occurrence.pathPointer) {
			entries.push({
				key: occurrence.key,
				anchor: occurrence.anchor,
				change: 'moved',
				previousPathPointer: previous.pathPointer,
				currentPathPointer: occurrence.pathPointer,
				previousSourceHash: previous.sourceHash,
				currentSourceHash: occurrence.sourceHash,
			});
		}
	}

	for (const previous of previousCatalog.occurrences) {
		if (currentByKey.has(previous.key)) continue;

		entries.push({
			key: previous.key,
			anchor: previous.anchor,
			change: 'removed',
			previousPathPointer: previous.pathPointer,
			previousSourceHash: previous.sourceHash,
		});
	}

	for (const issue of issues) {
		entries.push({
			key: issue.key,
			anchor: issue.anchor,
			change: 'ambiguous',
			currentPathPointer: issue.pathPointer,
			reason: issue.reason,
		});
	}

	return {
		$schema: '../schemas/manifestCatalog.schema.json',
		version: 1,
		domain: 'manifest',
		generatedAt: nowIso(),
		deferredDomains: ['webviews', 'quickpicks', 'formatter', 'runtimeCensus'],
		occurrences: [...currentOccurrences].sort((left, right) => left.key.localeCompare(right.key)),
		reconciliation: {
			entries: entries.sort((left, right) => left.key.localeCompare(right.key)),
			summary: summarize(entries),
		},
	};
}

function summarize(entries: readonly ManifestReconciliationEntry[]): Record<ManifestReconciliationEntry['change'], number> {
	const summary: Record<ManifestReconciliationEntry['change'], number> = {
		added: 0,
		changed: 0,
		moved: 0,
		removed: 0,
		ambiguous: 0,
	};

	for (const entry of entries) {
		summary[entry.change] += 1;
	}

	return summary;
}
