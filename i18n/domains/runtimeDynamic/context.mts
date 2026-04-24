import path from 'node:path';

import { createDomainContext, createI18nWorkspaceContext, type DomainContext } from '../../core/context.mts';

export type RuntimeDynamicDomain = 'formatter' | 'quickpicks';

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
		localizedSourceDir: path.join(
			domain.rootDir,
			'.work',
			'i18n',
			'runtime-dynamic-sources',
			domain.locale,
			domainName,
		),
	};
}

export function parseRuntimeDynamicDomain(value: string | undefined): RuntimeDynamicDomain {
	if (value === 'formatter' || value === 'quickpicks') return value;

	throw new Error(`Expected --domain to be 'formatter' or 'quickpicks', got '${value ?? ''}'`);
}
