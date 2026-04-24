import fs from 'node:fs';
import path from 'node:path';

import type { WebviewsDomainContext } from './context.mts';

import {
	createEmptyCatalogFile,
	createEmptyReconciliationReportFile,
	createEmptyWorksetFile,
	loadAuthorityBundle,
	loadCatalog,
	loadWorkset,
	readJsonFile,
	saveAuthorityBundle,
	saveCatalog,
	savePendingReport,
	saveWorkset,
	writeTextFile,
} from '../../core/store.mts';
import type { ReconciliationReportFile } from '../../core/model.mts';

export function loadWebviewsCatalog(context: WebviewsDomainContext) {
	return loadCatalog(context, createEmptyWebviewsCatalogFile());
}

export function saveWebviewsCatalog(
	context: WebviewsDomainContext,
	catalog: ReturnType<typeof createEmptyWebviewsCatalogFile>,
): void {
	saveCatalog(context, catalog);
}

export function loadWebviewsReconciliationReport(context: WebviewsDomainContext): ReconciliationReportFile {
	return readJsonFile(context.reconciliationReportFile, createEmptyWebviewsReconciliationReportFile());
}

export function saveWebviewsReconciliationReport(
	context: WebviewsDomainContext,
	report: ReconciliationReportFile,
): void {
	writeTextFile(context.reconciliationReportFile, `${JSON.stringify(report, undefined, '\t')}\n`);
}

export function loadWebviewsWorkset(context: WebviewsDomainContext) {
	return loadWorkset(context, createEmptyWebviewsWorksetFile());
}

export function saveWebviewsWorkset(
	context: WebviewsDomainContext,
	workset: ReturnType<typeof createEmptyWebviewsWorksetFile>,
): void {
	saveWorkset(context, workset);
}

export function loadSettingsBuildHtml(context: WebviewsDomainContext): string {
	return fs.readFileSync(context.settingsBuildFile, 'utf8');
}

export function loadSettingsExtractionHtml(context: WebviewsDomainContext): string {
	try {
		return loadSettingsBuildHtml(context);
	} catch {
		return loadSettingsTemplateHtml(context);
	}
}

function loadSettingsTemplateHtml(context: WebviewsDomainContext): string {
	const template = fs.readFileSync(context.settingsTemplateFile, 'utf8');
	return template.replace(
		/<%=\s*require\('html-loader\?\{"esModule":false\}!([^']+)'\)\s*%>/gu,
		(_match: string, request: string) => {
			const partial = request.startsWith('./') ? request.slice(2) : request;
			return fs.readFileSync(path.join(path.dirname(context.settingsTemplateFile), partial), 'utf8');
		},
	);
}

export function loadSourceTargetContents(context: WebviewsDomainContext, relativeFile: string): string | undefined {
	try {
		return fs.readFileSync(path.join(context.rootDir, ...relativeFile.split('/')), 'utf8');
	} catch {
		return undefined;
	}
}

export function saveLocalizedSettingsShell(context: WebviewsDomainContext, html: string): void {
	writeTextFile(context.localizedSettingsShellBuildFile, html);
}

export function loadLocalizedSettingsShell(context: WebviewsDomainContext): string | undefined {
	try {
		return fs.readFileSync(context.localizedSettingsShellBuildFile, 'utf8');
	} catch {
		return undefined;
	}
}

export function saveLocalizedDynamicSource(
	context: WebviewsDomainContext,
	relativeFile: string,
	contents: string,
): void {
	writeTextFile(path.join(context.localizedDynamicSourceDir, ...relativeFile.split('/')), contents);
}

export function loadLocalizedDynamicSource(context: WebviewsDomainContext, relativeFile: string): string | undefined {
	try {
		return fs.readFileSync(path.join(context.localizedDynamicSourceDir, ...relativeFile.split('/')), 'utf8');
	} catch {
		return undefined;
	}
}

export function deleteLocalizedDynamicSource(context: WebviewsDomainContext, relativeFile: string): void {
	const filePath = path.join(context.localizedDynamicSourceDir, ...relativeFile.split('/'));
	try {
		fs.rmSync(filePath, { force: true });
	} catch {}
}

export { loadAuthorityBundle, readJsonFile, saveAuthorityBundle, savePendingReport };

export function createEmptyWebviewsCatalogFile() {
	return createEmptyCatalogFile({
		schemaPath: '../schemas/sourceCatalog.schema.json',
		domain: 'webviews',
		deferredDomains: ['quickpicks', 'formatter', 'runtimeCensus'],
	});
}

export function createEmptyWebviewsReconciliationReportFile(): ReconciliationReportFile {
	return createEmptyReconciliationReportFile({
		schemaPath: '../schemas/reconciliationReport.schema.json',
		domain: 'webviews',
	});
}

export function createEmptyWebviewsWorksetFile() {
	return createEmptyWorksetFile({
		schemaPath: '../schemas/translationWorkset.schema.json',
		domain: 'webviews',
		locale: 'zh-cn',
	});
}
