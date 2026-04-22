import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createWebviewsDomainContext } from '../context.mts';
import {
	loadLocalizedSettingsShell,
	loadLocalizedRuntimeBundle,
	loadWebviewsCatalog,
	loadWebviewsWorkset,
	saveWebviewsWorkset,
} from '../store.mts';
import { createPendingReport, generateWebviewsLocalizedOutputs, promoteWebviewsAuthority, syncWebviewsI18n } from '../workflow.mts';

run();

function run(): void {
	testSettingsWorkflow();
	testWelcomeRuntimeBundleWorkflow();
	testAdditionalRuntimeBundleWorkflow();
	testRuntimeWorkflowCapturesStandaloneSpanCopy();
	testRuntimeWorkflowCapturesStandaloneStrongCopy();
	testRuntimeWorkflowCapturesRootFragmentCopy();
	testRuntimeWorkflowCapturesDirectTextDivCopy();
	testRuntimeWorkflowCapturesStandaloneInflectionWords();
	testRuntimeWorkflowCapturesImperativeDisplayHelpers();
	testRuntimeWorkflowSkipsObviousNonUiImperativeStrings();
	testRuntimeWorkflowPreservesTemplateArgumentSeparators();
	testRuntimeWorkflowSkipsWrapperOnlyContainers();
	testDeferredRuntimeBoundariesAreReported();
	testGeneratorPreservesStructuralNodes();
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
		assert.equal(workset.entries.some(entry => entry.source.includes('${author}')), false);

		const settingsEntry = workset.entries.find(entry => entry.source === 'Settings');
		assert.notEqual(settingsEntry, undefined);
		const linkedHintEntry = workset.entries.find(entry => entry.source === 'Adds a ${slot1}, hidden by default');
		assert.notEqual(linkedHintEntry, undefined);

		saveWebviewsWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.source === 'Settings'
					? {
							...entry,
							status: 'approved',
							translation: '设置',
					  }
					: entry.source === 'Line History view'
						? {
								...entry,
								status: 'approved',
								translation: '行历史视图',
						  }
						: entry.source === 'Open Settings'
							? {
									...entry,
									status: 'approved',
									translation: '打开设置',
							  }
							: entry.source === 'Show View in Side Bar'
								? {
										...entry,
										status: 'approved',
										translation: '在侧边栏中显示视图',
								  }
								: entry.source === 'Adds a ${slot1}, hidden by default'
									? {
											...entry,
											status: 'approved',
											translation: '添加${slot1}（默认隐藏）',
									  }
									: entry.source === 'Example: ${slot1}'
										? {
												...entry,
												status: 'approved',
												translation: '示例：${slot1}',
										  }
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

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'settings');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('设置'), true);
		assert.equal(localizedBundle!.includes('添加${slot1}（默认隐藏）'), true);

		const report = createPendingReport({ rootDir });
		assert.equal(report.domain, 'webviews');
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testWelcomeRuntimeBundleWorkflow(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'dist/webviews/welcome.js',
			[
				"import { html } from 'lit';",
				'',
				'export const steps = [{ title: "Welcome to GitLens" }];',
				'',
				'export function renderWelcome(doneCount, allCount) {',
				'\treturn html`<section><h1>Welcome to GitLens</h1><p>${doneCount}/${allCount} steps complete</p><ul><li>View previous file revisions</li></ul></section>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/welcome/components/welcome-page.ts',
			[
				"import { html } from 'lit';",
				'',
				'const steps = [{ title: "Welcome to GitLens" }];',
				'',
				'export function renderWelcome(doneCount, allCount) {',
				'\tvoid steps;',
				"\treturn html`<section><h1>Welcome to GitLens</h1><p>${doneCount}/${allCount} steps complete</p><ul><li>View previous file revisions</li></ul></section>`;",
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(rootDir, 'src/webviews/apps/welcome/components/welcome-parts.ts', "export const unused = true;\n");

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'Welcome to GitLens': '欢迎使用 GitLens',
			'${slot1}/${slot2} steps complete': '${slot1}/${slot2} 个步骤已完成',
			'View previous file revisions': '查看文件的上一版修订',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'welcome');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('欢迎使用 GitLens'), true);
		assert.equal(localizedBundle!.includes('${slot1}/${slot2} 个步骤已完成'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testAdditionalRuntimeBundleWorkflow(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-bundles-'));
	try {
		writeDefaultSettingsShell(rootDir);

		writeRuntimeBundleFixture(
			rootDir,
			'rebase',
			'src/webviews/apps/rebase/rebase.ts',
			'No commits to rebase',
		);
		writeRuntimeBundleFixture(
			rootDir,
			'home',
			'src/webviews/apps/home/home.ts',
			'You are all caught up!',
		);
		writeRuntimeBundleFixture(
			rootDir,
			'commitDetails',
			'src/webviews/apps/commitDetails/commitDetails.ts',
			'Inspect Commit',
		);
		writeRuntimeBundleFixture(
			rootDir,
			'timeline',
			'src/webviews/apps/plus/timeline/timeline.ts',
			'No commits found for the specified time period',
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

		for (const [bundle, translation] of [
			['rebase', '没有可变基的提交'],
			['home', '你已全部处理完成！'],
			['commitDetails', '检查提交'],
			['timeline', '在指定时间段内未找到提交'],
		] as const) {
			const localizedBundle = loadLocalizedRuntimeBundle(context, bundle);
			assert.notEqual(localizedBundle, undefined, `${bundle} runtime bundle should be generated`);
			assert.equal(localizedBundle!.includes(translation), true, `${bundle} runtime bundle should be localized`);
		}
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testRuntimeWorkflowCapturesStandaloneSpanCopy(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-span-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'dist/webviews/home.js',
			[
				"import { html } from 'lit';",
				'',
				'export function renderBundle() {',
				'\treturn html`<gl-section><span slot="heading">Launchpad</span><gl-repo-button-group><span slot="tooltip">Switch to Another Repository...</span></gl-repo-button-group><span>None</span></gl-section>`;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/home/home.ts',
			[
				"import { html } from 'lit';",
				'',
				'export function renderBundle() {',
				'\treturn html`<gl-section><span slot="heading">Launchpad</span><gl-repo-button-group><span slot="tooltip">Switch to Another Repository...</span></gl-repo-button-group><span>None</span></gl-section>`;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		const workset = loadWebviewsWorkset(context);
		assert.equal(workset.entries.some(entry => entry.source === 'Launchpad'), true);
		assert.equal(workset.entries.some(entry => entry.source === 'Switch to Another Repository...'), true);
		assert.equal(workset.entries.some(entry => entry.source === 'None'), true);

		approveTranslations(context, {
			Launchpad: 'Launchpad',
			'Switch to Another Repository...': '切换到另一个仓库...',
			None: '无',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'home');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('切换到另一个仓库...'), true);
		assert.equal(localizedBundle!.includes('"text": "无"'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testRuntimeWorkflowCapturesStandaloneStrongCopy(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-strong-'));
	try {
		writeDefaultSettingsShell(rootDir);
		const source = [
			"import { html } from 'lit';",
			'',
			'export function renderBundle() {',
			'\treturn html`<section><p><strong>GitLens is better with integrations!</strong></p></section>`;',
			'}',
			'',
		].join('\n');

		writeTextFile(rootDir, 'dist/webviews/home.js', source);
		writeTextFile(rootDir, 'src/webviews/apps/home/home.ts', source);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		const workset = loadWebviewsWorkset(context);
		assert.equal(workset.entries.some(entry => entry.source === 'GitLens is better with integrations!'), true);

		approveTranslations(context, {
			'GitLens is better with integrations!': '接入集成后，GitLens 更强大！',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'home');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('接入集成后，GitLens 更强大！'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testRuntimeWorkflowCapturesRootFragmentCopy(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-root-fragment-'));
	try {
		writeDefaultSettingsShell(rootDir);
		const source = [
			"import { html } from 'lit';",
			'',
			'export function renderBundle(upstream) {',
			'\treturn html`<gl-button><span slot="tooltip">Pull${upstream?.name ? html` from <strong>${upstream.name}</strong>` : ""}</span></gl-button>`;',
			'}',
			'',
		].join('\n');

		writeTextFile(rootDir, 'dist/webviews/home.js', source);
		writeTextFile(rootDir, 'src/webviews/apps/home/home.ts', source);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		const workset = loadWebviewsWorkset(context);
		assert.equal(workset.entries.some(entry => entry.source === 'Pull ${slot1}'), true);
		assert.equal(workset.entries.some(entry => entry.source === 'from ${slot1}'), true);

		approveTranslations(context, {
			'Pull ${slot1}': '拉取${slot1}',
			'from ${slot1}': '自${slot1}',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'home');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('"text": "拉取${slot1}"'), true);
		assert.equal(localizedBundle!.includes('"text": "自${slot1}"'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testRuntimeWorkflowCapturesDirectTextDivCopy(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-div-copy-'));
	try {
		writeDefaultSettingsShell(rootDir);
		const source = [
			"import { html } from 'lit';",
			'',
			'export function renderBundle(doneCount, allCount) {',
			'\treturn html`<gl-tooltip><div slot="content"><div>Open Walkthrough</div><p>Walkthrough Progress (${doneCount}/${allCount})</p></div></gl-tooltip>`;',
			'}',
			'',
		].join('\n');

		writeTextFile(rootDir, 'dist/webviews/home.js', source);
		writeTextFile(rootDir, 'src/webviews/apps/home/home.ts', source);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		const workset = loadWebviewsWorkset(context);
		assert.equal(workset.entries.some(entry => entry.source === 'Open Walkthrough'), true);
		assert.equal(workset.entries.some(entry => entry.source === 'Walkthrough Progress (${slot1}/${slot2})'), true);

		approveTranslations(context, {
			'Open Walkthrough': '打开演练',
			'Walkthrough Progress (${slot1}/${slot2})': '演练进度 (${slot1}/${slot2})',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'home');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('打开演练'), true);
		assert.equal(localizedBundle!.includes('演练进度 (${slot1}/${slot2})'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testRuntimeWorkflowCapturesStandaloneInflectionWords(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-inflection-'));
	try {
		writeDefaultSettingsShell(rootDir);
		const source = [
			"import { html } from 'lit';",
			'',
			'export function renderBundle(flag) {',
			"\tconst message = `${flag ? 'need' : 'needs'} reviewers`;",
			'\treturn html`<span>${message}</span>`;',
			'}',
			'',
		].join('\n');

		writeTextFile(rootDir, 'dist/webviews/home.js', source);
		writeTextFile(rootDir, 'src/webviews/apps/home/home.ts', source);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		const workset = loadWebviewsWorkset(context);
		assert.equal(workset.entries.some(entry => entry.source === 'need'), true);
		assert.equal(workset.entries.some(entry => entry.source === 'needs'), true);
		assert.equal(workset.entries.some(entry => entry.source === '${slot1} reviewers'), true);

		approveTranslations(context, {
			need: '',
			needs: '',
			'${slot1} reviewers': '${slot1}需要审查者',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'home');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('"source": "need"'), true);
		assert.equal(localizedBundle!.includes('"text": ""'), true);
		assert.equal(localizedBundle!.includes('"text": "${slot1}需要审查者"'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testRuntimeWorkflowCapturesImperativeDisplayHelpers(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-imperative-helpers-'));
	try {
		writeDefaultSettingsShell(rootDir);
		const source = [
			"import { html } from 'lit';",
			'',
			'function getWipTooltipParts(count) {',
			'\tconst parts = [];',
			'\tif (count) {',
			"\t\tparts.push(`${count} added`);",
			'\t}',
			'\treturn parts;',
			'}',
			'',
			'export function renderBundle(ts) {',
			'\tlet effectiveLabel;',
			"\tif (ts > 1) { effectiveLabel = 'Modified'; }",
			"\telse { effectiveLabel = 'Committed'; }",
			"\tconst dateFormat = 'MMMM Do, YYYY h:mma';",
			"\tconst fmtLine = (label, value) => html`<span>${label} ${value}</span>`;",
			"\treturn html`<section><time>${effectiveLabel} ${ts}</time><div>${fmtLine('Accessed', ts)}</div><p>${getWipTooltipParts(1).join(', ')}</p></section>`;",
			'}',
			'',
		].join('\n');

		writeTextFile(rootDir, 'dist/webviews/home.js', source);
		writeTextFile(rootDir, 'src/webviews/apps/home/home.ts', source);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		const workset = loadWebviewsWorkset(context);
		assert.equal(workset.entries.some(entry => entry.source === 'Modified'), true);
		assert.equal(workset.entries.some(entry => entry.source === 'Committed'), true);
		assert.equal(workset.entries.some(entry => entry.source === 'Accessed'), true);
		assert.equal(workset.entries.some(entry => entry.source === '${slot1} added'), true);

		approveTranslations(context, {
			Modified: '已修改',
			Committed: '已提交',
			Accessed: '已访问',
			'${slot1} added': '已新增 ${slot1}',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'home');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('"source": "Modified"'), true);
		assert.equal(localizedBundle!.includes('"text": "已修改"'), true);
		assert.equal(localizedBundle!.includes('"source": "${slot1} added"'), true);
		assert.equal(localizedBundle!.includes('"text": "已新增 ${slot1}"'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testRuntimeWorkflowSkipsObviousNonUiImperativeStrings(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-noise-'));
	try {
		writeDefaultSettingsShell(rootDir);
		const source = [
			"import { html } from 'lit';",
			'',
			'export function renderBundle() {',
			"\tconst pulse = 'indicator--pulse';",
			"\tconst color = 'var(--gl-git-status-conflict-modified, #c4a000)';",
			'\tconst markup = \'class="scrollable" tabindex="0" role="tree" aria-label="Branches"\';',
			"\tconst log = '[REBASE] select render';",
			"\tconst error = '@signal can only be used on accessors or getters';",
			'\tvoid pulse; void color; void markup; void log; void error;',
			"\treturn html`<section><p>Review required</p></section>`;",
			'}',
			'',
		].join('\n');

		writeTextFile(rootDir, 'dist/webviews/home.js', source);
		writeTextFile(rootDir, 'src/webviews/apps/home/home.ts', source);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		const workset = loadWebviewsWorkset(context);
		assert.equal(workset.entries.some(entry => entry.source === 'Review required'), true);
		assert.equal(workset.entries.some(entry => entry.source === 'indicator--pulse'), false);
		assert.equal(workset.entries.some(entry => entry.source === 'var(--gl-git-status-conflict-modified, #c4a000)'), false);
		assert.equal(
			workset.entries.some(
				entry =>
					entry.source === 'class="scrollable" tabindex="0" role="tree" aria-label="Branches"',
			),
			false,
		);
		assert.equal(workset.entries.some(entry => entry.source === '[REBASE] select render'), false);
		assert.equal(workset.entries.some(entry => entry.source === '@signal can only be used on accessors or getters'), false);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testRuntimeWorkflowPreservesTemplateArgumentSeparators(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-arg-separators-'));
	try {
		writeDefaultSettingsShell(rootDir);
		const source = [
			"import { html } from 'lit';",
			'',
			'function renderHeader(title, icon) {',
			'\treturn html`<span>${title} ${icon}</span>`;',
			'}',
			'',
			'export function renderBundle(flag) {',
			"\treturn html`${renderHeader(`Branch ${flag ? 'Likely ' : ''}Merged`, 'git-merge')}`;",
			'}',
			'',
		].join('\n');

		writeTextFile(rootDir, 'dist/webviews/home.js', source);
		writeTextFile(rootDir, 'src/webviews/apps/home/home.ts', source);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'Branch ${slot1}Merged': '分支${slot1}已合并',
			'Likely ': '很可能',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'home');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('"text": "分支${slot1}已合并"'), true);
		assert.equal(localizedBundle!.includes('"text": "很可能"'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testRuntimeWorkflowSkipsWrapperOnlyContainers(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-wrapper-'));
	try {
		writeDefaultSettingsShell(rootDir);
		const source = [
			"import { html } from 'lit';",
			'',
			'export function renderBundle() {',
			'\treturn html`<section><p class="centered"><gl-button class="is-basic" href="command:test">Manage in Source Control</gl-button></p><span class="section-heading-actions"><gl-button class="section-heading-action" appearance="toolbar" tooltip="Fetch All" href="command:fetch"><code-icon icon="repo-fetch"></code-icon></gl-button></span><a class="launchpad-action" href="command:review"><code-icon icon="report"></code-icon><span>Review required</span></a></section>`;',
			'}',
			'',
		].join('\n');

		writeTextFile(rootDir, 'dist/webviews/home.js', source);
		writeTextFile(rootDir, 'src/webviews/apps/home/home.ts', source);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		const workset = loadWebviewsWorkset(context);
		assert.equal(workset.entries.some(entry => entry.source === 'Manage in Source Control'), true);
		assert.equal(workset.entries.some(entry => entry.source === 'Fetch All'), true);
		assert.equal(workset.entries.some(entry => entry.source === 'Review required'), true);
		assert.equal(
			workset.entries.some(
				entry =>
					entry.source ===
					'class="section-heading-actions" > class="section-heading-action" appearance="toolbar" tooltip="Fetch All" href= ${slot1} >',
			),
			false,
		);
		assert.equal(
			workset.entries.some(
				entry =>
					entry.source ===
					'class="launchpad-action" href= ${slot1} > ${slot2} Review required',
			),
			false,
		);

		approveTranslations(context, {
			'Manage in Source Control': '在源代码管理中管理',
			'Fetch All': '获取全部',
			'Review required': '需要审查',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'home');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('在源代码管理中管理'), true);
		assert.equal(localizedBundle!.includes('获取全部'), true);
		assert.equal(localizedBundle!.includes('需要审查'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testGraphRuntimeBundleWorkflow(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-webview-runtime-graph-'));
	try {
		writeDefaultSettingsShell(rootDir);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/graph/graph-wrapper/gl-graph.react.tsx',
			[
				'import React from "react";',
				'export function GraphMenu() {',
				'\treturn <div><span>No results found</span><button aria-label="Compose Commits..." tooltip="Generate Commit Message">Compose Commits...</button><a>Load more commits...</a><a>Load more results...</a></div>;',
				'}',
				'',
			].join('\n'),
		);
		writeTextFile(
			rootDir,
			'src/webviews/apps/plus/graph/minimap/minimap.ts',
			[
				'export function renderMinimap() {',
				"\tconst commits = 'No commits';",
				'\treturn commits;',
				'}',
				'',
			].join('\n'),
		);

		syncWebviewsI18n({ rootDir });

		const context = createWebviewsDomainContext(rootDir);
		approveTranslations(context, {
			'No results found': '未找到结果',
			'Compose Commits...': '编排提交...',
			'Generate Commit Message': '生成提交消息',
			'Load more commits...': '加载更多提交...',
			'Load more results...': '加载更多结果...',
			'No commits': '没有提交',
		});

		promoteWebviewsAuthority({ rootDir });
		generateWebviewsLocalizedOutputs({ rootDir });

		const localizedBundle = loadLocalizedRuntimeBundle(context, 'graph');
		assert.notEqual(localizedBundle, undefined);
		assert.equal(localizedBundle!.includes('未找到结果'), true);
		assert.equal(localizedBundle!.includes('编排提交...'), true);
		assert.equal(localizedBundle!.includes('生成提交消息'), true);
		assert.equal(localizedBundle!.includes('加载更多提交...'), true);
		assert.equal(localizedBundle!.includes('加载更多结果...'), true);
		assert.equal(localizedBundle!.includes('没有提交'), true);
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
			reasons.some(reason => reason.includes('deferred patchDetails: follow-up page family deferred from current rollout')),
			true,
		);
		assert.equal(catalog.occurrences.some(occurrence => occurrence.scope.startsWith('webviews.graph.')), true);
		assert.equal(catalog.occurrences.some(occurrence => occurrence.scope.startsWith('webviews.patchDetails.')), false);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testLocalizedSettingsShellPreservesRuntimeAnchors(): void {
	const localizedHtml = fs.readFileSync(
		new URL('../../../../src/i18n/webviews/zh-cn/settings.html', import.meta.url),
		'utf8',
	);

	for (const marker of [
		'id="version"',
		'id="scopes"',
		'id="token-popup"',
		'data-component="autolink-integration"',
		'data-component="autolinks"',
	]) {
		assert.equal(
			localizedHtml.includes(marker),
			true,
			`localized settings shell must preserve runtime marker ${marker}`,
		);
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
					? {
							...entry,
							status: 'approved',
							translation: 'Git 全面增强',
					  }
					: entry.source === 'Open CHANGELOG'
						? {
								...entry,
								status: 'approved',
								translation: '打开 CHANGELOG',
						  }
						: entry.source === 'Open Release Notes'
							? {
									...entry,
									status: 'approved',
									translation: '打开发布说明',
							  }
							: entry.source === 'Release notes'
								? {
										...entry,
										status: 'approved',
										translation: '发布说明',
								  }
								: entry.source === 'Version'
									? {
											...entry,
											status: 'approved',
											translation: '版本',
									  }
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

function writeDefaultSettingsShell(rootDir: string): void {
	writeTextFile(rootDir, 'dist/webviews/settings.html', ['<!doctype html>', '<html lang="en">', '<body></body>', '</html>', ''].join('\n'));
}

function writeRuntimeBundleFixture(rootDir: string, bundle: string, sourceFile: string, sourceText: string): void {
	writeTextFile(
		rootDir,
		`dist/webviews/${bundle}.js`,
		[
			"import { html } from 'lit';",
			'',
			'export const meta = { title: "Placeholder" };',
			'',
			'export function renderBundle() {',
			`\treturn html\`<section><p>${sourceText}</p></section>\`;`,
			'}',
			'',
		].join('\n'),
	);
	writeTextFile(
		rootDir,
		sourceFile,
		[
			"import { html } from 'lit';",
			'',
			'export function renderBundle() {',
			`\treturn html\`<section><p>${sourceText}</p></section>\`;`,
			'}',
			'',
		].join('\n'),
	);
}

function writeTextFile(rootDir: string, relativePath: string, contents: string): void {
	const filePath = path.join(rootDir, ...relativePath.split('/'));
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, contents, 'utf8');
}

function approveTranslations(context: ReturnType<typeof createWebviewsDomainContext>, translations: Record<string, string>): void {
	const workset = loadWebviewsWorkset(context);
	saveWebviewsWorkset(context, {
		...workset,
		entries: workset.entries.map(entry => {
			const translation = translations[entry.source];
			return translation == null
				? entry
				: {
						...entry,
						status: 'approved',
						translation: translation,
				  };
		}),
	});
}



