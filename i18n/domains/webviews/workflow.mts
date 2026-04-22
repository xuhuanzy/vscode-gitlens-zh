import { spawnSync } from 'node:child_process';

import fs from 'node:fs';

import type { PendingReportFile } from '../../core/model.mts';
import { nowIso } from '../../core/model.mts';
import { promoteApprovedEntries, resolveOccurrenceTranslation, syncWorkset } from '../../core/authority.mts';
import { reconcileCatalog } from '../../core/reconcile.mts';
import { ensureAuthorityFiles, ensureDomainFiles } from '../../core/store.mts';
import { writeI18nWorkflowReadme } from '../../workflowReadme.mts';

import { createWebviewsDomainContext, type WebviewsDomainContext } from './context.mts';
import { extractSupportedWebviewOccurrences } from './extractor.mts';
import { generateLocalizedSettingsShell } from './generator.mts';
import {
	createEmptyWebviewsCatalogFile,
	createEmptyWebviewsWorksetFile,
	loadAuthorityBundle,
	loadSettingsBuildHtml,
	loadWebviewsCatalog,
	loadWebviewsWorkset,
	saveAuthorityBundle,
	saveLocalizedSettingsShell,
	savePendingReport,
	saveWebviewsCatalog,
	saveWebviewsWorkset,
} from './store.mts';

export interface WorkflowOptions {
	readonly rootDir?: string;
	readonly baseRef?: string;
	readonly writeTo?: string;
}

export function syncWebviewsI18n(options: WorkflowOptions = {}): {
	readonly context: WebviewsDomainContext;
	readonly occurrenceCount: number;
	readonly worksetCount: number;
} {
	const context = createWebviewsDomainContext(options.rootDir);
	ensureAuthorityFiles(context);
	ensureDomainFiles(context, {
		catalog: createEmptyWebviewsCatalogFile(),
		workset: createEmptyWebviewsWorksetFile(),
	});

	const previousCatalog = loadWebviewsCatalog(context);
	const previousWorkset = loadWebviewsWorkset(context);
	const bundle = loadAuthorityBundle(context);
	const extraction = extractSupportedWebviewOccurrences([
		{
			file: 'dist/webviews/settings.html',
			html: loadSettingsBuildHtml(context),
			shell: 'settings',
		},
	]);
	const catalog = reconcileCatalog(previousCatalog, extraction.occurrences, extraction.issues, {
		domain: 'webviews',
		schemaPath: '../schemas/sourceCatalog.schema.json',
		deferredDomains: ['quickpicks', 'formatter', 'runtimeCensus'],
	});
	const workset = syncWorkset(previousWorkset, catalog.occurrences, bundle);

	saveWebviewsCatalog(context, catalog);
	saveWebviewsWorkset(context, workset);

	return {
		context: context,
		occurrenceCount: catalog.occurrences.length,
		worksetCount: workset.entries.length,
	};
}

export function promoteWebviewsAuthority(options: WorkflowOptions = {}): {
	readonly context: WebviewsDomainContext;
	readonly promoted: string[];
} {
	const context = createWebviewsDomainContext(options.rootDir);
	ensureAuthorityFiles(context);
	ensureDomainFiles(context, {
		catalog: createEmptyWebviewsCatalogFile(),
		workset: createEmptyWebviewsWorksetFile(),
	});

	const workset = loadWebviewsWorkset(context);
	const bundle = loadAuthorityBundle(context);
	const promoted = promoteApprovedEntries(workset, bundle);

	saveAuthorityBundle(context, promoted.bundle);
	saveWebviewsWorkset(context, promoted.workset);

	return {
		context: context,
		promoted: promoted.promoted,
	};
}

export function generateWebviewsLocalizedOutputs(options: WorkflowOptions = {}): {
	readonly context: WebviewsDomainContext;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
} {
	const syncResult = syncWebviewsI18n(options);
	const context = syncResult.context;
	const catalog = loadWebviewsCatalog(context);
	const bundle = loadAuthorityBundle(context);
	const englishHtml = loadSettingsBuildHtml(context);
	const generated = generateLocalizedSettingsShell(englishHtml, catalog.occurrences, bundle);

	saveLocalizedSettingsShell(context, generated.localizedHtml);

	return {
		context: context,
		translatedCount: generated.translatedCount,
		unresolvedCount: generated.unresolvedCount,
	};
}

export function createPendingReport(options: WorkflowOptions = {}): PendingReportFile {
	const syncResult = syncWebviewsI18n(options);
	const context = syncResult.context;
	const bundle = loadAuthorityBundle(context);
	const catalog = loadWebviewsCatalog(context);
	const workset = loadWebviewsWorkset(context);
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
		domain: 'webviews',
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
		report.sinceBase = diffWorksetAgainstBase(context, options.baseRef, workset.entries.map(entry => entry.id));
	}

	savePendingReport(context, context.pendingReportFile, report);
	if (options.writeTo != null && options.writeTo !== context.pendingReportFile) {
		savePendingReport(context, options.writeTo, report);
	}

	return report;
}

export function writeWorkflowReadme(context: WebviewsDomainContext): void {
	writeI18nWorkflowReadme(context.rootDir);
}

export function ensureControlledWebviewFiles(options: WorkflowOptions = {}): WebviewsDomainContext {
	const context = createWebviewsDomainContext(options.rootDir);
	ensureAuthorityFiles(context);
	ensureDomainFiles(context, {
		catalog: createEmptyWebviewsCatalogFile(),
		workset: createEmptyWebviewsWorksetFile(),
	});

	if (!fs.existsSync(context.pendingReportFile)) {
		savePendingReport(context, context.pendingReportFile, {
			$schema: '../schemas/pendingReport.schema.json',
			version: 1,
			locale: context.locale,
			domain: 'webviews',
			generatedAt: new Date(0).toISOString(),
			counts: {
				total: 0,
				pending: 0,
				translated: 0,
				needsReview: 0,
				approved: 0,
				promotable: 0,
			},
			coverage: {
				catalogOccurrences: 0,
				resolvedOccurrences: 0,
				unresolvedOccurrences: 0,
				readyForGeneration: false,
			},
			items: [],
		});
	}

	return context;
}

function diffWorksetAgainstBase(
	context: WebviewsDomainContext,
	baseRef: string,
	currentEntryIds: readonly string[],
): { readonly added: number; readonly changed: number; readonly removed: number } | undefined {
	const relativePath = normalizeGitPath(context.rootDir, context.worksetFile);
	const result = spawnSync('git', ['show', `${baseRef}:${relativePath}`], {
		cwd: context.rootDir,
		encoding: 'utf8',
	});
	if (result.status !== 0 || result.stdout.length === 0) {
		return undefined;
	}

	try {
		const previous = JSON.parse(result.stdout) as { readonly entries?: Array<{ readonly id: string; readonly sourceHash?: string }> };
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

function normalizeGitPath(rootDir: string, filePath: string): string {
	return filePath.slice(rootDir.length + 1).replaceAll('\\', '/');
}
