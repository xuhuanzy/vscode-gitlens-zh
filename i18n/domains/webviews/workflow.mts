import fs from "node:fs";
import path from "node:path";

import type { PendingReportFile } from "../../core/model.mts";
import {
	filterOccurrenceIdsByScope,
	filterWorksetEntriesByScope,
	promoteApprovedEntries,
	syncWorkset,
	type WorksetScopeOptions,
} from "../../core/authority.mts";
import {
	createReconciliationReport,
	filterCatalogOccurrencesByScope,
	reconcileCatalog,
	type CatalogScopeOptions,
} from "../../core/reconcile.mts";
import { assertUniqueGeneratedMirrorPaths } from "../../core/generated.mts";
import { buildPendingReport } from "../../core/report.mts";
import {
	ensureAuthorityFiles,
	ensureDomainFiles,
	createEmptyCatalogFile,
	createEmptyWorksetFile,
	loadAuthorityBundle,
	loadCatalog as loadWebviewsCatalog,
	loadWorkset as loadWebviewsWorkset,
	saveAuthorityBundle,
	saveCatalog as saveWebviewsCatalog,
	savePendingReport,
	saveReconciliationReport as saveWebviewsReconciliationReport,
	saveWorkset as saveWebviewsWorkset,
	writeTextFile,
} from "../../core/store.mts";
import type { I18nLayerOptions } from "../../core/context.mts";

import { createWebviewsDomainContext, type WebviewsDomainContext } from "./context.mts";
import { extractSupportedWebviewOccurrences } from "./extractor.mts";
import { generateLocalizedHtmlSourceFile, generateLocalizedSourceFile } from "./generator.mts";

interface DynamicSourceTarget {
	readonly bundle: "welcome" | "rebase" | "home" | "commitDetails" | "timeline" | "graph" | "composer";
	readonly directories?: readonly string[];
	readonly files?: readonly string[];
}

interface DeferredRuntimeTarget {
	readonly bundle: "patchDetails";
	readonly reason: string;
	readonly directories: readonly string[];
}

interface StaticHtmlTarget {
	readonly shell: "settings";
	readonly file: string;
}

const supportedDynamicSourceTargets: readonly DynamicSourceTarget[] = [
	{
		bundle: "welcome",
		files: [
			"src/webviews/apps/welcome/welcome.ts",
			"src/webviews/apps/welcome/components/welcome-page.ts",
			"src/webviews/apps/welcome/components/welcome-parts.ts",
		],
	},
	{
		bundle: "rebase",
		directories: ["src/webviews/apps/rebase"],
	},
	{
		bundle: "home",
		directories: [
			"src/webviews/apps/home",
			"src/webviews/apps/plus/home",
			"src/webviews/apps/plus/shared",
			"src/webviews/apps/shared/components",
		],
	},
	{
		bundle: "commitDetails",
		directories: [
			"src/webviews/apps/commitDetails",
			"src/webviews/apps/shared/components",
			"src/webviews/apps/plus/patchDetails/components",
		],
	},
	{
		bundle: "timeline",
		directories: ["src/webviews/apps/plus/timeline"],
	},
	{
		bundle: "graph",
		directories: ["src/webviews/apps/plus/graph"],
	},
	{
		bundle: "composer",
		directories: ["src/webviews/apps/plus/composer"],
	},
];

const deferredRuntimeTargets: readonly DeferredRuntimeTarget[] = [
	{
		bundle: "patchDetails",
		reason: "follow-up page family deferred from current rollout",
		directories: ["src/webviews/apps/plus/patchDetails"],
	},
];

const settingsHtmlSourceFile = "src/webviews/apps/settings/settings.html";
const settingsHtmlPartialsDirectory = "src/webviews/apps/settings/partials";

export type WorkflowOptions = I18nLayerOptions;

/** 从受支持的 webview 源码刷新共享 catalog, workset 和 reconciliation report. */
export function syncWebviewsI18n(options: WorkflowOptions = {}): {
	readonly context: WebviewsDomainContext;
	readonly occurrenceCount: number;
	readonly worksetCount: number;
} {
	const context = ensureControlledWebviewFiles(options);

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
		domain: "webviews",
		schemaPath: "../schemas/reconciliationReport.schema.json",
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

/** 将 webviews 作用域内已批准的 workset 条目提升到 authority 真源. */
export function promoteWebviewsAuthority(options: WorkflowOptions = {}): {
	readonly context: WebviewsDomainContext;
	readonly promoted: string[];
} {
	const context = ensureControlledWebviewFiles(options);

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

/** 生成设置 HTML 与动态 webview 源码的完整本地化输出. */
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

/** 仅生成动态 webview 源码 overlay. */
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

/** 仅生成设置页 HTML 及其 partial 的本地化镜像. */
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
		staticTargets.map((target) => ({ owner: `webviews:${target.shell}`, relativePath: target.file })),
	);

	for (const target of staticTargets) {
		const html = loadSourceTargetContents(context, target.file);
		if (html == null) continue;

		const generated = generateLocalizedHtmlSourceFile(html, target.file, catalog.occurrences, bundle, {
			htmlLang: target.file === settingsHtmlSourceFile ? "zh-CN" : undefined,
		});
		writeTextFile(path.join(context.generatedRootDir, ...target.file.split("/")), generated.localizedHtml);
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
		supportedDynamicSourceTargets.flatMap((target) => [
			...(target.files ?? []),
			...(target.directories?.flatMap((directory) => enumerateSourceFiles(context, directory)) ?? []),
		]),
	);
	assertUniqueGeneratedMirrorPaths([
		...loadStaticHtmlTargets(context).map((target) => ({
			owner: `webviews:${target.shell}`,
			relativePath: target.file,
		})),
		...[...allLocalizedSourceFiles].map((file) => ({ owner: "webviews:source", relativePath: file })),
	]);

	for (const file of [...allLocalizedSourceFiles].sort((left, right) => left.localeCompare(right))) {
		const source = loadSourceTargetContents(context, file);
		if (source == null) {
			fs.rmSync(path.join(context.generatedRootDir, ...file.split("/")), { force: true });
			continue;
		}

		const localizedSource = generateLocalizedSourceFile(source, file, catalog.occurrences, bundle);
		writeTextFile(path.join(context.generatedRootDir, ...file.split("/")), localizedSource.contents);
		localizedSourceTranslatedCount += localizedSource.translatedCount;
		localizedSourceUnresolvedCount += localizedSource.unresolvedCount;
	}

	return {
		translatedCount: localizedSourceTranslatedCount,
		unresolvedCount: localizedSourceUnresolvedCount,
	};
}

/** 同步 webviews 作用域并写出当前待处理翻译与覆盖率报告. */
export function createPendingReport(options: WorkflowOptions = {}): PendingReportFile {
	const syncResult = syncWebviewsI18n(options);
	const context = syncResult.context;
	const bundle = loadAuthorityBundle(context);
	const catalog = loadWebviewsCatalog(context);
	const workset = loadWebviewsWorkset(context);
	const scope = getWebviewsWorksetScope();
	const scopedOccurrences = filterCatalogOccurrencesByScope(catalog.occurrences, getWebviewsCatalogScope());
	const scopedEntries = filterWorksetEntriesByScope(workset.entries, scope);
	const report = buildPendingReport({
		locale: context.locale,
		domain: "webviews",
		occurrences: scopedOccurrences,
		entries: scopedEntries,
		bundle: bundle,
		getOccurrenceIds: (entry) => filterOccurrenceIdsByScope(entry.occurrenceIds, scope),
	});

	savePendingReport(context, report);

	return report;
}

function getWebviewsWorksetScope(): WorksetScopeOptions {
	return {
		occurrenceIdPrefix: "webviews:",
		worksetDomain: "webviews",
	};
}

function getWebviewsCatalogScope(): CatalogScopeOptions {
	return {
		occurrenceIdPrefix: "webviews:",
		catalogDomain: "webviews",
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

/** 确保 webviews 所需持久文件存在, 但不隐式重新抽取上游源码. */
export function ensureControlledWebviewFiles(options: WorkflowOptions = {}): WebviewsDomainContext {
	const context = createWebviewsDomainContext(options);
	ensureAuthorityFiles(context);
	ensureDomainFiles(context, {
		catalog: createEmptyCatalogFile({
			schemaPath: "../schemas/sourceCatalog.schema.json",
			domain: "webviews",
		}),
		workset: createEmptyWorksetFile({
			schemaPath: "../schemas/translationWorkset.schema.json",
			domain: "webviews",
			locale: context.locale,
		}),
	});

	return context;
}

function loadDynamicExtractionTargets(context: WebviewsDomainContext) {
	return [
		...supportedDynamicSourceTargets.flatMap((target) => loadDynamicSourceTargets(context, target)),
		...deferredRuntimeTargets.flatMap((target) =>
			loadDynamicSourceTargets(context, {
				bundle: target.bundle,
				directories: target.directories,
				mode: "deferred",
				reason: target.reason,
			}),
		),
	];
}

function loadStaticHtmlExtractionTargets(context: WebviewsDomainContext) {
	return loadStaticHtmlTargets(context)
		.map((target) => {
			const html = loadSourceTargetContents(context, target.file);
			if (html == null) return undefined;

			return {
				kind: "html" as const,
				file: target.file,
				html: html,
				shell: target.shell,
			};
		})
		.filter((target): target is Exclude<typeof target, undefined> => target != null);
}

function loadSourceTargetContents(context: WebviewsDomainContext, relativeFile: string): string | undefined {
	try {
		return fs.readFileSync(path.join(context.upstreamRoot, ...relativeFile.split("/")), "utf8");
	} catch {
		return undefined;
	}
}

function loadStaticHtmlTargets(context: WebviewsDomainContext): StaticHtmlTarget[] {
	return [
		{ shell: "settings", file: settingsHtmlSourceFile },
		...enumerateHtmlFiles(context, settingsHtmlPartialsDirectory).map((file) => ({
			shell: "settings" as const,
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
		readonly mode?: "supported" | "deferred";
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
	mode?: "supported" | "deferred",
	reason?: string,
) {
	const syntax = getSourceSyntax(file);
	if (syntax == null) return undefined;

	const absolute = path.join(context.upstreamRoot, ...file.split("/"));
	if (!fs.existsSync(absolute)) return undefined;

	return {
		kind: "source" as const,
		file: file,
		source: fs.readFileSync(absolute, "utf8"),
		syntax: syntax,
		bundle: bundle,
		mode: mode,
		deferredReason: reason,
	};
}

function enumerateSourceFiles(context: WebviewsDomainContext, directory: string): string[] {
	const absoluteDirectory = path.join(context.upstreamRoot, ...directory.split("/"));
	if (!fs.existsSync(absoluteDirectory)) return [];

	return fs
		.globSync("**/*.{ts,tsx,jsx}", {
			cwd: absoluteDirectory,
			exclude: ["**/__tests__/**", "**/*.d.ts", "**/*.test.{ts,tsx,jsx}", "**/*.css.ts"],
		})
		.map((file) => path.relative(context.upstreamRoot, path.join(absoluteDirectory, file)).replaceAll("\\", "/"))
		.sort((left, right) => left.localeCompare(right));
}

function enumerateHtmlFiles(context: WebviewsDomainContext, directory: string): string[] {
	const absoluteDirectory = path.join(context.upstreamRoot, ...directory.split("/"));
	if (!fs.existsSync(absoluteDirectory)) return [];

	return fs
		.globSync("**/*.html", { cwd: absoluteDirectory, exclude: ["**/__tests__/**"] })
		.map((file) => path.relative(context.upstreamRoot, path.join(absoluteDirectory, file)).replaceAll("\\", "/"))
		.sort((left, right) => left.localeCompare(right));
}

function getSourceSyntax(file: string): "ts" | "tsx" | "jsx" | undefined {
	if (file.endsWith(".tsx")) return "tsx";
	if (file.endsWith(".jsx")) return "jsx";
	if (file.endsWith(".ts")) return "ts";
	return undefined;
}
