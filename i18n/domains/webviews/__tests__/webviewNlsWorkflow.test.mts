import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createWebviewsDomainContext } from '../context.mts';
import {
	loadWebviewsCatalog,
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

run();

function run(): void {
	testSettingsWorkflow();
	testWelcomeLocalizedSourceWorkflow();
	testDynamicSourceGenerationDoesNotRequireBuiltSettingsShell();
	testSupportedDynamicBundlesGenerateLocalizedSources();
	testWelcomeLocalizedSourceRewritesImportsBackToSourceTree();
	testGraphBundleGeneratesLocalizedSource();
	testWelcomeWorkflowPreservesTemplateArgumentSeparators();
	testWelcomeWorkflowSkipsObviousNonUiImperativeStrings();
	testCommitDetailsWorkflowLocalizesDisplayOnlyImperativeStrings();
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
		const reasons = catalog.reconciliation.entries
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
