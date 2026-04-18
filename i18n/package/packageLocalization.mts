import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export type PackageNlsJson = Record<string, string>;

export type PackageNlsDiff = {
	added: string[];
	removed: string[];
	unchanged: string[];
	updated: string[];
};

export type PackageNlsPendingTranslation = {
	chinese?: string;
	english: string;
	key: string;
	previousEnglish?: string;
	reason: 'added' | 'updated';
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, '..', '..');
export const contributionsPath = path.join(rootDir, 'contributions.json');
export const packageJsonPath = path.join(rootDir, 'package.json');
export const packageNlsPath = path.join(rootDir, 'package.nls.json');
export const packageNlsZhCnPath = path.join(rootDir, 'package.nls.zh-cn.json');

const generatedPackageNlsPrefixes = [
	'commands.',
	'configuration.',
	'customEditors.',
	'mcpServerDefinitionProviders.',
	'submenus.',
	'views.',
	'viewsContainers.',
	'viewsWelcome.',
	'walkthroughs.',
] as const;

const retiredPackageNlsPrefixes = ['colors.', 'icons.', 'resourceLabelFormatters.'] as const;

const managedPackageNlsPrefixes = [...generatedPackageNlsPrefixes, ...retiredPackageNlsPrefixes] as const;

export function ensurePackageNlsExists(): void {
	if (!existsSync(packageNlsPath)) {
		throw new Error("缺少 'package.nls.json'，请先运行 'pnpm run generate:contributions'。");
	}
}

export function readPackageNls(filePath: string): PackageNlsJson {
	if (!existsSync(filePath)) {
		return Object.create(null);
	}

	return JSON.parse(readFileSync(filePath, 'utf8')) as PackageNlsJson;
}

export function resolveNlsValue(value: string | undefined, packageNls: PackageNlsJson): string | undefined {
	if (value == null) return value;

	const match = /^%([^%]+)%$/.exec(value);
	if (!match) return value;

	const resolved = packageNls[match[1]];
	if (resolved == null) {
		throw new Error(`缺少 package NLS 条目 '${match[1]}'`);
	}

	return resolved;
}

export function mergePackageNls(existingPackageNls: PackageNlsJson, generatedPackageNls: PackageNlsJson): PackageNlsJson {
	const preservedEntries = Object.entries(existingPackageNls).filter(
		([key]) => !managedPackageNlsPrefixes.some(prefix => key.startsWith(prefix)),
	);

	return Object.fromEntries(
		[...preservedEntries, ...Object.entries(generatedPackageNls)].sort(([a], [b]) => a.localeCompare(b)),
	);
}

export function syncPackageNlsZhCn(
	packageNls: PackageNlsJson,
	existingZhCn: PackageNlsJson,
): { diff: PackageNlsDiff; catalog: PackageNlsJson } {
	const catalog = Object.fromEntries(
		Object.entries(packageNls)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, english]) => [key, existingZhCn[key] ?? english]),
	);

	return { diff: diffPackageNlsCatalog(existingZhCn, catalog), catalog: catalog };
}

export function hasPackageNlsChanges(diff: Pick<PackageNlsDiff, 'added' | 'removed' | 'updated'>): boolean {
	return diff.added.length > 0 || diff.updated.length > 0 || diff.removed.length > 0;
}

export function diffPackageNlsCatalog(previous: PackageNlsJson, next: PackageNlsJson): PackageNlsDiff {
	const added: string[] = [];
	const removed: string[] = [];
	const unchanged: string[] = [];
	const updated: string[] = [];

	for (const key of Object.keys(next).sort((a, b) => a.localeCompare(b))) {
		if (!(key in previous)) {
			added.push(key);
			continue;
		}

		if (previous[key] === next[key]) {
			unchanged.push(key);
			continue;
		}

		updated.push(key);
	}

	for (const key of Object.keys(previous).sort((a, b) => a.localeCompare(b))) {
		if (!(key in next)) {
			removed.push(key);
		}
	}

	return { added: added, removed: removed, unchanged: unchanged, updated: updated };
}

export function findPendingPackageNlsZhCnTranslations(
	basePackageNls: PackageNlsJson,
	currentPackageNls: PackageNlsJson,
	currentZhCn: PackageNlsJson,
	options?: { acceptedEqualValues?: Iterable<string> },
): PackageNlsPendingTranslation[] {
	const acceptedEqualValues = new Set(options?.acceptedEqualValues ?? []);
	const diff = diffPackageNlsCatalog(basePackageNls, currentPackageNls);
	const pending: PackageNlsPendingTranslation[] = [];

	for (const key of diff.added) {
		const english = currentPackageNls[key];
		const chinese = currentZhCn[key];
		if (!isPendingPackageNlsZhCnTranslation(english, chinese, acceptedEqualValues)) continue;

		pending.push({
			chinese: chinese,
			english: english,
			key: key,
			reason: 'added',
		});
	}

	for (const key of diff.updated) {
		const english = currentPackageNls[key];
		const chinese = currentZhCn[key];
		if (!isPendingPackageNlsZhCnTranslation(english, chinese, acceptedEqualValues)) continue;

		pending.push({
			chinese: chinese,
			english: english,
			key: key,
			previousEnglish: basePackageNls[key],
			reason: 'updated',
		});
	}

	return pending.sort((a, b) => a.key.localeCompare(b.key));
}

function isPendingPackageNlsZhCnTranslation(
	english: string,
	chinese: string | undefined,
	acceptedEqualValues: ReadonlySet<string>,
): boolean {
	if (chinese == null) return true;
	if (chinese !== english) return false;

	return !acceptedEqualValues.has(english);
}
