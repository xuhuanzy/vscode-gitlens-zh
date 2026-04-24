import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

import type { PendingReportFile } from '../../core/model.mts';
import { nowIso, outputReferenceId, stableStringify } from '../../core/model.mts';
import { promoteApprovedEntries, resolveOccurrenceTranslation, syncWorkset } from '../../core/authority.mts';
import { createReconciliationReport, reconcileCatalog } from '../../core/reconcile.mts';
import { ensureAuthorityFiles, ensureDomainFiles } from '../../core/store.mts';
import { writeI18nWorkflowReadme } from '../../workflowReadme.mts';

import { createManifestDomainContext, type ManifestDomainContext } from './context.mts';
import { extractManifestOccurrences } from './extractor.mts';
import { generateManifestOutputs } from './generator.mts';
import {
	createEmptyManifestCatalogFile,
	createEmptyManifestWorksetFile,
	loadAuthorityBundle,
	loadEnglishPackageNls,
	loadLocalizedPackageNls,
	loadManifest,
	loadManifestCatalog,
	loadManifestWorkset,
	saveAuthorityBundle,
	saveEnglishPackageNls,
	saveLocalizedPackageNls,
	saveManifest,
	saveManifestCatalog,
	saveManifestReconciliationReport,
	saveManifestWorkset,
	savePendingReport,
} from './store.mts';

export interface WorkflowOptions {
	readonly rootDir?: string;
	readonly baseRef?: string;
	readonly writeTo?: string;
}

export function syncManifestI18n(options: WorkflowOptions = {}): {
	readonly context: ManifestDomainContext;
	readonly occurrenceCount: number;
	readonly worksetCount: number;
} {
	const context = createManifestDomainContext(options.rootDir);
	ensureAuthorityFiles(context);
	ensureDomainFiles(context, {
		catalog: createEmptyManifestCatalogFile(),
		workset: createEmptyManifestWorksetFile(),
	});

	const manifest = loadManifest(context);
	const englishNls = loadEnglishPackageNls(context);
	const previousCatalog = loadManifestCatalog(context);
	const bundle = loadAuthorityBundle(context);
	const previousWorkset = loadManifestWorkset(context);
	const extraction = extractManifestOccurrences(manifest, englishNls);
	const catalog = reconcileCatalog(previousCatalog, extraction.occurrences);
	const reconciliation = createReconciliationReport(previousCatalog, catalog, extraction.issues, {
		domain: 'manifest',
		schemaPath: '../schemas/reconciliationReport.schema.json',
	});
	const workset = syncWorkset(previousWorkset, catalog.occurrences, bundle);

	saveManifestCatalog(context, catalog);
	saveManifestReconciliationReport(context, reconciliation);
	saveManifestWorkset(context, workset);

	return {
		context: context,
		occurrenceCount: catalog.occurrences.length,
		worksetCount: workset.entries.length,
	};
}

export function promoteManifestAuthority(options: WorkflowOptions = {}): {
	readonly context: ManifestDomainContext;
	readonly promoted: string[];
} {
	const context = createManifestDomainContext(options.rootDir);
	ensureAuthorityFiles(context);
	ensureDomainFiles(context, {
		catalog: createEmptyManifestCatalogFile(),
		workset: createEmptyManifestWorksetFile(),
	});

	const workset = loadManifestWorkset(context);
	const bundle = loadAuthorityBundle(context);
	const promoted = promoteApprovedEntries(workset, bundle);

	saveAuthorityBundle(context, promoted.bundle);
	saveManifestWorkset(context, promoted.workset);

	return {
		context: context,
		promoted: promoted.promoted,
	};
}

export function generateManifestLocalizedOutputs(options: WorkflowOptions = {}): {
	readonly context: ManifestDomainContext;
	readonly englishKeys: number;
	readonly localizedKeys: number;
	readonly unresolvedKeys: number;
} {
	const context = createManifestDomainContext(options.rootDir);
	ensureAuthorityFiles(context);
	ensureDomainFiles(context, {
		catalog: createEmptyManifestCatalogFile(),
		workset: createEmptyManifestWorksetFile(),
	});

	const manifest = loadManifest(context);
	const catalog = loadManifestCatalog(context);
	const bundle = loadAuthorityBundle(context);
	const generated = generateManifestOutputs(manifest, catalog.occurrences, bundle);

	saveManifest(context, generated.manifest);
	saveEnglishPackageNls(context, generated.englishPackageNls);
	saveLocalizedPackageNls(context, generated.localizedPackageNls);

	return {
		context: context,
		englishKeys: generated.englishKeys,
		localizedKeys: generated.localizedKeys,
		unresolvedKeys: generated.unresolvedKeys,
	};
}

export function createPendingReport(options: WorkflowOptions = {}): PendingReportFile {
	const syncResult = syncManifestI18n(options);
	const context = syncResult.context;
	const bundle = loadAuthorityBundle(context);
	const catalog = loadManifestCatalog(context);
	const workset = loadManifestWorkset(context);
	const counts = {
		total: workset.entries.length,
		pending: 0,
		translated: 0,
		needsReview: 0,
		approved: 0,
		promotable: 0,
	};

	for (const entry of workset.entries) {
		counts[entry.status] += 1;
		if (entry.status === 'approved') {
			counts.promotable += 1;
		}
	}

	let resolvedOccurrences = 0;
	for (const occurrence of catalog.occurrences) {
		if (resolveOccurrenceTranslation(occurrence, bundle) != null) {
			resolvedOccurrences += 1;
		}
	}

	const report: PendingReportFile = {
		$schema: '../schemas/pendingReport.schema.json',
		version: 1,
		locale: context.locale,
		domain: 'manifest',
		generatedAt: nowIso(),
		baseRef: options.baseRef,
		counts: counts,
		coverage: {
			catalogOccurrences: catalog.occurrences.length,
			resolvedOccurrences: resolvedOccurrences,
			unresolvedOccurrences: catalog.occurrences.length - resolvedOccurrences,
			readyForGeneration:
				workset.entries.every(entry => entry.status !== 'pending') &&
				catalog.occurrences.length === resolvedOccurrences,
		},
		items: workset.entries.map(entry => ({
			id: entry.id,
			status: entry.status,
			occurrenceIds: entry.occurrenceIds,
		})),
	};

	if (options.baseRef != null) {
		report.sinceBase = diffWorksetAgainstBase(context, options.baseRef, workset);
	}

	savePendingReport(context, context.pendingReportFile, report);

	if (options.writeTo != null && options.writeTo !== context.pendingReportFile) {
		savePendingReport(context, options.writeTo, report);
	}

	return report;
}

export function writeWorkflowReadme(context: ManifestDomainContext): void {
	writeI18nWorkflowReadme(context.rootDir);
}

export function diffWorksetAgainstBase(
	context: ManifestDomainContext,
	baseRef: string,
	currentWorkset: ReturnType<typeof loadManifestWorkset>,
): { readonly added: number; readonly changed: number; readonly removed: number } | undefined {
	const relativePath = normalizeGitPath(context.rootDir, context.worksetFile);
	const result = spawnSync('git', ['show', `${baseRef}:${relativePath}`], {
		cwd: context.rootDir,
		encoding: 'utf8',
	});
	if (result.status !== 0 || result.stdout.length === 0) {
		return undefined;
	}

	const baseWorkset = JSON.parse(result.stdout) as ReturnType<typeof loadManifestWorkset>;
	const baseEntries = new Map(baseWorkset.entries.map(entry => [entry.id, entry]));
	const currentEntries = new Map(currentWorkset.entries.map(entry => [entry.id, entry]));
	let added = 0;
	let changed = 0;
	let removed = 0;

	for (const [id, entry] of currentEntries) {
		const baseEntry = baseEntries.get(id);
		if (baseEntry == null) {
			added += 1;
			continue;
		}

		if (stableStringify(baseEntry) !== stableStringify(entry)) {
			changed += 1;
		}
	}

	for (const id of baseEntries.keys()) {
		if (!currentEntries.has(id)) {
			removed += 1;
		}
	}

	return { added, changed, removed };
}

function normalizeGitPath(rootDir: string, filePath: string): string {
	return filePath.slice(rootDir.length + 1).replaceAll('\\', '/');
}

export function getManifestOutputKeys(context: ManifestDomainContext): string[] {
	const catalog = loadManifestCatalog(context);
	return catalog.occurrences
		.map(occurrence => occurrence.output)
		.filter(output => output != null)
		.map(output => outputReferenceId(output))
		.sort((left, right) => left.localeCompare(right));
}

export function loadCurrentManifestOutputs(context: ManifestDomainContext): {
	readonly manifest: Record<string, unknown>;
	readonly englishPackageNls: Record<string, string>;
	readonly localizedPackageNls: Record<string, string>;
} {
	return {
		manifest: loadManifest(context),
		englishPackageNls: loadEnglishPackageNls(context),
		localizedPackageNls: loadLocalizedPackageNls(context),
	};
}
