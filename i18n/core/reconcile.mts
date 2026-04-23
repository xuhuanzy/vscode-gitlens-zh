import type {
	CatalogIssue,
	CatalogReconciliationEntry,
	I18nDomain,
	SourceCatalogFile,
	SourceOccurrence,
} from './model.mts';
import { cloneOutputReference, cloneSourceReference, nowIso, outputReferenceId, stableStringify } from './model.mts';

export function reconcileCatalog(
	previousCatalog: SourceCatalogFile,
	currentOccurrences: readonly SourceOccurrence[],
	issues: readonly CatalogIssue[],
	options: {
		readonly domain: I18nDomain;
		readonly schemaPath: string;
		readonly deferredDomains: readonly I18nDomain[];
	},
): SourceCatalogFile {
	const previousById = new Map(previousCatalog.occurrences.map(occurrence => [occurrence.id, occurrence]));
	const currentById = new Map(currentOccurrences.map(occurrence => [occurrence.id, occurrence]));
	const entries: CatalogReconciliationEntry[] = [];

	for (const occurrence of currentOccurrences) {
		const previous = previousById.get(occurrence.id);
		if (previous == null) {
			entries.push({
				occurrenceId: occurrence.id,
				anchor: occurrence.anchor,
				change: 'added',
				currentReference: cloneSourceReference(occurrence.reference),
				currentSourceHash: occurrence.sourceHash,
				output: occurrence.output == null ? undefined : cloneOutputReference(occurrence.output),
			});
			continue;
		}

		if (previous.sourceHash !== occurrence.sourceHash) {
			entries.push({
				occurrenceId: occurrence.id,
				anchor: occurrence.anchor,
				change: 'changed',
				previousReference: cloneSourceReference(previous.reference),
				currentReference: cloneSourceReference(occurrence.reference),
				previousSourceHash: previous.sourceHash,
				currentSourceHash: occurrence.sourceHash,
				output: occurrence.output == null ? undefined : cloneOutputReference(occurrence.output),
			});
			continue;
		}

		if (
			stableStringify(previous.reference) !== stableStringify(occurrence.reference) ||
			getOutputId(previous.output) !== getOutputId(occurrence.output)
		) {
			entries.push({
				occurrenceId: occurrence.id,
				anchor: occurrence.anchor,
				change: 'moved',
				previousReference: cloneSourceReference(previous.reference),
				currentReference: cloneSourceReference(occurrence.reference),
				previousSourceHash: previous.sourceHash,
				currentSourceHash: occurrence.sourceHash,
				output: occurrence.output == null ? undefined : cloneOutputReference(occurrence.output),
			});
		}
	}

	for (const previous of previousCatalog.occurrences) {
		if (currentById.has(previous.id)) continue;

		entries.push({
			occurrenceId: previous.id,
			anchor: previous.anchor,
			change: 'removed',
			previousReference: cloneSourceReference(previous.reference),
			previousSourceHash: previous.sourceHash,
			output: previous.output == null ? undefined : cloneOutputReference(previous.output),
		});
	}

	for (const [index, issue] of issues.entries()) {
		entries.push({
			occurrenceId: issue.occurrenceId ?? `${options.domain}:issue:${index + 1}`,
			anchor: issue.anchor,
			change: 'ambiguous',
			currentReference: issue.reference == null ? undefined : cloneSourceReference(issue.reference),
			output: issue.output == null ? undefined : cloneOutputReference(issue.output),
			reason: issue.reason,
		});
	}

	return {
		$schema: options.schemaPath,
		version: 2,
		domain: options.domain,
		generatedAt: nowIso(),
		deferredDomains: [...options.deferredDomains],
		occurrences: [...currentOccurrences].sort(compareOccurrences),
		reconciliation: {
			entries: entries.sort((left, right) => left.occurrenceId.localeCompare(right.occurrenceId)),
			summary: summarize(entries),
		},
	};
}

function summarize(
	entries: readonly CatalogReconciliationEntry[],
): Record<CatalogReconciliationEntry['change'], number> {
	const summary: Record<CatalogReconciliationEntry['change'], number> = {
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

function compareOccurrences(left: SourceOccurrence, right: SourceOccurrence): number {
	return left.id.localeCompare(right.id);
}

function getOutputId(output: SourceOccurrence['output']): string | undefined {
	return output == null ? undefined : outputReferenceId(output);
}
