import { env, Uri, workspace } from 'vscode';

import {
	buildLocalizedWebviewBundleRelativePaths,
	buildLocalizedWebviewShellRelativePaths,
	buildWebviewLocaleCandidates,
	getWebviewRuntimeBundle,
	normalizeI18nLocale,
} from './webviews.utils.js';
import {
	buildRuntimeWebviewLocalizationPayload,
	type RuntimeWebviewLocalizationPayload,
	type WebviewLocalizationPayload,
} from './webviews.shared.js';
import { injectWebviewRuntimeLocalization } from './webviews.runtime.js';

export {
	buildLocalizedWebviewBundleRelativePaths,
	buildLocalizedWebviewShellRelativePaths,
	buildWebviewLocaleCandidates,
	getWebviewRuntimeBundle,
	injectWebviewRuntimeLocalization,
	normalizeI18nLocale,
};
export type { WebviewLocalizationPayload } from './webviews.shared.js';

export function getCurrentWebviewLocale(): string {
	return normalizeI18nLocale(env.language);
}

export function getLocalizedWebviewShellUri(rootUri: Uri, relativePath: string): Uri {
	return Uri.joinPath(rootUri, ...relativePath.split('/'));
}

export async function getAvailableLocalizedWebviewShellUri(
	rootUri: Uri,
	locale: string,
	fileName: string,
): Promise<Uri | undefined> {
	const candidates = buildLocalizedWebviewShellRelativePaths(locale, fileName);
	for (const candidate of candidates) {
		const uri = getLocalizedWebviewShellUri(rootUri, candidate);

		try {
			const stat = await workspace.fs.stat(uri);
			if (stat.size === 0) continue;
			return uri;
		} catch {}
	}

	return undefined;
}

export async function getAvailableLocalizedWebviewBundleUri(
	rootUri: Uri,
	locale: string,
	bundle: string,
): Promise<Uri | undefined> {
	const candidates = buildLocalizedWebviewBundleRelativePaths(locale, bundle);
	for (const candidate of candidates) {
		const uri = getLocalizedWebviewShellUri(rootUri, candidate);

		try {
			const stat = await workspace.fs.stat(uri);
			if (stat.size === 0) continue;
			return uri;
		} catch {}
	}

	return undefined;
}

export async function getWebviewRuntimeLocalizationPayload(
	rootUri: Uri,
	locale: string,
	fileName: string,
): Promise<RuntimeWebviewLocalizationPayload | undefined> {
	const bundle = getWebviewRuntimeBundle(fileName);
	if (bundle == null) return undefined;

	const uri = await getAvailableLocalizedWebviewBundleUri(rootUri, locale, bundle);
	if (uri == null) return undefined;

	try {
		const bytes = await workspace.fs.readFile(uri);
		const payload = JSON.parse(Buffer.from(bytes).toString('utf8')) as WebviewLocalizationPayload;
		return buildRuntimeWebviewLocalizationPayload({
			...payload,
			locale: locale,
			bundle: payload.bundle ?? bundle,
		});
	} catch {
		return undefined;
	}
}
