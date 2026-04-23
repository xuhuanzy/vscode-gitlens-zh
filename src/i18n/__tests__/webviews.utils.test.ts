import * as assert from 'assert';

import {
	buildLocalizedWebviewScriptRelativePaths,
	buildLocalizedWebviewShellRelativePaths,
	buildWebviewLocaleCandidates,
	getWebviewLocalizedScriptBundle,
	normalizeI18nLocale,
} from '../webviews.js';
import { replaceLocalizedWebviewScriptReference } from '../../webviews/webviewController.js';

suite('Webview I18n Test Suite', () => {
	test('normalizes locale identifiers', () => {
		assert.strictEqual(normalizeI18nLocale(undefined), 'en');
		assert.strictEqual(normalizeI18nLocale('zh_CN'), 'zh-cn');
		assert.strictEqual(normalizeI18nLocale('zh-Hans-CN'), 'zh-hans-cn');
	});

	test('only builds the maintained zh-cn locale candidate', () => {
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-CN'), ['zh-cn']);
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-Hans'), []);
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-SG'), []);
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-Hans-CN'), []);
		assert.deepStrictEqual(buildLocalizedWebviewShellRelativePaths('zh-CN', 'settings.html'), [
			'dist/webviews/i18n/zh-cn/settings.html',
		]);
	});

	test('keeps english locales on english path only', () => {
		assert.deepStrictEqual(buildWebviewLocaleCandidates('en'), []);
		assert.deepStrictEqual(buildWebviewLocaleCandidates('en-US'), []);
	});

	test('uses dist-only localized shell paths', () => {
		assert.deepStrictEqual(buildLocalizedWebviewShellRelativePaths('zh-CN', 'settings.html'), [
			'dist/webviews/i18n/zh-cn/settings.html',
		]);
	});

	test('does not emit localized shell paths for english locales', () => {
		assert.deepStrictEqual(buildLocalizedWebviewShellRelativePaths('en-US', 'settings.html'), []);
	});

	test('resolves localized script bundle names for supported pages', () => {
		assert.strictEqual(getWebviewLocalizedScriptBundle('welcome.html'), 'welcome');
		assert.strictEqual(getWebviewLocalizedScriptBundle('settings.html'), undefined);
		assert.strictEqual(getWebviewLocalizedScriptBundle('rebase.html'), 'rebase');
		assert.strictEqual(getWebviewLocalizedScriptBundle('home.html'), 'home');
		assert.strictEqual(getWebviewLocalizedScriptBundle('commitDetails.html'), 'commitDetails');
		assert.strictEqual(getWebviewLocalizedScriptBundle('timeline.html'), 'timeline');
		assert.strictEqual(getWebviewLocalizedScriptBundle('graph.html'), 'graph');
	});

	test('builds localized script candidate paths from dist only', () => {
		assert.deepStrictEqual(buildLocalizedWebviewScriptRelativePaths('zh-CN', 'welcome'), [
			'dist/webviews/i18n/zh-cn/welcome.js',
		]);
	});

	test('does not emit localized script paths for english locales', () => {
		assert.deepStrictEqual(buildLocalizedWebviewScriptRelativePaths('en-US', 'welcome'), []);
	});

	test('rewrites localized script references for dynamic bundles', () => {
		const html = replaceLocalizedWebviewScriptReference(
			'<!doctype html><html lang="en"><head><script type="module" src="#{root}/dist/webviews/welcome.js"></script></head><body></body></html>',
			'welcome',
			'zh-cn',
		);

		assert.strictEqual(html.includes('#{root}/dist/webviews/i18n/zh-cn/welcome.js'), true);
		assert.strictEqual(html.includes('#{root}/dist/webviews/welcome.js'), false);
	});

	test('leaves unrelated script references unchanged', () => {
		const html = replaceLocalizedWebviewScriptReference(
			'<!doctype html><html><head><script type="module" src="#{root}/dist/webviews/home.js"></script></head></html>',
			'welcome',
			'zh-cn',
		);

		assert.strictEqual(html.includes('#{root}/dist/webviews/home.js'), true);
		assert.strictEqual(html.includes('#{root}/dist/webviews/i18n/zh-cn/welcome.js'), false);
	});
});
