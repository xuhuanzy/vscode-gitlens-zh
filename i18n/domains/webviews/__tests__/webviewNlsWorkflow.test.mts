import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

import {
	loadCatalog as loadWebviewsCatalog,
	loadReconciliationReport as loadWebviewsReconciliationReport,
	loadWorkset as loadWebviewsWorkset,
	saveCatalog as saveWebviewsCatalog,
	saveWorkset as saveWebviewsWorkset,
	writeTextFile as writeStoreTextFile,
} from "../../../core/store.mts";
import { createTestLayerOptions, withTempRoot } from "../../../testing/tempRoot.mts";
import { createWebviewsDomainContext } from "../context.mts";
import {
	generateWebviewsLocalizedDynamicSources,
	generateWebviewsLocalizedOutputs,
	promoteWebviewsAuthority,
	syncWebviewsI18n,
} from "../workflow.mts";

test("extracts and localizes the 18.3 settings runtime sources", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeTextFile(
			rootDir,
			"src/webviews/apps/settings/settings.ts",
			[
				"import { html } from 'lit';",
				'export const view = () => html`<h1 title="Search settings">Settings</h1>`;',
				"export const placeholder = 'Search settings';",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/settings/categories/general.ts",
			"import { html } from 'lit';\nexport const view = () => html`<span>General settings</span>`;\n",
		);

		const options = createTestLayerOptions(rootDir);
		syncWebviewsI18n(options);
		const context = createWebviewsDomainContext(options);
		const catalog = loadWebviewsCatalog(context);
		expect(
			catalog.occurrences.some(
				(occurrence) => occurrence.output?.kind === "runtime-key" && occurrence.output.bundle === "settings",
			),
		).toBe(true);

		approveTranslations(context, {
			Settings: "设置",
			"Search settings": "搜索设置",
			"General settings": "常规设置",
		});
		promoteWebviewsAuthority(options);
		generateWebviewsLocalizedDynamicSources(options);

		expect(loadGeneratedSource(context, "src/webviews/apps/settings/settings.ts")).toContain("设置");
		expect(loadGeneratedSource(context, "src/webviews/apps/settings/categories/general.ts")).toContain("常规设置");
	});
});

test("preserves shared webview host entries during sync", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeTextFile(
			rootDir,
			"src/webviews/apps/settings/settings.ts",
			"import { html } from 'lit';\nexport const view = () => html`<h1>Settings</h1>`;\n",
		);

		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		saveWebviewsCatalog(context, {
			$schema: "../schemas/sourceCatalog.schema.json",
			version: 5,
			domain: "webviews",
			occurrences: [
				{
					id: "webviewHost:webviewHost.registration.registration.string-13-11.title.123#title",
					scope: "webviewHost.registration",
					anchor: "webviewHost.registration.registration.string-13-11.title.123",
					slot: "title",
					authorityId: "message.webview-host-only",
					pattern: {
						kind: "literal",
						text: "Home",
					},
					reference: {
						kind: "source",
						file: "src/webviews/home/registration.ts",
						attribute: "title",
					},
					output: {
						kind: "runtime-key",
						bundle: "webviewHost",
						key: "registration.string-13-11.title.123",
					},
				},
			],
		});
		saveWebviewsWorkset(context, {
			$schema: "../schemas/translationWorkset.schema.json",
			version: 2,
			locale: "zh-cn",
			domain: "webviews",
			generatedAt: new Date(0).toISOString(),
			entries: [
				{
					id: "message.webview-host-only",
					kind: "literal",
					source: "Home",
					translation: null,
					sourceHash: "hash-home",
					occurrenceIds: ["webviewHost:webviewHost.registration.registration.string-13-11.title.123#title"],
					status: "pending",
				},
			],
		});

		const result = syncWebviewsI18n(createTestLayerOptions(rootDir));
		expect(result.worksetCount).toBe(1);

		const workset = loadWebviewsWorkset(context);
		expect(workset.entries.some((entry) => entry.id === "message.webview-host-only")).toBe(true);
		expect(workset.entries.some((entry) => entry.source === "Settings")).toBe(true);
		const catalog = loadWebviewsCatalog(context);
		expect(catalog.domain).toBe("webviews");
		expect(catalog.occurrences.some((occurrence) => occurrence.id.startsWith("webviewHost:"))).toBe(true);
		expect(catalog.occurrences.some((occurrence) => occurrence.pattern.text === "Settings")).toBe(true);
	});
});

test("runs the welcome localized source workflow", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeWelcomeFixture(rootDir, {
			welcomeTs: [
				"import './welcome.scss';",
				"import { html } from 'lit';",
				"import './components/welcome-page.js';",
				"export function renderApp() {",
				"\treturn html`<div><gl-welcome-page></gl-welcome-page></div>`;",
				"}",
				"",
			].join("\n"),
			welcomePageTs: [
				"import { html } from 'lit';",
				"import './welcome-parts.js';",
				'const cards = [{ title: "Welcome to GitLens" }];',
				"export function renderWelcome(doneCount, allCount) {",
				"\tvoid cards;",
				"\treturn html`<section><h1>Welcome to GitLens</h1><p>${doneCount}/${allCount} steps complete</p><ul><li>View previous file revisions</li></ul></section>`;",
				"}",
				"",
			].join("\n"),
			welcomePartsTs: [
				"import { html } from 'lit';",
				"export function renderProgress(doneCount, allCount) {",
				"\treturn html`<p>${doneCount}/${allCount} steps complete</p>`;",
				"}",
				"",
			].join("\n"),
		});

		syncWebviewsI18n(createTestLayerOptions(rootDir));

		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		approveTranslations(context, {
			"Welcome to GitLens": "欢迎使用 GitLens",
			"${slot1}/${slot2} steps complete": "${slot1}/${slot2} 个步骤已完成",
			"View previous file revisions": "查看文件的上一版修订",
		});

		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		const generateResult = generateWebviewsLocalizedOutputs(createTestLayerOptions(rootDir));
		expect(generateResult.translatedCount).toBeGreaterThanOrEqual(4);

		const localizedWelcomePage = loadGeneratedSource(
			context,
			"src/webviews/apps/welcome/components/welcome-page.ts",
		);
		expect(localizedWelcomePage).toBeDefined();
		expect(localizedWelcomePage!).toContain("欢迎使用 GitLens");
		expect(localizedWelcomePage!).toContain("${doneCount}/${allCount} 个步骤已完成");
		expect(localizedWelcomePage!).toContain("查看文件的上一版修订");

		const localizedWelcomeParts = loadGeneratedSource(
			context,
			"src/webviews/apps/welcome/components/welcome-parts.ts",
		);
		expect(localizedWelcomeParts).toBeDefined();
		expect(localizedWelcomeParts!).toContain("${doneCount}/${allCount} 个步骤已完成");
	});
});

test("preserves template expression discriminants during overlay", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/home/home.ts",
			[
				"import { html, nothing } from 'lit';",
				"let _activeTab = 'recent';",
				"let activeView = 'files';",
				"function switchTab(tab: string) { _activeTab = tab; }",
				"export function renderHome() {",
				"\treturn html`<main>${_activeTab === 'recent' ? html`<button @click=${() => switchTab('recent')}>Recent activity</button>` : nothing}${activeView === 'files' ? html`<h1>Changed files</h1>` : nothing}</main>`;",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		approveTranslations(context, {
			"Recent activity": "最近活动",
			"Changed files": "已更改文件",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedDynamicSources(createTestLayerOptions(rootDir));

		const localizedHome = loadGeneratedSource(context, "src/webviews/apps/home/home.ts");
		expect(localizedHome).toBeDefined();
		expect(localizedHome!).toMatch(/_activeTab === 'recent'/u);
		expect(localizedHome!).toMatch(/switchTab\('recent'\)/u);
		expect(localizedHome!).toMatch(/activeView === 'files'/u);
		expect(localizedHome!).toMatch(/>最近活动<\/button>/u);
		expect(localizedHome!).toMatch(/>已更改文件<\/h1>/u);
		expect(localizedHome!).not.toMatch(/_activeTab === '最近'/u);
		expect(localizedHome!).not.toMatch(/switchTab\('最近'\)/u);
		expect(localizedHome!).not.toMatch(/activeView === '文件'/u);
	});
});

test("does not extract literal-union call arguments as display text", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/graph/components/status.ts",
			[
				"import { html } from 'lit';",
				"function formatStatus(verb: 'Composing' | 'Reviewing' | 'Resolving') {",
				"\treturn html`<span>${verb}...</span>`;",
				"}",
				"export function renderStatus(mode: 'compose' | 'review') {",
				"\treturn formatStatus(mode === 'compose' ? 'Composing' : 'Reviewing');",
				"}",
				"export const resolving = formatStatus('Resolving');",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const catalog = loadWebviewsCatalog(createWebviewsDomainContext(createTestLayerOptions(rootDir)));
		for (const discriminant of ["Composing", "Reviewing", "Resolving"]) {
			expect(catalog.occurrences.some((occurrence) => occurrence.pattern.text === discriminant)).toBe(false);
		}
	});
});

test("skips unchanged text writes", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		const filePath = path.join(rootDir, "sample.txt");
		writeStoreTextFile(filePath, "same content\n");
		const before = fs.statSync(filePath, { bigint: true }).mtimeNs;

		sleep(1100);
		writeStoreTextFile(filePath, "same content\n");
		const after = fs.statSync(filePath, { bigint: true }).mtimeNs;

		expect(after).toBe(before);
	});
});

test("generates dynamic sources without a settings source", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeWelcomeFixture(rootDir, {
			welcomeTs: [
				"import { html } from 'lit';",
				"import './components/welcome-page.js';",
				"export function renderApp() {",
				"\treturn html`<div><gl-welcome-page></gl-welcome-page></div>`;",
				"}",
				"",
			].join("\n"),
			welcomePageTs: [
				"import { html } from 'lit';",
				"export function renderWelcome() {",
				"\treturn html`<section><h1>Welcome to GitLens</h1></section>`;",
				"}",
				"",
			].join("\n"),
			welcomePartsTs: "export const unused = true;\n",
		});

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		approveTranslations(context, {
			"Welcome to GitLens": "欢迎使用 GitLens",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));

		const generateResult = generateWebviewsLocalizedDynamicSources(createTestLayerOptions(rootDir));
		expect(generateResult.translatedCount).toBeGreaterThanOrEqual(1);
		expect(loadGeneratedSource(context, "src/webviews/apps/welcome/components/welcome-page.ts")).toContain(
			"欢迎使用 GitLens",
		);
	});
});

test("does not create reports in generate-only mode", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		const result = generateWebviewsLocalizedDynamicSources(createTestLayerOptions(rootDir));

		expect(fs.existsSync(result.context.pendingReportFile)).toBe(false);
		expect(fs.existsSync(result.context.reconciliationReportFile)).toBe(false);
	});
});

test("generates supported dynamic bundles", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/rebase/rebase.ts",
			[
				"import { html } from 'lit';",
				"export function renderRebase() {",
				"\treturn html`<section><p>No commits to rebase</p></section>`;",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/home/home.ts",
			[
				"import { html } from 'lit';",
				"export function renderHome() {",
				"\treturn html`<section><p>You are all caught up!</p></section>`;",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/commitDetails/commitDetails.ts",
			[
				"import { html } from 'lit';",
				"export function renderCommitDetails() {",
				"\treturn html`<section><p>Inspect Commit</p></section>`;",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/timeline/timeline.ts",
			[
				"import { html } from 'lit';",
				"export function renderTimeline() {",
				"\treturn html`<section><p>No commits found for the specified time period</p></section>`;",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		approveTranslations(context, {
			"No commits to rebase": "没有可变基的提交",
			"You are all caught up!": "你已全部处理完成！",
			"Inspect Commit": "检查提交",
			"No commits found for the specified time period": "在指定时间段内未找到提交",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedOutputs(createTestLayerOptions(rootDir));

		expect(loadGeneratedSource(context, "src/webviews/apps/rebase/rebase.ts")).toContain("没有可变基的提交");
		expect(loadGeneratedSource(context, "src/webviews/apps/home/home.ts")).toContain("你已全部处理完成！");
		expect(loadGeneratedSource(context, "src/webviews/apps/commitDetails/commitDetails.ts")).toContain("检查提交");
		expect(loadGeneratedSource(context, "src/webviews/apps/plus/timeline/timeline.ts")).toContain(
			"在指定时间段内未找到提交",
		);
	});
});

test("runs the composer localized source workflow", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/composer/composer.ts",
			[
				"import { html } from 'lit';",
				"import './components/commits-panel.js';",
				"export function renderComposer() {",
				"\treturn html`<gl-commits-panel></gl-commits-panel>`;",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/composer/components/commit-item.ts",
			[
				"import { html } from 'lit';",
				"export class CommitItem {",
				"\tfileCount = 0;",
				"\tmessage = '';",
				"\trender() {",
				"\t\tconst isPlaceholder = !this.message;",
				"\t\treturn html`<div><span>${isPlaceholder ? 'Draft commit (add a commit message)' : this.message}</span><span>${this.fileCount} ${this.fileCount === 1 ? 'file' : 'files'}</span></div>`;",
				"\t}",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/composer/components/commit-message.ts",
			[
				"import { html } from 'lit';",
				"import { when } from 'lit/directives/when.js';",
				"export class CommitMessage {",
				"\taiGenerated = false;",
				"\taiEnabled = false;",
				"\taiDisabledReason: string | null = null;",
				"\tgenerating = false;",
				"\texplanation = '';",
				"\tmessage = '';",
				"\texplanationLabel?: string = 'Auto-composition Summary:';",
				"\tplaceholder: string = 'Enter commit message...';",
				"\tprivate onGenerateCommitMessageClick() {}",
				"\tprivate renderHelpText() {",
				'\t\treturn html`<div class="message" id="help-text" aria-live="polite"></div>`;',
				"\t}",
				"\tprivate renderEditable() {",
				"\t\treturn html`",
				'\t\t\t<div class="commit-message__field">',
				"\t\t\t\t<textarea",
				'\t\t\t\t\tclass="commit-message__input"',
				"\t\t\t\t\t.value=${this.message ?? ''}",
				"\t\t\t\t\t.placeholder=${this.placeholder}",
				"\t\t\t\t></textarea>",
				"\t\t\t\t${this.renderHelpText()}",
				"\t\t\t\t${when(",
				"\t\t\t\t\tthis.aiEnabled,",
				"\t\t\t\t\t() =>",
				"\t\t\t\t\t\thtml`<gl-button",
				'\t\t\t\t\t\t\tclass="commit-message__ai-button"',
				'\t\t\t\t\t\t\tappearance="toolbar"',
				"\t\t\t\t\t\t\t?disabled=${this.generating}",
				"\t\t\t\t\t\t\t.tooltip=${this.generating ? 'Generating...' : 'Generate commit message with AI'}",
				"\t\t\t\t\t\t\t@click=${() => this.onGenerateCommitMessageClick()}",
				"\t\t\t\t\t\t>",
				"\t\t\t\t\t\t\t${this.explanation || this.aiGenerated ? 'Regenerate Message' : 'Generate Message'}",
				"\t\t\t\t\t\t</gl-button>`,",
				"\t\t\t\t\t() =>",
				"\t\t\t\t\t\thtml`<gl-button",
				'\t\t\t\t\t\t\tclass="commit-message__ai-button"',
				'\t\t\t\t\t\t\tappearance="toolbar"',
				"\t\t\t\t\t\t\t.tooltip=${this.aiDisabledReason || 'AI features are disabled'}",
				"\t\t\t\t\t\t>",
				"\t\t\t\t\t\t\t${this.explanation || this.aiGenerated ? 'Regenerate Message' : 'Generate Message'}",
				"\t\t\t\t\t\t</gl-button>`,",
				"\t\t\t\t)}",
				"\t\t\t</div>`;",
				"\t}",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/composer/components/commits-panel.ts",
			[
				"import { html } from 'lit';",
				"import './commit-item.js';",
				"export class CommitsPanel {",
				"\taiModel?: { name?: string };",
				"\tcommitting = false;",
				"\tfileCount = 0;",
				"\tprivate get aiModelDisplayName(): string {",
				"\t\tif (!this.aiModel) return 'Choose AI Model';",
				"\t\treturn this.aiModel.name || 'Unknown Model';",
				"\t}",
				"\trender() {",
				"\t\treturn html`",
				"\t\t\t<section>",
				'\t\t\t\t<gl-button tooltip="Select AI Model">${this.aiModelDisplayName}</gl-button>',
				"\t\t\t\t<span class=\"file-count\">${this.fileCount} ${this.fileCount === 1 ? 'file' : 'files'}</span>",
				"\t\t\t\t<gl-popover>",
				'\t\t\t\t\t<div slot="content">',
				"\t\t\t\t\t\tProviding additional instructions can help steer the AI composition for this session.",
				"\t\t\t\t\t\t<br /><br />",
				"\t\t\t\t\t\tPotential instructions include:",
				'\t\t\t\t\t\t<ul class="instructions-list">',
				"\t\t\t\t\t\t\t<li>conventional commits format</li>",
				"\t\t\t\t\t\t\t<li>size of commits</li>",
				"\t\t\t\t\t\t\t<li>focus on certain changes</li>",
				"\t\t\t\t\t\t</ul>",
				"\t\t\t\t\t\t<hr />",
				"\t\t\t\t\t\tYou can also specify custom instructions that apply to all composer sessions with the following setting:",
				"\t\t\t\t\t\t<a href=${`command:workbench.action.openSettings?%22@id:gitlens.ai.generateCommits.customInstructions%22`}>gitlens.ai.generateCommits.customInstructions</a>",
				"\t\t\t\t\t</div>",
				"\t\t\t\t</gl-popover>",
				"\t\t\t\t<gl-button>${this.committing ? 'Committing...' : 'Create Commits'}</gl-button>",
				"\t\t\t\t<h3>Draft Commits</h3>",
				"\t\t\t\t<span>Drop hunks here to create new commit</span>",
				"\t\t\t\t<gl-commit-item></gl-commit-item>",
				"\t\t\t</section>`;",
				"\t}",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		approveTranslations(context, {
			"Choose AI Model": "选择 AI 模型",
			"Unknown Model": "未知模型",
			"Select AI Model": "选择 AI 模型",
			"Draft commit (add a commit message)": "草稿提交（添加提交消息）",
			"Providing additional instructions can help steer the AI composition for this session. ${slot1} ${slot2} Potential instructions include: ${slot3} ${slot4} You can also specify custom instructions that apply to all composer sessions with the following setting: ${slot5}":
				"提供额外指令有助于引导本次 AI 编排。${slot1}${slot2}可用指令包括：${slot3}${slot4}你也可以通过以下设置指定适用于所有提交编排器会话的自定义指令：${slot5}",
			"conventional commits format": "Conventional Commits 格式",
			"size of commits": "提交大小",
			"focus on certain changes": "聚焦特定更改",
			"Committing...": "正在提交...",
			"Create Commits": "创建提交",
			"Draft Commits": "草稿提交",
			"Drop hunks here to create new commit": "将代码块拖到此处以创建新提交",
			"AI features are disabled": "AI 功能已禁用",
			"Auto-composition Summary:": "自动编排摘要：",
			"Enter commit message...": "输入提交消息...",
			"Generate commit message with AI": "使用 AI 生成提交消息",
			"Generate Message": "生成提交消息",
			"Generating...": "正在生成...",
			"Regenerate Message": "重新生成提交消息",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedDynamicSources(createTestLayerOptions(rootDir));

		const localizedCommitsPanel = loadGeneratedSource(
			context,
			"src/webviews/apps/plus/composer/components/commits-panel.ts",
		);
		expect(localizedCommitsPanel).toBeDefined();
		expect(localizedCommitsPanel!).toContain("选择 AI 模型");
		expect(localizedCommitsPanel!).toContain("未知模型");
		expect(localizedCommitsPanel!).toContain("this.committing ? 'Committing...' : 'Create Commits'");
		expect(localizedCommitsPanel!).not.toContain("正在提交...");
		expect(localizedCommitsPanel!).not.toContain('${this.fileCount} ${this.fileCount === 1 ? "个文件" : "个文件"}');
		expect(localizedCommitsPanel!).toContain("${this.fileCount} ${this.fileCount === 1 ? 'file' : 'files'}");
		expect(localizedCommitsPanel!).toContain("提供额外指令有助于引导本次 AI 编排。");
		expect(localizedCommitsPanel!).toContain('<ul class="instructions-list">');
		expect(localizedCommitsPanel!).toContain("<li>Conventional Commits 格式</li>");
		expect(localizedCommitsPanel!).toContain("<li>提交大小</li>");
		expect(localizedCommitsPanel!).toContain("<li>聚焦特定更改</li>");
		expect(localizedCommitsPanel!).toContain("<hr />");
		expect(localizedCommitsPanel!).toContain("gitlens.ai.generateCommits.customInstructions");
		expect(localizedCommitsPanel!).not.toContain("Conventional Commits 格式、提交大小、聚焦特定更改");

		const localizedCommitItem = loadGeneratedSource(
			context,
			"src/webviews/apps/plus/composer/components/commit-item.ts",
		);
		expect(localizedCommitItem).toBeDefined();
		expect(localizedCommitItem!).toContain("isPlaceholder ? 'Draft commit (add a commit message)'");
		expect(localizedCommitItem!).not.toContain("草稿提交（添加提交消息）");
		expect(localizedCommitItem!).not.toContain('${this.fileCount} ${this.fileCount === 1 ? "个文件" : "个文件"}');
		expect(localizedCommitItem!).toContain("${this.fileCount} ${this.fileCount === 1 ? 'file' : 'files'}");

		const localizedCommitMessage = loadGeneratedSource(
			context,
			"src/webviews/apps/plus/composer/components/commit-message.ts",
		);
		expect(localizedCommitMessage).toBeDefined();
		expect(localizedCommitMessage!).toContain("自动编排摘要：");
		expect(localizedCommitMessage!).toContain("输入提交消息...");
		expect(localizedCommitMessage!).not.toContain("正在生成...");
		expect(localizedCommitMessage!).not.toContain("使用 AI 生成提交消息");
		expect(localizedCommitMessage!).not.toContain("重新生成提交消息");
		expect(localizedCommitMessage!).not.toContain("生成提交消息");
		expect(localizedCommitMessage!).not.toContain("AI 功能已禁用");
		expect(localizedCommitMessage!).toContain("Generate Message");
		expect(localizedCommitMessage!).toContain("Regenerate Message");
		expect(localizedCommitMessage!).toContain("Generate commit message with AI");
	});
});

test("does not extract the rebase shortcut footer", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/rebase/rebase.ts",
			[
				"import { html } from 'lit';",
				"export function renderFooter() {",
				"\treturn html`<footer>",
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
				"\t\t</div>",
				"\t\t<p>Ready to rebase</p>",
				"\t</footer>`;",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		const catalog = loadWebviewsCatalog(context);
		const workset = loadWebviewsWorkset(context);
		const blockedSources = new Set(["ick", "eword", "dit", "quash", "ixup", "rop", "move", "search"]);

		expect(workset.entries.some((entry) => entry.source === "Ready to rebase")).toBe(true);
		expect(workset.entries.some((entry) => blockedSources.has(entry.source))).toBe(false);
		expect(catalog.occurrences.some((occurrence) => blockedSources.has(occurrence.pattern.text))).toBe(false);
	});
});

test("does not extract structural slot-only templates", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/rebase/components/rebase-entry.ts",
			[
				"import { html } from 'lit';",
				"export function renderEntry(action: string, message: string, sha: string) {",
				"\tconst ariaLabel = `${action}, ${message}, ${sha}`;",
				"\treturn html`<div aria-label=${ariaLabel}><span>Ready to rebase</span></div>`;",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/shared/components/search/search-box.ts",
			[
				"import { html } from 'lit';",
				"export function renderCount(step: number, total: number, label: string) {",
				"\treturn html`<span><span>${step}</span> of <span>${total}</span><span> ${label}</span></span>`;",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/home/components/user-chip.ts",
			[
				"import { html } from 'lit';",
				"export function renderUser(name: string, status: string) {",
				"\treturn html`<span><strong>${name}</strong> (${status})</span>`;",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/graph/components/branch-label.ts",
			[
				"import { html } from 'lit';",
				"export function renderBranchLabel(name: string, status: string, branch: string, remote: string) {",
				"\treturn html`<div><span>${name} ${status}</span><span>${branch} is</span><span>on ${remote}</span></div>`;",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		const catalog = loadWebviewsCatalog(context);
		const workset = loadWebviewsWorkset(context);
		const blockedSources = new Set([
			"${slot1}, ${slot2}, ${slot3}",
			"${slot1} of ${slot2} ${slot3}",
			"**${slot1}** (${slot2})",
			"${slot1} ${slot2}",
			"${slot1} is",
			"on ${slot1}",
		]);

		expect(workset.entries.some((entry) => blockedSources.has(entry.source))).toBe(false);
		expect(catalog.occurrences.some((occurrence) => blockedSources.has(occurrence.pattern.text))).toBe(false);
		expect(workset.entries.some((entry) => entry.source === "Ready to rebase")).toBe(true);
	});
});

test("does not extract Launchpad grammar helpers", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/home/components/launchpad.ts",
			[
				"import { html } from 'lit';",
				"const pluralize = (label: string, count: number): string => `${count} ${label}${count === 1 ? '' : 's'}`;",
				"export function renderLaunchpad(total: number, summary: { count: number }) {",
				"\tconst messages = [",
				"\t\t{ count: summary.count, message: `${summary.count > 1 ? 'need' : 'needs'} reviewers` },",
				"\t\t{ count: summary.count, message: `${summary.count > 1 ? 'have' : 'has'} failed CI checks` },",
				"\t\t{ count: summary.count, message: `${summary.count > 1 ? 'have' : 'has'} conflicts` },",
				"\t];",
				"\treturn html`",
				"\t\t<section>",
				"\t\t\t<span>${pluralize('pull request', total)} ${messages[0].message}</span>",
				"\t\t\t<span>${pluralize('pull request', total)} ${total > 1 ? 'are' : 'is'} blocked (${messages.map(m => `${m.count} ${m.message}`).join(', ')})</span>",
				"\t\t\t<span>${pluralize('pull request', total)} ${total > 1 ? 'require' : 'requires'} follow-up</span>",
				"\t\t\t<span>${pluralize('pull request', total)} ${total > 1 ? 'need' : 'needs'} your review</span>",
				"\t\t</section>`;",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		const catalog = loadWebviewsCatalog(context);
		const workset = loadWebviewsWorkset(context);
		const grammarHelperSources = new Set(["are", "has", "have", "is", "need", "needs", "require", "requires"]);
		const expectedSources = new Set([
			"${slot1} reviewers",
			"${slot1} failed CI checks",
			"${slot1} conflicts",
			"${slot1} ${slot2} blocked (${slot3})",
			"${slot1} ${slot2} follow-up",
			"${slot1} ${slot2} your review",
		]);
		const blockedStructuralSources = new Set(["${slot1} ${slot2}"]);

		expect(workset.entries.some((entry) => grammarHelperSources.has(entry.source))).toBe(false);
		expect(catalog.occurrences.some((occurrence) => grammarHelperSources.has(occurrence.pattern.text))).toBe(false);
		expect(workset.entries.some((entry) => blockedStructuralSources.has(entry.source))).toBe(false);
		expect(catalog.occurrences.some((occurrence) => blockedStructuralSources.has(occurrence.pattern.text))).toBe(
			false,
		);
		for (const source of expectedSources) {
			expect(
				catalog.occurrences.some((occurrence) => occurrence.pattern.text === source),
				`expected Launchpad source to be extracted: ${source}`,
			).toBe(true);
		}

		approveTranslations(context, {
			"${slot1} reviewers": "需要审查者",
			"${slot1} failed CI checks": "CI 检查未通过",
			"${slot1} conflicts": "存在冲突",
			"${slot1} ${slot2} blocked (${slot3})": "${slot1} 已阻塞（${slot3}）",
			"${slot1} ${slot2} follow-up": "${slot1} 需要后续跟进",
			"${slot1} ${slot2} your review": "${slot1} 需要你审查",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedDynamicSources(createTestLayerOptions(rootDir));

		const localizedLaunchpad = loadGeneratedSource(context, "src/webviews/apps/plus/home/components/launchpad.ts");
		expect(localizedLaunchpad).toBeDefined();
		expect(localizedLaunchpad!).not.toContain('summary.count > 1 ? "" : ""');
		expect(localizedLaunchpad!).not.toContain('total > 1 ? "" : ""');
		expect(localizedLaunchpad!).toContain("message: `需要审查者`");
		expect(localizedLaunchpad!).toContain("message: `CI 检查未通过`");
		expect(localizedLaunchpad!).toContain("message: `存在冲突`");
		expect(localizedLaunchpad!).toContain("${pluralize('pull request', total)} 需要后续跟进");
		expect(localizedLaunchpad!).toContain("${pluralize('pull request', total)} 需要你审查");
		expect(localizedLaunchpad!).toContain(
			"${pluralize('pull request', total)} 已阻塞（${messages.map(m => `${m.count} ${m.message}`).join(', ')}）",
		);
	});
});

test("generates the graph bundle", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/graph/graph.ts",
			[
				"import { html } from 'lit';",
				"export function renderGraph() {",
				"\treturn html`<section><gl-graph></gl-graph></section>`;",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/graph/graph-wrapper/gl-graph.react.tsx",
			[
				'import React from "react";',
				'export function renderGraphMenu(props: { searchMode: "filter" | "normal" }) {',
				"\treturn (",
				"\t\t<div>",
				"\t\t\t<span>No results found</span>",
				'\t\t\t<a>{props.searchMode === "filter" ? "Load more results..." : "Load more commits..."}</a>',
				'\t\t\t<gl-button tooltip="Compose Commits..." aria-label="Compose Commits...">Compose Commits...</gl-button>',
				'\t\t\t<gl-button tooltip="Generate Commit Message" aria-label="Generate Commit Message"></gl-button>',
				"\t\t</div>",
				"\t);",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		approveTranslations(context, {
			"No results found": "未找到结果",
			"Load more results...": "加载更多结果...",
			"Load more commits...": "加载更多提交...",
			"Compose Commits...": "编排提交...",
			"Generate Commit Message": "生成提交消息",
		});

		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedOutputs(createTestLayerOptions(rootDir));

		const localizedGraph = loadGeneratedSource(context, "src/webviews/apps/plus/graph/graph.ts");
		expect(localizedGraph).toBeDefined();

		const localizedReactGraph = loadGeneratedSource(
			context,
			"src/webviews/apps/plus/graph/graph-wrapper/gl-graph.react.tsx",
		);
		expect(localizedReactGraph).toBeDefined();
		expect(localizedReactGraph!).toContain("未找到结果");
		expect(localizedReactGraph!).toContain("加载更多结果...");
		expect(localizedReactGraph!).toContain("加载更多提交...");
		expect(localizedReactGraph!).toContain('tooltip="编排提交..."');
		expect(localizedReactGraph!).toContain('aria-label="编排提交..."');
		expect(localizedReactGraph!).toContain(">编排提交...</gl-button>");
		expect(localizedReactGraph!).toContain('tooltip="生成提交消息"');
		expect(localizedReactGraph!).toContain('aria-label="生成提交消息"');
	});
});

test("skips obvious non-UI imperative strings", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeWelcomeFixture(rootDir, {
			welcomeTs: [
				"import './welcome.scss';",
				"import { html } from 'lit';",
				"import './components/welcome-page.js';",
				"export function renderApp() {",
				"\treturn html`<div><gl-welcome-page></gl-welcome-page></div>`;",
				"}",
				"",
			].join("\n"),
			welcomePageTs: [
				"import { html } from 'lit';",
				"export function renderWelcome() {",
				"\tconst pulse = 'indicator--pulse';",
				"\tconst color = 'var(--gl-git-status-conflict-modified, #c4a000)';",
				"\tvoid pulse; void color;",
				"\treturn html`<section><p>Review required</p></section>`;",
				"}",
				"",
			].join("\n"),
			welcomePartsTs: "export const unused = true;\n",
		});

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		const workset = loadWebviewsWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "Review required")).toBe(true);
		expect(workset.entries.some((entry) => entry.source === "indicator--pulse")).toBe(false);
		expect(
			workset.entries.some((entry) => entry.source === "var(--gl-git-status-conflict-modified, #c4a000)"),
		).toBe(false);
	});
});

test("localizes display-only imperative strings in commit details", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/commitDetails/components/gl-inspect-nav.ts",
			[
				"import { html } from 'lit';",
				"export function renderInspectNav(stashNumber, shortSha, getAltKeySymbol) {",
				'\treturn html`<gl-tooltip><span slot="content">Copy ${stashNumber != null ? "Stash Name" : "SHA"}<br />[${getAltKeySymbol()}] Copy Message</span></gl-tooltip>`;',
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/commitDetails/components/gl-commit-details.ts",
			[
				"import { html } from 'lit';",
				"export function renderEmpty() {",
				"\treturn html`<section><p>Rich details for commits and stashes are shown as you navigate:</p><p>Alternatively, show your work-in-progress, or search for or choose a commit</p></section>`;",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/commitDetails/components/gl-wip-details.ts",
			[
				"import { html } from 'lit';",
				"export function renderWip(ahead, behind, upstream) {",
				"\tlet label = 'Share as Cloud Patch';",
				"\tconst fetchLabel = behind > 0 ? 'Pull' : ahead > 0 ? 'Push' : 'Fetch';",
				"\tconst fetchTooltip = behind > 0 ? 'Pull from' : ahead > 0 ? 'Push to' : 'Fetch from';",
				'\treturn html`<gl-button data-action="${fetchLabel.toLowerCase()}">${fetchLabel}<span slot="tooltip">${fetchTooltip} <strong>${upstream}</strong></span></gl-button><gl-button tooltip="${label}">${label}</gl-button>`;',
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(rootDir, "src/webviews/apps/commitDetails/commitDetails.ts", "export const app = true;\n");

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		approveTranslations(context, {
			"Copy ${slot1} [${slot2}] Copy Message": "复制 ${slot1}<br />[${slot2}] 复制消息",
			"Rich details for commits and stashes are shown as you navigate:": "导航时会显示提交和贮藏的详细信息：",
			"Alternatively, show your work-in-progress, or search for or choose a commit":
				"或者显示你的进行中工作，或搜索、选择某个提交",
			"Share as Cloud Patch": "共享为云补丁",
			Pull: "拉取",
			Push: "推送",
			Fetch: "获取",
			"Pull from": "从以下位置拉取",
			"Push to": "推送到",
			"Fetch from": "从以下位置获取",
			"Pull from ${slot1}": "从 ${slot1} 拉取",
			"Push to ${slot1}": "推送到 ${slot1}",
			"Fetch from ${slot1}": "从 ${slot1} 获取",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedOutputs(createTestLayerOptions(rootDir));

		const localizedInspectNav = loadGeneratedSource(
			context,
			"src/webviews/apps/commitDetails/components/gl-inspect-nav.ts",
		);
		expect(localizedInspectNav).toBeDefined();
		expect(localizedInspectNav!).toMatch(/复制 \$\{stashNumber != null \? "Stash Name" : "SHA"\}<br \/>/u);
		expect(localizedInspectNav!).toMatch(/\[\$\{getAltKeySymbol\(\)\}\] 复制消息/u);

		const localizedCommitDetails = loadGeneratedSource(
			context,
			"src/webviews/apps/commitDetails/components/gl-commit-details.ts",
		);
		expect(localizedCommitDetails).toBeDefined();
		expect(localizedCommitDetails!).toContain("导航时会显示提交和贮藏的详细信息：");
		expect(localizedCommitDetails!).toContain("或者显示你的进行中工作，或搜索、选择某个提交");

		const localizedWipDetails = loadGeneratedSource(
			context,
			"src/webviews/apps/commitDetails/components/gl-wip-details.ts",
		);
		expect(localizedWipDetails).toBeDefined();
		expect(localizedWipDetails!).toContain(
			"const fetchLabel = behind > 0 ? 'Pull' : ahead > 0 ? 'Push' : 'Fetch';",
		);
		expect(localizedWipDetails!).toContain(
			'const fetchTooltip = behind > 0 ? "从以下位置拉取" : ahead > 0 ? "推送到" : "从以下位置获取";',
		);
		expect(localizedWipDetails!).toContain('let label = "共享为云补丁";');
		expect(localizedWipDetails!).toContain('data-action="${fetchLabel.toLowerCase()}"');
		expect(localizedWipDetails!).toContain('>${fetchLabel}<span slot="tooltip">${fetchTooltip}');
		expect(localizedWipDetails!).toContain('<gl-button tooltip="${label}">${label}</gl-button>');
	});
});

test("localizes search input placeholder getters", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/home/home.ts",
			[
				"import { html } from 'lit';",
				"export function renderHome() {",
				"\treturn html`<gl-search-input></gl-search-input>`;",
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/shared/components/search/search-input.ts",
			[
				"import { html } from 'lit';",
				"export class GlSearchInput {",
				"\tfilter = false;",
				"\tnaturalLanguage = false;",
				"\tprivate get label() {",
				"\t\treturn this.filter ? 'Filter' : 'Search';",
				"\t}",
				"\tprivate get placeholder() {",
				"\t\tif (this.naturalLanguage) {",
				"\t\t\treturn `${this.label} commits using natural language (↑↓ for history), e.g. my commits from last week`;",
				"\t\t}",
				"\t\treturn `${this.label} commits (press Enter to search, ↑↓ for history), e.g. @me after:1.week.ago file:*.ts`;",
				"\t}",
				"\trender() {",
				'\t\treturn html`<input placeholder="${this.placeholder}" />`;',
				"\t}",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		const catalog = loadWebviewsCatalog(context);
		for (const source of [
			"Filter",
			"Search",
			"${slot1} commits using natural language (↑↓ for history), e.g. my commits from last week",
			"${slot1} commits (press Enter to search, ↑↓ for history), e.g. @me after:1.week.ago file:*.ts",
		]) {
			expect(
				catalog.occurrences.some((occurrence) => occurrence.pattern.text === source),
				`expected search placeholder source to be extracted: ${source}`,
			).toBe(true);
		}

		approveTranslations(context, {
			Filter: "筛选",
			Search: "搜索",
			"${slot1} commits using natural language (↑↓ for history), e.g. my commits from last week":
				"${slot1}使用自然语言搜索提交（↑↓ 查看历史），例如 my commits from last week",
			"${slot1} commits (press Enter to search, ↑↓ for history), e.g. @me after:1.week.ago file:*.ts":
				"${slot1}提交（按 Enter 搜索，↑↓ 查看历史），例如 @me after:1.week.ago file:*.ts",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedDynamicSources(createTestLayerOptions(rootDir));

		const localizedSearchInput = loadGeneratedSource(
			context,
			"src/webviews/apps/shared/components/search/search-input.ts",
		);
		expect(localizedSearchInput).toBeDefined();
		expect(localizedSearchInput!).toContain('return this.filter ? "筛选" : "搜索";');
		expect(localizedSearchInput!).toContain(
			"`${this.label}使用自然语言搜索提交（↑↓ 查看历史），例如 my commits from last week`",
		);
		expect(localizedSearchInput!).toContain(
			"`${this.label}提交（按 Enter 搜索，↑↓ 查看历史），例如 @me after:1.week.ago file:*.ts`",
		);
	});
});

test("localizes variable initializers in returned display templates", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/shared/components/rich/pr-icon.ts",
			[
				"import { html } from 'lit';",
				"export class PrIcon {",
				"\tdraft = false;",
				"\tstate?: string;",
				"\tprId?: string;",
				"\tget label(): string {",
				"\t\tconst type = this.draft ? 'Draft pull request' : 'Pull request';",
				"\t\tif (!this.state) return type;",
				"\t\treturn `${type} ${this.prId ? `#${this.prId}` : ''} is ${this.state}`;",
				"\t}",
				"\trender() {",
				"\t\treturn html`<span>${this.label}</span>`;",
				"\t}",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		const catalog = loadWebviewsCatalog(context);
		for (const source of ["Draft pull request", "Pull request"]) {
			expect(
				catalog.occurrences.some((occurrence) => occurrence.pattern.text === source),
				`expected returned label source to be extracted: ${source}`,
			).toBe(true);
		}
		expect(
			catalog.occurrences.some((occurrence) => occurrence.pattern.text === "${slot1} ${slot2} is ${slot3}"),
		).toBe(false);

		approveTranslations(context, {
			"Draft pull request": "草稿拉取请求",
			"Pull request": "拉取请求",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedDynamicSources(createTestLayerOptions(rootDir));

		const localizedPrIcon = loadGeneratedSource(context, "src/webviews/apps/shared/components/rich/pr-icon.ts");
		expect(localizedPrIcon).toBeDefined();
		expect(localizedPrIcon!).toContain('const type = this.draft ? "草稿拉取请求" : "拉取请求";');
		expect(localizedPrIcon!).toContain("return `${type} ${this.prId ? `#${this.prId}` : ''} is ${this.state}`;");
	});
});

test("localizes graph branch visibility options", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/graph/graph-header.ts",
			[
				"import { html } from 'lit';",
				"export function renderBranchVisibility(repo, branchesVisibility) {",
				'\treturn html`<gl-tooltip placement="top" content="Branches Visibility">',
				"\t\t<sl-select value=${branchesVisibility} hoist>",
				'\t\t\t<code-icon icon="chevron-down" slot="expand-icon"></code-icon>',
				'\t\t\t<sl-option value="all" ?disabled=${repo?.virtual}> All Branches </sl-option>',
				'\t\t\t<sl-option value="current">Current Branch</sl-option>',
				"\t\t\t<menu-divider></menu-divider>",
				'\t\t\t<sl-option value="smart" ?disabled=${repo?.virtual}>',
				"\t\t\t\tSmart Branches",
				'\t\t\t\t${html`<gl-tooltip placement="right" slot="suffix">',
				'\t\t\t\t\t<code-icon icon="info"></code-icon>',
				'\t\t\t\t\t<span slot="content">',
				"\t\t\t\t\t\tShows only relevant branches",
				"\t\t\t\t\t\t<br />",
				"\t\t\t\t\t\t<br />",
				"\t\t\t\t\t\t<i>Includes the current branch, its upstream, and its base or target branch</i>",
				"\t\t\t\t\t</span>",
				"\t\t\t\t</gl-tooltip>`}",
				"\t\t\t</sl-option>",
				'\t\t\t<sl-option value="favorited" ?disabled=${repo?.virtual}>',
				"\t\t\t\tFavorited Branches",
				'\t\t\t\t<gl-tooltip placement="right" slot="suffix">',
				'\t\t\t\t\t<code-icon icon="info"></code-icon>',
				'\t\t\t\t\t<span slot="content">',
				"\t\t\t\t\t\tShows only branches that have been starred as favorites",
				"\t\t\t\t\t\t<br />",
				"\t\t\t\t\t\t<br />",
				"\t\t\t\t\t\t<i>Also includes the current branch</i>",
				"\t\t\t\t\t</span>",
				"\t\t\t\t</gl-tooltip>",
				"\t\t\t</sl-option>",
				"\t\t</sl-select>",
				"\t</gl-tooltip>`;",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		const catalog = loadWebviewsCatalog(context);
		for (const source of [
			"Branches Visibility",
			"All Branches",
			"Current Branch",
			"Smart Branches ${slot1}",
			"Favorited Branches",
			"Shows only relevant branches ${slot1}",
			"Includes the current branch, its upstream, and its base or target branch",
			"Shows only branches that have been starred as favorites ${slot1}",
			"Also includes the current branch",
		]) {
			expect(
				catalog.occurrences.some((occurrence) => occurrence.pattern.text === source),
				`expected graph branch visibility source to be extracted: ${source}`,
			).toBe(true);
		}

		approveTranslations(context, {
			"Branches Visibility": "分支可见性",
			"All Branches": "所有分支",
			"Current Branch": "当前分支",
			"Smart Branches ${slot1}": "智能分支 ${slot1}",
			"Favorited Branches": "收藏的分支",
			"Shows only relevant branches ${slot1}": "仅显示相关分支 ${slot1}",
			"Includes the current branch, its upstream, and its base or target branch":
				"包括当前分支、其上游以及其基础分支或目标分支",
			"Shows only branches that have been starred as favorites ${slot1}": "仅显示已加星标为收藏的分支 ${slot1}",
			"Also includes the current branch": "也包括当前分支",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedDynamicSources(createTestLayerOptions(rootDir));

		const localizedGraphHeader = loadGeneratedSource(context, "src/webviews/apps/plus/graph/graph-header.ts");
		expect(localizedGraphHeader).toBeDefined();
		expect(localizedGraphHeader!).toMatch(/<gl-tooltip placement="top" content="分支可见性">/u);
		expect(localizedGraphHeader!).toMatch(
			/<sl-option value="all" \?disabled=\$\{repo\?\.virtual\}>\s*所有分支\s*<\/sl-option>/u,
		);
		expect(localizedGraphHeader!).toMatch(/<sl-option value="current">当前分支<\/sl-option>/u);
		expect(localizedGraphHeader!).toMatch(/智能分支\s*\$\{[\s\S]*?<gl-tooltip placement="right" slot="suffix">/u);
		expect(localizedGraphHeader!).toMatch(/收藏的分支\s*<gl-tooltip placement="right" slot="suffix">/u);
		expect(localizedGraphHeader!).toMatch(
			/<span slot="content">仅显示相关分支 <br \/><br \/><i>包括当前分支、其上游以及其基础分支或目标分支<\/i><\/span>/u,
		);
		expect(localizedGraphHeader!).toMatch(
			/<span slot="content">仅显示已加星标为收藏的分支 <br \/><br \/><i>也包括当前分支<\/i><\/span>/u,
		);
	});
});

test("reports deferred runtime boundaries", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/graph/graph-wrapper/gl-graph.react.tsx",
			[
				'import React from "react";',
				"export function GraphMenu() {",
				'\treturn <button aria-label="Compose Commits...">Compose Commits...</button>;',
				"}",
				"",
			].join("\n"),
		);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/patchDetails/components/gl-patch-create.ts",
			[
				"import { html } from 'lit';",
				"export function renderPatchCreate() {",
				'\treturn html`<section><input placeholder="Title (required)" /><p>Share Patch</p></section>`;',
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));

		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		const catalog = loadWebviewsCatalog(context);
		const reconciliation = loadWebviewsReconciliationReport(context);
		const reasons = reconciliation.entries
			.map((entry) => entry.reason)
			.filter((reason): reason is string => reason != null);
		expect(
			reasons.some((reason) =>
				reason.includes("deferred patchDetails: follow-up page family deferred from current rollout"),
			),
		).toBe(true);
		expect(catalog.occurrences.some((occurrence) => occurrence.scope.startsWith("webviews.graph."))).toBe(true);
		expect(catalog.occurrences.some((occurrence) => occurrence.scope.startsWith("webviews.patchDetails."))).toBe(
			false,
		);
	});
});

test("preserves named slot subtrees", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/home/home.ts",
			[
				"import { html } from 'lit';",
				"export function renderHome(repoName) {",
				"\treturn html`",
				"\t\t<section>",
				"\t\t\t<gl-repo-button-group>",
				'\t\t\t\t<span slot="tooltip">Switch to Another Repository...<hr />${repoName}</span>',
				"\t\t\t</gl-repo-button-group>",
				"\t\t\t<gl-button>",
				"\t\t\t\tCompose Commits...",
				'\t\t\t\t<span slot="tooltip"><strong>Compose Commits</strong> (Preview)<br /><i>Automatically or interactively organize changes into meaningful commits</i></span>',
				"\t\t\t</gl-button>",
				"\t\t</section>`;",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		approveTranslations(context, {
			"Switch to Another Repository... ${slot1}": "切换到另一个仓库... ${slot1}",
			"Compose Commits...": "编排提交...",
			"Compose Commits": "编排提交",
			"${slot1} (Preview) ${slot2}": "${slot1}（预览）${slot2}",
			"Automatically or interactively organize changes into meaningful commits":
				"自动或以交互方式将更改整理为有意义的提交",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedOutputs(createTestLayerOptions(rootDir));

		const localizedHome = loadGeneratedSource(context, "src/webviews/apps/home/home.ts");
		expect(localizedHome).toBeDefined();
		expect(localizedHome!).toMatch(
			/<span slot="tooltip">\s*切换到另一个仓库\.\.\.\s*<hr \/>\s*\$\{repoName\}\s*<\/span>/u,
		);
		expect(localizedHome!).toMatch(/编排提交\.\.\.\s*<span slot="tooltip">/u);
		expect(localizedHome!).toMatch(
			/<span slot="tooltip">\s*<strong>编排提交<\/strong>（预览）<br \/>\s*<i>自动或以交互方式将更改整理为有意义的提交<\/i>\s*<\/span>/u,
		);
		expect(localizedHome!).not.toContain(">编排提交...<strong>编排提交</strong>");
	});
});

test("preserves walkthrough anchor structure", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/home/home.ts",
			[
				"import { html } from 'lit';",
				"export function renderHome(progress) {",
				"\treturn html`",
				'\t\t<gl-tooltip placement="bottom">',
				'\t\t\t<a class="walkthrough-progress" href="command:gitlens.showWelcomeView">',
				'\t\t\t\t<header class="walkthrough-progress__title">',
				"\t\t\t\t\t<span>GitLens Walkthrough (${progress.doneCount}/${progress.allCount})</span>",
				"\t\t\t\t</header>",
				'\t\t\t\t<progress class="walkthrough-progress__bar" value=${progress.progress}></progress>',
				"\t\t\t</a>",
				'\t\t\t<div slot="content">',
				"\t\t\t\t<div>Open Walkthrough</div>",
				"\t\t\t\t<hr />",
				"\t\t\t\t<p>Walkthrough Progress (${progress.doneCount}/${progress.allCount})</p>",
				"\t\t\t</div>",
				"\t\t</gl-tooltip>`;",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		approveTranslations(context, {
			"GitLens Walkthrough (${slot1}/${slot2})": "GitLens 演练 (${slot1}/${slot2})",
			"Open Walkthrough": "打开演练",
			"Walkthrough Progress (${slot1}/${slot2})": "演练进度 (${slot1}/${slot2})",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedOutputs(createTestLayerOptions(rootDir));

		const localizedHome = loadGeneratedSource(context, "src/webviews/apps/home/home.ts");
		expect(localizedHome).toBeDefined();
		expect(localizedHome!).toMatch(
			/<a class="walkthrough-progress" href="command:gitlens\.showWelcomeView">\s*<header class="walkthrough-progress__title">\s*<span>GitLens 演练 \(\$\{progress\.doneCount\}\/\$\{progress\.allCount\}\)<\/span>\s*<\/header>\s*<progress class="walkthrough-progress__bar" value=\$\{progress\.progress\}><\/progress>\s*<\/a>/u,
		);
		expect(localizedHome!).not.toContain(
			'<a class="walkthrough-progress" href="command:gitlens.showWelcomeView">GitLens 演练 (${progress.doneCount}/${progress.allCount})</a>',
		);
	});
});

test("preserves graph popover menu structure", () => {
	withTempRoot("gitlens-webview-", (rootDir) => {
		writeDefaultSettingsSource(rootDir);
		writeTextFile(
			rootDir,
			"src/webviews/apps/plus/graph/graph-header.ts",
			[
				"import { html } from 'lit';",
				"export function renderGraphHeader(config, excludeRefs) {",
				"\treturn html`",
				'\t\t<gl-button tooltip=${config?.sidebar ? "Hide Side Bar" : "Show Side Bar"}></gl-button>',
				"\t\t${(() => {",
				'\t\t\tconst label = config?.details ? "Hide Details Panel" : "Show Details Panel";',
				"\t\t\treturn html`<gl-button tooltip=${label}></gl-button>`;",
				"\t\t})()}",
				"\t\t<gl-popover>",
				'\t\t\t<gl-tooltip slot="anchor"><span slot="content">Minimap Options</span></gl-tooltip>',
				'\t\t\t<div slot="content">',
				"\t\t\t\t<menu-label>Minimap</menu-label>",
				'\t\t\t\t<menu-item role="none">',
				"\t\t\t\t\t<gl-radio-group value=${config?.minimapDataType ?? 'commits'}>",
				'\t\t\t\t\t\t<gl-radio name="minimap-datatype" value="commits"> Commits </gl-radio>',
				'\t\t\t\t\t\t<gl-radio name="minimap-datatype" value="lines"> Lines Changed </gl-radio>',
				"\t\t\t\t\t</gl-radio-group>",
				"\t\t\t\t</menu-item>",
				"\t\t\t\t<menu-divider></menu-divider>",
				"\t\t\t\t<menu-label>Markers</menu-label>",
				'\t\t\t\t<menu-item role="none">',
				'\t\t\t\t\t<gl-checkbox value="localBranches" ?checked=${true}>',
				'\t\t\t\t\t\t<span class="minimap-marker-swatch" data-marker="localBranches"></span>',
				"\t\t\t\t\t\tLocal Branches",
				"\t\t\t\t\t</gl-checkbox>",
				"\t\t\t\t</menu-item>",
				'\t\t\t\t<menu-item role="none">',
				'\t\t\t\t\t<gl-checkbox value="remoteBranches" ?checked=${true}>',
				'\t\t\t\t\t\t<span class="minimap-marker-swatch" data-marker="remoteBranches"></span>',
				"\t\t\t\t\t\tRemote Branches",
				"\t\t\t\t\t</gl-checkbox>",
				"\t\t\t\t</menu-item>",
				"\t\t\t</div>",
				"\t\t</gl-popover>",
				"\t\t<gl-popover>",
				'\t\t\t<gl-tooltip slot="anchor"><span slot="content">Hidden Branches / Tags</span></gl-tooltip>',
				'\t\t\t<div slot="content">',
				"\t\t\t\t<menu-label>Hidden Branches / Tags</menu-label>",
				"\t\t\t\t${excludeRefs?.map(ref => html`<menu-item><span>${ref.name}</span></menu-item>`)}",
				"\t\t\t\t<menu-item>Show All</menu-item>",
				"\t\t\t</div>",
				"\t\t</gl-popover>`;",
				"}",
				"",
			].join("\n"),
		);

		syncWebviewsI18n(createTestLayerOptions(rootDir));
		const context = createWebviewsDomainContext(createTestLayerOptions(rootDir));
		approveTranslations(context, {
			"Hide Side Bar": "隐藏侧边栏",
			"Show Side Bar": "显示侧边栏",
			"Hide Details Panel": "隐藏详情面板",
			"Show Details Panel": "显示详情面板",
			"Minimap Options": "迷你地图选项",
			Minimap: "迷你地图",
			Commits: "提交数",
			"Lines Changed": "更改行数",
			Markers: "标记",
			"Local Branches": "本地分支",
			"Remote Branches": "远程分支",
			"Hidden Branches / Tags": "隐藏的分支 / 标签",
			"Show All": "全部显示",
		});
		promoteWebviewsAuthority(createTestLayerOptions(rootDir));
		generateWebviewsLocalizedOutputs(createTestLayerOptions(rootDir));

		const localizedGraphHeader = loadGeneratedSource(context, "src/webviews/apps/plus/graph/graph-header.ts");
		expect(localizedGraphHeader).toBeDefined();
		expect(localizedGraphHeader!).toContain('config?.sidebar ? "隐藏侧边栏" : "显示侧边栏"');
		expect(localizedGraphHeader!).toContain('config?.details ? "隐藏详情面板" : "显示详情面板"');
		expect(localizedGraphHeader!).toMatch(/<menu-label>迷你地图<\/menu-label>/u);
		expect(localizedGraphHeader!).toMatch(
			/<gl-radio name="minimap-datatype" value="commits">\s*提交数\s*<\/gl-radio>/u,
		);
		expect(localizedGraphHeader!).toMatch(
			/<gl-radio name="minimap-datatype" value="lines">\s*更改行数\s*<\/gl-radio>/u,
		);
		expect(localizedGraphHeader!).toMatch(/<menu-label>标记<\/menu-label>/u);
		expect(localizedGraphHeader!).toMatch(
			/<gl-checkbox value="localBranches" \?checked=\$\{true\}>\s*<span class="minimap-marker-swatch" data-marker="localBranches"><\/span>\s*本地分支\s*<\/gl-checkbox>/u,
		);
		expect(localizedGraphHeader!).toMatch(
			/<gl-checkbox value="remoteBranches" \?checked=\$\{true\}>\s*<span class="minimap-marker-swatch" data-marker="remoteBranches"><\/span>\s*远程分支\s*<\/gl-checkbox>/u,
		);
		expect(localizedGraphHeader!).toMatch(/<menu-label>隐藏的分支 \/ 标签<\/menu-label>/u);
		expect(localizedGraphHeader!).toMatch(/<menu-item>全部显示<\/menu-item>/u);
		expect(localizedGraphHeader!).not.toContain(
			'<div slot="content">迷你地图 提交数 更改行数 标记 本地分支 远程分支</div>',
		);
	});
});

function writeDefaultSettingsSource(rootDir: string): void {
	writeTextFile(rootDir, "src/webviews/apps/settings/settings.ts", "export const settings = 'Settings';\n");
}

function loadGeneratedSource(
	context: ReturnType<typeof createWebviewsDomainContext>,
	relativeFile: string,
): string | undefined {
	try {
		return fs.readFileSync(path.join(context.generatedRootDir, ...relativeFile.split("/")), "utf8");
	} catch {
		return undefined;
	}
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
	writeTextFile(rootDir, "src/webviews/apps/welcome/welcome.ts", fixture.welcomeTs);
	writeTextFile(rootDir, "src/webviews/apps/welcome/components/welcome-page.ts", fixture.welcomePageTs);
	writeTextFile(rootDir, "src/webviews/apps/welcome/components/welcome-parts.ts", fixture.welcomePartsTs);

	for (const [relativePath, contents] of Object.entries(fixture.extraFiles ?? {})) {
		writeTextFile(rootDir, relativePath, contents);
	}
}

function writeTextFile(rootDir: string, relativePath: string, contents: string): void {
	const filePath = path.join(rootDir, ...relativePath.split("/"));
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, contents, "utf8");
}

function approveTranslations(
	context: ReturnType<typeof createWebviewsDomainContext>,
	translations: Record<string, string>,
): void {
	const workset = loadWebviewsWorkset(context);
	saveWebviewsWorkset(context, {
		...workset,
		entries: workset.entries.map((entry) => {
			const translation = translations[entry.source];
			return translation == null ? entry : { ...entry, status: "approved", translation: translation };
		}),
	});
}

function sleep(milliseconds: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
