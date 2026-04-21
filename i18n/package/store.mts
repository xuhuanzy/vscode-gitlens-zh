import fs from 'node:fs';
import path from 'node:path';

import type {
	AuthorityAliasEntry,
	AuthorityEntryFile,
	AuthorityMessageEntry,
	AuthorityTermEntry,
	ManifestCatalogFile,
	OverrideEntry,
	PendingReportFile,
	TranslationWorksetFile,
} from '../shared/model.mts';
import { createPackageI18nContext, type PackageI18nContext } from './context.mts';

export interface AuthorityBundle {
	readonly messages: AuthorityEntryFile<'messages', AuthorityMessageEntry>;
	readonly terms: AuthorityEntryFile<'terms', AuthorityTermEntry>;
	readonly aliases: AuthorityEntryFile<'aliases', AuthorityAliasEntry>;
	readonly scopeOverrides: AuthorityEntryFile<'scopeOverrides', OverrideEntry>;
	readonly anchorOverrides: AuthorityEntryFile<'anchorOverrides', OverrideEntry>;
	readonly keyOverrides: AuthorityEntryFile<'keyOverrides', OverrideEntry>;
}

export function ensurePackageI18nFiles(context: PackageI18nContext): void {
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

	writeJsonIfMissing(context.catalogFile, createEmptyCatalogFile());
	writeJsonIfMissing(context.worksetFile, createEmptyWorksetFile());
	writeJsonIfMissing(context.authorityMessagesFile, createEmptyAuthorityFile('messages'));
	writeJsonIfMissing(context.authorityTermsFile, createEmptyAuthorityFile('terms'));
	writeJsonIfMissing(context.authorityAliasesFile, createEmptyAuthorityFile('aliases'));
	writeJsonIfMissing(context.scopeOverridesFile, createEmptyAuthorityFile('scopeOverrides'));
	writeJsonIfMissing(context.anchorOverridesFile, createEmptyAuthorityFile('anchorOverrides'));
	writeJsonIfMissing(context.keyOverridesFile, createEmptyAuthorityFile('keyOverrides'));
}

export function loadManifest(context: PackageI18nContext): Record<string, unknown> {
	return readJsonFile<Record<string, unknown>>(context.manifestFile, {});
}

export function saveManifest(context: PackageI18nContext, manifest: Record<string, unknown>): void {
	writeJsonFile(context.manifestFile, manifest);
}

export function loadEnglishPackageNls(context: PackageI18nContext): Record<string, string> {
	return readJsonFile<Record<string, string>>(context.englishPackageNlsFile, {});
}

export function saveEnglishPackageNls(context: PackageI18nContext, values: Record<string, string>): void {
	writeJsonFile(context.englishPackageNlsFile, sortObject(values));
}

export function loadLocalizedPackageNls(context: PackageI18nContext): Record<string, string> {
	return readJsonFile<Record<string, string>>(context.localizedPackageNlsFile, {});
}

export function saveLocalizedPackageNls(context: PackageI18nContext, values: Record<string, string>): void {
	writeJsonFile(context.localizedPackageNlsFile, sortObject(values));
}

export function loadCatalog(context: PackageI18nContext): ManifestCatalogFile {
	return readJsonFile<ManifestCatalogFile>(context.catalogFile, createEmptyCatalogFile());
}

export function saveCatalog(context: PackageI18nContext, catalog: ManifestCatalogFile): void {
	writeJsonFile(context.catalogFile, catalog);
}

export function loadWorkset(context: PackageI18nContext): TranslationWorksetFile {
	return readJsonFile<TranslationWorksetFile>(context.worksetFile, createEmptyWorksetFile());
}

export function saveWorkset(context: PackageI18nContext, workset: TranslationWorksetFile): void {
	writeJsonFile(context.worksetFile, workset);
}

export function loadAuthorityBundle(context: PackageI18nContext): AuthorityBundle {
	return {
		messages: readJsonFile(context.authorityMessagesFile, createEmptyAuthorityFile('messages')),
		terms: readJsonFile(context.authorityTermsFile, createEmptyAuthorityFile('terms')),
		aliases: readJsonFile(context.authorityAliasesFile, createEmptyAuthorityFile('aliases')),
		scopeOverrides: readJsonFile(context.scopeOverridesFile, createEmptyAuthorityFile('scopeOverrides')),
		anchorOverrides: readJsonFile(context.anchorOverridesFile, createEmptyAuthorityFile('anchorOverrides')),
		keyOverrides: readJsonFile(context.keyOverridesFile, createEmptyAuthorityFile('keyOverrides')),
	};
}

export function saveAuthorityBundle(context: PackageI18nContext, bundle: AuthorityBundle): void {
	writeJsonFile(context.authorityMessagesFile, bundle.messages);
	writeJsonFile(context.authorityTermsFile, bundle.terms);
	writeJsonFile(context.authorityAliasesFile, bundle.aliases);
	writeJsonFile(context.scopeOverridesFile, bundle.scopeOverrides);
	writeJsonFile(context.anchorOverridesFile, bundle.anchorOverrides);
	writeJsonFile(context.keyOverridesFile, bundle.keyOverrides);
}

export function savePendingReport(context: PackageI18nContext, name: string, report: PendingReportFile): string {
	const outputFile = resolveReportOutputFile(context, name);
	writeJsonFile(outputFile, report);
	return outputFile;
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
	} catch {
		return fallback;
	}
}

export function writeJsonFile(filePath: string, value: unknown): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, undefined, '\t')}\n`, 'utf8');
}

export function writeTextFile(filePath: string, content: string): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content, 'utf8');
}

export function writeJsonIfMissing(filePath: string, value: unknown): void {
	if (fs.existsSync(filePath)) return;

	writeJsonFile(filePath, value);
}

export function createEmptyCatalogFile(): ManifestCatalogFile {
	return {
		$schema: '../schemas/manifestCatalog.schema.json',
		version: 1,
		domain: 'manifest',
		generatedAt: new Date(0).toISOString(),
		deferredDomains: ['webviews', 'quickpicks', 'formatter', 'runtimeCensus'],
		occurrences: [],
		reconciliation: {
			entries: [],
			summary: {
				added: 0,
				changed: 0,
				moved: 0,
				removed: 0,
				ambiguous: 0,
			},
		},
	};
}

export function createEmptyWorksetFile(): TranslationWorksetFile {
	return {
		$schema: '../schemas/translationWorkset.schema.json',
		version: 2,
		locale: 'zh-cn',
		domain: 'manifest',
		generatedAt: new Date(0).toISOString(),
		entries: [],
	};
}

export function createEmptyAuthorityFile<TKind extends string>(kind: TKind): AuthorityEntryFile<TKind, never> {
	return {
		$schema: '../../schemas/authority.schema.json',
		version: 2,
		kind: kind,
		locale: 'zh-cn',
		updatedAt: new Date(0).toISOString(),
		entries: [],
	};
}

export function resolveContext(rootDir?: string): PackageI18nContext {
	return createPackageI18nContext(rootDir);
}

function sortObject<T extends Record<string, string>>(value: T): T {
	return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) as T;
}

function resolveReportOutputFile(context: PackageI18nContext, name: string): string {
	if (path.isAbsolute(name)) {
		return name;
	}

	if (name.includes('/') || name.includes('\\')) {
		return path.resolve(context.rootDir, name);
	}

	return path.join(context.reportDir, name);
}
