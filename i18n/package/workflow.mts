import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

import type { PendingReportFile } from '../shared/model.mts';
import { nowIso } from '../shared/model.mts';
import { resolveOccurrenceTranslation, promoteApprovedEntries, syncWorkset } from './authority.mts';
import { createPackageI18nContext, type PackageI18nContext } from './context.mts';
import { extractManifestOccurrences } from './extractor.mts';
import { reconcileCatalog } from './reconcile.mts';
import {
	ensurePackageI18nFiles,
	loadAuthorityBundle,
	loadCatalog,
	loadEnglishPackageNls,
	loadLocalizedPackageNls,
	loadManifest,
	loadWorkset,
	saveAuthorityBundle,
	saveCatalog,
	saveEnglishPackageNls,
	saveLocalizedPackageNls,
	saveManifest,
	savePendingReport,
	saveWorkset,
	type AuthorityBundle,
} from './store.mts';

export interface WorkflowOptions {
	readonly rootDir?: string;
	readonly baseRef?: string;
	readonly writeTo?: string;
}

export function syncPackageManifestI18n(options: WorkflowOptions = {}): {
	readonly context: PackageI18nContext;
	readonly occurrenceCount: number;
	readonly worksetCount: number;
} {
	const context = createPackageI18nContext(options.rootDir);
	ensurePackageI18nFiles(context);

	const manifest = loadManifest(context);
	const englishNls = loadEnglishPackageNls(context);
	const previousCatalog = loadCatalog(context);
	const bundle = loadAuthorityBundle(context);
	const previousWorkset = loadWorkset(context);
	const extraction = extractManifestOccurrences(manifest, englishNls);
	const catalog = reconcileCatalog(previousCatalog, extraction.occurrences, extraction.issues);
	const workset = syncWorkset(previousWorkset, catalog.occurrences, bundle);

	saveCatalog(context, catalog);
	saveWorkset(context, workset);

	return {
		context: context,
		occurrenceCount: catalog.occurrences.length,
		worksetCount: workset.entries.length,
	};
}

export function promotePackageManifestAuthority(options: WorkflowOptions = {}): {
	readonly context: PackageI18nContext;
	readonly promoted: string[];
} {
	const context = createPackageI18nContext(options.rootDir);
	ensurePackageI18nFiles(context);

	const workset = loadWorkset(context);
	const bundle = loadAuthorityBundle(context);
	const promoted = promoteApprovedEntries(workset, bundle);

	saveAuthorityBundle(context, promoted.bundle);
	saveWorkset(context, promoted.workset);

	return {
		context: context,
		promoted: promoted.promoted,
	};
}

export function generatePackageManifestOutputs(options: WorkflowOptions = {}): {
	readonly context: PackageI18nContext;
	readonly englishKeys: number;
	readonly localizedKeys: number;
	readonly unresolvedKeys: number;
} {
	const context = createPackageI18nContext(options.rootDir);
	ensurePackageI18nFiles(context);

	const manifest = loadManifest(context);
	const catalog = loadCatalog(context);
	const bundle = loadAuthorityBundle(context);
	const localizedPackageNls = loadLocalizedPackageNls(context);

	const englishPackageNls: Record<string, string> = {};
	const nextLocalizedPackageNls: Record<string, string> = {};

	for (const occurrence of catalog.occurrences) {
		englishPackageNls[occurrence.key] = occurrence.sourceText;
		setManifestValue(manifest, occurrence.pathSegments, `%${occurrence.key}%`);

		const resolved = resolveOccurrenceTranslation(occurrence, bundle);
		if (resolved != null) {
			nextLocalizedPackageNls[occurrence.key] = resolved.pattern.text;
			continue;
		}

		if (localizedPackageNls[occurrence.key] != null) {
			delete localizedPackageNls[occurrence.key];
		}
	}

	saveManifest(context, manifest);
	saveEnglishPackageNls(context, englishPackageNls);
	saveLocalizedPackageNls(context, nextLocalizedPackageNls);

	return {
		context: context,
		englishKeys: Object.keys(englishPackageNls).length,
		localizedKeys: Object.keys(nextLocalizedPackageNls).length,
		unresolvedKeys: Object.keys(englishPackageNls).length - Object.keys(nextLocalizedPackageNls).length,
	};
}

export function createPendingReport(options: WorkflowOptions = {}): PendingReportFile {
	const syncResult = syncPackageManifestI18n(options);
	const context = syncResult.context;
	const bundle = loadAuthorityBundle(context);
	const catalog = loadCatalog(context);
	const workset = loadWorkset(context);
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
		locale: 'zh-cn',
		domain: 'manifest',
		generatedAt: nowIso(),
		baseRef: options.baseRef,
		counts: counts,
		coverage: {
			catalogOccurrences: catalog.occurrences.length,
			resolvedOccurrences: resolvedOccurrences,
			unresolvedOccurrences: catalog.occurrences.length - resolvedOccurrences,
			readyForGeneration: workset.entries.every(entry => entry.status !== 'pending') &&
				catalog.occurrences.length === resolvedOccurrences,
		},
		items: workset.entries.map(entry => {
			const scopes = new Set(
				entry.keys
					.map(key => catalog.occurrences.find(occurrence => occurrence.key === key)?.scope)
					.filter((scope): scope is string => scope != null),
			);

			return {
				id: entry.id,
				status: entry.status,
				scope: scopes.size === 1 ? [...scopes][0] : scopes.size > 1 ? 'mixed' : 'unknown',
				occurrences: entry.keys.length,
				sourceText: entry.sourcePattern.text,
				keys: entry.keys,
			};
		}),
	};

	if (options.baseRef != null) {
		// @ts-ignore
		report.sinceBase = diffWorksetAgainstBase(context, options.baseRef, workset);
	}

	savePendingReport(context, context.pendingReportFile, report);

	if (options.writeTo != null && options.writeTo !== context.pendingReportFile) {
		savePendingReport(context, options.writeTo, report);
	}

	return report;
}

export function writeWorkflowReadme(context: PackageI18nContext): void {
const content = `# Package Manifest I18n Workflow

当前阶段仅覆盖 \`package.json\` / \`package.nls*\`。

\`i18n/catalog/package.catalog.json\` 保留完整 occurrence、scope 与对账信息。
\`i18n/worksets/package.zh-cn.json\` 只保留翻译工作状态、候选译文与 key 引用，不重复落盘 occurrence 元数据。

## 日常流程

1. 运行 \`pnpm run sync:package-nls\`，从 \`package.json\` + \`package.nls.json\` 重建 catalog 与 workset。
2. 运行 \`pnpm run report:package-nls:zh-cn:pending\`，它会先刷新 catalog/workset，再默认回写 \`i18n/reports/package-pending.json\`。
3. 如需额外副本，再使用 \`pnpm run report:package-nls:zh-cn:pending -- --write package-pending.snapshot.json\`。
4. 由 Codex 修改 \`i18n/worksets/package.zh-cn.json\`，将候选译文推进到 \`translated\` / \`needsReview\` / \`approved\`。
5. 翻译多轮推进时重复运行 \`pnpm run report:package-nls:zh-cn:pending\`，让 authority / override 已覆盖的条目自动从 workset 中收敛掉。
6. 运行 \`pnpm run promote:package-nls:zh-cn\`，把 \`approved\` 条目晋升到 authority。
7. 运行 \`pnpm run generate:package-nls\`，重建 \`package.json\`、\`package.nls.json\` 与 \`package.nls.zh-cn.json\`。

## 上游合并后的标准流程

1. 先合并上游英文源码。
2. 重新运行 \`pnpm run sync:package-nls\`。
3. 查看 \`i18n/catalog/package.catalog.json\` 中的 added / changed / moved / removed / ambiguous。
4. 修订 workset，必要时重新翻译并晋升 authority。
5. 重新生成 manifest 本地化产物。

## 约束

- 不使用 \`contributions.json\` 作为 i18n 真源。
- 不使用 \`generate:contributions\` / \`extract:contributions\` 维护本分支本地化。
- \`webviews\`、\`quickpicks\`、\`formatter\` 保留到后续阶段。
`;

	fs.writeFileSync(context.workflowDocFile, content, 'utf8');
}

export function diffWorksetAgainstBase(
	context: PackageI18nContext,
	baseRef: string,
	currentWorkset: ReturnType<typeof loadWorkset>,
): { readonly added: number; readonly changed: number; readonly removed: number } | undefined {
	const relativePath = normalizeGitPath(context.rootDir, context.worksetFile);
	const result = spawnSync('git', ['show', `${baseRef}:${relativePath}`], {
		cwd: context.rootDir,
		encoding: 'utf8',
	});
	if (result.status !== 0 || result.stdout.length === 0) {
		return undefined;
	}

	const baseWorkset = JSON.parse(result.stdout) as ReturnType<typeof loadWorkset>;
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

		if (
			baseEntry.status !== entry.status ||
			baseEntry.sourceHash !== entry.sourceHash ||
			baseEntry.candidateTranslation?.text !== entry.candidateTranslation?.text ||
			JSON.stringify(baseEntry.keys) !== JSON.stringify(entry.keys) ||
			baseEntry.note !== entry.note
		) {
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

function setManifestValue(target: Record<string, unknown>, segments: readonly (string | number)[], value: string): void {
	let current: unknown = target;
	for (let index = 0; index < segments.length - 1; index++) {
		const segment = segments[index];
		if (typeof segment === 'number') {
			current = Array.isArray(current) ? current[segment] : undefined;
			continue;
		}

		current = current != null && typeof current === 'object' ? (current as Record<string, unknown>)[segment] : undefined;
	}

	const lastSegment = segments.at(-1);
	if (lastSegment == null || current == null || typeof current !== 'object') return;

	if (typeof lastSegment === 'number') {
		if (Array.isArray(current)) {
			current[lastSegment] = value;
		}
		return;
	}

	(current as Record<string, unknown>)[lastSegment] = value;
}
