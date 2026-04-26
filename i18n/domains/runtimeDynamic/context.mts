import path from 'node:path';

import { createDomainContext, createI18nWorkspaceContext, type DomainContext } from '../../core/context.mts';
import { getGeneratedI18nRootDir } from '../../core/generated.mts';

export type RuntimeDynamicDomain = 'formatter' | 'quickpicks' | 'webviewHost';

export interface RuntimeDynamicDomainContext extends DomainContext {
	readonly domain: RuntimeDynamicDomain;
	readonly artifactId: RuntimeDynamicDomain;
	readonly localizedSourceDir: string;
}

export function createRuntimeDynamicDomainContext(
	domainName: RuntimeDynamicDomain,
	rootDir?: string,
): RuntimeDynamicDomainContext {
	const workspace = createI18nWorkspaceContext(rootDir);
	const domain = createDomainContext(workspace, {
		domain: domainName,
		artifactId: domainName,
		pendingReportName: `${domainName}-pending.json`,
	});

	return {
		...domain,
		domain: domainName,
		artifactId: domainName,
		catalogFile:
			domainName === 'webviewHost' ? path.join(domain.catalogDir, 'webviews.catalog.json') : domain.catalogFile,
		worksetFile:
			domainName === 'webviewHost'
				? path.join(domain.worksetDir, `webviews.${domain.locale}.json`)
				: domain.worksetFile,
		localizedSourceDir: getGeneratedI18nRootDir(domain.rootDir, domain.locale),
	};
}
