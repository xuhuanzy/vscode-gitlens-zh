import fs from "node:fs";

import type { PendingReportFile } from "../../core/model.mts";
import { promoteApprovedEntries, syncWorkset } from "../../core/authority.mts";
import { createReconciliationReport, reconcileCatalog } from "../../core/reconcile.mts";
import { buildPendingReport } from "../../core/report.mts";
import {
	createEmptyCatalogFile,
	createEmptyWorksetFile,
	ensureDomainFiles,
	loadAuthorityBundle,
	loadCatalog as loadManifestCatalog,
	loadWorkset as loadManifestWorkset,
	readJsonFile,
	readJsonFileIfMissing,
	saveAuthorityBundle,
	saveCatalog as saveManifestCatalog,
	savePendingReport,
	saveReconciliationReport as saveManifestReconciliationReport,
	saveWorkset as saveManifestWorkset,
	writeJsonFile,
} from "../../core/store.mts";

import { createManifestDomainContext, type ManifestDomainContext, type ManifestDomainOptions } from "./context.mts";
import { extractManifestOccurrences } from "./extractor.mts";
import { generateManifestOutputs } from "./generator.mts";

export type WorkflowOptions = ManifestDomainOptions;

/** 从上游 manifest 刷新 catalog, workset 和 reconciliation report. */
export function syncManifestI18n(options: WorkflowOptions = {}): {
	readonly context: ManifestDomainContext;
	readonly occurrenceCount: number;
	readonly worksetCount: number;
} {
	const context = createManifestDomainContext(options);
	ensureManifestDomainFiles(context);

	const manifest = readJsonFile<Record<string, unknown>>(context.manifestFile);
	const englishNls = readJsonFileIfMissing<Record<string, string>>(context.englishPackageNlsFile, {});
	const previousCatalog = loadManifestCatalog(context);
	const bundle = loadAuthorityBundle(context);
	const previousWorkset = loadManifestWorkset(context);
	const extraction = extractManifestOccurrences(manifest, englishNls);
	const catalog = reconcileCatalog(previousCatalog, extraction.occurrences);
	const reconciliation = createReconciliationReport(previousCatalog, catalog, extraction.issues, {
		domain: "manifest",
		schemaPath: "../schemas/reconciliationReport.schema.json",
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

/** 将 manifest workset 中已批准的翻译提升到 authority 真源. */
export function promoteManifestAuthority(options: WorkflowOptions = {}): {
	readonly context: ManifestDomainContext;
	readonly promoted: string[];
} {
	const context = createManifestDomainContext(options);
	ensureManifestDomainFiles(context);

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

/** 生成可打包的本地化 manifest 根目录, 并确认上游输入文件保持不变. */
export function generateManifestLocalizedOutputs(options: WorkflowOptions = {}): {
	readonly context: ManifestDomainContext;
	readonly englishKeys: number;
	readonly localizedKeys: number;
	readonly unresolvedKeys: number;
} {
	const context = createManifestDomainContext(options);
	ensureManifestDomainFiles(context);

	const beforeManifest = readTextFile(context.manifestFile);
	const beforeContributions = readOptionalTextFile(context.contributionsFile);
	const manifest = readJsonFile<Record<string, unknown>>(context.manifestFile);
	const tokenized = extractManifestOccurrences(manifest, {}).issues.filter((issue) =>
		issue.reason.startsWith("Missing english package.nls entry for token"),
	);
	if (tokenized.length !== 0) {
		throw new Error(
			`Root package.json contains generated localization tokens: ${tokenized
				.slice(0, 10)
				.map((issue) => issue.occurrenceId)
				.join(", ")}`,
		);
	}
	const catalog = loadManifestCatalog(context);
	const bundle = loadAuthorityBundle(context);
	const generated = generateManifestOutputs(manifest, catalog.occurrences, bundle);

	writeJsonFile(context.generatedManifestFile, generated.manifest);
	writeJsonFile(
		context.englishPackageNlsFile,
		Object.fromEntries(
			Object.entries(generated.englishPackageNls).sort(([left], [right]) => left.localeCompare(right)),
		),
	);
	writeJsonFile(
		context.localizedPackageNlsFile,
		Object.fromEntries(
			Object.entries(generated.localizedPackageNls).sort(([left], [right]) => left.localeCompare(right)),
		),
	);
	assertUnchanged(context.manifestFile, beforeManifest, "root package.json");
	assertUnchanged(context.contributionsFile, beforeContributions, "contributions.json");

	return {
		context: context,
		englishKeys: generated.englishKeys,
		localizedKeys: generated.localizedKeys,
		unresolvedKeys: generated.unresolvedKeys,
	};
}

/** 同步 manifest 状态并写出当前待处理翻译与覆盖率报告. */
export function createPendingReport(options: WorkflowOptions = {}): PendingReportFile {
	const syncResult = syncManifestI18n(options);
	const context = syncResult.context;
	const bundle = loadAuthorityBundle(context);
	const catalog = loadManifestCatalog(context);
	const workset = loadManifestWorkset(context);
	const report = buildPendingReport({
		locale: context.locale,
		domain: "manifest",
		occurrences: catalog.occurrences,
		entries: workset.entries,
		bundle: bundle,
	});

	savePendingReport(context, report);

	return report;
}

function ensureManifestDomainFiles(context: ManifestDomainContext): void {
	ensureDomainFiles(context, {
		catalog: createEmptyCatalogFile({
			schemaPath: "../schemas/sourceCatalog.schema.json",
			domain: "manifest",
		}),
		workset: createEmptyWorksetFile({
			schemaPath: "../schemas/translationWorkset.schema.json",
			domain: "manifest",
			locale: context.locale,
		}),
	});
}

function assertUnchanged(filePath: string, expected: string | undefined, label: string): void {
	if (readOptionalTextFile(filePath) === expected) return;

	throw new Error(`Manifest localization generation unexpectedly mutated ${label}`);
}

function readTextFile(filePath: string): string {
	return fs.readFileSync(filePath, "utf8");
}

function readOptionalTextFile(filePath: string): string | undefined {
	try {
		return readTextFile(filePath);
	} catch {
		return undefined;
	}
}
