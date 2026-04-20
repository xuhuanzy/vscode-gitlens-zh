import { readJsonFileIfExists } from './files.mts';

export type StringCatalog = Record<string, string>;

export type TranslationAuthorityEntry = {
	english: string;
	localized: string;
};

export type TranslationAuthorityCatalog = Record<string, TranslationAuthorityEntry>;

export type LocaleCoverageEntry = {
	authorityEnglish?: string;
	authorityLocalized?: string;
	english: string;
	localized?: string;
	source: 'authority' | 'missing' | 'proofreader' | 'stale';
};

export type StringCatalogDiff = {
	added: string[];
	removed: string[];
	unchanged: string[];
	updated: string[];
};

export type PendingTranslation = {
	chinese?: string;
	english: string;
	key: string;
	previousEnglish?: string;
	reason: 'added' | 'updated';
};

export function readStringCatalog<T extends StringCatalog>(filePath: string): T {
	return readJsonFileIfExists(filePath, () => Object.create(null) as T);
}

export function readTranslationAuthorityCatalog<T extends TranslationAuthorityCatalog>(filePath: string): T {
	return readJsonFileIfExists(filePath, () => Object.create(null) as T);
}

export function syncLocaleCatalog<T extends StringCatalog>(
	englishCatalog: T,
	existingLocalizedCatalog: T,
): { diff: StringCatalogDiff; catalog: T } {
	const catalog = Object.fromEntries(
		Object.entries(englishCatalog)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, english]) => [key, existingLocalizedCatalog[key] ?? english]),
	) as T;

	return { diff: diffStringCatalog(existingLocalizedCatalog, catalog), catalog: catalog };
}

export function buildLocaleCatalogFromAuthority<T extends StringCatalog>(options: {
	authorityCatalog: TranslationAuthorityCatalog;
	englishCatalog: T;
	resolveGeneratedLocalized?: (english: string, key: string) => string | undefined;
}): { catalog: T; coverage: Record<string, LocaleCoverageEntry> } {
	const catalog = Object.create(null) as StringCatalog;
	const coverage = Object.create(null) as Record<string, LocaleCoverageEntry>;
	const matchedAuthorityKeys = new Set<string>();

	for (const [key, english] of Object.entries(options.englishCatalog).sort(([a], [b]) => a.localeCompare(b))) {
		const authorityEntry = options.authorityCatalog[key];
		if (authorityEntry != null) {
			matchedAuthorityKeys.add(key);
			if (authorityEntry.english === english) {
				catalog[key] = authorityEntry.localized;
				coverage[key] = {
					english: english,
					localized: authorityEntry.localized,
					source: 'authority',
				};
				continue;
			}

			coverage[key] = {
				authorityEnglish: authorityEntry.english,
				authorityLocalized: authorityEntry.localized,
				english: english,
				source: 'stale',
			};
			continue;
		}

		const generatedLocalized = options.resolveGeneratedLocalized?.(english, key);
		if (generatedLocalized != null) {
			catalog[key] = generatedLocalized;
			coverage[key] = {
				english: english,
				localized: generatedLocalized,
				source: 'proofreader',
			};
			continue;
		}

		coverage[key] = {
			english: english,
			source: 'missing',
		};
	}

	for (const [key, authorityEntry] of Object.entries(options.authorityCatalog).sort(([a], [b]) => a.localeCompare(b))) {
		if (matchedAuthorityKeys.has(key)) continue;

		coverage[key] = {
			authorityEnglish: authorityEntry.english,
			authorityLocalized: authorityEntry.localized,
			english: authorityEntry.english,
			source: 'stale',
		};
	}

	return { catalog: catalog as T, coverage: coverage };
}

export function hasCatalogChanges(diff: Pick<StringCatalogDiff, 'added' | 'removed' | 'updated'>): boolean {
	return diff.added.length > 0 || diff.updated.length > 0 || diff.removed.length > 0;
}

export function diffStringCatalog<T extends StringCatalog>(previous: T, next: T): StringCatalogDiff {
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

export function findPendingTranslations<T extends StringCatalog>(
	baseCatalog: T,
	currentCatalog: T,
	currentLocalizedCatalog: T,
	options?: { acceptedEqualValues?: Iterable<string> },
): PendingTranslation[] {
	const acceptedEqualValues = new Set(options?.acceptedEqualValues ?? []);
	const diff = diffStringCatalog(baseCatalog, currentCatalog);
	const pending: PendingTranslation[] = [];

	for (const key of diff.added) {
		const english = currentCatalog[key];
		const chinese = currentLocalizedCatalog[key];
		if (!isPendingTranslation(english, chinese, acceptedEqualValues)) continue;

		pending.push({
			chinese: chinese,
			english: english,
			key: key,
			reason: 'added',
		});
	}

	for (const key of diff.updated) {
		const english = currentCatalog[key];
		const chinese = currentLocalizedCatalog[key];
		if (!isPendingTranslation(english, chinese, acceptedEqualValues)) continue;

		pending.push({
			chinese: chinese,
			english: english,
			key: key,
			previousEnglish: baseCatalog[key],
			reason: 'updated',
		});
	}

	return pending.sort((a, b) => a.key.localeCompare(b.key));
}

export function collectAcceptedEqualValues<T extends StringCatalog>(
	englishCatalog: T,
	localizedCatalog: T,
): Set<string> {
	const accepted = new Set<string>();

	for (const [key, english] of Object.entries(englishCatalog)) {
		if (localizedCatalog[key] !== english) continue;
		accepted.add(english);
	}

	return accepted;
}

function isPendingTranslation(
	english: string,
	localized: string | undefined,
	acceptedEqualValues: ReadonlySet<string>,
): boolean {
	if (localized == null) return true;
	if (localized !== english) return false;

	return !acceptedEqualValues.has(english);
}
