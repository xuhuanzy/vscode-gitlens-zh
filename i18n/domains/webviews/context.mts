import { createDomainContext, createI18nLayerContext, type I18nLayerInput } from "../../core/context.mts";

export type WebviewsDomainContext = ReturnType<typeof createWebviewsDomainContext>;

/** 创建 webviews domain 上下文. */
export function createWebviewsDomainContext(input: I18nLayerInput = {}) {
	const workspace = createI18nLayerContext(input);
	const domain = createDomainContext(workspace, {
		domain: "webviews",
		artifactId: "webviews",
	});

	return {
		...domain,
		domain: "webviews" as const,
	};
}
