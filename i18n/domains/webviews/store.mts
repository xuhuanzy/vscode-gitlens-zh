import fs from 'node:fs';

import type { WebviewsDomainContext } from './context.mts';

import {
	createEmptyCatalogFile,
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

export function loadWebviewsCatalog(context: WebviewsDomainContext) {
	return loadCatalog(context, createEmptyWebviewsCatalogFile());
}

export function saveWebviewsCatalog(context: WebviewsDomainContext, catalog: ReturnType<typeof createEmptyWebviewsCatalogFile>): void {
	saveCatalog(context, catalog);
}

export function loadWebviewsWorkset(context: WebviewsDomainContext) {
	return loadWorkset(context, createEmptyWebviewsWorksetFile());
}

export function saveWebviewsWorkset(context: WebviewsDomainContext, workset: ReturnType<typeof createEmptyWebviewsWorksetFile>): void {
	saveWorkset(context, workset);
}

export function loadSettingsBuildHtml(context: WebviewsDomainContext): string {
	return fs.readFileSync(context.settingsBuildFile, 'utf8');
}

export function saveLocalizedSettingsShell(context: WebviewsDomainContext, html: string): void {
	writeTextFile(context.localizedSettingsShellSourceFile, html);
}

export function loadLocalizedSettingsShell(context: WebviewsDomainContext): string | undefined {
	try {
		return fs.readFileSync(context.localizedSettingsShellSourceFile, 'utf8');
	} catch {
		return undefined;
	}
}

export { loadAuthorityBundle, readJsonFile, saveAuthorityBundle, savePendingReport };

export function createEmptyWebviewsCatalogFile() {
	return createEmptyCatalogFile({
		schemaPath: '../schemas/sourceCatalog.schema.json',
		domain: 'webviews',
		deferredDomains: ['quickpicks', 'formatter', 'runtimeCensus'],
	});
}

export function createEmptyWebviewsWorksetFile() {
	return createEmptyWorksetFile({
		schemaPath: '../schemas/translationWorkset.schema.json',
		domain: 'webviews',
		locale: 'zh-cn',
	});
}
