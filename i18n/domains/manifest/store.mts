import type { ManifestDomainContext } from './context.mts';

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
	writeJsonFile,
} from '../../core/store.mts';

export function loadManifest(context: ManifestDomainContext): Record<string, unknown> {
	return readJsonFile<Record<string, unknown>>(context.manifestFile, {});
}

export function saveManifest(context: ManifestDomainContext, manifest: Record<string, unknown>): void {
	writeJsonFile(context.manifestFile, manifest);
}

export function loadEnglishPackageNls(context: ManifestDomainContext): Record<string, string> {
	return readJsonFile<Record<string, string>>(context.englishPackageNlsFile, {});
}

export function saveEnglishPackageNls(context: ManifestDomainContext, values: Record<string, string>): void {
	writeJsonFile(context.englishPackageNlsFile, sortObject(values));
}

export function loadLocalizedPackageNls(context: ManifestDomainContext): Record<string, string> {
	return readJsonFile<Record<string, string>>(context.localizedPackageNlsFile, {});
}

export function saveLocalizedPackageNls(context: ManifestDomainContext, values: Record<string, string>): void {
	writeJsonFile(context.localizedPackageNlsFile, sortObject(values));
}

export function loadManifestCatalog(context: ManifestDomainContext) {
	return loadCatalog(context, createEmptyManifestCatalogFile());
}

export function saveManifestCatalog(context: ManifestDomainContext, catalog: ReturnType<typeof createEmptyManifestCatalogFile>): void {
	saveCatalog(context, catalog);
}

export function loadManifestWorkset(context: ManifestDomainContext) {
	return loadWorkset(context, createEmptyManifestWorksetFile());
}

export function saveManifestWorkset(context: ManifestDomainContext, workset: ReturnType<typeof createEmptyManifestWorksetFile>): void {
	saveWorkset(context, workset);
}

export { loadAuthorityBundle, saveAuthorityBundle, savePendingReport };

export function createEmptyManifestCatalogFile() {
	return createEmptyCatalogFile({
		schemaPath: '../schemas/sourceCatalog.schema.json',
		domain: 'manifest',
		deferredDomains: ['webviews', 'quickpicks', 'formatter', 'runtimeCensus'],
	});
}

export function createEmptyManifestWorksetFile() {
	return createEmptyWorksetFile({
		schemaPath: '../schemas/translationWorkset.schema.json',
		domain: 'manifest',
		locale: 'zh-cn',
	});
}

function sortObject<T extends Record<string, string>>(value: T): T {
	return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) as T;
}
