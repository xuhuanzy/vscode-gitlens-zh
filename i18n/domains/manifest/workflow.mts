import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { PendingReportFile } from '../../core/model.mts';
import { nowIso, stableStringify } from '../../core/model.mts';
import { promoteApprovedEntries, resolveOccurrenceTranslation, syncWorkset } from '../../core/authority.mts';
import { createReconciliationReport, reconcileCatalog } from '../../core/reconcile.mts';
import { ensureAuthorityFiles, ensureDomainFiles } from '../../core/store.mts';

import { createManifestDomainContext, type ManifestDomainContext } from './context.mts';
import { extractManifestOccurrences } from './extractor.mts';
import { generateManifestOutputs } from './generator.mts';
import {
	createEmptyManifestCatalogFile,
	createEmptyManifestWorksetFile,
	loadAuthorityBundle,
	loadEnglishPackageNls,
	loadManifest,
	loadManifestCatalog,
	loadManifestWorkset,
	saveAuthorityBundle,
	saveEnglishPackageNls,
	saveGeneratedManifest,
	saveLocalizedPackageNls,
	saveManifestCatalog,
	saveManifestReconciliationReport,
	saveManifestWorkset,
	savePendingReport,
} from './store.mts';

export interface WorkflowOptions {
	readonly rootDir?: string;
	readonly outputRoot?: string;
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
	const context = createManifestDomainContext(options.rootDir, options.outputRoot);
	ensureAuthorityFiles(context);
	ensureDomainFiles(context, {
		catalog: createEmptyManifestCatalogFile(),
		workset: createEmptyManifestWorksetFile(),
	});

	const beforeManifest = readTextFile(context.manifestFile);
	const beforeContributions = readOptionalTextFile(path.join(context.rootDir, 'contributions.json'));
	assertManifestIsNotTokenized(context);
	const manifest = loadManifest(context);
	const catalog = loadManifestCatalog(context);
	const bundle = loadAuthorityBundle(context);
	const generated = generateManifestOutputs(manifest, catalog.occurrences, bundle);

	saveGeneratedManifest(context, generated.manifest);
	saveEnglishPackageNls(context, generated.englishPackageNls);
	saveLocalizedPackageNls(context, generated.localizedPackageNls);
	prepareStagedExtensionRoot(context);
	assertUnchanged(context.manifestFile, beforeManifest, 'root package.json');
	assertUnchanged(path.join(context.rootDir, 'contributions.json'), beforeContributions, 'contributions.json');

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

	const sinceBase = options.baseRef == null ? undefined : diffWorksetAgainstBase(context, options.baseRef, workset);
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
		...(sinceBase == null ? {} : { sinceBase: sinceBase }),
	};

	savePendingReport(context, context.pendingReportFile, report);

	if (options.writeTo != null && options.writeTo !== context.pendingReportFile) {
		savePendingReport(context, options.writeTo, report);
	}

	return report;
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

export function assertManifestIsNotTokenized(context: ManifestDomainContext): void {
	const extraction = extractManifestOccurrences(loadManifest(context), {});
	const tokenized = extraction.issues.filter(issue =>
		issue.reason.startsWith('Missing english package.nls entry for token'),
	);
	if (tokenized.length === 0) return;

	throw new Error(
		`Root package.json contains generated localization tokens: ${tokenized
			.slice(0, 10)
			.map(issue => issue.occurrenceId)
			.join(', ')}`,
	);
}

function prepareStagedExtensionRoot(context: ManifestDomainContext): void {
	fs.mkdirSync(context.stagedManifestRootDir, { recursive: true });

	for (const entry of fs.readdirSync(context.rootDir, { withFileTypes: true })) {
		if (shouldSkipStagedRootEntry(entry.name)) continue;

		const source = path.join(context.rootDir, entry.name);
		const target = path.join(context.stagedManifestRootDir, entry.name);

		if (entry.isDirectory()) {
			if (shouldMaterializeStagedRootEntry(entry.name)) {
				materializeStagedDirectory(source, target);
				continue;
			}

			if (fs.existsSync(target)) continue;
			fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
		} else if (entry.isFile()) {
			fs.copyFileSync(source, target);
		}
	}
}

function materializeStagedDirectory(source: string, target: string): void {
	fs.rmSync(target, { recursive: true, force: true });
	fs.mkdirSync(target, { recursive: true });

	for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
		const sourcePath = path.join(source, entry.name);
		const targetPath = path.join(target, entry.name);

		if (entry.isDirectory()) {
			materializeStagedDirectory(sourcePath, targetPath);
		} else if (entry.isFile()) {
			linkOrCopyFile(sourcePath, targetPath);
		}
	}
}

function linkOrCopyFile(source: string, target: string): void {
	try {
		fs.linkSync(source, target);
	} catch {
		fs.copyFileSync(source, target);
	}
}

function shouldMaterializeStagedRootEntry(name: string): boolean {
	return name === 'dist' || name === 'images' || name === 'walkthroughs';
}

function shouldSkipStagedRootEntry(name: string): boolean {
	return (
		name === '.git' ||
		name === '.work' ||
		name === 'package.json' ||
		name === 'package.nls.json' ||
		name === 'package.nls.zh-cn.json'
	);
}

function assertUnchanged(filePath: string, expected: string | undefined, label: string): void {
	if (readOptionalTextFile(filePath) === expected) return;

	throw new Error(`Manifest localization generation unexpectedly mutated ${label}`);
}

function readTextFile(filePath: string): string {
	return fs.readFileSync(filePath, 'utf8');
}

function readOptionalTextFile(filePath: string): string | undefined {
	try {
		return readTextFile(filePath);
	} catch {
		return undefined;
	}
}
