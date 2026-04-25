import type { ManifestDomainContext } from './context.mts';

import {
	createEmptyCatalogFile,
	createEmptyWorksetFile,
	loadAuthorityBundle,
	loadCatalog,
	loadWorkset,
	readJsonFile,
	readJsonFileIfMissing,
	saveAuthorityBundle,
	saveCatalog,
	savePendingReport,
	saveWorkset,
	writeJsonFile,
} from '../../core/store.mts';
import type { ReconciliationReportFile } from '../../core/model.mts';

export function loadManifest(context: ManifestDomainContext): Record<string, unknown> {
	return readJsonFile<Record<string, unknown>>(context.manifestFile);
}

export function loadGeneratedManifest(context: ManifestDomainContext): Record<string, unknown> {
	return readJsonFile<Record<string, unknown>>(context.generatedManifestFile);
}

export function saveGeneratedManifest(context: ManifestDomainContext, manifest: Record<string, unknown>): void {
	writeJsonFile(context.generatedManifestFile, manifest);
}

export function loadEnglishPackageNls(context: ManifestDomainContext): Record<string, string> {
	return readJsonFileIfMissing<Record<string, string>>(context.englishPackageNlsFile, {});
}

export function saveEnglishPackageNls(context: ManifestDomainContext, values: Record<string, string>): void {
	writeJsonFile(context.englishPackageNlsFile, sortObject(values));
}

export function loadLocalizedPackageNls(context: ManifestDomainContext): Record<string, string> {
	return readJsonFile<Record<string, string>>(context.localizedPackageNlsFile);
}

export function saveLocalizedPackageNls(context: ManifestDomainContext, values: Record<string, string>): void {
	writeJsonFile(context.localizedPackageNlsFile, sortObject(values));
}

export function loadManifestCatalog(context: ManifestDomainContext) {
	return loadCatalog(context);
}

export function saveManifestCatalog(
	context: ManifestDomainContext,
	catalog: ReturnType<typeof createEmptyManifestCatalogFile>,
): void {
	saveCatalog(context, catalog);
}

export function loadManifestReconciliationReport(context: ManifestDomainContext): ReconciliationReportFile {
	return readJsonFile<ReconciliationReportFile>(context.reconciliationReportFile);
}

export function saveManifestReconciliationReport(
	context: ManifestDomainContext,
	report: ReconciliationReportFile,
): void {
	writeJsonFile(context.reconciliationReportFile, report);
}

export function loadManifestWorkset(context: ManifestDomainContext) {
	return loadWorkset(context);
}

export function saveManifestWorkset(
	context: ManifestDomainContext,
	workset: ReturnType<typeof createEmptyManifestWorksetFile>,
): void {
	saveWorkset(context, workset);
}

export { loadAuthorityBundle, saveAuthorityBundle, savePendingReport };

export function createEmptyManifestCatalogFile() {
	return createEmptyCatalogFile({
		schemaPath: '../schemas/sourceCatalog.schema.json',
		domain: 'manifest',
		deferredDomains: ['webviews', 'quickpicks', 'formatter'],
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
