import path from "node:path";
import { fileURLToPath } from "node:url";

import type { I18nDomain, I18nLocale } from "./model.mts";

export interface I18nLayerOptions {
	readonly controlRoot?: string;
	readonly upstreamRoot?: string;
	readonly workRoot?: string;
	readonly locale?: I18nLocale;
}

export interface I18nLayerContext {
	readonly controlRoot: string;
	readonly upstreamRoot: string;
	readonly workRoot: string;
	readonly locale: I18nLocale;
	readonly i18nDir: string;
	readonly schemaDir: string;
	readonly authorityDir: string;
	readonly authorityLocaleDir: string;
	readonly catalogDir: string;
	readonly worksetDir: string;
	readonly reportDir: string;
	readonly generatedRootDir: string;
	readonly authorityMessagesFile: string;
	readonly authorityTermsFile: string;
	readonly authorityOverridesFile: string;
}

export type I18nLayerInput = I18nLayerOptions | undefined;

export interface DomainContext extends I18nLayerContext {
	readonly domain: I18nDomain;
	readonly catalogFile: string;
	readonly reconciliationReportFile: string;
	readonly worksetFile: string;
	readonly pendingReportFile: string;
}

const defaultControlRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** 解析控制根, 上游根和工作根, 并集中生成 i18n 持久数据与临时输出路径. */
export function createI18nLayerContext(input: I18nLayerInput = {}): I18nLayerContext {
	const options = input ?? {};
	const controlRoot = path.resolve(options.controlRoot ?? defaultControlRoot);
	const upstreamRoot = resolveLayerRoot(controlRoot, options.upstreamRoot, ".upstream");
	const workRoot = resolveLayerRoot(controlRoot, options.workRoot, ".work");
	const locale = options.locale ?? "zh-cn";
	const i18nDir = path.join(controlRoot, "i18n");
	const authorityDir = path.join(i18nDir, "authority");
	const authorityLocaleDir = path.join(authorityDir, locale);
	const catalogDir = path.join(i18nDir, "catalog");
	const worksetDir = path.join(i18nDir, "worksets");
	const reportDir = path.join(i18nDir, "reports");

	return {
		controlRoot: controlRoot,
		upstreamRoot: upstreamRoot,
		workRoot: workRoot,
		locale: locale,
		i18nDir: i18nDir,
		schemaDir: path.join(i18nDir, "schemas"),
		authorityDir: authorityDir,
		authorityLocaleDir: authorityLocaleDir,
		catalogDir: catalogDir,
		worksetDir: worksetDir,
		reportDir: reportDir,
		generatedRootDir: path.join(workRoot, "i18n", "generated", locale),
		authorityMessagesFile: path.join(authorityLocaleDir, "messages.json"),
		authorityTermsFile: path.join(authorityLocaleDir, "terms.json"),
		authorityOverridesFile: path.join(authorityLocaleDir, "overrides.json"),
	};
}

/** 在共享 layer context 上补充指定 domain 的 catalog, workset 和报告路径. */
export function createDomainContext(
	workspace: I18nLayerContext,
	options: {
		readonly domain: I18nDomain;
		readonly artifactId: string;
	},
): DomainContext {
	return {
		...workspace,
		domain: options.domain,
		catalogFile: path.join(workspace.catalogDir, `${options.artifactId}.catalog.json`),
		reconciliationReportFile: path.join(workspace.reportDir, `${options.artifactId}-reconciliation.json`),
		worksetFile: path.join(workspace.worksetDir, `${options.artifactId}.${workspace.locale}.json`),
		pendingReportFile: path.join(workspace.reportDir, `${options.artifactId}-pending.json`),
	};
}

function resolveLayerRoot(controlRoot: string, configuredRoot: string | undefined, defaultName: string): string {
	if (configuredRoot == null) return path.join(controlRoot, defaultName);
	return path.resolve(controlRoot, configuredRoot);
}
