export function normalizeI18nLocale(locale: string | undefined): string {
	if (locale == null || locale.length === 0) return 'en';

	return locale.toLowerCase().replaceAll('_', '-');
}

export function buildWebviewLocaleCandidates(locale: string | undefined): string[] {
	const normalized = normalizeI18nLocale(locale);
	return normalized === 'zh-cn' ? ['zh-cn'] : [];
}

const localizedWebviewShellBasePaths = [['dist', 'webviews', 'i18n']] as const;
const localizedWebviewScriptBasePaths = [['dist', 'webviews', 'i18n']] as const;

const scriptBundleOverridesByWebviewFileName = new Map<string, string>([]);
const localizedScriptBundleFileNames = new Set([
	'commitDetails.html',
	'graph.html',
	'home.html',
	'rebase.html',
	'timeline.html',
	'welcome.html',
]);

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

export function getWebviewLocalizedScriptBundle(fileName: string): string | undefined {
	if (!localizedScriptBundleFileNames.has(fileName)) return undefined;

	const override = scriptBundleOverridesByWebviewFileName.get(fileName);
	if (override != null) return override;

	const match = /^(?<bundle>[^/\\]+)\.html$/i.exec(fileName);
	return match?.groups?.bundle;
}

export function buildLocalizedWebviewScriptRelativePaths(locale: string | undefined, bundle: string): string[] {
	const paths: string[] = [];

	for (const candidate of buildWebviewLocaleCandidates(locale)) {
		if (candidate === 'en' || candidate.startsWith('en-')) continue;

		for (const basePath of localizedWebviewScriptBasePaths) {
			paths.push([...basePath, candidate, `${bundle}.js`].join('/'));
		}
	}

	return paths;
}
