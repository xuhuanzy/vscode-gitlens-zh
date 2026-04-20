import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';
import {
	buildLocaleCatalogFromAuthority,
	diffStringCatalog,
	hasCatalogChanges,
	readStringCatalog,
	type LocaleCoverageEntry,
	type StringCatalog,
	type StringCatalogDiff,
	type TranslationAuthorityCatalog,
} from '../shared/catalog.mts';
import { readJsonFileIfExists } from '../shared/files.mts';
import { proofreadZhCnValue } from '../shared/zhCnProofreader.mts';

export type CommitDisplayCatalog = StringCatalog;
export type CommitDisplayCatalogDiff = StringCatalogDiff;
export type CommitDisplayTranslationAuthority = TranslationAuthorityCatalog;
type CommitDisplayTranslationAuthoritySource = Record<string, string | { english?: string; localized: string }>;
export type CommitDisplayPendingTranslation = {
	authorityEnglish?: string;
	chinese?: string;
	english: string;
	key: string;
	previousEnglish?: string;
	reason: 'added' | 'stale' | 'updated';
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, '..', '..');
export const commitDisplayCatalogDir = path.join(rootDir, 'src', 'i18n', 'commitDisplay');
export const commitDisplayNlsPath = path.join(commitDisplayCatalogDir, 'commitDisplay.nls.json');
export const commitDisplayNlsZhCnPath = path.join(commitDisplayCatalogDir, 'commitDisplay.nls.zh-cn.json');
export const commitDisplayTranslationAuthorityPath = path.join(
	rootDir,
	'i18n',
	'authority',
	'zh-cn',
	'branch',
	'commit-display.translations.json',
);

const commitDisplaySourcePaths = [
	path.join(rootDir, 'src', 'i18n', 'commitDisplay', 'commitFormatterText.ts'),
	path.join(rootDir, 'src', 'i18n', 'commitDisplay', 'commitQuickPickText.ts'),
	path.join(rootDir, 'src', 'quickpicks', 'items', 'commits.ts'),
	path.join(rootDir, 'src', 'commands', 'quick-wizard', 'steps', 'commits.ts'),
] as const;
const commitFormatterSourcePath = path.join(rootDir, 'src', 'git', 'formatters', 'commitFormatter.ts');
const commitDisplayKeyCallNames = new Set([
	'getCommitQuickPickActionLabel',
	'getCommitQuickPickBranchActionLabel',
	'getCommitQuickPickSeparatorLabel',
	'localizeCommitDisplayString',
]);

export function buildCommitDisplayCatalog(): CommitDisplayCatalog {
	const keys = new Set<string>();

	for (const filePath of commitDisplaySourcePaths) {
		for (const key of collectCommitDisplayKeys(filePath)) {
			keys.add(key);
		}
	}

	validateCommitFormatterSourceCoverage(keys, collectCommitFormatterLiteralKeys(commitFormatterSourcePath));

	return sortCatalog(Object.fromEntries([...keys].map(key => [key, key])) as CommitDisplayCatalog);
}

export function readCommitDisplayCatalog(filePath: string): CommitDisplayCatalog {
	return readStringCatalog<CommitDisplayCatalog>(filePath);
}

export function readCommitDisplayTranslationAuthority(filePath: string): CommitDisplayTranslationAuthority {
	const authorityCatalog = readJsonFileIfExists<CommitDisplayTranslationAuthoritySource>(
		filePath,
		() => Object.create(null) as CommitDisplayTranslationAuthoritySource,
	);
	return Object.fromEntries(
		Object.entries(authorityCatalog).map(([key, entry]) => [
			typeof entry === 'string'
				? key
				: entry.english == null || entry.english.length === 0
					? key
					: entry.english,
			typeof entry === 'string'
				? {
						english: key,
						localized: entry,
					}
				: {
						english: entry.english == null || entry.english.length === 0 ? key : entry.english,
						localized: entry.localized,
					},
		]),
	) as CommitDisplayTranslationAuthority;
}

export function buildCommitDisplayZhCnCatalog(
	commitDisplayCatalog: CommitDisplayCatalog,
	authorityCatalog: CommitDisplayTranslationAuthority,
): { catalog: CommitDisplayCatalog; coverage: Record<string, LocaleCoverageEntry> } {
	return buildLocaleCatalogFromAuthority({
		authorityCatalog: authorityCatalog,
		englishCatalog: commitDisplayCatalog,
		resolveGeneratedLocalized: (english: string) => {
			const decision = proofreadZhCnValue(english);
			return decision.reason === 'unresolved' ? undefined : decision.localized;
		},
	});
}

export function hasCommitDisplayCatalogChanges(
	diff: Pick<CommitDisplayCatalogDiff, 'added' | 'removed' | 'updated'>,
): boolean {
	return hasCatalogChanges(diff);
}

export function diffCommitDisplayCatalog(
	previous: CommitDisplayCatalog,
	next: CommitDisplayCatalog,
): CommitDisplayCatalogDiff {
	return diffStringCatalog(previous, next);
}

export function findPendingCommitDisplayZhCnTranslations(
	baseCommitDisplayCatalog: CommitDisplayCatalog,
	currentCommitDisplayCatalog: CommitDisplayCatalog,
	coverage: Record<string, LocaleCoverageEntry>,
): CommitDisplayPendingTranslation[] {
	const diff = diffStringCatalog(baseCommitDisplayCatalog, currentCommitDisplayCatalog);
	const pending = new Map<string, CommitDisplayPendingTranslation>();

	for (const key of diff.added) {
		const entry = coverage[key];
		if (entry == null || entry.source === 'authority' || entry.source === 'proofreader') continue;

		pending.set(
			key,
			createPendingTranslation(
				key,
				currentCommitDisplayCatalog[key],
				entry,
				entry.source === 'stale' ? 'stale' : 'added',
			),
		);
	}

	for (const key of diff.updated) {
		const entry = coverage[key];
		if (entry == null || entry.source === 'authority' || entry.source === 'proofreader') continue;

		pending.set(
			key,
			createPendingTranslation(
				key,
				currentCommitDisplayCatalog[key],
				entry,
				entry.source === 'stale' ? 'stale' : 'updated',
				{
					previousEnglish: baseCommitDisplayCatalog[key],
				},
			),
		);
	}

	for (const [key, entry] of Object.entries(coverage)) {
		if (entry.source !== 'stale' || pending.has(key)) continue;

		pending.set(
			key,
			createPendingTranslation(key, currentCommitDisplayCatalog[key] ?? entry.english, entry, 'stale'),
		);
	}

	return [...pending.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function createPendingTranslation(
	key: string,
	english: string,
	entry: LocaleCoverageEntry,
	reason: CommitDisplayPendingTranslation['reason'],
	options?: { previousEnglish?: string },
): CommitDisplayPendingTranslation {
	return {
		...(entry.authorityEnglish == null ? {} : { authorityEnglish: entry.authorityEnglish }),
		...(entry.authorityLocalized == null ? {} : { chinese: entry.authorityLocalized }),
		english: english,
		key: key,
		...(options?.previousEnglish == null ? {} : { previousEnglish: options.previousEnglish }),
		reason: reason,
	};
}

function sortCatalog(catalog: CommitDisplayCatalog): CommitDisplayCatalog {
	return Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b))) as CommitDisplayCatalog;
}

function collectCommitDisplayKeys(filePath: string): string[] {
	const sourceText = fs.readFileSync(filePath, 'utf8');
	const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const keys = new Set<string>();

	const visit = (node: ts.Node): void => {
		if (ts.isCallExpression(node)) {
			const callName = getCallExpressionName(node.expression);
			if (callName != null && commitDisplayKeyCallNames.has(callName)) {
				const [firstArgument] = node.arguments;
				if (firstArgument != null) {
					for (const key of collectStringLiteralValues(firstArgument)) {
						keys.add(key);
					}
				}
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return [...keys];
}

function getCallExpressionName(expression: ts.LeftHandSideExpression): string | undefined {
	return ts.isIdentifier(expression) ? expression.text : undefined;
}

function collectCommitFormatterLiteralKeys(filePath: string): string[] {
	const sourceText = fs.readFileSync(filePath, 'utf8');
	const keys = new Set<string>();

	for (const match of sourceText.matchAll(/\)\}\s+"([^"$\r\n]+)"\)/g)) {
		keys.add(match[1]);
	}

	for (const match of sourceText.matchAll(/\$\(sparkle\)\s+([^\]\r\n$]+)(?=\])/g)) {
		keys.add(match[1]);
	}

	return [...keys];
}

function collectStringLiteralValues(node: ts.Node): string[] {
	if (ts.isStringLiteralLike(node)) {
		return [node.text];
	}

	if (ts.isParenthesizedExpression(node)) {
		return collectStringLiteralValues(node.expression);
	}

	if (ts.isConditionalExpression(node)) {
		return [...collectStringLiteralValues(node.whenTrue), ...collectStringLiteralValues(node.whenFalse)];
	}

	return [];
}

function validateCommitFormatterSourceCoverage(
	catalogKeys: ReadonlySet<string>,
	requiredKeys: readonly string[],
): void {
	const missingKeys = requiredKeys.filter(key => !catalogKeys.has(key));
	if (missingKeys.length === 0) return;

	throw new Error(
		[
			'commit-display catalog 缺少来自 src/git/formatters/commitFormatter.ts 的英文模板覆盖。',
			'请同步更新对应的 runtime helper 或本地化调用：',
			...missingKeys.map(key => `- ${key}`),
		].join('\n'),
	);
}
