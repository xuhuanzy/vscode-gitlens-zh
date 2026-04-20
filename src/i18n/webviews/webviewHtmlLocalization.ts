import { env, Uri, workspace } from 'vscode';
import { md5 } from '@gitlens/utils/crypto.js';
import { PromiseCache } from '@gitlens/utils/promiseCache.js';
import type { Container } from '../../container.js';
import { buildRuntimeTranslationMap } from './webviewRuntimeLocalizationCore.js';
import webviewLocalizationEnglish from './webviews.nls.json';
import webviewLocalizationZhCn from './webviews.nls.zh-cn.json';

type LocalizedWebviewTemplate = {
	catalogIdentity: string;
	html: string;
	locale: string;
	sourceIdentity: string;
	templateIdentity: string;
};

type RuntimeWebviewLocalizationPayload = {
	locale: string;
	translations: Record<string, string>;
};

const templateCache = new PromiseCache<string, LocalizedWebviewTemplate>({
	accessTTL: 5 * 60 * 1000,
	capacity: 8,
	createTTL: 60 * 1000,
});
const runtimeCatalogCache = new PromiseCache<string, RuntimeWebviewLocalizationPayload>({
	accessTTL: 5 * 60 * 1000,
	capacity: 4,
	createTTL: 60 * 1000,
});
const staleTemplates = new Map<string, LocalizedWebviewTemplate>();

const managedWebviews = new Map([
	[
		'settings.html',
		{
			distFileName: 'settings.html',
			runtimeMetadataFileName: 'settings.i18n.json',
			runtimeTemplateFileName: 'settings.i18n.html',
		},
	],
]);

const webviewLocalizationCatalogs = {
	'zh-cn': webviewLocalizationZhCn,
} as const satisfies Partial<Record<string, Record<string, string>>>;

export function getWebviewHtmlLocale(): string {
	return normalizeLocale(env.language);
}

export function shouldLocalizeWebviewHtml(fileName: string): boolean {
	return getManagedWebviewLocalizationDefinition(fileName) != null;
}

export async function getWebviewRuntimeLocalizationPayload(
	_container: Container,
): Promise<RuntimeWebviewLocalizationPayload | undefined> {
	const locale = getWebviewHtmlLocale();
	if (isEnglishLocale(locale)) return undefined;

	const englishCatalog = webviewLocalizationEnglish;
	const effectiveLocalizedCatalog = getLocalizedCatalog(locale) ?? Object.create(null);
	const englishCatalogIdentity = `md5:${md5(JSON.stringify(englishCatalog))}`;
	const localizedCatalogIdentity = `md5:${md5(JSON.stringify(effectiveLocalizedCatalog))}`;
	const cacheKey = [locale, englishCatalogIdentity, localizedCatalogIdentity].join('|');

	return runtimeCatalogCache.getOrCreate(cacheKey, () =>
		Promise.resolve({
			locale: locale,
			translations: buildRuntimeTranslationMap(englishCatalog, effectiveLocalizedCatalog),
		}),
	);
}

export async function localizeWebviewHtmlTemplate(
	container: Container,
	webviewFileName: string,
	html: string,
): Promise<string> {
	const definition = getManagedWebviewLocalizationDefinition(webviewFileName);
	if (definition == null) return html;

	const locale = getWebviewHtmlLocale();
	if (isEnglishLocale(locale)) return html;

	const sourceIdentity = `md5:${md5(html)}`;
	const catalog = getLocalizedCatalog(locale) ?? webviewLocalizationEnglish;
	const catalogIdentity = `md5:${md5(JSON.stringify(catalog))}`;
	const cacheIdentity = [webviewFileName, locale, sourceIdentity].join('|');
	const cacheKey = `${cacheIdentity}|${catalogIdentity}`;

	const fresh = templateCache.get(cacheKey);
	if (fresh != null) {
		return (await fresh).html;
	}

	const stale = staleTemplates.get(cacheKey);
	if (stale != null) {
		void refreshLocalizedTemplate(
			container,
			definition,
			locale,
			sourceIdentity,
			catalogIdentity,
			catalog,
			cacheKey,
		);
		return stale.html;
	}

	const localized = await refreshLocalizedTemplate(
		container,
		definition,
		locale,
		sourceIdentity,
		catalogIdentity,
		catalog,
		cacheKey,
	);

	return localized.html;
}

async function refreshLocalizedTemplate(
	container: Container,
	definition: NonNullable<ReturnType<typeof getManagedWebviewLocalizationDefinition>>,
	locale: string,
	sourceIdentity: string,
	catalogIdentity: string,
	catalog: Record<string, string>,
	cacheKey: string,
): Promise<LocalizedWebviewTemplate> {
	const localized = await templateCache.getOrCreate(cacheKey, async () => {
		const webviewsRoot = Uri.joinPath(container.context.extensionUri, 'dist', 'webviews');
		const [templateBytes, metadataBytes] = await Promise.all([
			workspace.fs.readFile(Uri.joinPath(webviewsRoot, definition.runtimeTemplateFileName)),
			workspace.fs.readFile(Uri.joinPath(webviewsRoot, definition.runtimeMetadataFileName)),
		]);

		const templateHtml = new TextDecoder().decode(templateBytes);
		const metadata = JSON.parse(new TextDecoder().decode(metadataBytes)) as WebviewLocalizationMetadata;
		if (metadata.sourceIdentity !== sourceIdentity) {
			throw new Error(
				`webview HTML 本地化 source identity 不匹配: ${definition.distFileName} (${metadata.sourceIdentity} != ${sourceIdentity})`,
			);
		}

		return {
			catalogIdentity: catalogIdentity,
			html: applyCatalog(templateHtml, catalog),
			locale: locale,
			sourceIdentity: sourceIdentity,
			templateIdentity: metadata.templateIdentity,
		};
	});

	setStaleTemplate(cacheKey, localized);
	return localized;
}

function getLocalizedCatalog(locale: string): Record<string, string> | undefined {
	return webviewLocalizationCatalogs[locale as keyof typeof webviewLocalizationCatalogs];
}

function applyCatalog(templateHtml: string, catalog: Record<string, string>): string {
	return templateHtml.replace(/__GL_I18N__([^_]+?)__/g, (substring, key) => {
		return catalog[key] ?? substring;
	});
}

export function applyWebviewHtmlCatalog(templateHtml: string, catalog: Record<string, string>): string {
	return applyCatalog(templateHtml, catalog);
}

function normalizeLocale(locale: string | undefined): string {
	if (locale == null || locale.trim().length === 0) return 'en';
	return locale.toLowerCase();
}

function isEnglishLocale(locale: string): boolean {
	return locale === 'en' || locale.startsWith('en-');
}

function getManagedWebviewLocalizationDefinition(fileName: string) {
	return managedWebviews.get(fileName);
}

function setStaleTemplate(key: string, value: LocalizedWebviewTemplate): void {
	staleTemplates.delete(key);
	staleTemplates.set(key, value);

	while (staleTemplates.size > 8) {
		const first = staleTemplates.keys().next();
		if (first.done) break;
		staleTemplates.delete(first.value);
	}
}

type WebviewLocalizationMetadata = {
	sourceIdentity: string;
	templateIdentity: string;
	webviewFileName: string;
	version: 1;
};

export function injectWebviewRuntimeLocalization(
	html: string,
	cspNonce: string,
	payload: RuntimeWebviewLocalizationPayload | undefined,
): string {
	const locale = payload?.locale ?? getWebviewHtmlLocale();
	const runtimeScript =
		payload != null
			? `<script type="text/javascript" nonce="${cspNonce}">` +
				`window.__GL_WEBVIEW_I18N__=${serializeRuntimeLocalizationPayload(payload)};` +
				`</script>`
			: '';

	let updated = html;
	if (/<html\b[^>]*\blang=/i.test(updated)) {
		updated = updated.replace(/(<html\b[^>]*\blang=["'])[^"']*(["'][^>]*>)/i, `$1${locale}$2`);
	} else {
		updated = updated.replace(/<html\b([^>]*)>/i, `<html$1 lang="${locale}">`);
	}

	if (runtimeScript.length === 0) return updated;

	if (/<\/head>/i.test(updated)) {
		return updated.replace(/<\/head>/i, `${runtimeScript}</head>`);
	}

	if (/<body\b/i.test(updated)) {
		return updated.replace(/<body\b([^>]*)>/i, `<body$1>${runtimeScript}`);
	}

	return `${runtimeScript}${updated}`;
}

function serializeRuntimeLocalizationPayload(payload: RuntimeWebviewLocalizationPayload): string {
	return JSON.stringify(payload)
		.replace(/</g, '\\u003c')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}
