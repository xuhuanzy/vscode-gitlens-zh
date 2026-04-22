import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import * as assert from 'assert';

import {
	buildLocalizedWebviewBundleRelativePaths,
	buildLocalizedWebviewShellRelativePaths,
	buildWebviewLocaleCandidates,
	getWebviewRuntimeBundle,
	injectWebviewRuntimeLocalization,
	normalizeI18nLocale,
} from '../webviews.js';
import { buildRuntimeWebviewLocalizationPayload } from '../webviews.shared.js';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');

function getRepoPath(...segments: string[]): string {
	return path.join(repoRoot, ...segments);
}

suite('Webview I18n Test Suite', () => {
	test('normalizes locale identifiers', () => {
		assert.strictEqual(normalizeI18nLocale(undefined), 'en');
		assert.strictEqual(normalizeI18nLocale('zh_CN'), 'zh-cn');
		assert.strictEqual(normalizeI18nLocale('zh-Hans-CN'), 'zh-hans-cn');
	});

	test('builds locale candidates without compatibility aliases', () => {
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-CN'), ['zh-cn', 'zh']);
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-Hans'), ['zh-hans', 'zh']);
		assert.deepStrictEqual(buildWebviewLocaleCandidates('zh-SG'), ['zh-sg', 'zh']);
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
		]);
	});

	test('does not emit localized shell paths for english locales', () => {
		assert.deepStrictEqual(buildLocalizedWebviewShellRelativePaths('en-US', 'settings.html'), []);
	});

	test('resolves runtime bundle metadata for supported pages', () => {
		assert.strictEqual(getWebviewRuntimeBundle('welcome.html'), 'welcome');
		assert.strictEqual(getWebviewRuntimeBundle('settings.html'), 'settings');
		assert.strictEqual(getWebviewRuntimeBundle('rebase.html'), 'rebase');
		assert.strictEqual(getWebviewRuntimeBundle('home.html'), 'home');
		assert.strictEqual(getWebviewRuntimeBundle('commitDetails.html'), 'commitDetails');
		assert.strictEqual(getWebviewRuntimeBundle('timeline.html'), 'timeline');
		assert.strictEqual(getWebviewRuntimeBundle('graph.html'), 'graph');
	});

	test('prefers src i18n bundles before dist copies', () => {
		assert.deepStrictEqual(buildLocalizedWebviewBundleRelativePaths('zh-CN', 'welcome'), [
			'src/i18n/webviews/zh-cn/welcome.json',
			'dist/webviews/i18n/zh-cn/welcome.json',
			'src/i18n/webviews/zh/welcome.json',
			'dist/webviews/i18n/zh/welcome.json',
		]);
	});

	test('builds runtime localization payload for exact and template messages', () => {
		assert.deepStrictEqual(
			buildRuntimeWebviewLocalizationPayload({
				version: 1,
				locale: 'zh-cn',
				bundle: 'welcome',
				messages: [
					{
						key: '1',
						source: 'Welcome to GitLens',
						pattern: {
							kind: 'literal',
							text: '欢迎使用 GitLens',
						},
					},
					{
						key: '2',
						source: 'You have completed ${slot1} of ${slot2} onboarding steps.',
						pattern: {
							kind: 'template',
							text: '你已完成 ${slot1}/${slot2} 个引导步骤。',
							slots: ['slot1', 'slot2'],
						},
					},
					{
						key: '3',
						source: 'needs',
						pattern: {
							kind: 'literal',
							text: '',
						},
					},
				],
			}),
			{
				locale: 'zh-cn',
				translations: {
					'Welcome to GitLens': '欢迎使用 GitLens',
				},
				templates: [
					{
						source: 'You have completed ${slot1} of ${slot2} onboarding steps.',
						target: '你已完成 ${slot1}/${slot2} 个引导步骤。',
						slots: ['slot1', 'slot2'],
					},
				],
			},
		);
	});

	test('derives only safe fragment translations from templates and skips reordered slots', () => {
		assert.deepStrictEqual(
			buildRuntimeWebviewLocalizationPayload({
				version: 1,
				locale: 'zh-cn',
				bundle: 'welcome',
				messages: [
					{
						key: '1',
						source: 'configure your preferred AI provider',
						pattern: {
							kind: 'literal',
							text: '配置你偏好的 AI 提供商',
						},
					},
					{
						key: '2',
						source: 'Stay in control. Review and edit AI suggestions before finalizing, and ${slot1} and model to fit your needs.',
						pattern: {
							kind: 'template',
							text: '保持掌控。在最终确定前先审阅并编辑 AI 建议，并 ${slot1} 和模型以满足你的需求。',
							slots: ['slot1'],
						},
					},
					{
						key: '3',
						source: '${slot1} ${slot2}',
						pattern: {
							kind: 'template',
							text: '${slot2}（${slot1}）',
							slots: ['slot1', 'slot2'],
						},
					},
					{
						key: '4',
						source: 'Pull ${slot1}',
						pattern: {
							kind: 'template',
							text: '拉取${slot1}',
							slots: ['slot1'],
						},
					},
				],
			}),
			{
				locale: 'zh-cn',
				translations: {
					'Stay in control. Review and edit AI suggestions before finalizing, and':
						'保持掌控。在最终确定前先审阅并编辑 AI 建议，并',
					'and model to fit your needs.': '和模型以满足你的需求。',
					'configure your preferred AI provider': '配置你偏好的 AI 提供商',
				},
				templates: [
					{
						source: 'Stay in control. Review and edit AI suggestions before finalizing, and ${slot1} and model to fit your needs.',
						target: '保持掌控。在最终确定前先审阅并编辑 AI 建议，并 ${slot1} 和模型以满足你的需求。',
						slots: ['slot1'],
					},
				],
			},
		);
	});

	test('drops unsafe runtime templates and inflection-only exact entries', () => {
		assert.deepStrictEqual(
			buildRuntimeWebviewLocalizationPayload({
				version: 1,
				locale: 'zh-cn',
				messages: [
					{
						key: '1',
						source: '${slot1} ${slot2}',
						pattern: {
							kind: 'template',
							text: '${slot2}（${slot1}）',
							slots: ['slot1', 'slot2'],
						},
					},
					{
						key: '2',
						source: 'Pull ${slot1}',
						pattern: {
							kind: 'template',
							text: '拉取${slot1}',
							slots: ['slot1'],
						},
					},
					{
						key: '3',
						source: 'No ${slot1} branches',
						pattern: {
							kind: 'template',
							text: '没有${slot1}分支',
							slots: ['slot1'],
						},
					},
					{
						key: '4',
						source: 'needs',
						pattern: {
							kind: 'literal',
							text: '',
						},
					},
				],
			}),
			undefined,
		);
	});

	test('drops colliding exact translations from runtime payload', () => {
		assert.deepStrictEqual(
			buildRuntimeWebviewLocalizationPayload({
				version: 1,
				locale: 'zh-cn',
				messages: [
					{
						key: '1',
						source: 'Open',
						pattern: {
							kind: 'literal',
							text: '打开',
						},
					},
					{
						key: '2',
						source: 'Open',
						pattern: {
							kind: 'literal',
							text: '开启',
						},
					},
				],
			}),
			undefined,
		);
	});

	test('filters broad runtime matches from real bundles while keeping required welcome fragments', () => {
		const homePayload = buildRuntimeWebviewLocalizationPayload(
			JSON.parse(fs.readFileSync(getRepoPath('src', 'i18n', 'webviews', 'zh-cn', 'home.json'), 'utf8')),
		);
		assert.ok(homePayload != null);

		const homeTemplates = new Set(homePayload.templates.map(template => template.source));
		assert.strictEqual(homeTemplates.has('${slot1} ${slot2}'), false);
		assert.strictEqual(homeTemplates.has('Pull ${slot1}'), false);
		assert.strictEqual(homeTemplates.has('No ${slot1} branches'), false);
		assert.strictEqual(homeTemplates.has('from ${slot1}'), false);
		assert.strictEqual(homeTemplates.has('to ${slot1}'), false);
		assert.strictEqual(homeTemplates.has('${slot1} ${slot2} your review'), false);
		assert.strictEqual(homeTemplates.has('Change Merge Target ${slot1}'), false);
		assert.strictEqual(
			homeTemplates.has(
				'Connect hosting services like ${slot1} and issue trackers like ${slot2} to track progress and take action on PRs and issues related to your branches.',
			),
			true,
		);
		assert.strictEqual(
			homeTemplates.has(
				'GitKraken MCP is active in your AI chat, leveraging Git and your integrations to provide context and perform actions. <a href="${slot1}">Learn more</a>${slot2}',
			),
			false,
		);

		assert.strictEqual('ahead of' in homePayload.translations, false);
		assert.strictEqual('branches' in homePayload.translations, false);
		assert.strictEqual('reviewers' in homePayload.translations, false);
		assert.strictEqual('in the working tree' in homePayload.translations, false);
		assert.strictEqual('No' in homePayload.translations, false);
		assert.strictEqual('recent' in homePayload.translations, false);
		assert.strictEqual('stale' in homePayload.translations, false);
		assert.strictEqual(homePayload.translations['No recent branches'], '没有最近分支');
		assert.strictEqual(homePayload.translations['No stale branches'], '没有陈旧分支');
		assert.strictEqual(homePayload.translations['Something went wrong'], '发生了错误');
		assert.strictEqual(
			homePayload.translations['GitKraken MCP Bundled with GitLens'],
			'GitLens 随附的 GitKraken MCP',
		);
		assert.strictEqual(
			homePayload.translations['Install GitKraken MCP for GitLens'],
			'为 GitLens 安装 GitKraken MCP',
		);
		assert.strictEqual(homePayload.translations['Manage Account'], '管理账户');
		assert.strictEqual(homePayload.translations['Sign Out'], '退出登录');
		assert.strictEqual(homePayload.translations['Manage Integrations'], '管理集成');
		assert.strictEqual(homePayload.translations['Loading integrations status'], '正在加载集成状态');
		assert.strictEqual(homePayload.translations['Loading account status'], '正在加载账户状态');
		assert.strictEqual(
			homePayload.translations['GitLens is better with integrations!'],
			'接入集成后，GitLens 更强大！',
		);
		assert.strictEqual(homePayload.translations['Upgrade to Pro'], '升级到 Pro');
		assert.strictEqual(homePayload.translations['Filter Commits'], '筛选提交');
		assert.strictEqual(homePayload.translations['No results found'], '未找到结果');
		assert.strictEqual(homePayload.translations['Switch AI Provider/Model'], '切换 AI 提供商/模型');
		assert.strictEqual(homePayload.translations['Connect hosting services like'], '连接');
		assert.strictEqual(homePayload.translations['and issue trackers like'], '等托管服务以及');
		assert.strictEqual(
			homePayload.translations['to track progress and take action on PRs and issues related to your branches.'],
			'等 Issue 跟踪器，以跟踪进度并对与你的分支相关的 PR 和 Issue 采取操作。',
		);

		const welcomePayload = buildRuntimeWebviewLocalizationPayload(
			JSON.parse(fs.readFileSync(getRepoPath('src', 'i18n', 'webviews', 'zh-cn', 'welcome.json'), 'utf8')),
		);
		assert.ok(welcomePayload != null);

		assert.strictEqual(
			welcomePayload.translations['Stay in control. Review and edit AI suggestions before finalizing, and'],
			'保持掌控。在最终确定前先审阅并编辑 AI 建议，并',
		);
		assert.strictEqual(welcomePayload.translations['and model to fit your needs.'], '和模型以满足你的需求。');
		assert.strictEqual(welcomePayload.translations["You're using"], '你当前使用的是');
		assert.strictEqual(welcomePayload.translations['Learn more about the'], '进一步了解');
	});

	test('injects runtime localization without rewriting page runtime bundles', () => {
		const html = injectWebviewRuntimeLocalization(
			'<!doctype html><html lang="en"><head><script type="module" src="#{root}/dist/webviews/welcome.js"></script></head><body></body></html>',
			'nonce',
			'zh-cn',
			{
				locale: 'zh-cn',
				translations: {
					'Welcome to GitLens': '欢迎使用 GitLens',
				},
				templates: [],
			},
		);

		assert.strictEqual(html.includes('window.__GL_WEBVIEW_I18N__'), true);
		assert.strictEqual(html.includes('#{root}/dist/webviews/welcome.js'), true);
		assert.strictEqual(html.includes('<html lang="zh-cn">'), true);
	});

	test('runtime localizes mixed inline content from derived template fragments', () => {
		class FakeNode {
			readonly nodeType: number;
			ownerDocument?: FakeDocument;
			parentNode: FakeNode | null = null;

			constructor(nodeType: number, ownerDocument?: FakeDocument) {
				this.nodeType = nodeType;
				this.ownerDocument = ownerDocument;
			}
		}

		class FakeText extends FakeNode {
			nodeValue: string | null;

			constructor(ownerDocument: FakeDocument, value: string) {
				super(3, ownerDocument);
				this.nodeValue = value;
			}

			get parentElement(): FakeElement | null {
				return this.parentNode instanceof FakeElement ? this.parentNode : null;
			}
		}

		class FakeComment extends FakeNode {
			data: string;

			constructor(ownerDocument: FakeDocument, value = '') {
				super(8, ownerDocument);
				this.data = value;
			}
		}

		class FakeElement extends FakeNode {
			readonly childNodes: FakeNode[] = [];
			lang = '';
			readonly tagName: string;
			private readonly attributes = new Map<string, string>();

			constructor(ownerDocument: FakeDocument, tagName: string, children?: Array<FakeNode | string>) {
				super(1, ownerDocument);
				this.tagName = tagName.toUpperCase();

				if (children != null) {
					this.replaceChildren(...children);
				}
			}

			getAttribute(name: string): string | null {
				return this.attributes.get(name) ?? null;
			}

			replaceChildren(...nodes: Array<FakeNode | string>): void {
				this.childNodes.length = 0;

				for (const node of nodes) {
					const child = typeof node === 'string' ? this.ownerDocument!.createTextNode(node) : node;
					child.parentNode = this;
					child.ownerDocument ??= this.ownerDocument;
					this.childNodes.push(child);
				}
			}

			setAttribute(name: string, value: string): void {
				this.attributes.set(name, value);
			}
		}

		class FakeDocument {
			readonly documentElement: FakeElement;

			constructor() {
				this.documentElement = new FakeElement(this, 'html');
			}

			createElement(tagName: string, children?: Array<FakeNode | string>): FakeElement {
				return new FakeElement(this, tagName, children);
			}

			createTextNode(data: string): FakeText {
				return new FakeText(this, data);
			}

			createComment(data = ''): FakeComment {
				return new FakeComment(this, data);
			}
		}

		class FakeMutationObserver {
			constructor(_callback: (records: unknown[]) => void) {}

			observe(_target: object, _options: object): void {}
		}

		function getScript(html: string): string {
			const match = /<script type="text\/javascript" nonce="nonce">([\s\S]*?)<\/script>/.exec(html);
			assert.ok(match != null);
			return match[1];
		}

		function getTextContent(node: FakeNode): string {
			if (node instanceof FakeText) {
				return node.nodeValue ?? '';
			}

			if (node instanceof FakeElement) {
				return node.childNodes.map(getTextContent).join('');
			}

			return '';
		}

		const document = new FakeDocument();
		const providerLink = document.createElement('a', ['configure your preferred AI provider']);
		const paragraph = document.createElement('p', [
			'Stay in control. Review and edit AI suggestions before finalizing, and ',
			providerLink,
			' and model to fit your needs.',
		]);
		const body = document.createElement('body', [paragraph]);
		document.documentElement.replaceChildren(body);

		const payload = buildRuntimeWebviewLocalizationPayload({
			version: 1,
			locale: 'zh-cn',
			bundle: 'welcome',
			messages: [
				{
					key: '1',
					source: 'configure your preferred AI provider',
					pattern: {
						kind: 'literal',
						text: '配置你偏好的 AI 提供商',
					},
				},
				{
					key: '2',
					source: 'Stay in control. Review and edit AI suggestions before finalizing, and ${slot1} and model to fit your needs.',
					pattern: {
						kind: 'template',
						text: '保持掌控。在最终确定前先审阅并编辑 AI 建议，并 ${slot1} 和模型以满足你的需求。',
						slots: ['slot1'],
					},
				},
			],
		});
		assert.ok(payload != null);

		const html = injectWebviewRuntimeLocalization(
			'<html><head></head><body></body></html>',
			'nonce',
			'zh-cn',
			payload,
		);

		vm.runInNewContext(getScript(html), {
			Element: FakeElement,
			MutationObserver: FakeMutationObserver,
			Node: { TEXT_NODE: 3 },
			Text: FakeText,
			document: document,
			window: {
				requestAnimationFrame(callback: () => void): number {
					callback();
					return 1;
				},
			},
		});

		assert.strictEqual(document.documentElement.lang, 'zh-cn');
		assert.strictEqual(
			paragraph.childNodes.map(getTextContent).join('|'),
			'保持掌控。在最终确定前先审阅并编辑 AI 建议，并 |配置你偏好的 AI 提供商| 和模型以满足你的需求。',
		);
		assert.strictEqual(getTextContent(providerLink), '配置你偏好的 AI 提供商');
	});

	test('runtime skips fragment exact translations inside mixed short phrases', () => {
		class FakeNode {
			readonly nodeType: number;
			ownerDocument?: FakeDocument;
			parentNode: FakeNode | null = null;

			constructor(nodeType: number, ownerDocument?: FakeDocument) {
				this.nodeType = nodeType;
				this.ownerDocument = ownerDocument;
			}
		}

		class FakeText extends FakeNode {
			nodeValue: string | null;

			constructor(ownerDocument: FakeDocument, value: string) {
				super(3, ownerDocument);
				this.nodeValue = value;
			}

			get parentElement(): FakeElement | null {
				return this.parentNode instanceof FakeElement ? this.parentNode : null;
			}
		}

		class FakeComment extends FakeNode {
			data: string;

			constructor(ownerDocument: FakeDocument, value = '') {
				super(8, ownerDocument);
				this.data = value;
			}
		}

		class FakeElement extends FakeNode {
			readonly childNodes: FakeNode[] = [];
			lang = '';
			readonly tagName: string;
			private readonly attributes = new Map<string, string>();

			constructor(ownerDocument: FakeDocument, tagName: string, children?: Array<FakeNode | string>) {
				super(1, ownerDocument);
				this.tagName = tagName.toUpperCase();

				if (children != null) {
					this.replaceChildren(...children);
				}
			}

			getAttribute(name: string): string | null {
				return this.attributes.get(name) ?? null;
			}

			replaceChildren(...nodes: Array<FakeNode | string>): void {
				this.childNodes.length = 0;

				for (const node of nodes) {
					const child = typeof node === 'string' ? this.ownerDocument!.createTextNode(node) : node;
					child.parentNode = this;
					child.ownerDocument ??= this.ownerDocument;
					this.childNodes.push(child);
				}
			}

			setAttribute(name: string, value: string): void {
				this.attributes.set(name, value);
			}
		}

		class FakeDocument {
			readonly documentElement: FakeElement;

			constructor() {
				this.documentElement = new FakeElement(this, 'html');
			}

			createElement(tagName: string, children?: Array<FakeNode | string>): FakeElement {
				return new FakeElement(this, tagName, children);
			}

			createTextNode(data: string): FakeText {
				return new FakeText(this, data);
			}
		}

		class FakeMutationObserver {
			constructor(_callback: (records: unknown[]) => void) {}

			observe(_target: object, _options: object): void {}
		}

		function getScript(html: string): string {
			const match = /<script type="text\/javascript" nonce="nonce">([\s\S]*?)<\/script>/.exec(html);
			assert.ok(match != null);
			return match[1];
		}

		function getTextContent(node: FakeNode): string {
			if (node instanceof FakeText) {
				return node.nodeValue ?? '';
			}

			if (node instanceof FakeElement) {
				return node.childNodes.map(getTextContent).join('');
			}

			return '';
		}

		const document = new FakeDocument();
		const branchSection = document.createElement('gl-branch-section');
		branchSection.setAttribute('label', 'recent');
		const heading = document.createElement('span', ['recent']);
		const paragraph = document.createElement('p', [
			'No ',
			new FakeComment(document, '?lit$marker$'),
			'recent',
			new FakeComment(document, '?lit$marker$'),
			' branches',
		]);
		const body = document.createElement('body', [branchSection, heading, paragraph]);
		document.documentElement.replaceChildren(body);

		const html = injectWebviewRuntimeLocalization('<html><head></head><body></body></html>', 'nonce', 'zh-cn', {
			locale: 'zh-cn',
			translations: {
				No: '否',
				recent: '最近',
			},
			templates: [],
		});

		vm.runInNewContext(getScript(html), {
			Element: FakeElement,
			MutationObserver: FakeMutationObserver,
			Node: { TEXT_NODE: 3 },
			Text: FakeText,
			document: document,
			window: {
				requestAnimationFrame(callback: () => void): number {
					callback();
					return 1;
				},
			},
		});

		assert.strictEqual(document.documentElement.lang, 'zh-cn');
		assert.strictEqual(branchSection.getAttribute('label'), 'recent');
		assert.strictEqual(getTextContent(heading), '最近');
		assert.strictEqual(getTextContent(paragraph), 'No recent branches');
		assert.ok(paragraph.childNodes[1] instanceof FakeComment);
		assert.ok(paragraph.childNodes[3] instanceof FakeComment);
		assert.deepStrictEqual(paragraph.childNodes.map(getTextContent), ['No ', '', 'recent', '', ' branches']);
	});

	test('runtime re-localizes parent elements for mixed text mutations', () => {
		class FakeNode {
			readonly nodeType: number;
			ownerDocument?: FakeDocument;
			parentNode: FakeNode | null = null;

			constructor(nodeType: number, ownerDocument?: FakeDocument) {
				this.nodeType = nodeType;
				this.ownerDocument = ownerDocument;
			}
		}

		class FakeText extends FakeNode {
			nodeValue: string | null;

			constructor(ownerDocument: FakeDocument, value: string) {
				super(3, ownerDocument);
				this.nodeValue = value;
			}

			get parentElement(): FakeElement | null {
				return this.parentNode instanceof FakeElement ? this.parentNode : null;
			}
		}

		class FakeComment extends FakeNode {
			data: string;

			constructor(ownerDocument: FakeDocument, value = '') {
				super(8, ownerDocument);
				this.data = value;
			}
		}

		class FakeElement extends FakeNode {
			readonly childNodes: FakeNode[] = [];
			lang = '';
			readonly tagName: string;
			private readonly attributes = new Map<string, string>();

			constructor(ownerDocument: FakeDocument, tagName: string, children?: Array<FakeNode | string>) {
				super(1, ownerDocument);
				this.tagName = tagName.toUpperCase();

				if (children != null) {
					this.replaceChildren(...children);
				}
			}

			getAttribute(name: string): string | null {
				return this.attributes.get(name) ?? null;
			}

			replaceChildren(...nodes: Array<FakeNode | string>): void {
				this.childNodes.length = 0;

				for (const node of nodes) {
					const child = typeof node === 'string' ? this.ownerDocument!.createTextNode(node) : node;
					child.parentNode = this;
					child.ownerDocument ??= this.ownerDocument;
					this.childNodes.push(child);
				}
			}

			setAttribute(name: string, value: string): void {
				this.attributes.set(name, value);
			}
		}

		class FakeDocument {
			readonly documentElement: FakeElement;

			constructor() {
				this.documentElement = new FakeElement(this, 'html');
			}

			createComment(data = ''): FakeComment {
				return new FakeComment(this, data);
			}

			createElement(tagName: string, children?: Array<FakeNode | string>): FakeElement {
				return new FakeElement(this, tagName, children);
			}

			createTextNode(data: string): FakeText {
				return new FakeText(this, data);
			}
		}

		class FakeMutationObserver {
			static instances: FakeMutationObserver[] = [];

			constructor(private readonly callback: (records: unknown[]) => void) {
				FakeMutationObserver.instances.push(this);
			}

			emit(records: unknown[]): void {
				this.callback(records);
			}

			observe(_target: object, _options: object): void {}
		}

		function getScript(html: string): string {
			const match = /<script type="text\/javascript" nonce="nonce">([\s\S]*?)<\/script>/.exec(html);
			assert.ok(match != null);
			return match[1];
		}

		function getTextContent(node: FakeNode): string {
			if (node instanceof FakeText) {
				return node.nodeValue ?? '';
			}

			if (node instanceof FakeElement) {
				return node.childNodes.map(getTextContent).join('');
			}

			return '';
		}

		const document = new FakeDocument();
		const paragraph = document.createElement('p');
		const body = document.createElement('body', [paragraph]);
		document.documentElement.replaceChildren(body);

		const html = injectWebviewRuntimeLocalization('<html><head></head><body></body></html>', 'nonce', 'zh-cn', {
			locale: 'zh-cn',
			translations: {
				No: '否',
				recent: '最近',
			},
			templates: [],
		});

		vm.runInNewContext(getScript(html), {
			Element: FakeElement,
			MutationObserver: FakeMutationObserver,
			Node: { TEXT_NODE: 3 },
			Text: FakeText,
			document: document,
			window: {
				requestAnimationFrame(callback: () => void): number {
					callback();
					return 1;
				},
			},
		});

		paragraph.replaceChildren(
			'No ',
			document.createComment('?lit$marker$'),
			'recent',
			document.createComment('?lit$marker$'),
			' branches',
		);

		FakeMutationObserver.instances[0]?.emit([
			{
				addedNodes: paragraph.childNodes,
				target: paragraph,
				type: 'childList',
			},
		]);

		assert.strictEqual(getTextContent(paragraph), 'No recent branches');
		assert.ok(paragraph.childNodes[1] instanceof FakeComment);
		assert.ok(paragraph.childNodes[3] instanceof FakeComment);
		assert.deepStrictEqual(paragraph.childNodes.map(getTextContent), ['No ', '', 'recent', '', ' branches']);
	});
});
