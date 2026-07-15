import path from "node:path";

import {
	createDomainContext,
	createI18nLayerContext,
	type DomainContext,
	type I18nLayerOptions,
} from "../../core/context.mts";

export type ManifestDomainOptions = I18nLayerOptions;

export interface ManifestDomainContext extends DomainContext {
	readonly manifestFile: string;
	readonly contributionsFile: string;
	readonly outputRootDir: string;
	readonly generatedManifestFile: string;
	readonly englishPackageNlsFile: string;
	readonly localizedPackageNlsFile: string;
}

/** 创建 manifest domain 上下文, 并确定上游输入与本地化输出目录的位置. */
export function createManifestDomainContext(options: ManifestDomainOptions = {}): ManifestDomainContext {
	const workspace = createI18nLayerContext(options);
	const domain = createDomainContext(workspace, {
		domain: "manifest",
		artifactId: "package",
	});
	const outputRootDir = path.join(domain.workRoot, "i18n", "package-root", domain.locale);

	return {
		...domain,
		manifestFile: path.join(domain.upstreamRoot, "package.json"),
		contributionsFile: path.join(domain.upstreamRoot, "contributions.json"),
		outputRootDir: outputRootDir,
		generatedManifestFile: path.join(outputRootDir, "package.json"),
		englishPackageNlsFile: path.join(outputRootDir, "package.nls.json"),
		localizedPackageNlsFile: path.join(outputRootDir, "package.nls.zh-cn.json"),
	};
}
