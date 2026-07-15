import fs from "node:fs";
import path from "node:path";

import { createI18nLayerContext } from "../i18n/core/context.mts";
import {
	createPendingReport as createManifestPendingReport,
	generateManifestLocalizedOutputs,
	promoteManifestAuthority,
	syncManifestI18n,
} from "../i18n/domains/manifest/workflow.mts";
import type { RuntimeDynamicDomain } from "../i18n/domains/runtimeDynamic/context.mts";
import {
	assertRuntimeDynamicGeneratedMirrorPaths,
	createPendingReport as createRuntimePendingReport,
	generateRuntimeDynamicLocalizedOutputs,
	promoteRuntimeDynamicAuthority,
	syncRuntimeDynamicI18n,
} from "../i18n/domains/runtimeDynamic/workflow.mts";
import {
	createPendingReport as createWebviewsPendingReport,
	generateWebviewsLocalizedDynamicSources,
	promoteWebviewsAuthority,
	syncWebviewsI18n,
} from "../i18n/domains/webviews/workflow.mts";
import { isWithin, locale, PipelineError, type ResolvedLayerConfig } from "./config.mts";

const runtimeDomains: readonly RuntimeDynamicDomain[] = ["formatter", "quickpicks", "webviewHost"];

/** 从锁定上游刷新各 domain 的 catalog, workset 和 reconciliation report. */
export function syncI18n(config: ResolvedLayerConfig): unknown {
	const options = layerOptions(config);
	const manifest = syncManifestI18n(options);
	const runtime = runtimeDomains.map((domain) => syncRuntimeDynamicI18n({ ...options, domain: domain }));
	const webviews = syncWebviewsI18n(options);
	return {
		manifest: { occurrences: manifest.occurrenceCount, workset: manifest.worksetCount },
		runtime: runtime.map((result) => ({
			domain: result.context.domain,
			occurrences: result.occurrenceCount,
			workset: result.worksetCount,
		})),
		webviews: { occurrences: webviews.occurrenceCount, workset: webviews.worksetCount },
	};
}

/** 将各 domain 已批准的 workset 条目提升到 authority 真源. */
export function promoteI18n(config: ResolvedLayerConfig): unknown {
	const options = layerOptions(config);
	return {
		manifest: promoteManifestAuthority(options).promoted.length,
		runtime: runtimeDomains.map((domain) => ({
			domain: domain,
			promoted: promoteRuntimeDynamicAuthority({ ...options, domain: domain }).promoted.length,
		})),
		webviews: promoteWebviewsAuthority(options).promoted.length,
	};
}

/** 生成各 domain 的待处理报告, 不修改已批准的 authority 内容. */
export function reportI18n(config: ResolvedLayerConfig): unknown {
	const options = layerOptions(config);
	return {
		manifest: createManifestPendingReport(options),
		runtime: runtimeDomains.map((domain) => createRuntimePendingReport({ ...options, domain: domain })),
		webviews: createWebviewsPendingReport(options),
	};
}

/** 从受跟踪 i18n 数据生成源码镜像, 并将生成文件覆盖到可丢弃的上游工作树. */
export function generateAndApplySourceOverlay(config: ResolvedLayerConfig): {
	readonly files: readonly string[];
	readonly translated: number;
	readonly unresolved: number;
} {
	const options = layerOptions(config);
	const context = createI18nLayerContext(options);
	fs.rmSync(context.generatedRootDir, { recursive: true, force: true });
	fs.mkdirSync(context.generatedRootDir, { recursive: true });

	assertRuntimeDynamicGeneratedMirrorPaths(options);
	let translated = 0;
	let unresolved = 0;
	for (const domain of runtimeDomains) {
		const result = generateRuntimeDynamicLocalizedOutputs({ ...options, domain: domain });
		translated += result.translatedCount;
		unresolved += result.unresolvedCount;
	}
	const dynamicWebviews = generateWebviewsLocalizedDynamicSources(options);
	translated += dynamicWebviews.translatedCount;
	unresolved += dynamicWebviews.unresolvedCount;

	const files = fs.existsSync(context.generatedRootDir)
		? fs
				.globSync("**/*", { cwd: context.generatedRootDir, withFileTypes: true })
				.filter((entry) => entry.isFile())
				.map((entry) => path.join(entry.parentPath, entry.name))
				.sort((left, right) => left.localeCompare(right))
		: [];
	for (const generatedFile of files) {
		const relative = path.relative(context.generatedRootDir, generatedFile);
		const target = path.resolve(config.upstreamRoot, relative);
		if (!isWithin(config.upstreamRoot, target)) {
			throw new PipelineError("I18N_PATH_ESCAPE", `Generated overlay escapes .upstream: ${relative}`);
		}
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.copyFileSync(generatedFile, target);
	}

	return {
		files: files.map((file) => path.relative(context.generatedRootDir, file).replaceAll("\\", "/")),
		translated: translated,
		unresolved: unresolved,
	};
}

/** 生成本地化 manifest/NLS 文件并写入上游根目录, 同时禁用打包生命周期脚本. */
export function applyLocalizedManifest(config: ResolvedLayerConfig): {
	readonly englishKeys: number;
	readonly localizedKeys: number;
	readonly unresolvedKeys: number;
} {
	const outputRoot = path.join(config.workRoot, "i18n", "package-root", locale);
	fs.rmSync(outputRoot, { recursive: true, force: true });
	const result = generateManifestLocalizedOutputs(layerOptions(config));
	for (const file of ["package.json", "package.nls.json", `package.nls.${locale}.json`]) {
		fs.copyFileSync(path.join(outputRoot, file), path.join(config.upstreamRoot, file));
	}
	disablePackageLifecycleScripts(path.join(config.upstreamRoot, "package.json"));
	return {
		englishKeys: result.englishKeys,
		localizedKeys: result.localizedKeys,
		unresolvedKeys: result.unresolvedKeys,
	};
}

function layerOptions(config: ResolvedLayerConfig) {
	return {
		controlRoot: config.controlRoot,
		upstreamRoot: config.upstreamRoot,
		workRoot: config.workRoot,
		locale: locale,
	};
}

function disablePackageLifecycleScripts(packageJsonFile: string): void {
	const manifest = JSON.parse(fs.readFileSync(packageJsonFile, "utf8")) as { scripts?: Record<string, string> };
	if (manifest.scripts != null) {
		delete manifest.scripts["vscode:prepublish"];
		delete manifest.scripts.prepare;
	}
	fs.writeFileSync(packageJsonFile, `${JSON.stringify(manifest, undefined, "\t")}\n`, "utf8");
}
