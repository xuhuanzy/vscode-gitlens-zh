import { spawnSync } from 'node:child_process';

import fs from 'node:fs';
import path from 'node:path';

import type { PendingReportFile } from '../../core/model.mts';
import { nowIso } from '../../core/model.mts';
import { promoteApprovedEntries, resolveOccurrenceTranslation, syncWorkset } from '../../core/authority.mts';
import { reconcileCatalog } from '../../core/reconcile.mts';
import { ensureAuthorityFiles, ensureDomainFiles } from '../../core/store.mts';
import { writeI18nWorkflowReadme } from '../../workflowReadme.mts';

import { createWebviewsDomainContext, type WebviewsDomainContext } from './context.mts';
import { extractSupportedWebviewOccurrences } from './extractor.mts';
import {
	generateLocalizedRuntimeBundle,
	generateLocalizedSettingsShell,
} from './generator.mts';
import {
	createEmptyWebviewsCatalogFile,
	createEmptyWebviewsWorksetFile,
	loadAuthorityBundle,
	loadSettingsBuildHtml,
	loadWebviewsCatalog,
	loadWebviewsWorkset,
	saveAuthorityBundle,
	saveLocalizedRuntimeBundle,
	saveLocalizedSettingsShell,
	savePendingReport,
	saveWebviewsCatalog,
	saveWebviewsWorkset,
} from './store.mts';

interface RuntimeBundleTarget {
	readonly bundle: 'welcome' | 'rebase' | 'home' | 'commitDetails' | 'timeline' | 'graph';
	readonly directories?: readonly string[];
	readonly files?: readonly string[];
}

interface DeferredRuntimeTarget {
	readonly bundle: 'patchDetails';
	readonly reason: string;
	readonly directories: readonly string[];
}

const supportedRuntimeBundleTargets: readonly RuntimeBundleTarget[] = [
	{
		bundle: 'welcome',
		files: [
			'src/webviews/apps/welcome/components/welcome-page.ts',
			'src/webviews/apps/welcome/components/welcome-parts.ts',
		],
	},
	{
		bundle: 'rebase',
		directories: ['src/webviews/apps/rebase'],
	},
	{
		bundle: 'home',
		directories: [
			'src/webviews/apps/home',
			'src/webviews/apps/plus/home',
			'src/webviews/apps/plus/shared',
			'src/webviews/apps/shared/components',
		],
	},
	{
		bundle: 'commitDetails',
		directories: ['src/webviews/apps/commitDetails'],
	},
	{
		bundle: 'timeline',
		directories: ['src/webviews/apps/plus/timeline'],
	},
	{
		bundle: 'graph',
		directories: ['src/webviews/apps/plus/graph'],
	},
];

const deferredRuntimeTargets: readonly DeferredRuntimeTarget[] = [
	{
		bundle: 'patchDetails',
		reason: 'follow-up page family deferred from current rollout',
		directories: ['src/webviews/apps/plus/patchDetails'],
	},
];
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
			kind: 'html',
			file: 'dist/webviews/settings.html',
			html: loadSettingsBuildHtml(context),
			shell: 'settings',
		},
		...loadRuntimeExtractionTargets(context),
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

	const settingsRuntimeBundle = generateLocalizedRuntimeBundle('settings', context.locale, catalog.occurrences, bundle);
	saveLocalizedRuntimeBundle(context, 'settings', settingsRuntimeBundle.json);

	let runtimeBundleTranslatedCount = 0;
	let runtimeBundleUnresolvedCount = 0;

	for (const target of supportedRuntimeBundleTargets) {
		const localizedBundle = generateLocalizedRuntimeBundle(target.bundle, context.locale, catalog.occurrences, bundle);
		saveLocalizedRuntimeBundle(context, target.bundle, localizedBundle.json);
		runtimeBundleTranslatedCount += localizedBundle.translatedCount;
		runtimeBundleUnresolvedCount += localizedBundle.unresolvedCount;
	}

	return {
		context: context,
		translatedCount:
			generated.translatedCount + settingsRuntimeBundle.translatedCount + runtimeBundleTranslatedCount,
		unresolvedCount:
			generated.unresolvedCount + settingsRuntimeBundle.unresolvedCount + runtimeBundleUnresolvedCount,
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

function loadRuntimeExtractionTargets(context: WebviewsDomainContext) {
	return [
		...supportedRuntimeBundleTargets.flatMap(target => loadRuntimeBundleTargets(context, target)),
		...deferredRuntimeTargets.flatMap(target =>
			loadRuntimeBundleTargets(context, {
				bundle: target.bundle,
				directories: target.directories,
				mode: 'deferred',
				reason: target.reason,
			}),
		),
	];
}

function loadRuntimeBundleTargets(
	context: WebviewsDomainContext,
	target: {
		readonly bundle: string;
		readonly directories?: readonly string[];
		readonly files?: readonly string[];
		readonly mode?: 'supported' | 'deferred';
		readonly reason?: string;
	},
) {
	const results = new Map<string, NonNullable<ReturnType<typeof loadSourceTarget>>>();

	for (const file of target.files ?? []) {
		const loaded = loadSourceTarget(context, file, target.bundle, target.mode, target.reason);
		if (loaded != null) {
			results.set(loaded.file, loaded);
		}
	}

	for (const directory of target.directories ?? []) {
		for (const file of enumerateSourceFiles(context, directory)) {
			const loaded = loadSourceTarget(context, file, target.bundle, target.mode, target.reason);
			if (loaded != null) {
				results.set(loaded.file, loaded);
			}
		}
	}

	return [...results.values()].sort((left, right) => left.file.localeCompare(right.file));
}

function loadSourceTarget(
	context: WebviewsDomainContext,
	file: string,
	bundle: string,
	mode?: 'supported' | 'deferred',
	reason?: string,
) {
	const syntax = getSourceSyntax(file);
	if (syntax == null) return undefined;

	const absolute = path.join(context.rootDir, ...file.split('/'));
	if (!fs.existsSync(absolute)) return undefined;

	return {
		kind: 'source' as const,
		file: file,
		source: fs.readFileSync(absolute, 'utf8'),
		syntax: syntax,
		bundle: bundle,
		mode: mode,
		deferredReason: reason,
	};
}

function enumerateSourceFiles(context: WebviewsDomainContext, directory: string): string[] {
	const absoluteDirectory = path.join(context.rootDir, ...directory.split('/'));
	if (!fs.existsSync(absoluteDirectory)) return [];

	return enumerateSourceFilesCore(context.rootDir, absoluteDirectory).sort((left, right) => left.localeCompare(right));
}

function enumerateSourceFilesCore(rootDir: string, currentDirectory: string): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
		if (entry.name === '__tests__') continue;

		const absolute = path.join(currentDirectory, entry.name);
		if (entry.isDirectory()) {
			results.push(...enumerateSourceFilesCore(rootDir, absolute));
			continue;
		}

		if (shouldSkipSourceFile(entry.name)) continue;

		const relative = path.relative(rootDir, absolute).replaceAll('\\', '/');
		if (getSourceSyntax(relative) == null) continue;

		results.push(relative);
	}

	return results;
}

function shouldSkipSourceFile(fileName: string): boolean {
	return (
		fileName.endsWith('.d.ts') ||
		fileName.endsWith('.test.ts') ||
		fileName.endsWith('.test.tsx') ||
		fileName.endsWith('.test.jsx') ||
		fileName.endsWith('.css.ts')
	);
}

function getSourceSyntax(file: string): 'ts' | 'tsx' | 'jsx' | undefined {
	if (file.endsWith('.tsx')) return 'tsx';
	if (file.endsWith('.jsx')) return 'jsx';
	if (file.endsWith('.ts')) return 'ts';
	return undefined;
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



