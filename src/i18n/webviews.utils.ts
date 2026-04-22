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

	return candidates;
}

const localizedWebviewShellBasePaths = [
	['src', 'i18n', 'webviews'],
	['dist', 'webviews', 'i18n'],
] as const;

const localizedWebviewBundleBasePaths = [
	['src', 'i18n', 'webviews'],
	['dist', 'webviews', 'i18n'],
] as const;

const runtimeBundleOverridesByWebviewFileName = new Map<string, string>([]);

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

export function getWebviewRuntimeBundle(fileName: string): string | undefined {
	const override = runtimeBundleOverridesByWebviewFileName.get(fileName);
	if (override != null) return override;

	const match = /^(?<bundle>[^/\\]+)\.html$/i.exec(fileName);
	return match?.groups?.bundle;
}

export function buildLocalizedWebviewBundleRelativePaths(locale: string | undefined, bundle: string): string[] {
	const paths: string[] = [];

	for (const candidate of buildWebviewLocaleCandidates(locale)) {
		if (candidate === 'en' || candidate.startsWith('en-')) continue;

		for (const basePath of localizedWebviewBundleBasePaths) {
			paths.push([...basePath, candidate, `${bundle}.json`].join('/'));
		}
	}

	return paths;
}

function addLocaleCandidate(candidates: string[], locale: string | undefined): void {
	if (locale == null || locale.length === 0) return;
	if (candidates.includes(locale)) return;

	candidates.push(locale);
}
