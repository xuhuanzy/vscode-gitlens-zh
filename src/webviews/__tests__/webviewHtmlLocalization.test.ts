import * as assert from 'assert';
import {
	applyWebviewHtmlCatalog,
	injectWebviewRuntimeLocalization,
	shouldLocalizeWebviewHtml,
} from '../../i18n/webviews/webviewHtmlLocalization.js';

suite('webview html localization', () => {
	test('should only localize the settings webview in the first rollout', () => {
		assert.strictEqual(shouldLocalizeWebviewHtml('settings.html'), true);
		assert.strictEqual(shouldLocalizeWebviewHtml('home.html'), false);
	});

	test('should apply a translated catalog without touching runtime tokens', () => {
		const template = `<html><body><section id="current-line"><a title="__GL_I18N__settings.root.a.id.version.attr-title__">__GL_I18N__settings.root.a.id.version.text__</a><span>#{root}</span></section></body></html>`;
		const translated = applyWebviewHtmlCatalog(template, {
			'settings.root.a.id.version.attr-title': '打开更新日志',
			'settings.root.a.id.version.text': '发行说明',
		});

		assert.ok(translated.includes('发行说明'));
		assert.ok(translated.includes('打开更新日志'));
		assert.ok(translated.includes('#{root}'));
		assert.ok(!translated.includes('__GL_I18N__'));
	});

	test('should apply suffixed catalog keys for repeated structural owners', () => {
		const template = [
			'<html><body>',
			'<a title="__GL_I18N__settings.root.a.action.jump.variant-aaa.attr-title__">__GL_I18N__settings.root.a.action.jump.variant-aaa.text__</a>',
			'<a title="__GL_I18N__settings.root.a.action.jump.variant-bbb.attr-title__">__GL_I18N__settings.root.a.action.jump.variant-bbb.text__</a>',
			'</body></html>',
		].join('');
		const translated = applyWebviewHtmlCatalog(template, {
			'settings.root.a.action.jump.variant-aaa.attr-title': '跳转到 Inline Blame 设置',
			'settings.root.a.action.jump.variant-aaa.text': 'Inline Blame',
			'settings.root.a.action.jump.variant-bbb.attr-title': '跳转到 Modes 设置',
			'settings.root.a.action.jump.variant-bbb.text': 'Modes',
		});

		assert.ok(translated.includes('Inline Blame'));
		assert.ok(translated.includes('Modes'));
		assert.ok(translated.includes('跳转到 Inline Blame 设置'));
		assert.ok(translated.includes('跳转到 Modes 设置'));
		assert.ok(!translated.includes('__GL_I18N__'));
	});

	test('should set html lang without injecting an empty runtime payload', () => {
		const html = injectWebviewRuntimeLocalization('<html><head></head><body></body></html>', 'nonce', undefined);

		assert.ok(html.includes('<html lang='));
		assert.ok(!html.includes('__GL_WEBVIEW_I18N__'));
	});

	test('should inject runtime payload with CSP nonce when translations are available', () => {
		const html = injectWebviewRuntimeLocalization('<html><head></head><body></body></html>', 'nonce', {
			locale: 'zh-cn',
			translations: { Loading: '加载中' },
		});

		assert.ok(html.includes('nonce="nonce"'));
		assert.ok(html.includes('window.__GL_WEBVIEW_I18N__='));
		assert.ok(html.includes('"locale":"zh-cn"'));
		assert.ok(html.includes('"Loading":"加载中"'));
	});
});
