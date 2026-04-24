import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { writeTextFile as writeStoreTextFile } from '../../../core/store.mts';
import { createWebviewsDomainContext } from '../context.mts';
import {
	loadWebviewsCatalog,
	loadWebviewsReconciliationReport,
	loadWebviewsWorkset,
	loadLocalizedDynamicSource,
	loadLocalizedSettingsShell,
	saveWebviewsWorkset,
} from '../store.mts';
import {
	createPendingReport,
	generateWebviewsLocalizedDynamicSources,
	generateWebviewsLocalizedOutputs,
	generateWebviewsLocalizedSettingsShell,
	promoteWebviewsAuthority,
	syncWebviewsI18n,
} from '../workflow.mts';
import { createLocalizedWebviewConfig, GenerateLocalizedDynamicSourcesPlugin } from '../webpack.mjs';

run();

function run(): void {
	testSettingsWorkflow();
	testWelcomeLocalizedSourceWorkflow();
	testDynamicSourceGenerationDoesNotRequireBuiltSettingsShell();
	testLocalizedWebpackWatchIgnoresGeneratedArtifacts();
	testWriteTextFileSkipsUnchangedWrites();
	testSupportedDynamicBundlesGenerateLocalizedSources();
	testRebaseShortcutFooterIsNotExtracted();
	testStructuralSlotOnlyTemplatesAreNotExtracted();
	testLaunchpadGrammarHelpersAreNotExtracted();
	testWelcomeLocalizedSourceRewritesImportsBackToSourceTree();
	testGraphBundleGeneratesLocalizedSource();
	testWelcomeWorkflowPreservesTemplateArgumentSeparators();
	testWelcomeWorkflowSkipsObviousNonUiImperativeStrings();
	testCommitDetailsWorkflowLocalizesDisplayOnlyImperativeStrings();
	testSearchInputPlaceholderGetterIsLocalized();
	testReturnedDisplayTemplateSlotsLocalizeVariableInitializers();
	testGraphBranchVisibilityOptionsAreLocalized();
	testDeferredRuntimeBoundariesAreReported();
	testGeneratorPreservesStructuralNodes();
	testLocalizedSourcePreservesNamedSlotSubtrees();
	testLocalizedSourcePreservesWalkthroughAnchorStructure();
	testGraphLocalizedSourcePreservesPopoverMenuStructure();
	testLocalizedSettingsShellPreservesRuntimeAnchors();
}

function testSettingsWorkflow(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-nls-'));
	try {
		fs.mkdirSync(path.join(rootDir, 'dist', 'webviews'), { recursive: true });
		fs.writeFileSync(
			path.join(rootDir, 'dist', 'webviews', 'settings.html'),
			[
				'<!doctype html>',
				'<html lang="en">',
				'<body>',
				'\t<h1 title="Open Settings">Settings</h1>',
				'\t<p>Adds a <a title="Show View in Side Bar" href="command:gitlens.showLineHistoryView">Line History view</a>, hidden by default</p>',
				'\t<span class="setting__hint">Example: <span data-setting-preview="currentLine.format" data-setting-preview-default="${author}"></span></span>',
				'</body>',
				'</html>',
				'',
			].join('\n'),
			'utf8',
		);

		const syncResult = syncWebviewsI18n({ rootDir });
		assert.equal(syncResult.occurrenceCount >= 3, true);

		const context = createWebviewsDomainContext(rootDir);
		const catalog = loadWebviewsCatalog(context);
		const workset = loadWebviewsWorkset(context);
		assert.equal(catalog.domain, 'webviews');
		assert.equal(workset.domain, 'webviews');
		assert.equal(
			workset.entries.some(entry => entry.source.includes('${author}')),
			false,
		);

		saveWebviewsWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.source === 'Settings'
					? { ...entry, status: 'approved', translation: '设置' }
					: entry.source === 'Line History view'
						? { ...entry, status: 'approved', translation: '行历史视图' }
						: entry.source === 'Open Settings'
							? { ...entry, status: 'approved', translation: '打开设置' }
							: entry.source === 'Show View in Side Bar'
								? { ...entry, status: 'approved', translation: '在侧边栏中显示视图' }
								: entry.source === 'Adds a ${slot1}, hidden by default'
									? { ...entry, status: 'approved', translation: '添加${slot1}（默认隐藏）' }
									: entry.source === 'Example: ${slot1}'
										? { ...entry, status: 'approved', translation: '示例：${slot1}' }
										: entry,
			),
		});

		const promoteResult = promoteWebviewsAuthority({ rootDir });
		assert.equal(promoteResult.promoted.length >= 3, true);

		const generateResult = generateWebviewsLocalizedOutputs({ rootDir });
		assert.equal(generateResult.translatedCount >= 3, true);

		const localizedHtml = loadLocalizedSettingsShell(context);
		assert.notEqual(localizedHtml, undefined);
		assert.equal(localizedHtml!.includes('设置'), true);
		assert.equal(localizedHtml!.includes('title="打开设置"'), true);
		assert.equal(
			localizedHtml!.includes(
				'<p>添加<a title="在侧边栏中显示视图" href="command:gitlens.showLineHistoryView">行历史视图</a>（默认隐藏）</p>',
			),
			true,
		);
		assert.equal(localizedHtml!.includes('示例：'), true);
		assert.equal(localizedHtml!.includes('${author}'), true);
		assert.equal(localizedHtml!.includes('<html lang="zh-CN">'), true);

		const report = createPendingReport({ rootDir });
		assert.equal(report.domain, 'webviews');
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testWelcomeLocalizedSourceWorkflow(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-welcome-source-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeWelcomeFixture(rootDir, {
			welcomeTs: [
				"import './welcome.scss';",
				"import { html } from 'lit';",
				"import './components/welcome-page.js';",
				'export function renderApp() {',
				'\treturn html`<div><gl-welcome-page></gl-welcome-page></div>`;',
				'}',
				'',
			].join('\n'),
			welcomePageTs: [
				"import { html } from 'lit';",
				"import './welcome-parts.js';",
				'const cards = [{ title: "Welcome to GitLens" }];',
				'export function renderWelcome(doneCount, allCount) {',
				'\tvoid cards;',
				'\treturn html`<section><h1>Welcome to GitLens</h1><p>${doneCount}/${allCount} steps complete</p><ul><li>View previous file revisions</li></ul></section>`;',
				'}',
				'',
			].join('\n'),
			welcomePartsTs: [
				"import { html } from 'lit';",
				'export function renderProgress(doneCount, allCount) {',
				'\treturn html`<p>${doneCount}/${allCount} steps complete</p>`;',
				'}',
				'',
			].join('\n'),
		});

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'Welcome to GitLens': '欢迎使用 GitLens',
			'${slot1}/${slot2} steps complete': '${slot1}/${slot2} 个步骤已完成',
			'View previous file revisions': '查看文件的上一版修订',
		});

		promoteWebviewsAuthority({ rootDir });
		const generateResult = generateWebviewsLocalizedOutputs({ rootDir });
		assert.equal(generateResult.translatedCount >= 4, true);

		const localizedWelcomePage = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/welcome/components/welcome-page.ts',
		);
		assert.notEqual(localizedWelcomePage, undefined);
		assert.equal(localizedWelcomePage!.includes('欢迎使用 GitLens'), true);
		assert.equal(localizedWelcomePage!.includes('${doneCount}/${allCount} 个步骤已完成'), true);
		assert.equal(localizedWelcomePage!.includes('查看文件的上一版修订'), true);

		const localizedWelcomeParts = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/welcome/components/welcome-parts.ts',
		);
		assert.notEqual(localizedWelcomeParts, undefined);
		assert.equal(localizedWelcomeParts!.includes('${doneCount}/${allCount} 个步骤已完成'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testLocalizedWebpackWatchIgnoresGeneratedArtifacts(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-watch-config-'));
	try {
		const config = createLocalizedWebviewConfig({
			rootDir: rootDir,
			webviews: {
				commitDetails: {
					entry: path.join(
						rootDir,
						'.work',
						'i18n',
						'webviews-sources',
						'zh-cn',
						'src',
						'webviews',
						'apps',
						'commitDetails',
						'commitDetails.ts',
					),
				},
			},
			locale: 'zh-cn',
			config: {
				watchOptions: {
					ignored: ['**/node_modules/**'],
				},
				plugins: [],
				resolve: {},
			},
			excludePlugin: () => false,
		});

		assert.ok(Array.isArray(config.watchOptions?.ignored));
		assert.deepEqual(config.watchOptions!.ignored, [
			'**/node_modules/**',
			path.join(rootDir, '.work', 'i18n', 'webviews-sources').replaceAll('\\', '/'),
			path.join(rootDir, 'i18n', 'catalog').replaceAll('\\', '/'),
			path.join(rootDir, 'i18n', 'worksets').replaceAll('\\', '/'),
			path.join(rootDir, 'i18n', 'reports').replaceAll('\\', '/'),
		]);

		const generator = config.plugins?.find(plugin => plugin instanceof GenerateLocalizedDynamicSourcesPlugin) as
			| GenerateLocalizedDynamicSourcesPlugin
			| undefined;
		if (generator == null) {
			throw new Error('expected GenerateLocalizedDynamicSourcesPlugin to be present');
		}
		assert.deepEqual(generator.pathsToWatch, [
			path.join(rootDir, 'src', 'webviews', 'apps'),
			path.join(rootDir, 'i18n', 'authority'),
		]);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testWriteTextFileSkipsUnchangedWrites(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-write-text-file-'));
	try {
		const filePath = path.join(rootDir, 'sample.txt');
		writeStoreTextFile(filePath, 'same content\n');
		const before = fs.statSync(filePath, { bigint: true }).mtimeNs;

		sleep(1100);
		writeStoreTextFile(filePath, 'same content\n');
		const after = fs.statSync(filePath, { bigint: true }).mtimeNs;

		assert.equal(after, before);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testDynamicSourceGenerationDoesNotRequireBuiltSettingsShell(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-dynamic-clean-dist-'));
	try {
		writeTextFile(
			rootDir,
			'src/webviews/apps/settings/settings.html',
			'<!doctype html><html lang="en"><body></body></html>\n',
		);
		writeWelcomeFixture(rootDir, {
			welcomeTs: [
				"import { html } from 'lit';",
				"import './components/welcome-page.js';",
				'export function renderApp() {',
				'\treturn html`<div><gl-welcome-page></gl-welcome-page></div>`;',
				'}',
				'',
			].join('\n'),
			welcomePageTs: [
				"import { html } from 'lit';",
				'export function renderWelcome() {',
				'\treturn html`<section><h1>Welcome to GitLens</h1></section>`;',
				'}',
				'',
			].join('\n'),
			welcomePartsTs: 'export const unused = true;\n',
		});

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'Welcome to GitLens': '欢迎使用 GitLens',
		});
		promoteWebviewsAuthority({ rootDir });

		const generateResult = generateWebviewsLocalizedDynamicSources({ rootDir });
		assert.equal(generateResult.translatedCount >= 1, true);
		assert.equal(
			loadLocalizedDynamicSource(context, 'src/webviews/apps/welcome/components/welcome-page.ts')?.includes(
				'欢迎使用 GitLens',
			),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testSupportedDynamicBundlesGenerateLocalizedSources(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-supported-bundles-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/rebase/rebase.ts',
			[
				"import { html } from 'lit';",
				'export function renderRebase() {',
				'\treturn html`<section><p>No commits to rebase</p></section>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/home/home.ts',
			[
				"import { html } from 'lit';",
				'export function renderHome() {',
				'\treturn html`<section><p>You are all caught up!</p></section>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/commitDetails/commitDetails.ts',
			[
				"import { html } from 'lit';",
				'export function renderCommitDetails() {',
				'\treturn html`<section><p>Inspect Commit</p></section>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/timeline/timeline.ts',
			[
				"import { html } from 'lit';",
				'export function renderTimeline() {',
				'\treturn html`<section><p>No commits found for the specified time period</p></section>`;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'No commits to rebase': '没有可变基的提交',
			'You are all caught up!': '你已全部处理完成！',
			'Inspect Commit': '检查提交',
			'No commits found for the specified time period': '在指定时间段内未找到提交',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		assert.equal(
			loadLocalizedDynamicSource(context, 'src/webviews/apps/rebase/rebase.ts')?.includes('没有可变基的提交'),
			true,
		);
		assert.equal(
			loadLocalizedDynamicSource(context, 'src/webviews/apps/home/home.ts')?.includes('你已全部处理完成！'),
			true,
		);
		assert.equal(
			loadLocalizedDynamicSource(context, 'src/webviews/apps/commitDetails/commitDetails.ts')?.includes(
				'检查提交',
			),
			true,
		);
		assert.equal(
			loadLocalizedDynamicSource(context, 'src/webviews/apps/plus/timeline/timeline.ts')?.includes(
				'在指定时间段内未找到提交',
			),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testRebaseShortcutFooterIsNotExtracted(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-rebase-shortcuts-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/rebase/rebase.ts',
			[
				"import { html } from 'lit';",
				'export function renderFooter() {',
				'\treturn html`<footer>',
				'\t\t<div class="shortcuts">',
				'\t\t\t<code-icon icon="keyboard"></code-icon>',
				'\t\t\t<span class="shortcut"><kbd class="word">p</kbd><span>ick</span></span>',
				'\t\t\t<span class="shortcut"><kbd class="word">r</kbd><span>eword</span></span>',
				'\t\t\t<span class="shortcut"><kbd class="word">e</kbd><span>dit</span></span>',
				'\t\t\t<span class="shortcut"><kbd class="word">s</kbd><span>quash</span></span>',
				'\t\t\t<span class="shortcut"><kbd class="word">f</kbd><span>ixup</span></span>',
				'\t\t\t<span class="shortcut"><kbd class="word">d</kbd><span>rop</span></span>',
				'\t\t\t<span class="shortcut"><kbd>alt</kbd> <kbd>↑↓</kbd><span class="label">move</span></span>',
				'\t\t\t<span class="shortcut"><kbd>/</kbd><span class="label">search</span></span>',
				'\t\t</div>',
				'\t\t<p>Ready to rebase</p>',
				'\t</footer>`;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		const catalog = loadWebviewsCatalog(context);
		const workset = loadWebviewsWorkset(context);
		const blockedSources = new Set(['ick', 'eword', 'dit', 'quash', 'ixup', 'rop', 'move', 'search']);

		assert.equal(
			workset.entries.some(entry => entry.source === 'Ready to rebase'),
			true,
		);
		assert.equal(
			workset.entries.some(entry => blockedSources.has(entry.source)),
			false,
		);
		assert.equal(
			catalog.occurrences.some(occurrence => blockedSources.has(occurrence.sourceText)),
			false,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testStructuralSlotOnlyTemplatesAreNotExtracted(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-structural-templates-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/rebase/components/rebase-entry.ts',
			[
				"import { html } from 'lit';",
				'export function renderEntry(action: string, message: string, sha: string) {',
				'\tconst ariaLabel = `${action}, ${message}, ${sha}`;',
				'\treturn html`<div aria-label=${ariaLabel}><span>Ready to rebase</span></div>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/shared/components/search/search-box.ts',
			[
				"import { html } from 'lit';",
				'export function renderCount(step: number, total: number, label: string) {',
				'\treturn html`<span><span>${step}</span> of <span>${total}</span><span> ${label}</span></span>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/home/components/user-chip.ts',
			[
				"import { html } from 'lit';",
				'export function renderUser(name: string, status: string) {',
				'\treturn html`<span><strong>${name}</strong> (${status})</span>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/graph/components/branch-label.ts',
			[
				"import { html } from 'lit';",
				'export function renderBranchLabel(name: string, status: string, branch: string, remote: string) {',
				'\treturn html`<div><span>${name} ${status}</span><span>${branch} is</span><span>on ${remote}</span></div>`;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		const catalog = loadWebviewsCatalog(context);
		const workset = loadWebviewsWorkset(context);
		const blockedSources = new Set([
			'${slot1}, ${slot2}, ${slot3}',
			'${slot1} of ${slot2} ${slot3}',
			'**${slot1}** (${slot2})',
			'${slot1} ${slot2}',
			'${slot1} is',
			'on ${slot1}',
		]);

		assert.equal(
			workset.entries.some(entry => blockedSources.has(entry.source)),
			false,
		);
		assert.equal(
			catalog.occurrences.some(occurrence => blockedSources.has(occurrence.sourceText)),
			false,
		);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Ready to rebase'),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testLaunchpadGrammarHelpersAreNotExtracted(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-launchpad-grammar-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/home/components/launchpad.ts',
			[
				"import { html } from 'lit';",
				"const pluralize = (label: string, count: number): string => `${count} ${label}${count === 1 ? '' : 's'}`;",
				'export function renderLaunchpad(total: number, summary: { count: number }) {',
				'\tconst messages = [',
				"\t\t{ count: summary.count, message: `${summary.count > 1 ? 'need' : 'needs'} reviewers` },",
				"\t\t{ count: summary.count, message: `${summary.count > 1 ? 'have' : 'has'} failed CI checks` },",
				"\t\t{ count: summary.count, message: `${summary.count > 1 ? 'have' : 'has'} conflicts` },",
				'\t];',
				'\treturn html`',
				'\t\t<section>',
				"\t\t\t<span>${pluralize('pull request', total)} ${messages[0].message}</span>",
				"\t\t\t<span>${pluralize('pull request', total)} ${total > 1 ? 'are' : 'is'} blocked (${messages.map(m => `${m.count} ${m.message}`).join(', ')})</span>",
				"\t\t\t<span>${pluralize('pull request', total)} ${total > 1 ? 'require' : 'requires'} follow-up</span>",
				"\t\t\t<span>${pluralize('pull request', total)} ${total > 1 ? 'need' : 'needs'} your review</span>",
				'\t\t</section>`;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		const catalog = loadWebviewsCatalog(context);
		const workset = loadWebviewsWorkset(context);
		const grammarHelperSources = new Set(['are', 'has', 'have', 'is', 'need', 'needs', 'require', 'requires']);
		const expectedSources = new Set([
			'${slot1} reviewers',
			'${slot1} failed CI checks',
			'${slot1} conflicts',
			'${slot1} ${slot2} blocked (${slot3})',
			'${slot1} ${slot2} follow-up',
			'${slot1} ${slot2} your review',
		]);
		const blockedStructuralSources = new Set(['${slot1} ${slot2}']);

		assert.equal(
			workset.entries.some(entry => grammarHelperSources.has(entry.source)),
			false,
		);
		assert.equal(
			catalog.occurrences.some(occurrence => grammarHelperSources.has(occurrence.sourceText)),
			false,
		);
		assert.equal(
			workset.entries.some(entry => blockedStructuralSources.has(entry.source)),
			false,
		);
		assert.equal(
			catalog.occurrences.some(occurrence => blockedStructuralSources.has(occurrence.sourceText)),
			false,
		);
		for (const source of expectedSources) {
			assert.equal(
				catalog.occurrences.some(occurrence => occurrence.sourceText === source),
				true,
				`expected Launchpad source to be extracted: ${source}`,
			);
		}

		approveTranslations(context, {
			'${slot1} reviewers': '需要审查者',
			'${slot1} failed CI checks': 'CI 检查未通过',
			'${slot1} conflicts': '存在冲突',
			'${slot1} ${slot2} blocked (${slot3})': '${slot1} 已阻塞（${slot3}）',
			'${slot1} ${slot2} follow-up': '${slot1} 需要后续跟进',
			'${slot1} ${slot2} your review': '${slot1} 需要你审查',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedDynamicSources({ rootDir });

		const localizedLaunchpad = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/plus/home/components/launchpad.ts',
		);
		assert.notEqual(localizedLaunchpad, undefined);
		assert.equal(localizedLaunchpad!.includes('summary.count > 1 ? "" : ""'), false);
		assert.equal(localizedLaunchpad!.includes('total > 1 ? "" : ""'), false);
		assert.equal(localizedLaunchpad!.includes('message: `需要审查者`'), true);
		assert.equal(localizedLaunchpad!.includes('message: `CI 检查未通过`'), true);
		assert.equal(localizedLaunchpad!.includes('message: `存在冲突`'), true);
		assert.equal(localizedLaunchpad!.includes("${pluralize('pull request', total)} 需要后续跟进"), true);
		assert.equal(localizedLaunchpad!.includes("${pluralize('pull request', total)} 需要你审查"), true);
		assert.equal(
			localizedLaunchpad!.includes(
				"${pluralize('pull request', total)} 已阻塞（${messages.map(m => `${m.count} ${m.message}`).join(', ')}）",
			),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testWelcomeLocalizedSourceRewritesImportsBackToSourceTree(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-welcome-imports-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeWelcomeFixture(rootDir, {
			welcomeTs: [
				"import './welcome.scss';",
				"import { html } from 'lit';",
				"import './components/welcome-page.js';",
				'export function renderApp() {',
				'\treturn html`<div><gl-welcome-page></gl-welcome-page></div>`;',
				'}',
				'',
			].join('\n'),
			welcomePageTs: [
				"import { html } from 'lit';",
				"import { renderProgress } from './welcome-parts.js';",
				"import { sharedValue } from '../../shared/context.js';",
				'export function renderWelcome(doneCount, allCount) {',
				'\tvoid sharedValue;',
				'\treturn html`<section><h1>Welcome to GitLens</h1>${renderProgress(doneCount, allCount)}</section>`;',
				'}',
				'',
			].join('\n'),
			welcomePartsTs: [
				"import { html } from 'lit';",
				'export function renderProgress(doneCount, allCount) {',
				'\treturn html`<p>${doneCount}/${allCount} steps complete</p>`;',
				'}',
				'',
			].join('\n'),
			extraFiles: {
				'src/webviews/apps/shared/context.ts': 'export const sharedValue = true;\n',
			},
		});

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'Welcome to GitLens': '欢迎使用 GitLens',
			'${slot1}/${slot2} steps complete': '${slot1}/${slot2} 个步骤已完成',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedWelcomePage = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/welcome/components/welcome-page.ts',
		);
		assert.notEqual(localizedWelcomePage, undefined);
		assert.equal(localizedWelcomePage!.includes("import { renderProgress } from './welcome-parts.ts';"), true);
		const expectedSharedImport = path
			.relative(
				path.join(context.localizedDynamicSourceDir, 'src', 'webviews', 'apps', 'welcome', 'components'),
				path.join(rootDir, 'src', 'webviews', 'apps', 'shared', 'context.js'),
			)
			.replaceAll('\\', '/');
		assert.equal(localizedWelcomePage!.includes(`import { sharedValue } from '${expectedSharedImport}';`), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testGraphBundleGeneratesLocalizedSource(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-graph-source-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/graph/graph.ts',
			[
				"import { html } from 'lit';",
				'export function renderGraph() {',
				'\treturn html`<section><gl-graph></gl-graph></section>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/graph/graph-wrapper/gl-graph.react.tsx',
			[
				'import React from "react";',
				'export function renderGraphMenu(props: { searchMode: "filter" | "normal" }) {',
				'\treturn (',
				'\t\t<div>',
				'\t\t\t<span>No results found</span>',
				'\t\t\t<a>{props.searchMode === "filter" ? "Load more results..." : "Load more commits..."}</a>',
				'\t\t\t<gl-button tooltip="Compose Commits..." aria-label="Compose Commits...">Compose Commits...</gl-button>',
				'\t\t\t<gl-button tooltip="Generate Commit Message" aria-label="Generate Commit Message"></gl-button>',
				'\t\t</div>',
				'\t);',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'No results found': '未找到结果',
			'Load more results...': '加载更多结果...',
			'Load more commits...': '加载更多提交...',
			'Compose Commits...': '编排提交...',
			'Generate Commit Message': '生成提交消息',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedGraph = loadLocalizedDynamicSource(context, 'src/webviews/apps/plus/graph/graph.ts');
		assert.notEqual(localizedGraph, undefined);

		const localizedReactGraph = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/plus/graph/graph-wrapper/gl-graph.react.tsx',
		);
		assert.notEqual(localizedReactGraph, undefined);
		assert.equal(localizedReactGraph!.includes('未找到结果'), true);
		assert.equal(localizedReactGraph!.includes('加载更多结果...'), true);
		assert.equal(localizedReactGraph!.includes('加载更多提交...'), true);
		assert.equal(localizedReactGraph!.includes('tooltip="编排提交..."'), true);
		assert.equal(localizedReactGraph!.includes('aria-label="编排提交..."'), true);
		assert.equal(localizedReactGraph!.includes('>编排提交...</gl-button>'), true);
		assert.equal(localizedReactGraph!.includes('tooltip="生成提交消息"'), true);
		assert.equal(localizedReactGraph!.includes('aria-label="生成提交消息"'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testWelcomeWorkflowPreservesTemplateArgumentSeparators(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-welcome-separators-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeWelcomeFixture(rootDir, {
			welcomeTs: [
				"import './welcome.scss';",
				"import { html } from 'lit';",
				"import './components/welcome-page.js';",
				'export function renderApp() {',
				'\treturn html`<div><gl-welcome-page></gl-welcome-page></div>`;',
				'}',
				'',
			].join('\n'),
			welcomePageTs: [
				"import { html } from 'lit';",
				'function renderHeader(title, icon) {',
				'\treturn html`<span>${title} ${icon}</span>`;',
				'}',
				'export function renderWelcome(flag) {',
				"\treturn html`${renderHeader(`Branch ${flag ? 'Likely ' : ''}Merged`, 'git-merge')}`;",
				'}',
				'',
			].join('\n'),
			welcomePartsTs: 'export const unused = true;\n',
		});

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'Branch ${slot1}Merged': '分支${slot1}已合并',
			'Likely ': '很可能',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedWelcomePage = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/welcome/components/welcome-page.ts',
		);
		assert.notEqual(localizedWelcomePage, undefined);
		assert.equal(
			localizedWelcomePage!.includes("renderHeader(`分支${flag ? \"很可能\" : ''}已合并`, 'git-merge')"),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testWelcomeWorkflowSkipsObviousNonUiImperativeStrings(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-welcome-noise-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeWelcomeFixture(rootDir, {
			welcomeTs: [
				"import './welcome.scss';",
				"import { html } from 'lit';",
				"import './components/welcome-page.js';",
				'export function renderApp() {',
				'\treturn html`<div><gl-welcome-page></gl-welcome-page></div>`;',
				'}',
				'',
			].join('\n'),
			welcomePageTs: [
				"import { html } from 'lit';",
				'export function renderWelcome() {',
				"\tconst pulse = 'indicator--pulse';",
				"\tconst color = 'var(--gl-git-status-conflict-modified, #c4a000)';",
				'\tvoid pulse; void color;',
				'\treturn html`<section><p>Review required</p></section>`;',
				'}',
				'',
			].join('\n'),
			welcomePartsTs: 'export const unused = true;\n',
		});

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		const workset = loadWebviewsWorkset(context);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Review required'),
			true,
		);
		assert.equal(
			workset.entries.some(entry => entry.source === 'indicator--pulse'),
			false,
		);
		assert.equal(
			workset.entries.some(entry => entry.source === 'var(--gl-git-status-conflict-modified, #c4a000)'),
			false,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testCommitDetailsWorkflowLocalizesDisplayOnlyImperativeStrings(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-commit-details-logic-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/commitDetails/components/gl-inspect-nav.ts',
			[
				"import { html } from 'lit';",
				'export function renderInspectNav(stashNumber, shortSha, getAltKeySymbol) {',
				'\treturn html`<gl-tooltip><span slot="content">Copy ${stashNumber != null ? "Stash Name" : "SHA"}<br />[${getAltKeySymbol()}] Copy Message</span></gl-tooltip>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/commitDetails/components/gl-commit-details.ts',
			[
				"import { html } from 'lit';",
				'export function renderEmpty() {',
				'\treturn html`<section><p>Rich details for commits and stashes are shown as you navigate:</p><p>Alternatively, show your work-in-progress, or search for or choose a commit</p></section>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/commitDetails/components/gl-wip-details.ts',
			[
				"import { html } from 'lit';",
				'export function renderWip(ahead, behind, upstream) {',
				"\tlet label = 'Share as Cloud Patch';",
				"\tconst fetchLabel = behind > 0 ? 'Pull' : ahead > 0 ? 'Push' : 'Fetch';",
				"\tconst fetchTooltip = behind > 0 ? 'Pull from' : ahead > 0 ? 'Push to' : 'Fetch from';",
				'\treturn html`<gl-button data-action="${fetchLabel.toLowerCase()}">${fetchLabel}<span slot="tooltip">${fetchTooltip} <strong>${upstream}</strong></span></gl-button><gl-button tooltip="${label}">${label}</gl-button>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(rootDir, 'src/webviews/apps/commitDetails/commitDetails.ts', 'export const app = true;\n');

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'Copy ${slot1} [${slot2}] Copy Message': '复制 ${slot1}<br />[${slot2}] 复制消息',
			'Rich details for commits and stashes are shown as you navigate:': '导航时会显示提交和贮藏的详细信息：',
			'Alternatively, show your work-in-progress, or search for or choose a commit':
				'或者显示你的进行中工作，或搜索、选择某个提交',
			'Share as Cloud Patch': '共享为云补丁',
			Pull: '拉取',
			Push: '推送',
			Fetch: '获取',
			'Pull from': '从以下位置拉取',
			'Push to': '推送到',
			'Fetch from': '从以下位置获取',
			'Pull from ${slot1}': '从 ${slot1} 拉取',
			'Push to ${slot1}': '推送到 ${slot1}',
			'Fetch from ${slot1}': '从 ${slot1} 获取',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedInspectNav = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/commitDetails/components/gl-inspect-nav.ts',
		);
		assert.notEqual(localizedInspectNav, undefined);
		assert.match(localizedInspectNav!, /复制 \$\{stashNumber != null \? "Stash Name" : "SHA"\}<br \/>/u);
		assert.match(localizedInspectNav!, /\[\$\{getAltKeySymbol\(\)\}\] 复制消息/u);

		const localizedCommitDetails = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/commitDetails/components/gl-commit-details.ts',
		);
		assert.notEqual(localizedCommitDetails, undefined);
		assert.equal(localizedCommitDetails!.includes('导航时会显示提交和贮藏的详细信息：'), true);
		assert.equal(localizedCommitDetails!.includes('或者显示你的进行中工作，或搜索、选择某个提交'), true);

		const localizedWipDetails = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/commitDetails/components/gl-wip-details.ts',
		);
		assert.notEqual(localizedWipDetails, undefined);
		assert.equal(
			localizedWipDetails!.includes("const fetchLabel = behind > 0 ? 'Pull' : ahead > 0 ? 'Push' : 'Fetch';"),
			true,
		);
		assert.equal(
			localizedWipDetails!.includes(
				'const fetchTooltip = behind > 0 ? "从以下位置拉取" : ahead > 0 ? "推送到" : "从以下位置获取";',
			),
			true,
		);
		assert.equal(localizedWipDetails!.includes('let label = "共享为云补丁";'), true);
		assert.equal(localizedWipDetails!.includes('data-action="${fetchLabel.toLowerCase()}"'), true);
		assert.equal(localizedWipDetails!.includes('>${fetchLabel}<span slot="tooltip">${fetchTooltip}'), true);
		assert.equal(localizedWipDetails!.includes('<gl-button tooltip="${label}">${label}</gl-button>'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testSearchInputPlaceholderGetterIsLocalized(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-search-placeholder-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/home/home.ts',
			[
				"import { html } from 'lit';",
				'export function renderHome() {',
				'\treturn html`<gl-search-input></gl-search-input>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/shared/components/search/search-input.ts',
			[
				"import { html } from 'lit';",
				'export class GlSearchInput {',
				'\tfilter = false;',
				'\tnaturalLanguage = false;',
				'\tprivate get label() {',
				"\t\treturn this.filter ? 'Filter' : 'Search';",
				'\t}',
				'\tprivate get placeholder() {',
				'\t\tif (this.naturalLanguage) {',
				'\t\t\treturn `${this.label} commits using natural language (↑↓ for history), e.g. my commits from last week`;',
				'\t\t}',
				'\t\treturn `${this.label} commits (press Enter to search, ↑↓ for history), e.g. @me after:1.week.ago file:*.ts`;',
				'\t}',
				'\trender() {',
				'\t\treturn html`<input placeholder="${this.placeholder}" />`;',
				'\t}',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		const catalog = loadWebviewsCatalog(context);
		for (const source of [
			'Filter',
			'Search',
			'${slot1} commits using natural language (↑↓ for history), e.g. my commits from last week',
			'${slot1} commits (press Enter to search, ↑↓ for history), e.g. @me after:1.week.ago file:*.ts',
		]) {
			assert.equal(
				catalog.occurrences.some(occurrence => occurrence.sourceText === source),
				true,
				`expected search placeholder source to be extracted: ${source}`,
			);
		}

		approveTranslations(context, {
			Filter: '筛选',
			Search: '搜索',
			'${slot1} commits using natural language (↑↓ for history), e.g. my commits from last week':
				'${slot1}使用自然语言搜索提交（↑↓ 查看历史），例如 my commits from last week',
			'${slot1} commits (press Enter to search, ↑↓ for history), e.g. @me after:1.week.ago file:*.ts':
				'${slot1}提交（按 Enter 搜索，↑↓ 查看历史），例如 @me after:1.week.ago file:*.ts',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedDynamicSources({ rootDir });

		const localizedSearchInput = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/shared/components/search/search-input.ts',
		);
		assert.notEqual(localizedSearchInput, undefined);
		assert.equal(localizedSearchInput!.includes('return this.filter ? "筛选" : "搜索";'), true);
		assert.equal(
			localizedSearchInput!.includes(
				'`${this.label}使用自然语言搜索提交（↑↓ 查看历史），例如 my commits from last week`',
			),
			true,
		);
		assert.equal(
			localizedSearchInput!.includes(
				'`${this.label}提交（按 Enter 搜索，↑↓ 查看历史），例如 @me after:1.week.ago file:*.ts`',
			),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testReturnedDisplayTemplateSlotsLocalizeVariableInitializers(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-returned-label-slots-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/shared/components/rich/pr-icon.ts',
			[
				"import { html } from 'lit';",
				'export class PrIcon {',
				'\tdraft = false;',
				'\tstate?: string;',
				'\tprId?: string;',
				'\tget label(): string {',
				"\t\tconst type = this.draft ? 'Draft pull request' : 'Pull request';",
				'\t\tif (!this.state) return type;',
				"\t\treturn `${type} ${this.prId ? `#${this.prId}` : ''} is ${this.state}`;",
				'\t}',
				'\trender() {',
				'\t\treturn html`<span>${this.label}</span>`;',
				'\t}',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		const catalog = loadWebviewsCatalog(context);
		for (const source of ['Draft pull request', 'Pull request']) {
			assert.equal(
				catalog.occurrences.some(occurrence => occurrence.sourceText === source),
				true,
				`expected returned label source to be extracted: ${source}`,
			);
		}
		assert.equal(
			catalog.occurrences.some(occurrence => occurrence.sourceText === '${slot1} ${slot2} is ${slot3}'),
			false,
		);

		approveTranslations(context, {
			'Draft pull request': '草稿拉取请求',
			'Pull request': '拉取请求',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedDynamicSources({ rootDir });

		const localizedPrIcon = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/shared/components/rich/pr-icon.ts',
		);
		assert.notEqual(localizedPrIcon, undefined);
		assert.equal(localizedPrIcon!.includes('const type = this.draft ? "草稿拉取请求" : "拉取请求";'), true);
		assert.equal(
			localizedPrIcon!.includes("return `${type} ${this.prId ? `#${this.prId}` : ''} is ${this.state}`;"),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testGraphBranchVisibilityOptionsAreLocalized(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-graph-branch-visibility-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/graph/graph-header.ts',
			[
				"import { html } from 'lit';",
				'export function renderBranchVisibility(repo, branchesVisibility) {',
				'\treturn html`<gl-tooltip placement="top" content="Branches Visibility">',
				'\t\t<sl-select value=${branchesVisibility} hoist>',
				'\t\t\t<code-icon icon="chevron-down" slot="expand-icon"></code-icon>',
				'\t\t\t<sl-option value="all" ?disabled=${repo?.virtual}> All Branches </sl-option>',
				'\t\t\t<sl-option value="current">Current Branch</sl-option>',
				'\t\t\t<menu-divider></menu-divider>',
				'\t\t\t<sl-option value="smart" ?disabled=${repo?.virtual}>',
				'\t\t\t\tSmart Branches',
				'\t\t\t\t${html`<gl-tooltip placement="right" slot="suffix">',
				'\t\t\t\t\t<code-icon icon="info"></code-icon>',
				'\t\t\t\t\t<span slot="content">',
				'\t\t\t\t\t\tShows only relevant branches',
				'\t\t\t\t\t\t<br />',
				'\t\t\t\t\t\t<br />',
				'\t\t\t\t\t\t<i>Includes the current branch, its upstream, and its base or target branch</i>',
				'\t\t\t\t\t</span>',
				'\t\t\t\t</gl-tooltip>`}',
				'\t\t\t</sl-option>',
				'\t\t\t<sl-option value="favorited" ?disabled=${repo?.virtual}>',
				'\t\t\t\tFavorited Branches',
				'\t\t\t\t<gl-tooltip placement="right" slot="suffix">',
				'\t\t\t\t\t<code-icon icon="info"></code-icon>',
				'\t\t\t\t\t<span slot="content">',
				'\t\t\t\t\t\tShows only branches that have been starred as favorites',
				'\t\t\t\t\t\t<br />',
				'\t\t\t\t\t\t<br />',
				'\t\t\t\t\t\t<i>Also includes the current branch</i>',
				'\t\t\t\t\t</span>',
				'\t\t\t\t</gl-tooltip>',
				'\t\t\t</sl-option>',
				'\t\t</sl-select>',
				'\t</gl-tooltip>`;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		const catalog = loadWebviewsCatalog(context);
		for (const source of [
			'Branches Visibility',
			'All Branches',
			'Current Branch',
			'Smart Branches ${slot1}',
			'Favorited Branches',
			'Shows only relevant branches ${slot1}',
			'Includes the current branch, its upstream, and its base or target branch',
			'Shows only branches that have been starred as favorites ${slot1}',
			'Also includes the current branch',
		]) {
			assert.equal(
				catalog.occurrences.some(occurrence => occurrence.sourceText === source),
				true,
				`expected graph branch visibility source to be extracted: ${source}`,
			);
		}

		approveTranslations(context, {
			'Branches Visibility': '分支可见性',
			'All Branches': '所有分支',
			'Current Branch': '当前分支',
			'Smart Branches ${slot1}': '智能分支 ${slot1}',
			'Favorited Branches': '收藏的分支',
			'Shows only relevant branches ${slot1}': '仅显示相关分支 ${slot1}',
			'Includes the current branch, its upstream, and its base or target branch':
				'包括当前分支、其上游以及其基础分支或目标分支',
			'Shows only branches that have been starred as favorites ${slot1}': '仅显示已加星标为收藏的分支 ${slot1}',
			'Also includes the current branch': '也包括当前分支',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedDynamicSources({ rootDir });

		const localizedGraphHeader = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/plus/graph/graph-header.ts',
		);
		assert.notEqual(localizedGraphHeader, undefined);
		assert.match(localizedGraphHeader!, /<gl-tooltip placement="top" content="分支可见性">/u);
		assert.match(
			localizedGraphHeader!,
			/<sl-option value="all" \?disabled=\$\{repo\?\.virtual\}>\s*所有分支\s*<\/sl-option>/u,
		);
		assert.match(localizedGraphHeader!, /<sl-option value="current">当前分支<\/sl-option>/u);
		assert.match(localizedGraphHeader!, /智能分支\s*\$\{[\s\S]*?<gl-tooltip placement="right" slot="suffix">/u);
		assert.match(localizedGraphHeader!, /收藏的分支\s*<gl-tooltip placement="right" slot="suffix">/u);
		assert.match(
			localizedGraphHeader!,
			/<span slot="content">仅显示相关分支 <br \/><br \/><i>包括当前分支、其上游以及其基础分支或目标分支<\/i><\/span>/u,
		);
		assert.match(
			localizedGraphHeader!,
			/<span slot="content">仅显示已加星标为收藏的分支 <br \/><br \/><i>也包括当前分支<\/i><\/span>/u,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testDeferredRuntimeBoundariesAreReported(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-deferred-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/graph/graph-wrapper/gl-graph.react.tsx',
			[
				'import React from "react";',
				'export function GraphMenu() {',
				'\treturn <button aria-label="Compose Commits...">Compose Commits...</button>;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/patchDetails/components/gl-patch-create.ts',
			[
				"import { html } from 'lit';",
				'export function renderPatchCreate() {',
				'\treturn html`<section><input placeholder="Title (required)" /><p>Share Patch</p></section>`;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		const catalog = loadWebviewsCatalog(context);
		const reconciliation = loadWebviewsReconciliationReport(context);
		const reasons = reconciliation.entries
			.map(entry => entry.reason)
			.filter((reason): reason is string => reason != null);
		assert.equal(
			reasons.some(reason =>
				reason.includes('deferred patchDetails: follow-up page family deferred from current rollout'),
			),
			true,
		);
		assert.equal(
			catalog.occurrences.some(occurrence => occurrence.scope.startsWith('webviews.graph.')),
			true,
		);
		assert.equal(
			catalog.occurrences.some(occurrence => occurrence.scope.startsWith('webviews.patchDetails.')),
			false,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testLocalizedSettingsShellPreservesRuntimeAnchors(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-settings-anchors-'));
	try {
		writeTextFile(
			rootDir,
			'dist/webviews/settings.html',
			[
				'<!doctype html>',
				'<html lang="en">',
				'<body>',
				'\t<a id="version" title="Open CHANGELOG"></a>',
				'\t<select id="scopes" name="scope"></select>',
				'\t<div id="token-popup" data-component="autolink-integration"></div>',
				'\t<section data-component="autolinks">Autolinks</section>',
				'</body>',
				'</html>',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			Autolinks: '自动链接',
			'Open CHANGELOG': '打开 CHANGELOG',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedSettingsShell({ rootDir });

		const localizedHtml = loadLocalizedSettingsShell(context);
		assert.notEqual(localizedHtml, undefined);
		for (const marker of [
			'id="version"',
			'id="scopes"',
			'id="token-popup"',
			'data-component="autolink-integration"',
			'data-component="autolinks"',
		]) {
			assert.equal(
				localizedHtml!.includes(marker),
				true,
				`localized settings shell must preserve runtime marker ${marker}`,
			);
		}
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testGeneratorPreservesStructuralNodes(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-structure-'));
	try {
		fs.mkdirSync(path.join(rootDir, 'dist', 'webviews'), { recursive: true });
		fs.writeFileSync(
			path.join(rootDir, 'dist', 'webviews', 'settings.html'),
			[
				'<!doctype html>',
				'<html lang="en">',
				'<body>',
				'\t<header>',
				'\t\t<h1><gitlens-logo></gitlens-logo> <small>Git Supercharged</small></h1>',
				'\t\t<p><span>Version <a id="version" title="Open CHANGELOG" aria-label="Open CHANGELOG"></a></span><a title="Open Release Notes" href="https://example.com/releases">Release notes</a></p>',
				'\t</header>',
				'</body>',
				'</html>',
				'',
			].join('\n'),
			'utf8',
		);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		const workset = loadWebviewsWorkset(context);
		saveWebviewsWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.source === 'Git Supercharged'
					? { ...entry, status: 'approved', translation: 'Git 全面增强' }
					: entry.source === 'Open CHANGELOG'
						? { ...entry, status: 'approved', translation: '打开 CHANGELOG' }
						: entry.source === 'Open Release Notes'
							? { ...entry, status: 'approved', translation: '打开发布说明' }
							: entry.source === 'Release notes'
								? { ...entry, status: 'approved', translation: '发布说明' }
								: entry.source === 'Version'
									? { ...entry, status: 'approved', translation: '版本' }
									: entry,
			),
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedHtml = loadLocalizedSettingsShell(context);
		assert.notEqual(localizedHtml, undefined);
		assert.equal(localizedHtml!.includes('<gitlens-logo></gitlens-logo>'), true);
		assert.equal(localizedHtml!.includes('id="version"'), true);
		assert.equal(localizedHtml!.includes('title="打开 CHANGELOG"'), true);
		assert.equal(localizedHtml!.includes('aria-label="打开 CHANGELOG"'), true);
		assert.equal(localizedHtml!.includes('发布说明'), true);
		assert.equal(localizedHtml!.includes('版本'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testLocalizedSourcePreservesNamedSlotSubtrees(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-slot-structure-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/home/home.ts',
			[
				"import { html } from 'lit';",
				'export function renderHome(repoName) {',
				'\treturn html`',
				'\t\t<section>',
				'\t\t\t<gl-repo-button-group>',
				'\t\t\t\t<span slot="tooltip">Switch to Another Repository...<hr />${repoName}</span>',
				'\t\t\t</gl-repo-button-group>',
				'\t\t\t<gl-button>',
				'\t\t\t\tCompose Commits...',
				'\t\t\t\t<span slot="tooltip"><strong>Compose Commits</strong> (Preview)<br /><i>Automatically or interactively organize changes into meaningful commits</i></span>',
				'\t\t\t</gl-button>',
				'\t\t</section>`;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'Switch to Another Repository... ${slot1}': '切换到另一个仓库... ${slot1}',
			'Compose Commits...': '编排提交...',
			'Compose Commits': '编排提交',
			'${slot1} (Preview) ${slot2}': '${slot1}（预览）${slot2}',
			'Automatically or interactively organize changes into meaningful commits':
				'自动或以交互方式将更改整理为有意义的提交',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedHome = loadLocalizedDynamicSource(context, 'src/webviews/apps/home/home.ts');
		assert.notEqual(localizedHome, undefined);
		assert.match(
			localizedHome!,
			/<span slot="tooltip">\s*切换到另一个仓库\.\.\.\s*<hr \/>\s*\$\{repoName\}\s*<\/span>/u,
		);
		assert.match(localizedHome!, /编排提交\.\.\.\s*<span slot="tooltip">/u);
		assert.match(
			localizedHome!,
			/<span slot="tooltip">\s*<strong>编排提交<\/strong>（预览）<br \/>\s*<i>自动或以交互方式将更改整理为有意义的提交<\/i>\s*<\/span>/u,
		);
		assert.equal(localizedHome!.includes('>编排提交...<strong>编排提交</strong>'), false);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testLocalizedSourcePreservesWalkthroughAnchorStructure(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-walkthrough-anchor-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/home/home.ts',
			[
				"import { html } from 'lit';",
				'export function renderHome(progress) {',
				'\treturn html`',
				'\t\t<gl-tooltip placement="bottom">',
				'\t\t\t<a class="walkthrough-progress" href="command:gitlens.showWelcomeView">',
				'\t\t\t\t<header class="walkthrough-progress__title">',
				'\t\t\t\t\t<span>GitLens Walkthrough (${progress.doneCount}/${progress.allCount})</span>',
				'\t\t\t\t</header>',
				'\t\t\t\t<progress class="walkthrough-progress__bar" value=${progress.progress}></progress>',
				'\t\t\t</a>',
				'\t\t\t<div slot="content">',
				'\t\t\t\t<div>Open Walkthrough</div>',
				'\t\t\t\t<hr />',
				'\t\t\t\t<p>Walkthrough Progress (${progress.doneCount}/${progress.allCount})</p>',
				'\t\t\t</div>',
				'\t\t</gl-tooltip>`;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'GitLens Walkthrough (${slot1}/${slot2})': 'GitLens 演练 (${slot1}/${slot2})',
			'Open Walkthrough': '打开演练',
			'Walkthrough Progress (${slot1}/${slot2})': '演练进度 (${slot1}/${slot2})',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedHome = loadLocalizedDynamicSource(context, 'src/webviews/apps/home/home.ts');
		assert.notEqual(localizedHome, undefined);
		assert.match(
			localizedHome!,
			/<a class="walkthrough-progress" href="command:gitlens\.showWelcomeView">\s*<header class="walkthrough-progress__title">\s*<span>GitLens 演练 \(\$\{progress\.doneCount\}\/\$\{progress\.allCount\}\)<\/span>\s*<\/header>\s*<progress class="walkthrough-progress__bar" value=\$\{progress\.progress\}><\/progress>\s*<\/a>/u,
		);
		assert.equal(
			localizedHome!.includes(
				'<a class="walkthrough-progress" href="command:gitlens.showWelcomeView">GitLens 演练 (${progress.doneCount}/${progress.allCount})</a>',
			),
			false,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testGraphLocalizedSourcePreservesPopoverMenuStructure(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-graph-popover-structure-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/graph/graph-header.ts',
			[
				"import { html } from 'lit';",
				'export function renderGraphHeader(config, excludeRefs) {',
				'\treturn html`',
				'\t\t<gl-popover>',
				'\t\t\t<gl-tooltip slot="anchor"><span slot="content">Minimap Options</span></gl-tooltip>',
				'\t\t\t<div slot="content">',
				'\t\t\t\t<menu-label>Minimap</menu-label>',
				'\t\t\t\t<menu-item role="none">',
				"\t\t\t\t\t<gl-radio-group value=${config?.minimapDataType ?? 'commits'}>",
				'\t\t\t\t\t\t<gl-radio name="minimap-datatype" value="commits"> Commits </gl-radio>',
				'\t\t\t\t\t\t<gl-radio name="minimap-datatype" value="lines"> Lines Changed </gl-radio>',
				'\t\t\t\t\t</gl-radio-group>',
				'\t\t\t\t</menu-item>',
				'\t\t\t\t<menu-divider></menu-divider>',
				'\t\t\t\t<menu-label>Markers</menu-label>',
				'\t\t\t\t<menu-item role="none">',
				'\t\t\t\t\t<gl-checkbox value="localBranches" ?checked=${true}>',
				'\t\t\t\t\t\t<span class="minimap-marker-swatch" data-marker="localBranches"></span>',
				'\t\t\t\t\t\tLocal Branches',
				'\t\t\t\t\t</gl-checkbox>',
				'\t\t\t\t</menu-item>',
				'\t\t\t\t<menu-item role="none">',
				'\t\t\t\t\t<gl-checkbox value="remoteBranches" ?checked=${true}>',
				'\t\t\t\t\t\t<span class="minimap-marker-swatch" data-marker="remoteBranches"></span>',
				'\t\t\t\t\t\tRemote Branches',
				'\t\t\t\t\t</gl-checkbox>',
				'\t\t\t\t</menu-item>',
				'\t\t\t</div>',
				'\t\t</gl-popover>',
				'\t\t<gl-popover>',
				'\t\t\t<gl-tooltip slot="anchor"><span slot="content">Hidden Branches / Tags</span></gl-tooltip>',
				'\t\t\t<div slot="content">',
				'\t\t\t\t<menu-label>Hidden Branches / Tags</menu-label>',
				'\t\t\t\t${excludeRefs?.map(ref => html`<menu-item><span>${ref.name}</span></menu-item>`)}',
				'\t\t\t\t<menu-item>Show All</menu-item>',
				'\t\t\t</div>',
				'\t\t</gl-popover>`;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });
		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'Minimap Options': '迷你地图选项',
			Minimap: '迷你地图',
			Commits: '提交数',
			'Lines Changed': '更改行数',
			Markers: '标记',
			'Local Branches': '本地分支',
			'Remote Branches': '远程分支',
			'Hidden Branches / Tags': '隐藏的分支 / 标签',
			'Show All': '全部显示',
		});
		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedGraphHeader = loadLocalizedDynamicSource(
			context,
			'src/webviews/apps/plus/graph/graph-header.ts',
		);
		assert.notEqual(localizedGraphHeader, undefined);
		assert.match(localizedGraphHeader!, /<menu-label>迷你地图<\/menu-label>/u);
		assert.match(
			localizedGraphHeader!,
			/<gl-radio name="minimap-datatype" value="commits">\s*提交数\s*<\/gl-radio>/u,
		);
		assert.match(
			localizedGraphHeader!,
			/<gl-radio name="minimap-datatype" value="lines">\s*更改行数\s*<\/gl-radio>/u,
		);
		assert.match(localizedGraphHeader!, /<menu-label>标记<\/menu-label>/u);
		assert.match(
			localizedGraphHeader!,
			/<gl-checkbox value="localBranches" \?checked=\$\{true\}>\s*<span class="minimap-marker-swatch" data-marker="localBranches"><\/span>\s*本地分支\s*<\/gl-checkbox>/u,
		);
		assert.match(
			localizedGraphHeader!,
			/<gl-checkbox value="remoteBranches" \?checked=\$\{true\}>\s*<span class="minimap-marker-swatch" data-marker="remoteBranches"><\/span>\s*远程分支\s*<\/gl-checkbox>/u,
		);
		assert.match(localizedGraphHeader!, /<menu-label>隐藏的分支 \/ 标签<\/menu-label>/u);
		assert.match(localizedGraphHeader!, /<menu-item>全部显示<\/menu-item>/u);
		assert.equal(
			localizedGraphHeader!.includes('<div slot="content">迷你地图 提交数 更改行数 标记 本地分支 远程分支</div>'),
			false,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function writeDefaultSettingsShell(rootDir: string): void {
	writeTextFile(
		rootDir,
		'dist/webviews/settings.html',
		['<!doctype html>', '<html lang="en">', '<body></body>', '</html>', ''].join('\n'),
	);
}

function writeWelcomeFixture(
	rootDir: string,
	fixture: {
		readonly welcomeTs: string;
		readonly welcomePageTs: string;
		readonly welcomePartsTs: string;
		readonly extraFiles?: Record<string, string>;
	},
): void {
	writeTextFile(rootDir, 'src/webviews/apps/welcome/welcome.ts', fixture.welcomeTs);
	writeTextFile(rootDir, 'src/webviews/apps/welcome/components/welcome-page.ts', fixture.welcomePageTs);
	writeTextFile(rootDir, 'src/webviews/apps/welcome/components/welcome-parts.ts', fixture.welcomePartsTs);

	for (const [relativePath, contents] of Object.entries(fixture.extraFiles ?? {})) {
		writeTextFile(rootDir, relativePath, contents);
	}
}

function writeTextFile(rootDir: string, relativePath: string, contents: string): void {
	const filePath = path.join(rootDir, ...relativePath.split('/'));
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, contents, 'utf8');
}

function approveTranslations(
	context: ReturnType<typeof createWebviewsDomainContext>,
	translations: Record<string, string>,
): void {
	const workset = loadWebviewsWorkset(context);
	saveWebviewsWorkset(context, {
		...workset,
		entries: workset.entries.map(entry => {
			const translation = translations[entry.source];
			return translation == null ? entry : { ...entry, status: 'approved', translation: translation };
		}),
	});
}

function sleep(milliseconds: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
