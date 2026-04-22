import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createWebviewsDomainContext } from '../context.mts';
import {
	loadLocalizedSettingsShell,
	loadWebviewsCatalog,
	loadWebviewsWorkset,
	saveWebviewsWorkset,
} from '../store.mts';
import { createPendingReport, generateWebviewsLocalizedOutputs, promoteWebviewsAuthority, syncWebviewsI18n } from '../workflow.mts';

run();

function run(): void {
	testSettingsWorkflow();
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

		const report = createPendingReport({ rootDir });
		assert.equal(report.domain, 'webviews');
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
								: entry.source === 'Version ${slot1}'
									? {
											...entry,
											status: 'approved',
											translation: '版本 ${slot1}',
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
