import { env, Uri, workspace } from 'vscode';

import {
	buildLocalizedWebviewShellRelativePaths,
	buildWebviewLocaleCandidates,
	normalizeI18nLocale,
} from './webviews.utils.js';

export { buildLocalizedWebviewShellRelativePaths, buildWebviewLocaleCandidates, normalizeI18nLocale };

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
