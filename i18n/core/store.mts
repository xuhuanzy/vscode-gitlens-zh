import fs from 'node:fs';
import path from 'node:path';

import type { DomainContext, I18nWorkspaceContext } from './context.mts';
import type {
	AuthorityBundle,
	AuthorityEntryFile,
	AuthorityEntryKind,
	I18nDomain,
	PendingReportFile,
	SourceCatalogFile,
	TranslationWorksetFile,
} from './model.mts';

export function ensureI18nDirectories(context: I18nWorkspaceContext): void {
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
}

export function ensureAuthorityFiles(context: I18nWorkspaceContext): void {
	ensureI18nDirectories(context);

	writeJsonIfMissing(context.authorityMessagesFile, createEmptyAuthorityFile('messages', context.locale));
	writeJsonIfMissing(context.authorityTermsFile, createEmptyAuthorityFile('terms', context.locale));
	writeJsonIfMissing(context.authorityAliasesFile, createEmptyAuthorityFile('aliases', context.locale));
	writeJsonIfMissing(context.authorityOverridesFile, createEmptyAuthorityFile('overrides', context.locale));
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

export function loadCatalog(context: DomainContext, fallback: SourceCatalogFile): SourceCatalogFile {
	return readJsonFile<SourceCatalogFile>(context.catalogFile, fallback);
}

export function saveCatalog(context: DomainContext, catalog: SourceCatalogFile): void {
	writeJsonFile(context.catalogFile, catalog);
}

export function loadWorkset(context: DomainContext, fallback: TranslationWorksetFile): TranslationWorksetFile {
	return readJsonFile<TranslationWorksetFile>(context.worksetFile, fallback);
}

export function saveWorkset(context: DomainContext, workset: TranslationWorksetFile): void {
	writeJsonFile(context.worksetFile, workset);
}

export function loadAuthorityBundle(context: I18nWorkspaceContext): AuthorityBundle {
	return {
		messages: readJsonFile(context.authorityMessagesFile, createEmptyAuthorityFile('messages', context.locale)),
		terms: readJsonFile(context.authorityTermsFile, createEmptyAuthorityFile('terms', context.locale)),
		aliases: readJsonFile(context.authorityAliasesFile, createEmptyAuthorityFile('aliases', context.locale)),
		overrides: readJsonFile(context.authorityOverridesFile, createEmptyAuthorityFile('overrides', context.locale)),
	};
}

export function saveAuthorityBundle(context: I18nWorkspaceContext, bundle: AuthorityBundle): void {
	writeJsonFile(context.authorityMessagesFile, bundle.messages);
	writeJsonFile(context.authorityTermsFile, bundle.terms);
	writeJsonFile(context.authorityAliasesFile, bundle.aliases);
	writeJsonFile(context.authorityOverridesFile, bundle.overrides);
}

export function savePendingReport(context: DomainContext, name: string, report: PendingReportFile): string {
	const outputFile = resolveReportOutputFile(context, name);
	writeJsonFile(outputFile, report);
	return outputFile;
}

export function createEmptyCatalogFile(options: {
	readonly schemaPath: string;
	readonly domain: I18nDomain;
	readonly deferredDomains?: readonly I18nDomain[];
}): SourceCatalogFile {
	return {
		$schema: options.schemaPath,
		version: 2,
		domain: options.domain,
		generatedAt: new Date(0).toISOString(),
		deferredDomains: [...(options.deferredDomains ?? [])],
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
		$schema: '../../schemas/authority.schema.json',
		version: 2,
		kind: kind,
		locale: locale,
		updatedAt: new Date(0).toISOString(),
		entries: [],
	};
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

export function resolveReportOutputFile(context: DomainContext, name: string): string {
	if (path.isAbsolute(name)) {
		return name;
	}

	if (name.includes('/') || name.includes('\\')) {
		return path.resolve(context.rootDir, name);
	}

	return path.join(context.reportDir, name);
}
