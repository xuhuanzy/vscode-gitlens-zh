import path from 'node:path';

import { createDomainContext, createI18nWorkspaceContext, type DomainContext } from '../../core/context.mts';

export interface ManifestDomainContext extends DomainContext {
	readonly manifestFile: string;
	readonly englishPackageNlsFile: string;
	readonly localizedPackageNlsFile: string;
}

export function createManifestDomainContext(rootDir?: string): ManifestDomainContext {
	const workspace = createI18nWorkspaceContext(rootDir);
	const domain = createDomainContext(workspace, {
		domain: 'manifest',
		artifactId: 'package',
		pendingReportName: 'package-pending.json',
	});

	return {
		...domain,
		manifestFile: path.join(domain.rootDir, 'package.json'),
		englishPackageNlsFile: path.join(domain.rootDir, 'package.nls.json'),
		localizedPackageNlsFile: path.join(domain.rootDir, 'package.nls.zh-cn.json'),
	};
}
