import { env, Uri, workspace } from 'vscode';

import {
	buildLocalizedWebviewScriptRelativePaths,
	buildLocalizedWebviewShellRelativePaths,
	buildWebviewLocaleCandidates,
	getWebviewLocalizedScriptBundle,
	normalizeI18nLocale,
} from './webviews.utils.js';

export {
	buildLocalizedWebviewScriptRelativePaths,
	buildLocalizedWebviewShellRelativePaths,
	buildWebviewLocaleCandidates,
	getWebviewLocalizedScriptBundle,
	normalizeI18nLocale,
};

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

export async function getAvailableLocalizedWebviewScriptUri(
	rootUri: Uri,
	locale: string,
	bundle: string,
): Promise<Uri | undefined> {
	const candidates = buildLocalizedWebviewScriptRelativePaths(locale, bundle);
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
