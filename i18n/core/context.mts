import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { I18nDomain, I18nLocale } from './model.mts';

export interface I18nWorkspaceContext {
	readonly rootDir: string;
	readonly locale: I18nLocale;
	readonly i18nDir: string;
	readonly schemaDir: string;
	readonly authorityDir: string;
	readonly authorityLocaleDir: string;
	readonly catalogDir: string;
	readonly worksetDir: string;
	readonly reportDir: string;
	readonly authorityMessagesFile: string;
	readonly authorityTermsFile: string;
	readonly authorityAliasesFile: string;
	readonly authorityOverridesFile: string;
}

export interface DomainContext extends I18nWorkspaceContext {
	readonly domain: I18nDomain;
	readonly artifactId: string;
	readonly catalogFile: string;
	readonly reconciliationReportFile: string;
	readonly worksetFile: string;
	readonly pendingReportFile: string;
}

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function createI18nWorkspaceContext(
	rootDir: string = defaultRootDir,
	locale: I18nLocale = 'zh-cn',
): I18nWorkspaceContext {
	const i18nDir = path.join(rootDir, 'i18n');
	const authorityDir = path.join(i18nDir, 'authority');
	const authorityLocaleDir = path.join(authorityDir, locale);
	const catalogDir = path.join(i18nDir, 'catalog');
	const worksetDir = path.join(i18nDir, 'worksets');
	const reportDir = path.join(i18nDir, 'reports');

	return {
		rootDir: rootDir,
		locale: locale,
		i18nDir: i18nDir,
		schemaDir: path.join(i18nDir, 'schemas'),
		authorityDir: authorityDir,
		authorityLocaleDir: authorityLocaleDir,
		catalogDir: catalogDir,
		worksetDir: worksetDir,
		reportDir: reportDir,
		authorityMessagesFile: path.join(authorityLocaleDir, 'messages.json'),
		authorityTermsFile: path.join(authorityLocaleDir, 'terms.json'),
		authorityAliasesFile: path.join(authorityLocaleDir, 'aliases.json'),
		authorityOverridesFile: path.join(authorityLocaleDir, 'overrides.json'),
	};
}

export function createDomainContext(
	workspace: I18nWorkspaceContext,
	options: {
		readonly domain: I18nDomain;
		readonly artifactId: string;
		readonly pendingReportName?: string;
	},
): DomainContext {
	return {
		...workspace,
		domain: options.domain,
		artifactId: options.artifactId,
		catalogFile: path.join(workspace.catalogDir, `${options.artifactId}.catalog.json`),
		reconciliationReportFile: path.join(workspace.reportDir, `${options.artifactId}-reconciliation.json`),
		worksetFile: path.join(workspace.worksetDir, `${options.artifactId}.${workspace.locale}.json`),
		pendingReportFile: path.join(
			workspace.reportDir,
			options.pendingReportName ?? `${options.artifactId}-pending.json`,
		),
	};
}
