import assert from 'node:assert/strict';
import { buildLocaleCatalogFromAuthority } from './catalog.mts';

run('buildLocaleCatalogFromAuthority prefers validated authority and keeps output sparse', () => {
	const { catalog, coverage } = buildLocaleCatalogFromAuthority({
		authorityCatalog: {
			authoritative: {
				english: 'Copy SHA',
				localized: '复制 SHA',
			},
			stale: {
				english: 'Learn more later',
				localized: '旧译文',
			},
		},
		englishCatalog: {
			authoritative: 'Copy SHA',
			generated: 'Learn more',
			missing: 'Totally Unknown Phrase',
			stale: 'Learn more',
		},
		resolveGeneratedLocalized: english => {
			if (english === 'Copy SHA') return '复制SHA';
			if (english === 'Learn more') return '了解更多';
			return undefined;
		},
	});

	assert.deepStrictEqual(
		{ ...catalog },
		{
			authoritative: '复制 SHA',
			generated: '了解更多',
		},
	);
	assert.deepStrictEqual(toPlainObject(coverage), {
		authoritative: {
			english: 'Copy SHA',
			localized: '复制 SHA',
			source: 'authority',
		},
		generated: {
			english: 'Learn more',
			localized: '了解更多',
			source: 'proofreader',
		},
		missing: {
			english: 'Totally Unknown Phrase',
			source: 'missing',
		},
		stale: {
			authorityEnglish: 'Learn more later',
			authorityLocalized: '旧译文',
			english: 'Learn more',
			source: 'stale',
		},
	});
});

console.log('catalog tests passed');

function toPlainObject<T extends Record<string, unknown>>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function run(name: string, testFn: () => void): void {
	try {
		testFn();
	} catch (error) {
		throw new Error(`${name} failed`, { cause: error });
	}
}
