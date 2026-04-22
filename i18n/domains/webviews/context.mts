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
	readonly workflowDocFile: string;
	readonly authorityMessagesFile: string;
	readonly authorityTermsFile: string;
	readonly authorityAliasesFile: string;
	readonly authorityOverridesFile: string;
	readonly domain: 'webviews';
	readonly artifactId: 'webviews';
	readonly catalogFile: string;
	readonly worksetFile: string;
	readonly pendingReportFile: string;
	readonly settingsTemplateFile: string;
	readonly settingsBuildFile: string;
	readonly localizedShellSourceDir: string;
	readonly localizedSettingsShellSourceFile: string;
} {
	const workspace = createI18nWorkspaceContext(rootDir);
	const domain = createDomainContext(workspace, {
		domain: 'webviews',
		artifactId: 'webviews',
		pendingReportName: 'webviews-pending.json',
	});

	const localizedShellSourceDir = path.join(domain.rootDir, 'src', 'i18n', 'webviews', domain.locale);

	return {
		...domain,
		settingsTemplateFile: path.join(domain.rootDir, 'src', 'webviews', 'apps', 'settings', 'settings.html'),
		settingsBuildFile: path.join(domain.rootDir, 'dist', 'webviews', 'settings.html'),
		localizedShellSourceDir: localizedShellSourceDir,
		localizedSettingsShellSourceFile: path.join(localizedShellSourceDir, 'settings.html'),
	};
}
