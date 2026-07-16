import type {
	CatalogIssue,
	CatalogReconciliationEntry,
	I18nDomain,
	ReconciliationReportFile,
	SourceCatalogFile,
	SourceOccurrence,
} from "./model.mts";
import { createContentHash, nowIso, outputReferenceId, stableStringify } from "./model.mts";

export interface CatalogScopeOptions {
	readonly occurrenceIdPrefix?: string;
	readonly catalogDomain?: I18nDomain;
}

/** 用本次抽取结果更新目标作用域, 同时保留其他 domain 共享的 catalog occurrence. */
export function reconcileCatalog(
	previousCatalog: SourceCatalogFile,
	currentOccurrences: readonly SourceOccurrence[],
	options: CatalogScopeOptions = {},
): SourceCatalogFile {
	const currentIds = new Set(currentOccurrences.map((occurrence) => occurrence.id));
	const scopedOccurrences = [
		...previousCatalog.occurrences.filter(
			(occurrence) => !isOccurrenceInScope(occurrence, options) && !currentIds.has(occurrence.id),
		),
		...currentOccurrences,
	];

	return {
		$schema: previousCatalog.$schema,
		version: 6,
		domain: options.catalogDomain ?? previousCatalog.domain,
		occurrences: scopedOccurrences.sort((left, right) => left.id.localeCompare(right.id)),
	};
}

/** 比较前后 catalog 并生成 added, changed, moved, removed 和 ambiguous 对账记录. */
export function createReconciliationReport(
	previousCatalog: SourceCatalogFile,
	currentCatalog: SourceCatalogFile,
	issues: readonly CatalogIssue[],
	options: {
		readonly domain: I18nDomain;
		readonly schemaPath: string;
	},
): ReconciliationReportFile {
	const previousById = new Map(previousCatalog.occurrences.map((occurrence) => [occurrence.id, occurrence]));
	const currentById = new Map(currentCatalog.occurrences.map((occurrence) => [occurrence.id, occurrence]));
	const entries: CatalogReconciliationEntry[] = [];

	for (const occurrence of currentCatalog.occurrences) {
		const previous = previousById.get(occurrence.id);
		if (previous == null) {
			entries.push({
				occurrenceId: occurrence.id,
				change: "added",
				currentReference: structuredClone(occurrence.reference),
				currentSourceHash: createContentHash(occurrence.pattern.text),
				output: structuredClone(occurrence.output),
			});
			continue;
		}

		const previousSourceHash = createContentHash(previous.pattern.text);
		const currentSourceHash = createContentHash(occurrence.pattern.text);
		if (previousSourceHash !== currentSourceHash) {
			entries.push({
				occurrenceId: occurrence.id,
				change: "changed",
				previousReference: structuredClone(previous.reference),
				currentReference: structuredClone(occurrence.reference),
				previousSourceHash: previousSourceHash,
				currentSourceHash: currentSourceHash,
				output: structuredClone(occurrence.output),
			});
			continue;
		}

		if (
			stableStringify(previous.reference) !== stableStringify(occurrence.reference) ||
			(previous.output == null ? undefined : outputReferenceId(previous.output)) !==
				(occurrence.output == null ? undefined : outputReferenceId(occurrence.output))
		) {
			entries.push({
				occurrenceId: occurrence.id,
				change: "moved",
				previousReference: structuredClone(previous.reference),
				currentReference: structuredClone(occurrence.reference),
				previousSourceHash: previousSourceHash,
				currentSourceHash: currentSourceHash,
				output: structuredClone(occurrence.output),
			});
		}
	}

	for (const previous of previousCatalog.occurrences) {
		if (currentById.has(previous.id)) continue;

		entries.push({
			occurrenceId: previous.id,
			change: "removed",
			previousReference: structuredClone(previous.reference),
			previousSourceHash: createContentHash(previous.pattern.text),
			output: structuredClone(previous.output),
		});
	}

	for (const [index, issue] of issues.entries()) {
		entries.push({
			occurrenceId: issue.occurrenceId ?? `${options.domain}:issue:${index + 1}`,
			change: "ambiguous",
			currentReference: structuredClone(issue.reference),
			output: structuredClone(issue.output),
			reason: issue.reason,
		});
	}

	return {
		$schema: options.schemaPath,
		version: 1,
		domain: options.domain,
		generatedAt: nowIso(),
		entries: entries.sort((left, right) => left.occurrenceId.localeCompare(right.occurrenceId)),
		summary: summarize(entries),
	};
}

export function filterCatalogOccurrencesByScope(
	occurrences: readonly SourceOccurrence[],
	options: CatalogScopeOptions = {},
): SourceOccurrence[] {
	return occurrences.filter((occurrence) => isOccurrenceInScope(occurrence, options));
}

function summarize(
	entries: readonly CatalogReconciliationEntry[],
): Record<CatalogReconciliationEntry["change"], number> {
	const summary: Record<CatalogReconciliationEntry["change"], number> = {
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

function isOccurrenceInScope(occurrence: SourceOccurrence, options: CatalogScopeOptions): boolean {
	return options.occurrenceIdPrefix == null || occurrence.id.startsWith(options.occurrenceIdPrefix);
}
