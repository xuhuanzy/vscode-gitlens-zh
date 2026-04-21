import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

import type { PendingReportFile } from '../../core/model.mts';
import { nowIso, outputReferenceId, stableStringify } from '../../core/model.mts';
import { promoteApprovedEntries, resolveOccurrenceTranslation, syncWorkset } from '../../core/authority.mts';
import { reconcileCatalog } from '../../core/reconcile.mts';
import { ensureAuthorityFiles, ensureDomainFiles } from '../../core/store.mts';

import { createManifestDomainContext, type ManifestDomainContext } from './context.mts';
import { extractManifestOccurrences } from './extractor.mts';
import { generateManifestOutputs } from './generator.mts';
import {
	createEmptyManifestCatalogFile,
	createEmptyManifestWorksetFile,
	loadAuthorityBundle,
	loadEnglishPackageNls,
	loadLocalizedPackageNls,
	loadManifest,
	loadManifestCatalog,
	loadManifestWorkset,
	saveAuthorityBundle,
	saveEnglishPackageNls,
	saveLocalizedPackageNls,
	saveManifest,
	saveManifestCatalog,
	saveManifestWorkset,
	savePendingReport,
} from './store.mts';

export interface WorkflowOptions {
	readonly rootDir?: string;
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
	const catalog = reconcileCatalog(previousCatalog, extraction.occurrences, extraction.issues, {
		domain: 'manifest',
		schemaPath: '../schemas/sourceCatalog.schema.json',
		deferredDomains: ['webviews', 'quickpicks', 'formatter', 'runtimeCensus'],
	});
	const workset = syncWorkset(previousWorkset, catalog.occurrences, bundle);

	saveManifestCatalog(context, catalog);
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
	const context = createManifestDomainContext(options.rootDir);
	ensureAuthorityFiles(context);
	ensureDomainFiles(context, {
		catalog: createEmptyManifestCatalogFile(),
		workset: createEmptyManifestWorksetFile(),
	});

	const manifest = loadManifest(context);
	const catalog = loadManifestCatalog(context);
	const bundle = loadAuthorityBundle(context);
	const generated = generateManifestOutputs(manifest, catalog.occurrences, bundle);

	saveManifest(context, generated.manifest);
	saveEnglishPackageNls(context, generated.englishPackageNls);
	saveLocalizedPackageNls(context, generated.localizedPackageNls);

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
	};

	if (options.baseRef != null) {
		report.sinceBase = diffWorksetAgainstBase(context, options.baseRef, workset);
	}

	savePendingReport(context, context.pendingReportFile, report);

	if (options.writeTo != null && options.writeTo !== context.pendingReportFile) {
		savePendingReport(context, options.writeTo, report);
	}

	return report;
}

export function writeWorkflowReadme(context: ManifestDomainContext): void {
	const content = `# I18n Workflow

当前 i18n 结构已切为 \`core + domain adapter\`：

- \`i18n/core\` 负责通用 occurrence、reference、output reference、authority、workset、report 模型
- \`i18n/domains/manifest\` 负责 \`package.json\` / \`package.nls*\` 的提取、对账与生成
- \`webviews\`、\`quickpicks\`、\`formatter\` 后续将作为新的 domain adapter 接入

\`i18n/catalog/package.catalog.json\` 保留 manifest domain 的完整 occurrence、source reference、output reference 与对账信息。
\`i18n/worksets/package.zh-cn.json\` 只保留翻译工作状态、双语消息记录与 \`occurrenceIds\` 引用，不重复落盘 occurrence 元数据。
\`i18n/reports/package-pending.json\` 是派生的索引/进度视图，只提供 counts、coverage 与 workset 定位信息，不作为编辑入口。
\`i18n/authority/zh-cn/overrides.json\` 统一承载 \`occurrence\` / \`anchor\` / \`scope\` / \`output\` 四类覆盖规则。

## 日常流程

1. 运行 \`pnpm run sync:package-nls\`，从 \`package.json\` + \`package.nls.json\` 重建 manifest catalog 与 workset。
2. 运行 \`pnpm run report:package-nls:zh-cn:pending\`，它会先刷新 catalog/workset，再默认回写 \`i18n/reports/package-pending.json\`。
3. 如需额外副本，再使用 \`pnpm run report:package-nls:zh-cn:pending -- --write package-pending.snapshot.json\`。
4. 由 Codex 读取 report 中的 \`id\` / \`occurrenceIds\` 定位条目，再修改 \`i18n/worksets/package.zh-cn.json\`，补全或修订条目的 \`translation\` 字段，并将状态推进到 \`translated\` / \`needsReview\` / \`approved\`。
5. 翻译多轮推进时重复运行 \`pnpm run report:package-nls:zh-cn:pending\`，让 authority / override 已覆盖的条目自动从 workset 中收敛掉。
6. 运行 \`pnpm run promote:package-nls:zh-cn\`，把 \`approved\` 条目晋升到 authority。
7. 运行 \`pnpm run generate:package-nls\`，重建 \`package.json\`、\`package.nls.json\` 与 \`package.nls.zh-cn.json\`。

## Override selector 语义

- \`occurrence\`：只覆盖一个具体 occurrence
- \`anchor\`：覆盖同一稳定锚点
- \`scope\`：覆盖某个 domain scope 下的 occurrence
- \`output\`：覆盖某个具体输出目标，例如 manifest key

manifest 域当前的解析优先级为：\`output -> occurrence -> anchor -> scope -> authority -> terms\`。

## 上游合并后的标准流程

1. 先合并上游英文源码。
2. 重新运行 \`pnpm run sync:package-nls\`。
3. 查看 \`i18n/catalog/package.catalog.json\` 中的 added / changed / moved / removed / ambiguous。
4. 修订 workset，必要时重新翻译并晋升 authority。
5. 重新生成 manifest 本地化产物。

## 约束

- 不使用 \`contributions.json\` 作为 i18n 真源。
- 不保留旧的 manifest-only 模型、旧 override 分文件结构或兼容读取逻辑。
- \`webviews\`、\`quickpicks\`、\`formatter\` 的运行时本地化仍是后续阶段，本次只完成 core 泛化与 manifest adapter 重建。
`;

	fs.writeFileSync(context.workflowDocFile, content, 'utf8');
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

export function getManifestOutputKeys(context: ManifestDomainContext): string[] {
	const catalog = loadManifestCatalog(context);
	return catalog.occurrences
		.map(occurrence => occurrence.output)
		.filter(output => output != null)
		.map(output => outputReferenceId(output))
		.sort((left, right) => left.localeCompare(right));
}

export function loadCurrentManifestOutputs(context: ManifestDomainContext): {
	readonly manifest: Record<string, unknown>;
	readonly englishPackageNls: Record<string, string>;
	readonly localizedPackageNls: Record<string, string>;
} {
	return {
		manifest: loadManifest(context),
		englishPackageNls: loadEnglishPackageNls(context),
		localizedPackageNls: loadLocalizedPackageNls(context),
	};
}
