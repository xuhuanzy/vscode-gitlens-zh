import { expect, test } from "vitest";
import * as ts from "typescript";

import { applyWebviewTranslations } from "../generator.mts";
import { analyzeWebviewSource } from "../sourcePlan.mts";

test("leaves source outside planned replacement ranges unchanged", () => {
	const source = [
		"import { html } from 'lit';",
		"const marker = `x`",
		'"y".trim();',
		"export function renderAction() {",
		'	return html`<button title="Open">Open</button>`;',
		"}",
		"",
	].join("\n");
	const plan = analyzeWebviewSource({
		file: "src/webviews/action.ts",
		source: source,
		syntax: "ts",
		bundle: "graph",
	});

	expect(applyWebviewTranslations(plan, new Map()).contents).toBe(source);

	const titleSite = plan.sites.find((site) => site.pattern.text === "Open" && site.role.kind === "attribute");
	if (titleSite == null) throw new Error("Expected title site");
	const localized = applyWebviewTranslations(plan, new Map([[titleSite.id, { kind: "literal", text: "打开" }]]));
	expect(localized.contents).toContain('const marker = `x`\n"y".trim();');
});

test("applies different translations to identical text at different sites", () => {
	const source = [
		"import { html } from 'lit';",
		"export function renderActions() {",
		'	return html`<button title="Open">First</button><button title="Open">Second</button>`;',
		"}",
		"",
	].join("\n");
	const plan = analyzeWebviewSource({
		file: "src/webviews/actions.ts",
		source: source,
		syntax: "ts",
		bundle: "graph",
	});
	const openSites = plan.sites.filter((site) => site.pattern.text === "Open");

	expect(openSites).toHaveLength(2);
	const localized = applyWebviewTranslations(
		plan,
		new Map([
			[openSites[0].id, { kind: "literal", text: "打开" }],
			[openSites[1].id, { kind: "literal", text: "开启" }],
		]),
	);

	expect(localized.contents).toContain('<button title="打开">First</button>');
	expect(localized.contents).toContain('<button title="开启">Second</button>');
	expect(localized.translatedCount).toBe(2);
});

test("localizes SettingsGroup type members and category values together", () => {
	const source = [
		"export type SettingsGroup = 'Views' | 'General';",
		"interface SettingsCategory { group: SettingsGroup; }",
		"export const settingsCategories: SettingsCategory[] = [",
		"\t{ group: 'Views' },",
		"\t{ group: 'General' },",
		"];",
		"",
	].join("\n");
	const plan = analyzeWebviewSource({
		file: "src/webviews/apps/settings/model.ts",
		source: source,
		syntax: "ts",
		bundle: "settings",
	});
	const translations = new Map(
		plan.sites.map((site) => [
			site.id,
			{ kind: "literal" as const, text: site.pattern.text === "Views" ? "视图" : "常规" },
		]),
	);

	const localized = applyWebviewTranslations(plan, translations);

	expect(localized.contents).toContain('export type SettingsGroup = "视图" | "常规";');
	expect(localized.contents).toContain('{ group: "视图" }');
	expect(localized.contents).toContain('{ group: "常规" }');
	expect(localized.translatedCount).toBe(4);
});

test("preserves a multiline JSX opening element after translating its last attribute", () => {
	const source = [
		"export function Action() {",
		"	const showActions = true;",
		"	return <>{showActions && (",
		"		<gl-button",
		'			aria-label="Open All Changes"',
		"		>",
		'			<code-icon icon="diff-multiple"></code-icon>',
		"		</gl-button>",
		"	)}</>;",
		"}",
		"",
	].join("\n");
	const plan = analyzeWebviewSource({
		file: "src/webviews/graph-action.tsx",
		source: source,
		syntax: "tsx",
		bundle: "graph",
	});
	const site = plan.sites.find((candidate) => candidate.pattern.text === "Open All Changes");
	if (site == null) throw new Error("Expected aria-label site");
	expect(plan.sites.filter((candidate) => candidate.pattern.text === "Open All Changes")).toHaveLength(1);

	const localized = applyWebviewTranslations(plan, new Map([[site.id, { kind: "literal", text: "打开所有更改" }]]));
	const transpiled = ts.transpileModule(localized.contents, {
		fileName: "fixture.tsx",
		compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest },
		reportDiagnostics: true,
	});

	expect(transpiled.diagnostics).toEqual([]);
	expect(localized.contents).toContain('aria-label="打开所有更改"\n\t\t>');
});
