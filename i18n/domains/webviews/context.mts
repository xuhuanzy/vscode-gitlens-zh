import path from 'node:path';

import { createDomainContext, createI18nWorkspaceContext } from '../../core/context.mts';

export type WebviewsDomainContext = ReturnType<typeof createWebviewsDomainContext>;

export function createWebviewsDomainContext(rootDir?: string): {
	readonly rootDir: string;
	readonly locale: string;
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
	readonly domain: 'webviews';
	readonly artifactId: 'webviews';
	readonly catalogFile: string;
	readonly reconciliationReportFile: string;
	readonly worksetFile: string;
	readonly pendingReportFile: string;
	readonly settingsBuildFile: string;
	readonly localizedDynamicSourceDir: string;
} {
	const workspace = createI18nWorkspaceContext(rootDir);
	const domain = createDomainContext(workspace, {
		domain: 'webviews',
		artifactId: 'webviews',
		pendingReportName: 'webviews-pending.json',
	});
	const localizedDynamicSourceDir = path.join(domain.rootDir, '.work', 'i18n', 'webviews-sources', domain.locale);

	return {
		...domain,
		domain: 'webviews',
		artifactId: 'webviews',
		settingsBuildFile: path.join(domain.rootDir, 'dist', 'webviews', 'settings.html'),
		localizedDynamicSourceDir: localizedDynamicSourceDir,
	};
}
