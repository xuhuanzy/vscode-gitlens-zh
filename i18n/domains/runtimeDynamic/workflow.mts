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
	createEmptyCatalogFile,
	createEmptyWorksetFile,
	ensureDomainFiles,
	loadAuthorityBundle,
	loadCatalog as loadRuntimeDynamicCatalog,
	loadWorkset as loadRuntimeDynamicWorkset,
	saveAuthorityBundle,
	saveCatalog as saveRuntimeDynamicCatalog,
	savePendingReport,
	saveReconciliationReport as saveRuntimeDynamicReconciliationReport,
	saveWorkset as saveRuntimeDynamicWorkset,
	writeTextFile,
} from "../../core/store.mts";
import type { I18nLayerInput, I18nLayerOptions } from "../../core/context.mts";

import {
	createRuntimeDynamicDomainContext,
	type RuntimeDynamicDomain,
	type RuntimeDynamicDomainContext,
} from "./context.mts";
import { extractRuntimeDynamicOccurrences } from "./extractor.mts";
import { generateLocalizedRuntimeDynamicSourceFile } from "./generator.mts";
import { loadRuntimeDynamicSourceTargets } from "./targets.mts";

export interface RuntimeDynamicWorkflowOptions extends I18nLayerOptions {
	readonly domain: RuntimeDynamicDomain;
}

const runtimeDynamicDomains: readonly RuntimeDynamicDomain[] = ["formatter", "quickpicks", "webviewHost"];

/** 校验所有动态运行时 domain 不会声明相同的生成镜像路径. */
export function assertRuntimeDynamicGeneratedMirrorPaths(input: I18nLayerInput = {}): void {
	assertUniqueGeneratedMirrorPaths(
		runtimeDynamicDomains.flatMap((domain) => {
			const context = createRuntimeDynamicDomainContext(domain, input);
			return loadRuntimeDynamicSourceTargets(context).map((target) => ({
				owner: `runtimeDynamic:${target.domain}:${target.group}`,
				relativePath: target.file,
			}));
		}),
	);
}

/** 从指定运行时 domain 刷新作用域内 catalog, workset 和 reconciliation report. */
export function syncRuntimeDynamicI18n(options: RuntimeDynamicWorkflowOptions): {
	readonly context: RuntimeDynamicDomainContext;
	readonly occurrenceCount: number;
	readonly worksetCount: number;
} {
	const context = createRuntimeDynamicDomainContext(options.domain, options);
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
			schemaPath: "../schemas/reconciliationReport.schema.json",
		}),
	);
	saveRuntimeDynamicWorkset(context, workset);

	return {
		context: context,
		occurrenceCount: scopedCatalog.occurrences.length,
		worksetCount: filterWorksetEntriesByScope(workset.entries, scope).length,
	};
}

/** 将指定运行时 domain 已批准的 workset 条目提升到共享 authority. */
export function promoteRuntimeDynamicAuthority(options: RuntimeDynamicWorkflowOptions): {
	readonly context: RuntimeDynamicDomainContext;
	readonly promoted: string[];
} {
	const context = createRuntimeDynamicDomainContext(options.domain, options);
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

/** 为指定运行时 domain 生成本地化源码镜像, 并统计已解析与未解析 occurrence. */
export function generateRuntimeDynamicLocalizedOutputs(options: RuntimeDynamicWorkflowOptions): {
	readonly context: RuntimeDynamicDomainContext;
	readonly translatedCount: number;
	readonly unresolvedCount: number;
} {
	const context = ensureRuntimeDynamicDomainFiles(options);
	const catalog = loadRuntimeDynamicCatalog(context);
	const bundle = loadAuthorityBundle(context);
	let translatedCount = 0;
	let unresolvedCount = 0;
	const targets = loadRuntimeDynamicSourceTargets(context);

	assertUniqueGeneratedMirrorPaths(
		targets.map((target) => ({
			owner: `runtimeDynamic:${target.domain}:${target.group}`,
			relativePath: target.file,
		})),
	);

	for (const target of targets) {
		const generated = generateLocalizedRuntimeDynamicSourceFile(target, catalog.occurrences, bundle);
		writeTextFile(path.join(context.generatedRootDir, ...target.file.split("/")), generated.contents);
		translatedCount += generated.translatedCount;
		unresolvedCount += generated.unresolvedCount;
	}

	return {
		context: context,
		translatedCount: translatedCount,
		unresolvedCount: unresolvedCount,
	};
}

/** 同步指定运行时 domain 并写出其作用域内的待处理报告. */
export function createPendingReport(options: RuntimeDynamicWorkflowOptions): PendingReportFile {
	const syncResult = syncRuntimeDynamicI18n(options);
	const context = syncResult.context;
	const bundle = loadAuthorityBundle(context);
	const catalog = loadRuntimeDynamicCatalog(context);
	const workset = loadRuntimeDynamicWorkset(context);
	const scope = getWorksetScope(context);
	const scopedOccurrences = filterCatalogOccurrencesByScope(catalog.occurrences, getCatalogScope(context));
	const scopedEntries = filterWorksetEntriesByScope(workset.entries, scope);
	const report = buildPendingReport({
		locale: context.locale,
		domain: context.domain,
		occurrences: scopedOccurrences,
		entries: scopedEntries,
		bundle: bundle,
		getOccurrenceIds: (entry) => filterOccurrenceIdsByScope(entry.occurrenceIds, scope),
	});

	savePendingReport(context, report);

	return report;
}

/** 确保动态运行时 domain 所需的 authority, catalog 和 workset 存在. */
export function ensureRuntimeDynamicDomainFiles(
	contextOrOptions: RuntimeDynamicDomainContext | RuntimeDynamicWorkflowOptions,
): RuntimeDynamicDomainContext {
	const context =
		"domain" in contextOrOptions && "catalogFile" in contextOrOptions
			? contextOrOptions
			: createRuntimeDynamicDomainContext(contextOrOptions.domain, contextOrOptions);

	ensureDomainFiles(context, {
		catalog: createEmptyCatalogFile({
			schemaPath: "../schemas/sourceCatalog.schema.json",
			domain: context.domain === "webviewHost" ? "webviews" : context.domain,
		}),
		workset: createEmptyWorksetFile({
			schemaPath: "../schemas/translationWorkset.schema.json",
			domain: context.domain === "webviewHost" ? "webviews" : context.domain,
			locale: context.locale,
		}),
	});

	return context;
}

function getWorksetScope(context: RuntimeDynamicDomainContext): WorksetScopeOptions {
	return context.domain === "webviewHost"
		? {
				occurrenceIdPrefix: "webviewHost:",
				worksetDomain: "webviews",
			}
		: {};
}

function getCatalogScope(context: RuntimeDynamicDomainContext): CatalogScopeOptions {
	return context.domain === "webviewHost"
		? {
				occurrenceIdPrefix: "webviewHost:",
				catalogDomain: "webviews",
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
