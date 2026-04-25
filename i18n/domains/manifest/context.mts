import path from 'node:path';

import { createDomainContext, createI18nWorkspaceContext, type DomainContext } from '../../core/context.mts';

export interface ManifestDomainContext extends DomainContext {
	readonly manifestFile: string;
	readonly stagedManifestRootDir: string;
	readonly generatedManifestFile: string;
	readonly englishPackageNlsFile: string;
	readonly localizedPackageNlsFile: string;
}

export function createManifestDomainContext(rootDir?: string, stagedManifestRoot?: string): ManifestDomainContext {
	const workspace = createI18nWorkspaceContext(rootDir);
	const domain = createDomainContext(workspace, {
		domain: 'manifest',
		artifactId: 'package',
		pendingReportName: 'package-pending.json',
	});
	const stagedManifestRootDir =
		stagedManifestRoot == null
			? path.join(domain.rootDir, '.work', 'i18n', 'extension-root', domain.locale)
			: path.resolve(domain.rootDir, stagedManifestRoot);

	return {
		...domain,
		manifestFile: path.join(domain.rootDir, 'package.json'),
		stagedManifestRootDir: stagedManifestRootDir,
		generatedManifestFile: path.join(stagedManifestRootDir, 'package.json'),
		englishPackageNlsFile: path.join(stagedManifestRootDir, 'package.nls.json'),
		localizedPackageNlsFile: path.join(stagedManifestRootDir, 'package.nls.zh-cn.json'),
	};
}
