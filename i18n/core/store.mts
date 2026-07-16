import fs from "node:fs";
import path from "node:path";

import type { DomainContext, I18nLayerContext } from "./context.mts";
import type {
	AuthorityBundle,
	AuthorityEntryFile,
	AuthorityEntryKind,
	I18nDomain,
	PendingReportFile,
	ReconciliationReportFile,
	SourceCatalogFile,
	TranslationWorksetFile,
} from "./model.mts";
import { stableStringify } from "./model.mts";

export function ensureAuthorityFiles(context: I18nLayerContext): void {
	for (const directory of [
		context.i18nDir,
		context.schemaDir,
		context.authorityDir,
		context.authorityLocaleDir,
		context.catalogDir,
		context.worksetDir,
		context.reportDir,
	]) {
		fs.mkdirSync(directory, { recursive: true });
	}

	writeJsonIfMissing(context.authorityMessagesFile, createEmptyAuthorityFile("messages", context.locale));
	writeJsonIfMissing(context.authorityTermsFile, createEmptyAuthorityFile("terms", context.locale));
	writeJsonIfMissing(context.authorityOverridesFile, createEmptyAuthorityFile("overrides", context.locale));
}

export function ensureDomainFiles(
	context: DomainContext,
	options: {
		readonly catalog: SourceCatalogFile;
		readonly workset: TranslationWorksetFile;
	},
): void {
	ensureAuthorityFiles(context);
	writeJsonIfMissing(context.catalogFile, options.catalog);
	writeJsonIfMissing(context.worksetFile, options.workset);
}

export function loadCatalog(context: DomainContext): SourceCatalogFile {
	const catalog = readJsonFile<unknown>(context.catalogFile);
	if (typeof catalog !== "object" || catalog == null || !("version" in catalog) || catalog.version !== 6) {
		const version =
			typeof catalog === "object" && catalog != null && "version" in catalog ? catalog.version : undefined;
		throw new Error(`Unsupported source catalog version: ${String(version)}`);
	}
	return catalog as SourceCatalogFile;
}

export function saveCatalog(context: DomainContext, catalog: SourceCatalogFile): void {
	writeJsonFile(context.catalogFile, catalog);
}

export function loadReconciliationReport(context: DomainContext): ReconciliationReportFile {
	return readJsonFile<ReconciliationReportFile>(context.reconciliationReportFile);
}

export function saveReconciliationReport(context: DomainContext, report: ReconciliationReportFile): void {
	writeJsonFile(context.reconciliationReportFile, report);
}

export function loadWorkset(context: DomainContext): TranslationWorksetFile {
	return readJsonFile<TranslationWorksetFile>(context.worksetFile);
}

export function saveWorkset(context: DomainContext, workset: TranslationWorksetFile): void {
	try {
		const existing = loadWorkset(context);
		if (areEquivalentWorksetsIgnoringGeneratedAt(existing, workset)) return;
	} catch {}

	writeJsonFile(context.worksetFile, workset);
}

export function loadAuthorityBundle(context: I18nLayerContext): AuthorityBundle {
	return {
		messages: readJsonFile<AuthorityBundle["messages"]>(context.authorityMessagesFile),
		terms: readJsonFile<AuthorityBundle["terms"]>(context.authorityTermsFile),
		overrides: readJsonFile<AuthorityBundle["overrides"]>(context.authorityOverridesFile),
	};
}

export function saveAuthorityBundle(context: I18nLayerContext, bundle: AuthorityBundle): void {
	writeJsonFile(context.authorityMessagesFile, bundle.messages);
	writeJsonFile(context.authorityTermsFile, bundle.terms);
	writeJsonFile(context.authorityOverridesFile, bundle.overrides);
}

export function savePendingReport(context: DomainContext, report: PendingReportFile): void {
	writeJsonFile(context.pendingReportFile, report);
}

export function createEmptyCatalogFile(options: {
	readonly schemaPath: string;
	readonly domain: I18nDomain;
}): SourceCatalogFile {
	return {
		$schema: options.schemaPath,
		version: 6,
		domain: options.domain,
		occurrences: [],
	};
}

export function createEmptyWorksetFile(options: {
	readonly schemaPath: string;
	readonly domain: I18nDomain;
	readonly locale: string;
}): TranslationWorksetFile {
	return {
		$schema: options.schemaPath,
		version: 2,
		locale: options.locale,
		domain: options.domain,
		generatedAt: new Date(0).toISOString(),
		entries: [],
	};
}

export function createEmptyAuthorityFile<TKind extends AuthorityEntryKind>(
	kind: TKind,
	locale: string,
): AuthorityEntryFile<TKind, never> {
	return {
		$schema: "../../schemas/authority.schema.json",
		version: 2,
		kind: kind,
		locale: locale,
		updatedAt: new Date(0).toISOString(),
		entries: [],
	};
}

export function readJsonFile<T>(filePath: string): T {
	return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function readJsonFileIfMissing<T>(filePath: string, initialValue: T): T {
	try {
		return readJsonFile<T>(filePath);
	} catch (ex) {
		if (isFileNotFoundError(ex)) return initialValue;
		throw ex;
	}
}

export function writeJsonFile(filePath: string, value: unknown): void {
	writeTextFile(filePath, `${JSON.stringify(value, undefined, "\t")}\n`);
}

export function writeTextFile(filePath: string, content: string): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	try {
		if (fs.readFileSync(filePath, "utf8") === content) return;
	} catch {}
	fs.writeFileSync(filePath, content, "utf8");
}

export function writeJsonIfMissing(filePath: string, value: unknown): void {
	if (fs.existsSync(filePath)) return;

	writeJsonFile(filePath, value);
}

function isFileNotFoundError(ex: unknown): boolean {
	return (
		typeof ex === "object" && ex != null && "code" in ex && (ex as { readonly code?: unknown }).code === "ENOENT"
	);
}

function areEquivalentWorksetsIgnoringGeneratedAt(
	left: TranslationWorksetFile,
	right: TranslationWorksetFile,
): boolean {
	return stableStringify({ ...left, generatedAt: "" }) === stableStringify({ ...right, generatedAt: "" });
}
