import { spawnSync } from 'node:child_process';

import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

import type { PendingReportFile } from '../../core/model.mts';
import { nowIso } from '../../core/model.mts';
import { promoteApprovedEntries, resolveOccurrenceTranslation, syncWorkset } from '../../core/authority.mts';
import { createReconciliationReport, reconcileCatalog } from '../../core/reconcile.mts';
import { ensureAuthorityFiles, ensureDomainFiles } from '../../core/store.mts';
import { writeI18nWorkflowReadme } from '../../workflowReadme.mts';

import { createWebviewsDomainContext, type WebviewsDomainContext } from './context.mts';
import { extractSupportedWebviewOccurrences } from './extractor.mts';
import { generateLocalizedSettingsShell, generateLocalizedSourceFile } from './generator.mts';
import {
	createEmptyWebviewsCatalogFile,
	createEmptyWebviewsReconciliationReportFile,
	createEmptyWebviewsWorksetFile,
	deleteLocalizedDynamicSource,
	loadAuthorityBundle,
	loadSettingsBuildHtml,
	loadSettingsExtractionHtml,
	loadSourceTargetContents,
	loadWebviewsCatalog,
	loadWebviewsWorkset,
	saveAuthorityBundle,
	saveLocalizedDynamicSource,
	saveLocalizedSettingsShell,
	savePendingReport,
	saveWebviewsCatalog,
	saveWebviewsReconciliationReport,
	saveWebviewsWorkset,
} from './store.mts';

interface DynamicSourceTarget {
	readonly bundle: 'welcome' | 'rebase' | 'home' | 'commitDetails' | 'timeline' | 'graph';
	readonly directories?: readonly string[];
	readonly files?: readonly string[];
}

interface DeferredRuntimeTarget {
	readonly bundle: 'patchDetails';
	readonly reason: string;
	readonly directories: readonly string[];
}

const localizedDynamicArtifactBundles = new Set<DynamicSourceTarget['bundle']>([
	'welcome',
	'rebase',
	'home',
	'commitDetails',
	'timeline',
	'graph',
]);

const supportedDynamicSourceTargets: readonly DynamicSourceTarget[] = [
	{
		bundle: 'welcome',
		files: [
			'src/webviews/apps/welcome/welcome.ts',
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
		directories: [
			'src/webviews/apps/commitDetails',
			'src/webviews/apps/shared/components',
			'src/webviews/apps/plus/patchDetails/components',
		],
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
			html: loadSettingsExtractionHtml(context),
			shell: 'settings',
		},
		...loadDynamicExtractionTargets(context),
	]);
	const catalog = reconcileCatalog(previousCatalog, extraction.occurrences);
	const reconciliation = createReconciliationReport(previousCatalog, catalog, extraction.issues, {
		domain: 'webviews',
		schemaPath: '../schemas/reconciliationReport.schema.json',
	});
	const workset = syncWorkset(previousWorkset, catalog.occurrences, bundle);

	saveWebviewsCatalog(context, catalog);
	saveWebviewsReconciliationReport(context, reconciliation);
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
	const settingsShell = generateWebviewsLocalizedSettingsShellCore(context);
	const dynamicSources = generateWebviewsLocalizedDynamicSourcesCore(context);

	return {
		context: context,
		translatedCount: settingsShell.translatedCount + dynamicSources.translatedCount,
		unresolvedCount: settingsShell.unresolvedCount + dynamicSources.unresolvedCount,
	};
}

export function generateWebviewsLocalizedDynamicSources(options: WorkflowOptions = {}): {
	readonly context: WebviewsDomainContext;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
} {
	const syncResult = syncWebviewsI18n(options);
	const context = syncResult.context;
	const dynamicSources = generateWebviewsLocalizedDynamicSourcesCore(context);

	return {
		context: context,
		translatedCount: dynamicSources.translatedCount,
		unresolvedCount: dynamicSources.unresolvedCount,
	};
}

export function generateWebviewsLocalizedSettingsShell(options: WorkflowOptions = {}): {
	readonly context: WebviewsDomainContext;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
} {
	const syncResult = syncWebviewsI18n(options);
	const context = syncResult.context;
	const settingsShell = generateWebviewsLocalizedSettingsShellCore(context);

	return {
		context: context,
		translatedCount: settingsShell.translatedCount,
		unresolvedCount: settingsShell.unresolvedCount,
	};
}

function generateWebviewsLocalizedSettingsShellCore(context: WebviewsDomainContext): {
	readonly translatedCount: number;
	readonly unresolvedCount: number;
} {
	const catalog = loadWebviewsCatalog(context);
	const bundle = loadAuthorityBundle(context);
	const englishHtml = loadSettingsBuildHtml(context);
	const generated = generateLocalizedSettingsShell(englishHtml, catalog.occurrences, bundle);
	saveLocalizedSettingsShell(context, generated.localizedHtml);

	return {
		translatedCount: generated.translatedCount,
		unresolvedCount: generated.unresolvedCount,
	};
}

function generateWebviewsLocalizedDynamicSourcesCore(context: WebviewsDomainContext): {
	readonly translatedCount: number;
	readonly unresolvedCount: number;
} {
	const catalog = loadWebviewsCatalog(context);
	const bundle = loadAuthorityBundle(context);

	let localizedSourceTranslatedCount = 0;
	let localizedSourceUnresolvedCount = 0;
	const allLocalizedSourceFiles = new Set(
		supportedDynamicSourceTargets
			.flatMap(target => [
				...(target.files ?? []),
				...(target.directories?.flatMap(directory => enumerateSourceFiles(context, directory)) ?? []),
			])
			.map(normalizePath),
	);

	for (const target of supportedDynamicSourceTargets) {
		const targetFiles = [
			...(target.files ?? []),
			...(target.directories?.flatMap(directory => enumerateSourceFiles(context, directory)) ?? []),
		]
			.filter((file, index, files) => files.indexOf(file) === index)
			.sort((left, right) => left.localeCompare(right));
		for (const file of targetFiles) {
			if (!localizedDynamicArtifactBundles.has(target.bundle)) {
				deleteLocalizedDynamicSource(context, file);
				continue;
			}

			const source = loadSourceTargetContents(context, file);
			if (source == null) {
				deleteLocalizedDynamicSource(context, file);
				continue;
			}

			const localizedSource = generateLocalizedSourceFile(
				source,
				file,
				target.bundle,
				catalog.occurrences,
				bundle,
			);
			saveLocalizedDynamicSource(
				context,
				file,
				rewriteRelativeModuleSpecifiersForLocalizedCopy(
					context,
					file,
					localizedSource.contents,
					allLocalizedSourceFiles,
				),
			);
			localizedSourceTranslatedCount += localizedSource.translatedCount;
			localizedSourceUnresolvedCount += localizedSource.unresolvedCount;
		}
	}

	return {
		translatedCount: localizedSourceTranslatedCount,
		unresolvedCount: localizedSourceUnresolvedCount,
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
		report.sinceBase = diffWorksetAgainstBase(
			context,
			options.baseRef,
			workset.entries.map(entry => entry.id),
		);
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

	if (!fs.existsSync(context.reconciliationReportFile)) {
		saveWebviewsReconciliationReport(context, createEmptyWebviewsReconciliationReportFile());
	}

	return context;
}

function loadDynamicExtractionTargets(context: WebviewsDomainContext) {
	return [
		...supportedDynamicSourceTargets.flatMap(target => loadDynamicSourceTargets(context, target)),
		...deferredRuntimeTargets.flatMap(target =>
			loadDynamicSourceTargets(context, {
				bundle: target.bundle,
				directories: target.directories,
				mode: 'deferred',
				reason: target.reason,
			}),
		),
	];
}

function loadDynamicSourceTargets(
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

	return enumerateSourceFilesCore(context.rootDir, absoluteDirectory).sort((left, right) =>
		left.localeCompare(right),
	);
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
		const previous = JSON.parse(result.stdout) as {
			readonly entries?: Array<{ readonly id: string; readonly sourceHash?: string }>;
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

function normalizeGitPath(rootDir: string, filePath: string): string {
	return filePath.slice(rootDir.length + 1).replaceAll('\\', '/');
}

function rewriteRelativeModuleSpecifiersForLocalizedCopy(
	context: WebviewsDomainContext,
	sourceFilePath: string,
	sourceText: string,
	localizedSourceFiles: ReadonlySet<string>,
): string {
	const sourceFile = ts.createSourceFile(
		sourceFilePath,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		getScriptKind(sourceFilePath),
	);
	const replacements: Array<{ readonly start: number; readonly end: number; readonly value: string }> = [];
	const localizedAbsoluteFile = path.join(context.localizedDynamicSourceDir, ...sourceFilePath.split('/'));
	const localizedDirectory = path.dirname(localizedAbsoluteFile);

	const visit = (node: ts.Node): void => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier != null &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			const specifier = node.moduleSpecifier.text;
			if (specifier.startsWith('.')) {
				const originalTarget = normalizePath(path.posix.join(path.posix.dirname(sourceFilePath), specifier));
				const localizedSpecifier = getLocalizedSpecifierForTarget(
					sourceFilePath,
					specifier,
					localizedSourceFiles,
				);
				const replacement = localizedSpecifier
					? localizedSpecifier
					: toImportSpecifier(
							path.relative(localizedDirectory, path.join(context.rootDir, ...originalTarget.split('/'))),
						);

				if (replacement !== specifier) {
					replacements.push({
						start: node.moduleSpecifier.getStart(sourceFile) + 1,
						end: node.moduleSpecifier.getEnd() - 1,
						value: replacement,
					});
				}
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return applyTextReplacements(sourceText, replacements);
}

function applyTextReplacements(
	source: string,
	replacements: ReadonlyArray<{ readonly start: number; readonly end: number; readonly value: string }>,
): string {
	let result = source;
	for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
		result = `${result.slice(0, replacement.start)}${replacement.value}${result.slice(replacement.end)}`;
	}
	return result;
}

function toImportSpecifier(relativePath: string): string {
	const normalized = normalizePath(relativePath);
	return normalized.startsWith('.') ? normalized : `./${normalized}`;
}

function getLocalizedSpecifierForTarget(
	sourceFilePath: string,
	specifier: string,
	localizedSourceFiles: ReadonlySet<string>,
): string | undefined {
	const originalTarget = normalizePath(path.posix.join(path.posix.dirname(sourceFilePath), specifier));
	if (localizedSourceFiles.has(originalTarget)) {
		return specifier;
	}

	for (const candidate of getPossibleSourceFilesForSpecifier(originalTarget)) {
		if (!localizedSourceFiles.has(candidate)) continue;

		return toImportSpecifier(path.posix.relative(path.posix.dirname(sourceFilePath), candidate));
	}

	return undefined;
}

function getPossibleSourceFilesForSpecifier(relativeTarget: string): string[] {
	const extension = path.posix.extname(relativeTarget);
	if (extension === '.js') {
		return [
			relativeTarget.slice(0, -3) + '.ts',
			relativeTarget.slice(0, -3) + '.tsx',
			relativeTarget.slice(0, -3) + '.jsx',
		];
	}

	if (extension === '.jsx') {
		return [relativeTarget.slice(0, -4) + '.tsx', relativeTarget];
	}

	return [relativeTarget];
}

function getScriptKind(filePath: string): ts.ScriptKind {
	if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
	if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
	if (filePath.endsWith('.ts')) return ts.ScriptKind.TS;
	return ts.ScriptKind.JS;
}

function normalizePath(value: string): string {
	return value.replaceAll('\\', '/');
}
