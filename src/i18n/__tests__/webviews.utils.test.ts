import * as assert from 'assert';

import {
	buildLocalizedWebviewShellRelativePaths,
	buildWebviewLocaleCandidates,
	normalizeI18nLocale,
} from '../webviews.utils.js';

suite('Webview I18n Test Suite', () => {
	test('normalizes locale identifiers', () => {
		assert.strictEqual(normalizeI18nLocale(undefined), 'en');
		assert.strictEqual(normalizeI18nLocale('zh_CN'), 'zh-cn');
		assert.strictEqual(normalizeI18nLocale('zh-Hans-CN'), 'zh-hans-cn');
	});

	test('falls back zh variants to zh-cn artifact', () => {
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-CN'), ['zh-cn', 'zh']);
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-Hans'), ['zh-hans', 'zh', 'zh-cn']);
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-SG'), ['zh-sg', 'zh', 'zh-cn']);
	});

	test('does not alias zh-Hans-CN to zh-cn', () => {
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-Hans-CN'), ['zh-hans-cn', 'zh-hans', 'zh']);
		assert.deepStrictEqual(buildLocalizedWebviewShellRelativePaths('zh-Hans-CN', 'settings.html'), [
			'src/i18n/webviews/zh-hans-cn/settings.html',
			'dist/webviews/i18n/zh-hans-cn/settings.html',
			'src/i18n/webviews/zh-hans/settings.html',
			'dist/webviews/i18n/zh-hans/settings.html',
			'src/i18n/webviews/zh/settings.html',
			'dist/webviews/i18n/zh/settings.html',
		]);
	});

	test('keeps english locales on english path only', () => {
		assert.deepStrictEqual(buildWebviewLocaleCandidates('en'), ['en']);
		assert.deepStrictEqual(buildWebviewLocaleCandidates('en-US'), ['en-us', 'en']);
	});

	test('prefers src i18n shells before dist copies', () => {
		assert.deepStrictEqual(buildLocalizedWebviewShellRelativePaths('zh-Hans', 'settings.html'), [
			'src/i18n/webviews/zh-hans/settings.html',
			'dist/webviews/i18n/zh-hans/settings.html',
			'src/i18n/webviews/zh/settings.html',
			'dist/webviews/i18n/zh/settings.html',
			'src/i18n/webviews/zh-cn/settings.html',
			'dist/webviews/i18n/zh-cn/settings.html',
		]);
	});

	test('does not emit localized shell paths for english locales', () => {
		assert.deepStrictEqual(buildLocalizedWebviewShellRelativePaths('en-US', 'settings.html'), []);
	});
});
