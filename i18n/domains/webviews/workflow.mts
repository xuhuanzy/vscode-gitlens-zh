import { spawnSync } from 'node:child_process';

import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

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

import { createWebviewsDomainContext, type WebviewsDomainContext } from './context.mts';
import { extractSupportedWebviewOccurrences } from './extractor.mts';
import { generateLocalizedHtmlSourceFile, generateLocalizedSourceFile } from './generator.mts';
import {
	createEmptyWebviewsCatalogFile,
	createEmptyWebviewsReconciliationReportFile,
	createEmptyWebviewsWorksetFile,
	deleteLocalizedDynamicSource,
	loadAuthorityBundle,
	loadSourceTargetContents,
	loadWebviewsCatalog,
	loadWebviewsWorkset,
	saveAuthorityBundle,
	saveLocalizedDynamicSource,
	saveLocalizedHtmlSource,
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

interface StaticHtmlTarget {
	readonly shell: 'settings';
	readonly file: string;
}

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

const settingsHtmlSourceFile = 'src/webviews/apps/settings/settings.html';
const settingsHtmlPartialsDirectory = 'src/webviews/apps/settings/partials';

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
		...loadStaticHtmlExtractionTargets(context),
		...loadDynamicExtractionTargets(context),
	]);
	const catalogScope = getWebviewsCatalogScope();
	const scopedPreviousCatalog = withCatalogScope(previousCatalog, catalogScope);
	const catalog = reconcileCatalog(previousCatalog, extraction.occurrences, catalogScope);
	const scopedCatalog = withCatalogScope(catalog, catalogScope);
	const reconciliation = createReconciliationReport(scopedPreviousCatalog, scopedCatalog, extraction.issues, {
		domain: 'webviews',
		schemaPath: '../schemas/reconciliationReport.schema.json',
	});
	const scope = getWebviewsWorksetScope();
	const workset = syncWorkset(previousWorkset, scopedCatalog.occurrences, bundle, scope);

	saveWebviewsCatalog(context, catalog);
	saveWebviewsReconciliationReport(context, reconciliation);
	saveWebviewsWorkset(context, workset);

	return {
		context: context,
		occurrenceCount: scopedCatalog.occurrences.length,
		worksetCount: filterWorksetEntriesByScope(workset.entries, scope).length,
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
	const promoted = promoteApprovedEntries(workset, bundle, getWebviewsWorksetScope());

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
	const settingsSources = generateWebviewsLocalizedSettingsSourcesCore(context);
	const dynamicSources = generateWebviewsLocalizedDynamicSourcesCore(context);

	return {
		context: context,
		translatedCount: settingsSources.translatedCount + dynamicSources.translatedCount,
		unresolvedCount: settingsSources.unresolvedCount + dynamicSources.unresolvedCount,
	};
}

export function generateWebviewsLocalizedDynamicSources(options: WorkflowOptions = {}): {
	readonly context: WebviewsDomainContext;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
} {
	const context = ensureControlledWebviewFiles(options);
	const dynamicSources = generateWebviewsLocalizedDynamicSourcesCore(context);

	return {
		context: context,
		translatedCount: dynamicSources.translatedCount,
		unresolvedCount: dynamicSources.unresolvedCount,
	};
}

export function generateWebviewsLocalizedSettingsSources(options: WorkflowOptions = {}): {
	readonly context: WebviewsDomainContext;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
} {
	const context = ensureControlledWebviewFiles(options);
	const settingsSources = generateWebviewsLocalizedSettingsSourcesCore(context);

	return {
		context: context,
		translatedCount: settingsSources.translatedCount,
		unresolvedCount: settingsSources.unresolvedCount,
	};
}

function generateWebviewsLocalizedSettingsSourcesCore(context: WebviewsDomainContext): {
	readonly translatedCount: number;
	readonly unresolvedCount: number;
} {
	const catalog = loadWebviewsCatalog(context);
	const bundle = loadAuthorityBundle(context);
	let translatedCount = 0;
	let unresolvedCount = 0;
	const staticTargets = loadStaticHtmlTargets(context);

	assertUniqueGeneratedMirrorPaths(
		staticTargets.map(target => ({ owner: `webviews:${target.shell}`, relativePath: target.file })),
	);

	for (const target of staticTargets) {
		const html = loadSourceTargetContents(context, target.file);
		if (html == null) continue;

		const generated = generateLocalizedHtmlSourceFile(html, target.file, catalog.occurrences, bundle, {
			htmlLang: target.file === settingsHtmlSourceFile ? 'zh-CN' : undefined,
		});
		saveLocalizedHtmlSource(context, target.file, generated.localizedHtml);
		translatedCount += generated.translatedCount;
		unresolvedCount += generated.unresolvedCount;
	}

	return {
		translatedCount: translatedCount,
		unresolvedCount: unresolvedCount,
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
	assertUniqueGeneratedMirrorPaths([
		...loadStaticHtmlTargets(context).map(target => ({
			owner: `webviews:${target.shell}`,
			relativePath: target.file,
		})),
		...[...allLocalizedSourceFiles].map(file => ({ owner: 'webviews:source', relativePath: file })),
	]);

	for (const file of [...allLocalizedSourceFiles].sort((left, right) => left.localeCompare(right))) {
		const source = loadSourceTargetContents(context, file);
		if (source == null) {
			deleteLocalizedDynamicSource(context, file);
			continue;
		}

		const localizedSource = generateLocalizedSourceFile(source, file, catalog.occurrences, bundle);
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
	const scope = getWebviewsWorksetScope();
	const scopedOccurrences = filterCatalogOccurrencesByScope(catalog.occurrences, getWebviewsCatalogScope());
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
		domain: 'webviews',
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

function getWebviewsWorksetScope(): WorksetScopeOptions {
	return {
		occurrenceIdPrefix: 'webviews:',
		worksetDomain: 'webviews',
	};
}

function getWebviewsCatalogScope(): CatalogScopeOptions {
	return {
		occurrenceIdPrefix: 'webviews:',
		catalogDomain: 'webviews',
		deferredDomains: ['quickpicks', 'formatter'],
	};
}

function withCatalogScope(
	catalog: ReturnType<typeof loadWebviewsCatalog>,
	scope: CatalogScopeOptions,
): ReturnType<typeof loadWebviewsCatalog> {
	return {
		...catalog,
		occurrences: filterCatalogOccurrencesByScope(catalog.occurrences, scope),
	};
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

function loadStaticHtmlExtractionTargets(context: WebviewsDomainContext) {
	return loadStaticHtmlTargets(context)
		.map(target => {
			const html = loadSourceTargetContents(context, target.file);
			if (html == null) return undefined;

			return {
				kind: 'html' as const,
				file: target.file,
				html: html,
				shell: target.shell,
			};
		})
		.filter((target): target is Exclude<typeof target, undefined> => target != null);
}

function loadStaticHtmlTargets(context: WebviewsDomainContext): StaticHtmlTarget[] {
	return [
		{ shell: 'settings', file: settingsHtmlSourceFile },
		...enumerateHtmlFiles(context, settingsHtmlPartialsDirectory).map(file => ({
			shell: 'settings' as const,
			file: file,
		})),
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

function enumerateHtmlFiles(context: WebviewsDomainContext, directory: string): string[] {
	const absoluteDirectory = path.join(context.rootDir, ...directory.split('/'));
	if (!fs.existsSync(absoluteDirectory)) return [];

	return enumerateFilesCore(context.rootDir, absoluteDirectory, fileName => fileName.endsWith('.html')).sort(
		(left, right) => left.localeCompare(right),
	);
}

function enumerateSourceFilesCore(rootDir: string, currentDirectory: string): string[] {
	return enumerateFilesCore(
		rootDir,
		currentDirectory,
		fileName => !shouldSkipSourceFile(fileName) && getSourceSyntax(fileName) != null,
	);
}

function enumerateFilesCore(
	rootDir: string,
	currentDirectory: string,
	includeFile: (fileName: string) => boolean,
): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
		if (entry.name === '__tests__') continue;

		const absolute = path.join(currentDirectory, entry.name);
		if (entry.isDirectory()) {
			results.push(...enumerateFilesCore(rootDir, absolute, includeFile));
			continue;
		}

		if (!includeFile(entry.name)) continue;

		const relative = path.relative(rootDir, absolute).replaceAll('\\', '/');
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
			readonly entries?: TranslationWorksetEntry[];
		};
		const scope = getWebviewsWorksetScope();
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
