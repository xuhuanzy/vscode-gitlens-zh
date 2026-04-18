import * as assert from 'assert';
import { buildRuntimeTranslationMap, translatePreservingWhitespace } from '../webviewRuntimeLocalizationCore.js';

suite('webview runtime localization', () => {
	test('should translate while preserving surrounding whitespace', () => {
		const translations = new Map([
			['Loading...', '加载中...'],
			['Something went wrong', '出错了'],
		]);

		assert.strictEqual(translatePreservingWhitespace('Loading...', translations), '加载中...');
		assert.strictEqual(translatePreservingWhitespace(' Something went wrong ', translations), ' 出错了 ');
	});

	test('should normalize ordinary whitespace before lookup', () => {
		const translations = new Map([['Choose File / Folder...', '选择文件 / 文件夹...']]);

		assert.strictEqual(
			translatePreservingWhitespace('Choose  File /\nFolder...', translations),
			'选择文件 / 文件夹...',
		);
	});

	test('should leave unknown values unresolved', () => {
		const translations = new Map([['Loading...', '加载中...']]);

		assert.strictEqual(translatePreservingWhitespace('Unknown', translations), undefined);
	});

	test('should drop value-level translations when multiple keys disagree', () => {
		const translations = buildRuntimeTranslationMap(
			{
				'a.one': 'Open',
				'a.two': 'Open',
				b: 'Close',
			},
			{
				'a.one': '打开',
				'a.two': '开启',
				b: '关闭',
			},
		);

		assert.deepStrictEqual(translations, { Close: '关闭' });
	});
});
