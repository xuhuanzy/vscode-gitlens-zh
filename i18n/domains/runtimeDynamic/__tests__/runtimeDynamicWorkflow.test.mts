import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

import { createTestLayerOptions, withTempRoot } from "../../../testing/tempRoot.mts";
import {
	loadCatalog as loadRuntimeDynamicCatalog,
	loadReconciliationReport as loadRuntimeDynamicReconciliationReport,
	loadWorkset as loadRuntimeDynamicWorkset,
	saveWorkset as saveRuntimeDynamicWorkset,
} from "../../../core/store.mts";
import { createRuntimeDynamicDomainContext } from "../context.mts";
import { extractRuntimeDynamicMatches } from "../extractor.mts";
import {
	createPendingReport,
	generateRuntimeDynamicLocalizedOutputs,
	promoteRuntimeDynamicAuthority,
	syncRuntimeDynamicI18n,
} from "../workflow.mts";

test("localizes webview host registration titles", () => {
	withTempRoot("gitlens-runtime-webview-host-", (rootDir) => {
		writeFile(
			rootDir,
			"src/webviews/home/registration.ts",
			[
				"export function registerHomeWebviewView(controller: { registerWebviewView: (...args: unknown[]) => unknown }) {",
				"\treturn controller.registerWebviewView(",
				"\t\t{",
				"\t\t\tid: 'gitlens.views.home',",
				"\t\t\tfileName: 'home.html',",
				"\t\t\ttitle: 'Home',",
				"\t\t},",
				"\t\tasync () => undefined,",
				"\t);",
				"}",
				"",
			].join("\n"),
		);

		const result = syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "webviewHost" });
		expect(result.occurrenceCount).toBe(1);

		const context = createRuntimeDynamicDomainContext("webviewHost", createTestLayerOptions(rootDir));
		const catalog = loadRuntimeDynamicCatalog(context);
		const workset = loadRuntimeDynamicWorkset(context);
		expect(catalog.domain).toBe("webviews");
		expect(workset.entries.some((entry) => entry.source === "Home")).toBe(true);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) =>
				entry.source === "Home" ? { ...entry, status: "approved", translation: "主页" } : entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "webviewHost" });
		expect(promoted.promoted.length).toBe(1);

		const generated = generateRuntimeDynamicLocalizedOutputs({
			...createTestLayerOptions(rootDir),
			domain: "webviewHost",
		});
		expect(generated.translatedCount).toBe(1);

		const localized = loadLocalizedRuntimeDynamicSource(context, "src/webviews/home/registration.ts");
		expect(localized).toBeDefined();
		expect(localized!).toContain("title: '主页'");
		expect(fs.readFileSync(path.join(rootDir, "src", "webviews", "home", "registration.ts"), "utf8")).toContain(
			"title: 'Home'",
		);
	});
});

test("stores webview host entries with webviews files", () => {
	withTempRoot("gitlens-runtime-webview-host-shared-webviews-files-", (rootDir) => {
		writeFile(
			rootDir,
			"src/webviews/home/registration.ts",
			[
				"export function registerHomeWebviewView(controller: { registerWebviewView: (...args: unknown[]) => unknown }) {",
				"\treturn controller.registerWebviewView(",
				"\t\t{",
				"\t\t\tid: 'gitlens.views.home',",
				"\t\t\tfileName: 'home.html',",
				"\t\t\ttitle: 'Home',",
				"\t\t},",
				"\t\tasync () => undefined,",
				"\t);",
				"}",
				"",
			].join("\n"),
		);

		const context = createRuntimeDynamicDomainContext("webviewHost", createTestLayerOptions(rootDir));
		expect(path.basename(context.catalogFile)).toBe("webviews.catalog.json");
		expect(path.basename(context.worksetFile)).toBe("webviews.zh-cn.json");

		fs.mkdirSync(path.dirname(context.catalogFile), { recursive: true });
		fs.writeFileSync(
			context.catalogFile,
			JSON.stringify(
				{
					$schema: "../schemas/sourceCatalog.schema.json",
					version: 3,
					domain: "webviews",
					generatedAt: new Date(0).toISOString(),
					occurrences: [
						{
							id: "webviews:webviews.home.home.lit-template-1-root.text.123#text",
							domain: "webviews",
							scope: "webviews.home",
							anchor: "webviews.home.home.lit-template-1-root.text.123",
							slot: "text",
							authorityId: "message.webviews-only",
							pattern: {
								kind: "literal",
								text: "Webview Only",
							},
							reference: {
								kind: "source",
								file: "src/webviews/apps/home/home.ts",
								syntax: "ts",
								start: { line: 1, column: 1 },
								end: { line: 1, column: 13 },
							},
							output: {
								kind: "runtime-key",
								bundle: "home",
								key: "home.lit-template-1-root.text.123",
							},
						},
					],
				},
				undefined,
				"\t",
			),
			"utf8",
		);
		fs.mkdirSync(path.dirname(context.worksetFile), { recursive: true });
		fs.writeFileSync(
			context.worksetFile,
			JSON.stringify(
				{
					$schema: "../schemas/translationWorkset.schema.json",
					version: 2,
					locale: "zh-cn",
					domain: "webviews",
					generatedAt: new Date(0).toISOString(),
					entries: [
						{
							id: "message.webviews-only",
							kind: "literal",
							source: "Webview Only",
							translation: null,
							sourceHash: "hash-webviews-only",
							occurrenceIds: ["webviews:webviews.home.home.lit-template-1-root.text.123#text"],
							status: "pending",
						},
					],
				},
				undefined,
				"\t",
			),
			"utf8",
		);

		const result = syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "webviewHost" });
		expect(result.worksetCount).toBe(1);

		const catalog = loadRuntimeDynamicCatalog(context);
		expect(catalog.domain).toBe("webviews");
		expect(catalog.occurrences.some((occurrence) => occurrence.pattern.text === "Webview Only")).toBe(true);
		expect(catalog.occurrences.some((occurrence) => occurrence.pattern.text === "Home")).toBe(true);
		expect(fs.existsSync(path.join(rootDir, "i18n", "catalog", "webviewHost.catalog.json"))).toBe(false);

		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.domain).toBe("webviews");
		expect(workset.entries.some((entry) => entry.id === "message.webviews-only")).toBe(true);
		expect(workset.entries.some((entry) => entry.source === "Home")).toBe(true);
		expect(fs.existsSync(path.join(rootDir, "i18n", "worksets", "webviewHost.zh-cn.json"))).toBe(false);
	});
});

test("extracts low-level QuickPick strings", () => {
	withTempRoot("gitlens-runtime-quickpicks-", (rootDir) => {
		writeFile(
			rootDir,
			"src/quickpicks/items/directive.ts",
			[
				"import { QuickPickItemKind } from 'vscode';",
				"export function createDirectiveQuickPickItem(kind: string) {",
				"\tlet label;",
				"\tlet detail;",
				"\tif (kind === 'trial') {",
				"\t\tlabel = 'Try GitLens Pro';",
				"\t\tdetail = 'Get 7 days of GitLens Pro for free';",
				"\t} else {",
				"\t\tlabel = 'Back';",
				"\t}",
				"\treturn { label, detail, kind: QuickPickItemKind.Default };",
				"}",
				"",
			].join("\n"),
		);

		const result = syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(result.occurrenceCount).toBe(3);

		const context = createRuntimeDynamicDomainContext("quickpicks", createTestLayerOptions(rootDir));
		const catalog = loadRuntimeDynamicCatalog(context);
		const workset = loadRuntimeDynamicWorkset(context);
		expect(catalog.domain).toBe("quickpicks");
		expect(workset.entries.some((entry) => entry.source === "Try GitLens Pro")).toBe(true);
		expect(workset.entries.some((entry) => entry.source === "Get 7 days of GitLens Pro for free")).toBe(true);
		expect(workset.entries.some((entry) => entry.source === "Back")).toBe(true);

		const report = createPendingReport({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(report.domain).toBe("quickpicks");
	});
});

test("localizes QuickPick template labels with placeholders", () => {
	withTempRoot("gitlens-runtime-quickpicks-template-", (rootDir) => {
		writeFile(
			rootDir,
			"src/quickpicks/remoteProviderPicker.ts",
			[
				"export function createCopyItem(resourceName: string, providerName: string) {",
				"\tconst label = `Copy Link to ${resourceName} for ${providerName}`;",
				"\treturn { label };",
				"}",
				"",
			].join("\n"),
		);

		const result = syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(result.occurrenceCount).toBe(1);

		const context = createRuntimeDynamicDomainContext("quickpicks", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "Copy Link to ${slot1} for ${slot2}")).toBe(true);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) =>
				entry.source === "Copy Link to ${slot1} for ${slot2}"
					? { ...entry, status: "approved", translation: "复制 ${slot2} 的${slot1}链接" }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(promoted.promoted.length).toBe(1);

		const generated = generateRuntimeDynamicLocalizedOutputs({
			...createTestLayerOptions(rootDir),
			domain: "quickpicks",
		});
		expect(generated.translatedCount).toBe(1);

		const localized = loadLocalizedRuntimeDynamicSource(context, "src/quickpicks/remoteProviderPicker.ts");
		expect(localized).toBeDefined();
		expect(localized!).toContain("const label = `复制 ${providerName} 的${resourceName}链接`;");
	});
});

test("localizes QuickPick nullish assignments", () => {
	withTempRoot("gitlens-runtime-quickpicks-nullish-", (rootDir) => {
		writeFile(
			rootDir,
			"src/quickpicks/items/directive.ts",
			[
				"export function createDirectiveQuickPickItem(detail?: string) {",
				"\tlet description;",
				"\tdescription ??= 'GitLens Pro is required to use this feature';",
				"\treturn { description, detail };",
				"}",
				"",
			].join("\n"),
		);

		const result = syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(result.occurrenceCount).toBe(1);

		const context = createRuntimeDynamicDomainContext("quickpicks", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "GitLens Pro is required to use this feature")).toBe(
			true,
		);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) =>
				entry.source === "GitLens Pro is required to use this feature"
					? { ...entry, status: "approved", translation: "需要 GitLens Pro 才能使用此功能" }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(promoted.promoted.length).toBe(1);

		const generated = generateRuntimeDynamicLocalizedOutputs({
			...createTestLayerOptions(rootDir),
			domain: "quickpicks",
		});
		expect(generated.translatedCount).toBe(1);

		const localized = loadLocalizedRuntimeDynamicSource(context, "src/quickpicks/items/directive.ts");
		expect(localized).toBeDefined();
		expect(localized!).toContain("description ??= '需要 GitLens Pro 才能使用此功能';");
	});
});

test("defers pluralized QuickPick template slots", () => {
	const source = [
		"import { pluralize } from '@gitlens/utils/string';",
		"export function createDirectiveQuickPickItem(proTrialLengthInDays: number) {",
		"\tconst detail = `Get ${pluralize('day', proTrialLengthInDays)} of GitLens Pro for free — no credit card required.`;",
		"\treturn { detail };",
		"}",
		"",
	].join("\n");

	const extraction = extractRuntimeDynamicMatches({
		domain: "quickpicks",
		group: "items",
		file: "src/quickpicks/items/directive.ts",
		source: source,
		syntax: "ts",
	});
	expect(extraction.matches.length).toBe(0);
	expect(extraction.issues.length).toBe(1);
	expect(extraction.issues[0].reason).toContain("requires pluralization modeling");

	withTempRoot("gitlens-runtime-quickpicks-pluralized-", (rootDir) => {
		writeFile(rootDir, "src/quickpicks/items/directive.ts", source);
		syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });

		const context = createRuntimeDynamicDomainContext("quickpicks", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.length).toBe(0);

		const reconciliation = loadRuntimeDynamicReconciliationReport(context);
		expect(reconciliation.summary.ambiguous).toBe(1);
		expect(reconciliation.entries.some((entry) => entry.reason?.includes("requires pluralization modeling"))).toBe(
			true,
		);
	});
});

test("extracts QuickPick separator labels", () => {
	withTempRoot("gitlens-runtime-quickpick-separator-", (rootDir) => {
		writeFile(
			rootDir,
			"src/commands/quick-wizard/steps/commits.ts",
			[
				"export function createQuickPickSeparator(label?: string) {",
				"\treturn { label };",
				"}",
				"export function getItems() {",
				"\treturn [createQuickPickSeparator('Actions')];",
				"}",
				"",
			].join("\n"),
		);

		const result = syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(result.occurrenceCount).toBe(1);

		const context = createRuntimeDynamicDomainContext("quickpicks", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "Actions")).toBe(true);
	});
});

test("localizes QuickWizard constructor labels with placeholders", () => {
	withTempRoot("gitlens-runtime-quickwizard-", (rootDir) => {
		writeFile(
			rootDir,
			"src/commands/quick-wizard/steps/commits.ts",
			[
				"export class GitWizardQuickPickItem {",
				"\tconstructor(readonly label: string, readonly options: object) {}",
				"}",
				"export function getItems(branchName: string) {",
				"\treturn [new GitWizardQuickPickItem(`Reset ${branchName ?? 'Current Branch'} to Commit...`, { command: 'reset' })];",
				"}",
				"",
			].join("\n"),
		);

		const result = syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(result.occurrenceCount).toBe(1);

		const context = createRuntimeDynamicDomainContext("quickpicks", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "Reset ${slot1} to Commit...")).toBe(true);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) =>
				entry.source === "Reset ${slot1} to Commit..."
					? { ...entry, status: "approved", translation: "将 ${slot1} 重置到提交..." }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(promoted.promoted.length).toBe(1);

		const generated = generateRuntimeDynamicLocalizedOutputs({
			...createTestLayerOptions(rootDir),
			domain: "quickpicks",
		});
		expect(generated.translatedCount).toBe(1);

		const localized = loadLocalizedRuntimeDynamicSource(context, "src/commands/quick-wizard/steps/commits.ts");
		expect(localized).toBeDefined();
		expect(localized!).toContain(
			"new GitWizardQuickPickItem(`将 ${branchName ?? 'Current Branch'} 重置到提交...`,",
		);
	});
});

test("localizes QuickWizard fallback and hint strings", () => {
	withTempRoot("gitlens-runtime-quickwizard-fallbacks-", (rootDir) => {
		writeFile(
			rootDir,
			"src/commands/quick-wizard/steps/commits.ts",
			[
				"export function createQuickPickSeparator(label?: string) {",
				"\treturn { label };",
				"}",
				"export class GitWizardQuickPickItem {",
				"\tconstructor(readonly label: string, readonly options: object) {}",
				"}",
				"export function getItems(branchName: string | undefined, providerName: string | undefined, isStash: boolean) {",
				"\treturn [",
				"\t\t{ hint: `Click to see ${isStash ? 'stash' : 'commit'} actions` },",
				"\t\t{ hint: 'Click to see all changed files' },",
				"\t\tcreateQuickPickSeparator(providerName ?? 'Remote'),",
				"\t\tnew GitWizardQuickPickItem(`Reset ${branchName ?? 'Current Branch'} to Commit...`, { command: 'reset' }),",
				"\t];",
				"}",
				"",
			].join("\n"),
		);
		writeFile(
			rootDir,
			"src/quickpicks/items/commits.ts",
			[
				"export class CommandQuickPickItem {",
				"\tconstructor(readonly label: string) {}",
				"}",
				"export class CommitBrowseRepositoryFromHereCommandQuickPickItem extends CommandQuickPickItem {",
				"\tconstructor(private readonly executeOptions?: { before?: boolean; openInNewWindow: boolean }) {",
				"\t\tsuper(`Browse Repository from${executeOptions?.before ? ' Before' : ''} Here${executeOptions?.openInNewWindow ? ' in New Window' : ''}`);",
				"\t}",
				"}",
				"",
			].join("\n"),
		);

		syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		writeFile(
			rootDir,
			"i18n/authority/zh-cn/terms.json",
			JSON.stringify(
				{
					$schema: "../../schemas/authority.schema.json",
					version: 2,
					kind: "terms",
					locale: "zh-cn",
					updatedAt: new Date(0).toISOString(),
					entries: [
						{ source: " Before", translation: "之前", updatedAt: new Date(0).toISOString() },
						{
							source: " in New Window",
							translation: "（在新窗口中）",
							updatedAt: new Date(0).toISOString(),
						},
						{ source: "commit", translation: "提交", updatedAt: new Date(0).toISOString() },
						{ source: "Current Branch", translation: "当前分支", updatedAt: new Date(0).toISOString() },
						{ source: "stash", translation: "贮藏", updatedAt: new Date(0).toISOString() },
					],
				},
				undefined,
				"\t",
			),
		);

		const context = createRuntimeDynamicDomainContext("quickpicks", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) => {
				switch (entry.source) {
					case "Browse Repository from${slot1} Here${slot2}":
						return { ...entry, status: "approved", translation: "浏览此处${slot1}的仓库${slot2}" };
					case "Click to see ${slot1} actions":
						return { ...entry, status: "approved", translation: "点击查看 ${slot1} 操作" };
					case "Click to see all changed files":
						return { ...entry, status: "approved", translation: "点击查看所有更改的文件" };
					case "Remote":
						return { ...entry, status: "approved", translation: "远程" };
					case "Reset ${slot1} to Commit...":
						return { ...entry, status: "approved", translation: "将 ${slot1} 重置到提交..." };
					default:
						return entry;
				}
			}),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(promoted.promoted.length).toBe(5);

		generateRuntimeDynamicLocalizedOutputs({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		const localizedWizard = loadLocalizedRuntimeDynamicSource(
			context,
			"src/commands/quick-wizard/steps/commits.ts",
		);
		const localizedCommitItems = loadLocalizedRuntimeDynamicSource(context, "src/quickpicks/items/commits.ts");
		expect(localizedWizard).toBeDefined();
		expect(localizedCommitItems).toBeDefined();
		expect(localizedWizard!).toContain("`点击查看 ${isStash ? '贮藏' : '提交'} 操作`");
		expect(localizedWizard!).toContain("{ hint: '点击查看所有更改的文件' }");
		expect(localizedWizard!).toContain("createQuickPickSeparator(providerName ?? '远程')");
		expect(localizedWizard!).toContain("`将 ${branchName ?? '当前分支'} 重置到提交...`");
		expect(localizedCommitItems!).toContain(
			"`浏览此处${executeOptions?.before ? '之前' : ''}的仓库${executeOptions?.openInNewWindow ? '（在新窗口中）' : ''}`",
		);
	});
});

test("localizes QuickCommand confirmation titles", () => {
	withTempRoot("gitlens-runtime-quick-command-confirm-", (rootDir) => {
		writeFile(
			rootDir,
			"src/commands/git/reset.ts",
			[
				"export class QuickCommand<State> {",
				"\tconstructor(container: unknown, key: string, label: string, title: string) {}",
				"}",
				"export function appendReposToTitle(title: string, state: unknown, context: unknown): string {",
				"\treturn title;",
				"}",
				"interface State {}",
				"export class ResetGitCommand extends QuickCommand<State> {",
				"\tconstructor(container: unknown) {",
				"\t\tsuper(container, 'reset', 'reset', 'Reset');",
				"\t}",
				"\tconfirmStep(state: unknown, context: { title: string }) {",
				"\t\treturn appendReposToTitle(`Confirm ${context.title}`, state, context);",
				"\t}",
				"}",
				"",
			].join("\n"),
		);

		const result = syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(result.occurrenceCount).toBe(2);

		const context = createRuntimeDynamicDomainContext("quickpicks", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "Reset")).toBe(true);
		expect(workset.entries.some((entry) => entry.source === "Confirm ${slot1}")).toBe(true);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) => {
				switch (entry.source) {
					case "Reset":
						return { ...entry, status: "approved", translation: "重置" };
					case "Confirm ${slot1}":
						return { ...entry, status: "approved", translation: "确认${slot1}" };
					default:
						return entry;
				}
			}),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "quickpicks" });
		expect(promoted.promoted.length).toBe(2);

		const generated = generateRuntimeDynamicLocalizedOutputs({
			...createTestLayerOptions(rootDir),
			domain: "quickpicks",
		});
		expect(generated.translatedCount).toBe(2);

		const localized = loadLocalizedRuntimeDynamicSource(context, "src/commands/git/reset.ts");
		expect(localized).toBeDefined();
		expect(localized!).toContain("super(container, 'reset', 'reset', '重置');");
		expect(localized!).toContain("return appendReposToTitle(`确认${context.title}`, state, context);");
	});
});

test("localizes formatter Markdown titles without changing command syntax", () => {
	withTempRoot("gitlens-runtime-formatter-", (rootDir) => {
		const fixture = [
			"export function commands(link: string) {",
			'\treturn `[$(eye)](${link} "Inspect Commit Details")`;',
			"}",
			"",
		].join("\n");
		writeFile(rootDir, "src/git/formatters/commitFormatter.ts", fixture);

		syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "formatter" });

		const context = createRuntimeDynamicDomainContext("formatter", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "Inspect Commit Details")).toBe(true);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) =>
				entry.source === "Inspect Commit Details"
					? { ...entry, status: "approved", translation: "检查提交详情" }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "formatter" });
		expect(promoted.promoted.length).toBe(1);

		const generated = generateRuntimeDynamicLocalizedOutputs({
			...createTestLayerOptions(rootDir),
			domain: "formatter",
		});
		expect(generated.translatedCount).toBe(1);

		const localized = loadLocalizedRuntimeDynamicSource(context, "src/git/formatters/commitFormatter.ts");
		expect(localized).toBeDefined();
		expect(localized!).toContain('[$(eye)](${link} "检查提交详情")');
		expect(localized!).toContain("[$(eye)](${link}");
	});
});

test("localizes dynamic formatter Markdown titles", () => {
	withTempRoot("gitlens-runtime-formatter-dynamic-", (rootDir) => {
		const fixture = [
			"export function commands(link: string, provider: string) {",
			'\treturn `[$(globe)](${link} "Open Commit on ${provider}")`;',
			"}",
			"",
		].join("\n");
		writeFile(rootDir, "src/git/formatters/commitFormatter.ts", fixture);

		syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "formatter" });

		const context = createRuntimeDynamicDomainContext("formatter", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "Open Commit on ${slot1}")).toBe(true);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) =>
				entry.source === "Open Commit on ${slot1}"
					? { ...entry, status: "approved", translation: "在 ${slot1} 上打开提交" }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "formatter" });
		expect(promoted.promoted.length).toBe(1);

		const generated = generateRuntimeDynamicLocalizedOutputs({
			...createTestLayerOptions(rootDir),
			domain: "formatter",
		});
		expect(generated.translatedCount).toBe(1);

		const localized = loadLocalizedRuntimeDynamicSource(context, "src/git/formatters/commitFormatter.ts");
		expect(localized).toBeDefined();
		expect(localized!).toContain('[$(globe)](${link} "在 ${provider} 上打开提交")');
		expect(localized!).toContain("${link}");
	});
});

test("localizes formatter Markdown labels without changing command syntax", () => {
	withTempRoot("gitlens-runtime-formatter-label-", (rootDir) => {
		const fixture = [
			"export function commands(link: string) {",
			'\treturn `[$(sparkle) Explain](${link} "Explain Changes")`;',
			"}",
			"",
		].join("\n");
		writeFile(rootDir, "src/git/formatters/commitFormatter.ts", fixture);

		syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "formatter" });

		const context = createRuntimeDynamicDomainContext("formatter", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "Explain")).toBe(true);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) =>
				entry.source === "Explain" ? { ...entry, status: "approved", translation: "解释" } : entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "formatter" });
		expect(promoted.promoted.length).toBe(1);

		const generated = generateRuntimeDynamicLocalizedOutputs({
			...createTestLayerOptions(rootDir),
			domain: "formatter",
		});
		expect(generated.translatedCount).toBe(1);

		const localized = loadLocalizedRuntimeDynamicSource(context, "src/git/formatters/commitFormatter.ts");
		expect(localized).toBeDefined();
		expect(localized!).toContain('[$(sparkle) 解释](${link} "Explain Changes")');
		expect(localized!).toContain("${link}");
	});
});

test("localizes dynamic formatter Markdown labels and multiline titles", () => {
	withTempRoot("gitlens-runtime-formatter-dynamic-label-", (rootDir) => {
		const fixture = [
			"export function commands(link: string, remote: { provider: { name: string } }) {",
			"\treturn `[$(plug) Connect to ${remote?.provider.name}${",
			"\t\tGlyphChars.Ellipsis",
			'\t}](${link} "Connect to ${',
			"\t\tremote.provider.name",
			'\t} to enable the display of the Pull Request (if any) that introduced this commit")`;',
			"}",
			"",
		].join("\n");
		writeFile(rootDir, "src/git/formatters/commitFormatter.ts", fixture);

		syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "formatter" });

		const context = createRuntimeDynamicDomainContext("formatter", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "Connect to ${slot1}${slot2}")).toBe(true);
		expect(
			workset.entries.some(
				(entry) =>
					entry.source ===
					"Connect to ${slot1} to enable the display of the Pull Request (if any) that introduced this commit",
			),
		).toBe(true);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) => {
				switch (entry.source) {
					case "Connect to ${slot1}${slot2}":
						return { ...entry, status: "approved", translation: "连接到 ${slot1}${slot2}" };
					case "Connect to ${slot1} to enable the display of the Pull Request (if any) that introduced this commit":
						return {
							...entry,
							status: "approved",
							translation: "连接到 ${slot1} 以显示引入此提交的拉取请求（如果有）",
						};
					default:
						return entry;
				}
			}),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "formatter" });
		expect(promoted.promoted.length).toBe(2);

		const generated = generateRuntimeDynamicLocalizedOutputs({
			...createTestLayerOptions(rootDir),
			domain: "formatter",
		});
		expect(generated.translatedCount).toBe(2);

		const localized = loadLocalizedRuntimeDynamicSource(context, "src/git/formatters/commitFormatter.ts");
		expect(localized).toBeDefined();
		expect(localized!).toContain("[$(plug) 连接到 ${remote?.provider.name}${\n\t\tGlyphChars.Ellipsis\n\t}]");
		expect(localized!).toContain('"连接到 ${\n\t\tremote.provider.name\n\t} 以显示引入此提交的拉取请求（如果有）"');
		expect(localized!).toContain("${link}");
	});
});

test("localizes formatter HTML titles without changing element syntax", () => {
	withTempRoot("gitlens-runtime-formatter-html-", (rootDir) => {
		const fixture = [
			"export function commands(link: string, label: string) {",
			'\treturn `<a href="${link}" title="Inspect Commit Details" class="command">${label}</a>`;',
			"}",
			"",
		].join("\n");
		writeFile(rootDir, "src/git/formatters/commitFormatter.ts", fixture);

		syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "formatter" });

		const context = createRuntimeDynamicDomainContext("formatter", createTestLayerOptions(rootDir));
		const workset = loadRuntimeDynamicWorkset(context);
		expect(workset.entries.some((entry) => entry.source === "Inspect Commit Details")).toBe(true);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) =>
				entry.source === "Inspect Commit Details"
					? { ...entry, status: "approved", translation: "检查提交详情" }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ ...createTestLayerOptions(rootDir), domain: "formatter" });
		expect(promoted.promoted.length).toBe(1);

		const generated = generateRuntimeDynamicLocalizedOutputs({
			...createTestLayerOptions(rootDir),
			domain: "formatter",
		});
		expect(generated.translatedCount).toBe(1);

		const localized = loadLocalizedRuntimeDynamicSource(context, "src/git/formatters/commitFormatter.ts");
		expect(localized).toBeDefined();
		expect(localized!).toContain('href="${link}" title="检查提交详情" class="command"');
		expect(localized!).toContain("${label}</a>");
	});
});

test("does not extract formatter HTML wrapper templates", () => {
	const source = [
		"export function formatMessage(message: string, classes?: string) {",
		"\tmessage = `<span ${classes}>${message}</span>`;",
		"\treturn message;",
		"}",
		"",
	].join("\n");

	const extraction = extractRuntimeDynamicMatches({
		domain: "formatter",
		group: "commitFormatter",
		file: "src/git/formatters/commitFormatter.ts",
		source: source,
		syntax: "ts",
	});
	expect(extraction.matches.length).toBe(0);
	expect(extraction.issues.length).toBe(0);
});

test("defers dynamic Markdown titles", () => {
	const source = [
		"export function commands(link: string, provider: string, title: string) {",
		'\treturn `[$(git-pull-request)](${link} "Open Pull Request #${provider}\\n--\\n${title}")`;',
		"}",
		"",
	].join("\n");

	const extraction = extractRuntimeDynamicMatches({
		domain: "formatter",
		group: "commitFormatter",
		file: "src/git/formatters/commitFormatter.ts",
		source: source,
		syntax: "ts",
	});
	expect(extraction.matches.length).toBe(0);
	expect(extraction.issues.length).toBe(1);
	expect(extraction.issues[0].reason).toContain("dynamic markdown title");

	withTempRoot("gitlens-runtime-formatter-deferred-", (rootDir) => {
		writeFile(rootDir, "src/git/formatters/commitFormatter.ts", source);
		syncRuntimeDynamicI18n({ ...createTestLayerOptions(rootDir), domain: "formatter" });

		const context = createRuntimeDynamicDomainContext("formatter", createTestLayerOptions(rootDir));
		const reconciliation = loadRuntimeDynamicReconciliationReport(context);
		expect(reconciliation.summary.ambiguous).toBe(1);
		expect(reconciliation.entries.some((entry) => entry.reason?.includes("dynamic markdown title"))).toBe(true);
	});
});

function writeFile(rootDir: string, relativePath: string, contents: string): void {
	const filePath = path.join(rootDir, ...relativePath.split("/"));
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, contents, "utf8");
}

function loadLocalizedRuntimeDynamicSource(
	context: ReturnType<typeof createRuntimeDynamicDomainContext>,
	relativePath: string,
): string | undefined {
	const filePath = path.join(context.generatedRootDir, ...relativePath.split("/"));
	return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : undefined;
}
