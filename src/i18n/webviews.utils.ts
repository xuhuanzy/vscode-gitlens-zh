export function normalizeI18nLocale(locale: string | undefined): string {
	if (locale == null || locale.length === 0) return 'en';

	return locale.toLowerCase().replaceAll('_', '-');
}

export function buildWebviewLocaleCandidates(locale: string | undefined): string[] {
	const normalized = normalizeI18nLocale(locale);
	const candidates: string[] = [];

	addLocaleCandidate(candidates, normalized);

	const segments = normalized.split('-');
	for (let length = segments.length - 1; length > 0; length--) {
		addLocaleCandidate(candidates, segments.slice(0, length).join('-'));
	}

	for (const alias of getLocaleFallbackAliases(normalized)) {
		addLocaleCandidate(candidates, alias);
	}

	return candidates;
}

const localizedWebviewShellBasePaths = [
	['src', 'i18n', 'webviews'],
	['dist', 'webviews', 'i18n'],
] as const;

export function buildLocalizedWebviewShellRelativePaths(locale: string | undefined, fileName: string): string[] {
	const paths: string[] = [];

	for (const candidate of buildWebviewLocaleCandidates(locale)) {
		if (candidate === 'en' || candidate.startsWith('en-')) continue;

		for (const basePath of localizedWebviewShellBasePaths) {
			paths.push([...basePath, candidate, fileName].join('/'));
		}
	}

	return paths;
}

function addLocaleCandidate(candidates: string[], locale: string | undefined): void {
	if (locale == null || locale.length === 0) return;
	if (candidates.includes(locale)) return;

	candidates.push(locale);
}

function getLocaleFallbackAliases(locale: string): readonly string[] {
	if (!locale.startsWith('zh')) return [];
	if (locale === 'zh-hans-cn') return [];

	// This branch currently only maintains a zh-cn webview shell. VS Code can report
	// zh-Hans/zh-SG, so we fall back to zh-cn instead of silently using English.
	return ['zh-cn'];
}
