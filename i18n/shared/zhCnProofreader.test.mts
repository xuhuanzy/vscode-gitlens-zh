import assert from 'node:assert/strict';
import {
	applyZhCnProofreaderCatalog,
	collectAcceptedZhCnProofreaderEqualValues,
	proofreadZhCnValue,
} from './zhCnProofreader.mts';
import {
	readZhCnAuthorityDictionary,
	sharedZhCnAuthorityPath,
	sharedZhCnPassthroughValues,
	sharedZhCnProtectedTerms,
} from './zhCnAuthority.mts';

run('shared authority is loaded from JSON and derives shared views', () => {
	const dictionary = readZhCnAuthorityDictionary(sharedZhCnAuthorityPath);

	assert.equal(dictionary.Blame, 'Blame');
	assert.equal(dictionary['Learn more'], '了解更多');
	assert.equal(sharedZhCnPassthroughValues.has('Blame'), true);
	assert.equal(sharedZhCnProtectedTerms.has('Blame'), true);
});

run('proofreadZhCnValue keeps shared passthrough values unchanged', () => {
	assert.deepStrictEqual(proofreadZhCnValue('GitLens'), {
		localized: 'GitLens',
		reason: 'sharedPassthrough',
	});
});

run('proofreadZhCnValue translates canonical glossary values', () => {
	assert.deepStrictEqual(proofreadZhCnValue('Learn more'), {
		localized: '了解更多',
		reason: 'sharedGlossary',
	});
});

run('proofreadZhCnValue preserves protected terms with neutral placeholders', () => {
	assert.deepStrictEqual(proofreadZhCnValue('Pull Request #{id}'), {
		localized: 'Pull Request #{id}',
		reason: 'sharedProtectedTerm',
	});
	assert.deepStrictEqual(proofreadZhCnValue('Blame ({count})'), {
		localized: 'Blame ({count})',
		reason: 'sharedProtectedTerm',
	});
});

run('proofreadZhCnValue applies nested template families', () => {
	assert.deepStrictEqual(proofreadZhCnValue('Jump to Commits view settings'), {
		localized: '跳转到提交视图设置',
		reason: 'sharedTemplate',
	});
	assert.deepStrictEqual(proofreadZhCnValue('Jump to Git CodeLens settings'), {
		localized: '跳转到Git CodeLens设置',
		reason: 'sharedTemplate',
	});
});

run('proofreadZhCnValue leaves unresolved values unchanged', () => {
	assert.deepStrictEqual(proofreadZhCnValue('Totally Unknown Phrase'), {
		localized: 'Totally Unknown Phrase',
		reason: 'unresolved',
	});
});

run('applyZhCnProofreaderCatalog applies proofreader before surface exceptions', () => {
	const englishCatalog = {
		action: 'Learn more',
		title: 'Jump to Commits view settings',
	} as const;

	const next = applyZhCnProofreaderCatalog({ ...englishCatalog }, englishCatalog, {
		extraExceptions: new Map([['Learn more', '进一步了解']]),
	});

	assert.deepStrictEqual(next, {
		action: '进一步了解',
		title: '跳转到提交视图设置',
	});
});

run('collectAcceptedZhCnProofreaderEqualValues includes passthrough and protected outputs', () => {
	const englishCatalog = {
		a: 'GitLens',
		b: 'Pull Request #{id}',
		c: '${dynamic}',
		d: 'Learn more',
	};

	const accepted = collectAcceptedZhCnProofreaderEqualValues({
		baseCatalog: {} as Record<string, string>,
		baseZhCnCatalog: {} as Record<string, string>,
		currentCatalog: englishCatalog,
		isImplicitPassthroughValue: value => value.startsWith('${'),
	});

	assert.equal(accepted.has('GitLens'), true);
	assert.equal(accepted.has('Pull Request #{id}'), true);
	assert.equal(accepted.has('${dynamic}'), true);
	assert.equal(accepted.has('Learn more'), false);
});

console.log('zhCnProofreader tests passed');

function run(name: string, testFn: () => void): void {
	try {
		testFn();
	} catch (error) {
		throw new Error(`${name} failed`, { cause: error });
	}
}
