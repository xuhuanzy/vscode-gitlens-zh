import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

import type { PendingReportFile } from '../../core/model.mts';
import { nowIso } from '../../core/model.mts';
import { promoteApprovedEntries, resolveOccurrenceTranslation, syncWorkset } from '../../core/authority.mts';
import { createReconciliationReport, reconcileCatalog } from '../../core/reconcile.mts';
import { ensureAuthorityFiles, ensureDomainFiles } from '../../core/store.mts';

import {
	createRuntimeDynamicDomainContext,
	type RuntimeDynamicDomain,
	type RuntimeDynamicDomainContext,
} from './context.mts';
import { extractRuntimeDynamicOccurrences } from './extractor.mts';
import { generateLocalizedRuntimeDynamicSourceFile } from './generator.mts';
import {
	createEmptyRuntimeDynamicCatalogFile,
	createEmptyRuntimeDynamicReconciliationReportFile,
	createEmptyRuntimeDynamicWorksetFile,
	loadAuthorityBundle,
	loadRuntimeDynamicCatalog,
	loadRuntimeDynamicWorkset,
	saveAuthorityBundle,
	saveLocalizedRuntimeDynamicSource,
	savePendingReport,
	saveRuntimeDynamicCatalog,
	saveRuntimeDynamicReconciliationReport,
	saveRuntimeDynamicWorkset,
} from './store.mts';
import { loadRuntimeDynamicSourceTargets } from './targets.mts';

export interface RuntimeDynamicWorkflowOptions {
	readonly rootDir?: string;
	readonly domain: RuntimeDynamicDomain;
	readonly baseRef?: string;
	readonly writeTo?: string;
	readonly dynamicSourcesOnly?: boolean;
}

export function syncRuntimeDynamicI18n(options: RuntimeDynamicWorkflowOptions): {
	readonly context: RuntimeDynamicDomainContext;
	readonly occurrenceCount: number;
	readonly worksetCount: number;
} {
	const context = createRuntimeDynamicDomainContext(options.domain, options.rootDir);
	ensureRuntimeDynamicDomainFiles(context);

	const previousCatalog = loadRuntimeDynamicCatalog(context);
	const previousWorkset = loadRuntimeDynamicWorkset(context);
	const bundle = loadAuthorityBundle(context);
	const extraction = extractRuntimeDynamicOccurrences(loadRuntimeDynamicSourceTargets(context));
	const catalog = reconcileCatalog(previousCatalog, extraction.occurrences);
	const reconciliation = createReconciliationReport(previousCatalog, catalog, extraction.issues, {
		domain: context.domain,
		schemaPath: '../schemas/reconciliationReport.schema.json',
	});
	const workset = syncWorkset(previousWorkset, catalog.occurrences, bundle);

	saveRuntimeDynamicCatalog(context, catalog);
	saveRuntimeDynamicReconciliationReport(context, reconciliation);
	saveRuntimeDynamicWorkset(context, workset);

	return {
		context: context,
		occurrenceCount: catalog.occurrences.length,
		worksetCount: workset.entries.length,
	};
}

export function promoteRuntimeDynamicAuthority(options: RuntimeDynamicWorkflowOptions): {
	readonly context: RuntimeDynamicDomainContext;
	readonly promoted: string[];
} {
	const context = createRuntimeDynamicDomainContext(options.domain, options.rootDir);
	ensureRuntimeDynamicDomainFiles(context);

	const workset = loadRuntimeDynamicWorkset(context);
	const bundle = loadAuthorityBundle(context);
	const promoted = promoteApprovedEntries(workset, bundle);

	saveAuthorityBundle(context, promoted.bundle);
	saveRuntimeDynamicWorkset(context, promoted.workset);

	return {
		context: context,
		promoted: promoted.promoted,
	};
}

export function generateRuntimeDynamicLocalizedOutputs(options: RuntimeDynamicWorkflowOptions): {
	readonly context: RuntimeDynamicDomainContext;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
} {
	const context = options.dynamicSourcesOnly
		? ensureRuntimeDynamicDomainFiles(options)
		: syncRuntimeDynamicI18n(options).context;
	const catalog = loadRuntimeDynamicCatalog(context);
	const bundle = loadAuthorityBundle(context);
	let translatedCount = 0;
	let unresolvedCount = 0;

	for (const target of loadRuntimeDynamicSourceTargets(context)) {
		const generated = generateLocalizedRuntimeDynamicSourceFile(target, catalog.occurrences, bundle);
		saveLocalizedRuntimeDynamicSource(context, target.file, generated.contents);
		translatedCount += generated.translatedCount;
		unresolvedCount += generated.unresolvedCount;
	}

	return {
		context: context,
		translatedCount: translatedCount,
		unresolvedCount: unresolvedCount,
	};
}

export function createPendingReport(options: RuntimeDynamicWorkflowOptions): PendingReportFile {
	const syncResult = syncRuntimeDynamicI18n(options);
	const context = syncResult.context;
	const bundle = loadAuthorityBundle(context);
	const catalog = loadRuntimeDynamicCatalog(context);
	const workset = loadRuntimeDynamicWorkset(context);
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

	const sinceBase =
		options.baseRef == null
			? undefined
			: diffWorksetAgainstBase(
				context,
				options.baseRef,
				workset.entries.map(entry => entry.id),
			);
	const report: PendingReportFile = {
		$schema: '../schemas/pendingReport.schema.json',
		version: 1,
		locale: context.locale,
		domain: context.domain,
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
		...(sinceBase == null ? {} : { sinceBase: sinceBase }),
	};

	savePendingReport(context, context.pendingReportFile, report);
	if (options.writeTo != null && options.writeTo !== context.pendingReportFile) {
		savePendingReport(context, options.writeTo, report);
	}

	return report;
}

export function ensureRuntimeDynamicDomainFiles(
	contextOrOptions: RuntimeDynamicDomainContext | RuntimeDynamicWorkflowOptions,
): RuntimeDynamicDomainContext {
	const context =
		'domain' in contextOrOptions && 'catalogFile' in contextOrOptions
			? contextOrOptions
			: createRuntimeDynamicDomainContext(contextOrOptions.domain, contextOrOptions.rootDir);

	ensureAuthorityFiles(context);
	ensureDomainFiles(context, {
		catalog: createEmptyRuntimeDynamicCatalogFile(context),
		workset: createEmptyRuntimeDynamicWorksetFile(context),
	});

	if (!exists(context.reconciliationReportFile)) {
		saveRuntimeDynamicReconciliationReport(context, createEmptyRuntimeDynamicReconciliationReportFile(context));
	}

	return context;
}

function diffWorksetAgainstBase(
	context: RuntimeDynamicDomainContext,
	baseRef: string,
	currentEntryIds: readonly string[],
): { readonly added: number; readonly changed: number; readonly removed: number } | undefined {
	const relativePath = context.worksetFile.slice(context.rootDir.length + 1).replaceAll('\\', '/');
	const result = spawnSync('git', ['show', `${baseRef}:${relativePath}`], {
		cwd: context.rootDir,
		encoding: 'utf8',
	});
	if (result.status !== 0 || result.stdout.length === 0) {
		return undefined;
	}

	try {
		const previous = JSON.parse(result.stdout) as {
			readonly entries?: Array<{ readonly id: string }>;
		};
		const previousIds = new Set((previous.entries ?? []).map(entry => entry.id));
		const currentIds = new Set(currentEntryIds);
		let added = 0;
		let removed = 0;
		for (const id of currentIds) {
			if (!previousIds.has(id)) added++;
		}
		for (const id of previousIds) {
			if (!currentIds.has(id)) removed++;
		}
		return {
			added: added,
			changed: 0,
			removed: removed,
		};
	} catch {
		return undefined;
	}
}

function exists(filePath: string): boolean {
	return fs.existsSync(filePath);
}
