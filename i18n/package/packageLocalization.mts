import { existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
	diffStringCatalog,
	findPendingTranslations,
	hasCatalogChanges,
	readStringCatalog,
	syncLocaleCatalog,
	type PendingTranslation,
	type StringCatalog,
	type StringCatalogDiff,
} from '../shared/catalog.mts';

export type PackageNlsJson = StringCatalog;
export type PackageNlsDiff = StringCatalogDiff;
export type PackageNlsPendingTranslation = PendingTranslation;

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
	return readStringCatalog<PackageNlsJson>(filePath);
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

export function mergePackageNls(
	existingPackageNls: PackageNlsJson,
	generatedPackageNls: PackageNlsJson,
): PackageNlsJson {
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
	return syncLocaleCatalog(packageNls, existingZhCn);
}

export function hasPackageNlsChanges(diff: Pick<PackageNlsDiff, 'added' | 'removed' | 'updated'>): boolean {
	return hasCatalogChanges(diff);
}

export function diffPackageNlsCatalog(previous: PackageNlsJson, next: PackageNlsJson): PackageNlsDiff {
	return diffStringCatalog(previous, next);
}

export function findPendingPackageNlsZhCnTranslations(
	basePackageNls: PackageNlsJson,
	currentPackageNls: PackageNlsJson,
	currentZhCn: PackageNlsJson,
	options?: { acceptedEqualValues?: Iterable<string> },
): PackageNlsPendingTranslation[] {
	return findPendingTranslations(basePackageNls, currentPackageNls, currentZhCn, options);
}
