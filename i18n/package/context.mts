import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PackageI18nContext {
	readonly rootDir: string;
	readonly locale: 'zh-cn';
	readonly i18nDir: string;
	readonly schemaDir: string;
	readonly authorityDir: string;
	readonly authorityLocaleDir: string;
	readonly catalogDir: string;
	readonly worksetDir: string;
	readonly reportDir: string;
	readonly workflowDocFile: string;
	readonly manifestFile: string;
	readonly englishPackageNlsFile: string;
	readonly localizedPackageNlsFile: string;
	readonly catalogFile: string;
	readonly worksetFile: string;
	readonly authorityMessagesFile: string;
	readonly authorityTermsFile: string;
	readonly authorityAliasesFile: string;
	readonly scopeOverridesFile: string;
	readonly anchorOverridesFile: string;
	readonly keyOverridesFile: string;
	readonly pendingReportFile: string;
}

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function createPackageI18nContext(rootDir: string = defaultRootDir): PackageI18nContext {
	const i18nDir = path.join(rootDir, 'i18n');
	const authorityDir = path.join(i18nDir, 'authority');
	const authorityLocaleDir = path.join(authorityDir, 'zh-cn');
	const catalogDir = path.join(i18nDir, 'catalog');
	const worksetDir = path.join(i18nDir, 'worksets');
	const reportDir = path.join(i18nDir, 'reports');

	return {
		rootDir: rootDir,
		locale: 'zh-cn',
		i18nDir: i18nDir,
		schemaDir: path.join(i18nDir, 'schemas'),
		authorityDir: authorityDir,
		authorityLocaleDir: authorityLocaleDir,
		catalogDir: catalogDir,
		worksetDir: worksetDir,
		reportDir: reportDir,
		workflowDocFile: path.join(i18nDir, 'README.md'),
		manifestFile: path.join(rootDir, 'package.json'),
		englishPackageNlsFile: path.join(rootDir, 'package.nls.json'),
		localizedPackageNlsFile: path.join(rootDir, 'package.nls.zh-cn.json'),
		catalogFile: path.join(catalogDir, 'package.catalog.json'),
		worksetFile: path.join(worksetDir, 'package.zh-cn.json'),
		authorityMessagesFile: path.join(authorityLocaleDir, 'messages.json'),
		authorityTermsFile: path.join(authorityLocaleDir, 'terms.json'),
		authorityAliasesFile: path.join(authorityLocaleDir, 'aliases.json'),
		scopeOverridesFile: path.join(authorityLocaleDir, 'scopeOverrides.json'),
		anchorOverridesFile: path.join(authorityLocaleDir, 'anchorOverrides.json'),
		keyOverridesFile: path.join(authorityLocaleDir, 'keyOverrides.json'),
		pendingReportFile: path.join(reportDir, 'package-pending.json'),
	};
}
