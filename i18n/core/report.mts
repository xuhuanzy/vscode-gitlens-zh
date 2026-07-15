import { resolveOccurrenceTranslation } from "./authority.mts";
import type {
	AuthorityBundle,
	I18nDomain,
	I18nLocale,
	PendingReportFile,
	SourceOccurrence,
	TranslationWorksetEntry,
} from "./model.mts";
import { nowIso } from "./model.mts";

/** 汇总指定 domain 的翻译状态和覆盖率. */
export function buildPendingReport(options: {
	readonly locale: I18nLocale;
	readonly domain: I18nDomain;
	readonly occurrences: readonly SourceOccurrence[];
	readonly entries: readonly TranslationWorksetEntry[];
	readonly bundle: AuthorityBundle;
	readonly getOccurrenceIds?: (entry: TranslationWorksetEntry) => string[];
}): PendingReportFile {
	const counts = {
		total: options.entries.length,
		pending: 0,
		translated: 0,
		needsReview: 0,
		approved: 0,
		promotable: 0,
	};
	for (const entry of options.entries) {
		counts[entry.status] += 1;
		if (entry.status === "approved") counts.promotable += 1;
	}

	const resolvedOccurrences = options.occurrences.filter(
		(occurrence) => resolveOccurrenceTranslation(occurrence, options.bundle) != null,
	).length;
	return {
		$schema: "../schemas/pendingReport.schema.json",
		version: 1,
		locale: options.locale,
		domain: options.domain,
		generatedAt: nowIso(),
		counts: counts,
		coverage: {
			catalogOccurrences: options.occurrences.length,
			resolvedOccurrences: resolvedOccurrences,
			unresolvedOccurrences: options.occurrences.length - resolvedOccurrences,
			readyForGeneration:
				options.entries.every((entry) => entry.status !== "pending") &&
				options.occurrences.length === resolvedOccurrences,
		},
		items: options.entries.map((entry) => ({
			id: entry.id,
			status: entry.status,
			occurrenceIds: options.getOccurrenceIds?.(entry) ?? entry.occurrenceIds,
		})),
	};
}
