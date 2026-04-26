import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

import type { PendingReportFile, TranslationWorksetEntry } from '../../core/model.mts';
import { nowIso } from '../../core/model.mts';
import {
	filterOccurrenceIdsByScope,
	filterWorksetEntriesByScope,
	promoteApprovedEntries,
	resolveOccurrenceTranslation,
	syncWorkset,
	type WorksetScopeOptions,
} from '../../core/authority.mts';
import {
	createReconciliationReport,
	filterCatalogOccurrencesByScope,
	reconcileCatalog,
	type CatalogScopeOptions,
} from '../../core/reconcile.mts';
import { assertUniqueGeneratedMirrorPaths } from '../../core/generated.mts';
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

const runtimeDynamicDomains: readonly RuntimeDynamicDomain[] = ['formatter', 'quickpicks', 'webviewHost'];

export function assertRuntimeDynamicGeneratedMirrorPaths(rootDir?: string): void {
	assertUniqueGeneratedMirrorPaths(
		runtimeDynamicDomains.flatMap(domain => {
			const context = createRuntimeDynamicDomainContext(domain, rootDir);
			return loadRuntimeDynamicSourceTargets(context).map(target => ({
				owner: `runtimeDynamic:${target.domain}:${target.group}`,
				relativePath: target.file,
			}));
		}),
	);
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
	const catalogScope = getCatalogScope(context);
	const scopedPreviousCatalog = withCatalogScope(previousCatalog, catalogScope);
	const catalog = reconcileCatalog(previousCatalog, extraction.occurrences, catalogScope);
	const scopedCatalog = withCatalogScope(catalog, catalogScope);
	const scope = getWorksetScope(context);
	const workset = syncWorkset(previousWorkset, scopedCatalog.occurrences, bundle, scope);

	saveRuntimeDynamicCatalog(context, catalog);
	saveRuntimeDynamicReconciliationReport(
		context,
		createReconciliationReport(scopedPreviousCatalog, scopedCatalog, extraction.issues, {
			domain: context.domain,
			schemaPath: '../schemas/reconciliationReport.schema.json',
		}),
	);
	saveRuntimeDynamicWorkset(context, workset);

	return {
		context: context,
		occurrenceCount: scopedCatalog.occurrences.length,
		worksetCount: filterWorksetEntriesByScope(workset.entries, scope).length,
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
	const promoted = promoteApprovedEntries(workset, bundle, getWorksetScope(context));

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
	const targets = loadRuntimeDynamicSourceTargets(context);

	assertUniqueGeneratedMirrorPaths(
		targets.map(target => ({
			owner: `runtimeDynamic:${target.domain}:${target.group}`,
			relativePath: target.file,
		})),
	);

	for (const target of targets) {
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
	const scope = getWorksetScope(context);
	const scopedOccurrences = filterCatalogOccurrencesByScope(catalog.occurrences, getCatalogScope(context));
	const scopedEntries = filterWorksetEntriesByScope(workset.entries, scope);
	const counts = {
		total: scopedEntries.length,
		pending: 0,
		translated: 0,
		needsReview: 0,
		approved: 0,
		promotable: 0,
	};

	for (const entry of scopedEntries) {
		counts[entry.status] += 1;
		if (entry.status === 'approved') {
			counts.promotable += 1;
		}
	}

	let resolvedOccurrences = 0;
	for (const occurrence of scopedOccurrences) {
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
					scopedEntries.map(entry => entry.id),
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
			catalogOccurrences: scopedOccurrences.length,
			resolvedOccurrences: resolvedOccurrences,
			unresolvedOccurrences: scopedOccurrences.length - resolvedOccurrences,
			readyForGeneration:
				scopedEntries.every(entry => entry.status !== 'pending') &&
				scopedOccurrences.length === resolvedOccurrences,
		},
		items: scopedEntries.map(entry => ({
			id: entry.id,
			status: entry.status,
			occurrenceIds: filterOccurrenceIdsByScope(entry.occurrenceIds, scope),
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
			readonly entries?: TranslationWorksetEntry[];
		};
		const scope = getWorksetScope(context);
		const previousIds = new Set(filterWorksetEntriesByScope(previous.entries ?? [], scope).map(entry => entry.id));
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

function getWorksetScope(context: RuntimeDynamicDomainContext): WorksetScopeOptions {
	return context.domain === 'webviewHost'
		? {
				occurrenceIdPrefix: 'webviewHost:',
				worksetDomain: 'webviews',
			}
		: {};
}

function getCatalogScope(context: RuntimeDynamicDomainContext): CatalogScopeOptions {
	return context.domain === 'webviewHost'
		? {
				occurrenceIdPrefix: 'webviewHost:',
				catalogDomain: 'webviews',
				deferredDomains: ['quickpicks', 'formatter'],
			}
		: {};
}

function withCatalogScope(
	catalog: ReturnType<typeof loadRuntimeDynamicCatalog>,
	scope: CatalogScopeOptions,
): ReturnType<typeof loadRuntimeDynamicCatalog> {
	return {
		...catalog,
		occurrences: filterCatalogOccurrencesByScope(catalog.occurrences, scope),
	};
}

function exists(filePath: string): boolean {
	return fs.existsSync(filePath);
}
