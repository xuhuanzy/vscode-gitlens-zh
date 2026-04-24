import fs from 'node:fs';
import path from 'node:path';

import type { RuntimeDynamicDomainContext } from './context.mts';

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
import type { I18nDomain, ReconciliationReportFile } from '../../core/model.mts';

export function loadRuntimeDynamicCatalog(context: RuntimeDynamicDomainContext) {
	return loadCatalog(context, createEmptyRuntimeDynamicCatalogFile(context));
}

export function saveRuntimeDynamicCatalog(
	context: RuntimeDynamicDomainContext,
	catalog: ReturnType<typeof createEmptyRuntimeDynamicCatalogFile>,
): void {
	saveCatalog(context, catalog);
}

export function loadRuntimeDynamicReconciliationReport(context: RuntimeDynamicDomainContext): ReconciliationReportFile {
	return readJsonFile(context.reconciliationReportFile, createEmptyRuntimeDynamicReconciliationReportFile(context));
}

export function saveRuntimeDynamicReconciliationReport(
	context: RuntimeDynamicDomainContext,
	report: ReconciliationReportFile,
): void {
	writeTextFile(context.reconciliationReportFile, `${JSON.stringify(report, undefined, '\t')}\n`);
}

export function loadRuntimeDynamicWorkset(context: RuntimeDynamicDomainContext) {
	return loadWorkset(context, createEmptyRuntimeDynamicWorksetFile(context));
}

export function saveRuntimeDynamicWorkset(
	context: RuntimeDynamicDomainContext,
	workset: ReturnType<typeof createEmptyRuntimeDynamicWorksetFile>,
): void {
	saveWorkset(context, workset);
}

export function loadSourceTargetContents(
	context: RuntimeDynamicDomainContext,
	relativeFile: string,
): string | undefined {
	try {
		return fs.readFileSync(path.join(context.rootDir, ...relativeFile.split('/')), 'utf8');
	} catch {
		return undefined;
	}
}

export function saveLocalizedRuntimeDynamicSource(
	context: RuntimeDynamicDomainContext,
	relativeFile: string,
	contents: string,
): void {
	writeTextFile(path.join(context.localizedSourceDir, ...relativeFile.split('/')), contents);
}

export function loadLocalizedRuntimeDynamicSource(
	context: RuntimeDynamicDomainContext,
	relativeFile: string,
): string | undefined {
	try {
		return fs.readFileSync(path.join(context.localizedSourceDir, ...relativeFile.split('/')), 'utf8');
	} catch {
		return undefined;
	}
}

export { loadAuthorityBundle, saveAuthorityBundle, savePendingReport };

export function createEmptyRuntimeDynamicCatalogFile(context: RuntimeDynamicDomainContext) {
	return createEmptyCatalogFile({
		schemaPath: '../schemas/sourceCatalog.schema.json',
		domain: context.domain,
		deferredDomains: getDeferredDomains(context.domain),
	});
}

export function createEmptyRuntimeDynamicReconciliationReportFile(
	context: RuntimeDynamicDomainContext,
): ReconciliationReportFile {
	return createEmptyReconciliationReportFile({
		schemaPath: '../schemas/reconciliationReport.schema.json',
		domain: context.domain,
	});
}

export function createEmptyRuntimeDynamicWorksetFile(context: RuntimeDynamicDomainContext) {
	return createEmptyWorksetFile({
		schemaPath: '../schemas/translationWorkset.schema.json',
		domain: context.domain,
		locale: context.locale,
	});
}

function getDeferredDomains(domain: RuntimeDynamicDomainContext['domain']): I18nDomain[] {
	return domain === 'formatter' ? ['quickpicks', 'runtimeCensus'] : ['formatter', 'runtimeCensus'];
}
