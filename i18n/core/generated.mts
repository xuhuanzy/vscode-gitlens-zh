import path from 'node:path';

import type { I18nLocale } from './model.mts';

export interface GeneratedMirrorClaim {
	readonly owner: string;
	readonly relativePath: string;
}

export function getGeneratedI18nRootDir(rootDir: string, locale: I18nLocale): string {
	return path.join(rootDir, '.work', 'i18n', 'generated', locale);
}

export function getGeneratedI18nFile(rootDir: string, locale: I18nLocale, relativePath: string): string {
	return path.join(getGeneratedI18nRootDir(rootDir, locale), ...normalizeRepoRelativePath(relativePath).split('/'));
}

export function normalizeRepoRelativePath(relativePath: string): string {
	const normalized = relativePath.replaceAll('\\', '/').replace(/^\.\//u, '');
	if (normalized.length === 0 || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
		throw new Error(`Invalid generated i18n mirror path: ${relativePath}`);
	}

	return normalized;
}

export function assertUniqueGeneratedMirrorPaths(claims: readonly GeneratedMirrorClaim[]): void {
	const ownersByPath = new Map<string, string>();
	for (const claim of claims) {
		const relativePath = normalizeRepoRelativePath(claim.relativePath);
		const existingOwner = ownersByPath.get(relativePath);
		if (existingOwner != null) {
			throw new Error(
				`Generated i18n mirror path collision: ${relativePath} is claimed by ${existingOwner} and ${claim.owner}`,
			);
		}

		ownersByPath.set(relativePath, claim.owner);
	}
}
