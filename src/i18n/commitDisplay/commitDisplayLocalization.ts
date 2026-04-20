import { env } from 'vscode';
import commitDisplayLocalizationEnglish from './commitDisplay.nls.json';
import commitDisplayLocalizationZhCn from './commitDisplay.nls.zh-cn.json';

type CommitDisplayLocalizationParams = Record<string, boolean | number | string | undefined>;

export type CommitDisplayLocalizationKey = keyof typeof commitDisplayLocalizationEnglish;

const commitDisplayLocalizationCatalogs = {
	'zh-cn': commitDisplayLocalizationZhCn,
} as const satisfies Partial<Record<string, Partial<Record<CommitDisplayLocalizationKey, string>>>>;
const emptyCommitDisplayLocalizationCatalog: Partial<Record<CommitDisplayLocalizationKey, string>> = {};

let localeOverrideForTesting: string | undefined;

export function localizeCommitDisplayString(
	key: CommitDisplayLocalizationKey,
	params?: CommitDisplayLocalizationParams,
): string {
	const english = commitDisplayLocalizationEnglish[key];
	const localized = getLocalizedCommitDisplayCatalog()[key];

	return applyCommitDisplayLocalizationParams(localized ?? english, params);
}

export function setCommitDisplayLocaleOverrideForTesting(locale?: string): void {
	localeOverrideForTesting = locale;
}

function getLocalizedCommitDisplayCatalog(): Partial<Record<CommitDisplayLocalizationKey, string>> {
	const locale = normalizeCommitDisplayLocale(localeOverrideForTesting ?? env.language);
	if (locale === 'en') return emptyCommitDisplayLocalizationCatalog;

	return (
		commitDisplayLocalizationCatalogs[locale as keyof typeof commitDisplayLocalizationCatalogs] ??
		emptyCommitDisplayLocalizationCatalog
	);
}

function normalizeCommitDisplayLocale(locale: string | undefined): string {
	if (locale == null || locale.trim().length === 0) return 'en';

	const normalized = locale.toLowerCase();
	if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
	if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-cn';

	return normalized;
}

function applyCommitDisplayLocalizationParams(template: string, params?: CommitDisplayLocalizationParams): string {
	if (params == null) return template;

	return template.replace(/\{([^{}]+)\}/g, (match, key: string) => {
		const value = params[key];
		return value == null ? match : String(value);
	});
}
