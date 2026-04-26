import { createDomainContext, createI18nWorkspaceContext } from '../../core/context.mts';
import { getGeneratedI18nRootDir } from '../../core/generated.mts';

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
	readonly localizedDynamicSourceDir: string;
} {
	const workspace = createI18nWorkspaceContext(rootDir);
	const domain = createDomainContext(workspace, {
		domain: 'webviews',
		artifactId: 'webviews',
		pendingReportName: 'webviews-pending.json',
	});
	const localizedDynamicSourceDir = getGeneratedI18nRootDir(domain.rootDir, domain.locale);

	return {
		...domain,
		domain: 'webviews',
		artifactId: 'webviews',
		localizedDynamicSourceDir: localizedDynamicSourceDir,
	};
}
