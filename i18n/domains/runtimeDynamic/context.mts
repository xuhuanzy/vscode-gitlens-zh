import path from "node:path";

import {
	createDomainContext,
	createI18nLayerContext,
	type DomainContext,
	type I18nLayerInput,
	type I18nLayerOptions,
} from "../../core/context.mts";

export type RuntimeDynamicDomain = "formatter" | "quickpicks" | "webviewHost";

export interface RuntimeDynamicDomainContext extends DomainContext {
	readonly domain: RuntimeDynamicDomain;
}

/** 创建动态运行时 domain 上下文, 并将共享 webviewHost 数据映射到 webviews 文件. */
export function createRuntimeDynamicDomainContext(
	domainName: RuntimeDynamicDomain,
	input: I18nLayerInput = {},
): RuntimeDynamicDomainContext {
	const workspace = createI18nLayerContext(input);
	const domain = createDomainContext(workspace, {
		domain: domainName,
		artifactId: domainName,
	});

	return {
		...domain,
		domain: domainName,
		catalogFile:
			domainName === "webviewHost" ? path.join(domain.catalogDir, "webviews.catalog.json") : domain.catalogFile,
		worksetFile:
			domainName === "webviewHost"
				? path.join(domain.worksetDir, `webviews.${domain.locale}.json`)
				: domain.worksetFile,
	};
}
