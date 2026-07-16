import { expect, test } from "vitest";

import { analyzeWebviewSource } from "../sourcePlan.mts";

test("plans Lit content and attributes with position-independent identities", () => {
	const source = [
		"import { html } from 'lit';",
		"export class GraphHeader {",
		"	renderTitlebar() {",
		'		return html`<gl-button tooltip="Show Side Bar">Open Graph</gl-button>`;',
		"\t}",
		"}",
		"",
	].join("\n");
	const input = {
		file: "src/webviews/apps/plus/graph/graph-header.ts",
		source: source,
		syntax: "ts" as const,
		bundle: "graph",
	};

	const plan = analyzeWebviewSource(input);
	const movedPlan = analyzeWebviewSource({ ...input, source: `\n\n${source}` });

	expect(
		plan.sites.map((site) => ({
			text: site.pattern.text,
			role: site.role,
			replacement: site.replacement.kind,
		})),
	).toEqual([
		{
			text: "Open Graph",
			role: { kind: "content" },
			replacement: "lit-template",
		},
		{
			text: "Show Side Bar",
			role: { kind: "attribute", name: "tooltip", tag: "gl-button", binding: "attribute" },
			replacement: "lit-template",
		},
	]);
	expect(movedPlan.sites.map((site) => site.id)).toEqual(plan.sites.map((site) => site.id));
	expect(plan.issues).toEqual([]);
});

test("plans Lit display expressions and rejects structural bindings", () => {
	const source = [
		"import { html } from 'lit';",
		"export function renderGraph(active: boolean) {",
		"	return html`",
		'		<gl-button tooltip=${active ? "Hide Side Bar" : "Show Side Bar"}>',
		'			${active ? "Hide Panel" : "Show Panel"}',
		"		</gl-button>",
		'		<gl-button .tooltip=${active ? "Property On" : "Property Off"}></gl-button>',
		'		<input ?disabled=${active ? "Disabled" : "Enabled"} @click=${() => "Clicked"} />',
		"	`;",
		"}",
		"",
	].join("\n");

	const plan = analyzeWebviewSource({
		file: "src/webviews/apps/plus/graph/graph.ts",
		source: source,
		syntax: "ts",
		bundle: "graph",
	});

	expect(plan.sites.map((site) => [site.pattern.text, site.role])).toEqual([
		["Hide Side Bar", { kind: "attribute", name: "tooltip", tag: "gl-button", binding: "attribute" }],
		["Show Side Bar", { kind: "attribute", name: "tooltip", tag: "gl-button", binding: "attribute" }],
		["Hide Panel", { kind: "content" }],
		["Show Panel", { kind: "content" }],
	]);
});

test("reports unsupported Lit display bindings as plan issues", () => {
	const source = [
		"import { html } from 'lit';",
		"export function renderGraph(active: boolean) {",
		'	return html`<gl-button .tooltip=${active ? "Property On" : "Property Off"}></gl-button>`;',
		"}",
		"",
	].join("\n");
	const plan = analyzeWebviewSource({
		file: "src/webviews/apps/plus/graph/graph.ts",
		source: source,
		syntax: "ts",
		bundle: "graph",
	});

	expect(plan.sites).toEqual([]);
	expect(plan.issues).toHaveLength(2);
	expect(
		plan.issues.every((issue) => issue.reference?.kind === "source" && issue.reference.attribute === "tooltip"),
	).toBe(true);
	expect(plan.issues.map((issue) => issue.reason)).toEqual([
		"deferred webview property binding 'tooltip': Property On",
		"deferred webview property binding 'tooltip': Property Off",
	]);
});

test("plans JSX display text and attributes", () => {
	const source = [
		"export function GraphAction({ active }: { active: boolean }) {",
		'	return <button className="action" aria-label="Compose Commits">',
		"		Ready to compose",
		'		{active ? "Hide Panel" : "Show Panel"}',
		"	</button>;",
		"}",
		"",
	].join("\n");

	const plan = analyzeWebviewSource({
		file: "src/webviews/apps/plus/graph/GraphAction.tsx",
		source: source,
		syntax: "tsx",
		bundle: "graph",
	});

	expect(plan.sites.map((site) => [site.pattern.text, site.role])).toEqual([
		["Compose Commits", { kind: "attribute", name: "aria-label", tag: "button", binding: "attribute" }],
		["Ready to compose", { kind: "content" }],
		["Hide Panel", { kind: "content" }],
		["Show Panel", { kind: "content" }],
	]);
});

test("plans imperative display flows and rejects runtime discriminants", () => {
	const source = [
		"import { html } from 'lit';",
		"function selectMode(mode: 'compact' | 'expanded') { return mode; }",
		"export class GraphSearch {",
		'	placeholder = "Search commits";',
		"	title = `Open ${repoName}`;",
		"	render(active: boolean, state: string) {",
		'		const label = active ? "Hide Details Panel" : "Show Details Panel";',
		'		const command = "gitlens.openGraph";',
		'		const style = "graph-toolbar";',
		'		selectMode(active ? "compact" : "expanded");',
		"		switch (state) {",
		'			case "open": break;',
		"		}",
		'		if (state === "closed") return html`<gl-button tooltip=${label}></gl-button>`;',
		"		return html`<gl-button tooltip=${label}></gl-button>`;",
		"	}",
		"}",
		"",
	].join("\n");

	const plan = analyzeWebviewSource({
		file: "src/webviews/apps/plus/graph/graph-search.ts",
		source: source,
		syntax: "ts",
		bundle: "graph",
	});

	expect(plan.sites.map((site) => [site.pattern.text, site.role])).toEqual([
		["Search commits", { kind: "imperative", target: "placeholder" }],
		["Open ${slot1}", { kind: "imperative", target: "title" }],
		["Hide Details Panel", { kind: "imperative", target: "label" }],
		["Show Details Panel", { kind: "imperative", target: "label" }],
	]);
});

test("plans display variables inside nested Lit producers", () => {
	const source = [
		"import { html } from 'lit';",
		"export function renderHeader(config: { details: boolean }) {",
		"	return html`${(() => {",
		'		const label = config.details ? "Hide Details Panel" : "Show Details Panel";',
		"		return html`<gl-button tooltip=${label}></gl-button>`;",
		"	})()}`;",
		"}",
		"",
	].join("\n");

	const plan = analyzeWebviewSource({
		file: "src/webviews/apps/plus/graph/graph-header.ts",
		source: source,
		syntax: "ts",
		bundle: "graph",
	});

	expect(plan.sites.map((site) => site.pattern.text)).toEqual(["Hide Details Panel", "Show Details Panel"]);
});

test("plans imperative display assignments and setAttribute calls", () => {
	const source = [
		"export function updateDisplay(element: HTMLElement) {",
		'	element.setAttribute("aria-label", "Open Details");',
		'	element.title = "Show Details";',
		'	element.validityMessage = "Commit message is required.";',
		"}",
		"",
	].join("\n");
	const plan = analyzeWebviewSource({
		file: "src/webviews/apps/shared/update-display.ts",
		source: source,
		syntax: "ts",
		bundle: "graph",
	});

	expect(plan.sites.map((site) => [site.pattern.text, site.role])).toEqual([
		["Open Details", { kind: "imperative", target: "label" }],
		["Show Details", { kind: "imperative", target: "title" }],
		["Commit message is required.", { kind: "imperative", target: "message" }],
	]);
});

test("plans declarative settings category display text including group values", () => {
	const source = [
		"import type { SettingsCategory } from '../model.js';",
		"export const viewsCategories: SettingsCategory[] = [",
		"\t{",
		"\t\tid: 'search-compare-view',",
		"\t\tsettingsSearch: 'gitlens.views.searchAndCompare or gitlens.views',",
		"\t\tname: 'Search & Compare view',",
		"\t\tgroup: 'Views',",
		"\t\thint: 'Adds a Search & Compare view to search and explore commit histories',",
		"\t\ticon: 'gl-search-view',",
		"\t\tcontrols: [",
		"\t\t\t{",
		"\t\t\t\tkind: 'select',",
		"\t\t\t\tkey: 'views.searchAndCompare.files.layout',",
		"\t\t\t\tlabel: 'File layout',",
		"\t\t\t\toptions: [",
		"\t\t\t\t\t{ value: 'auto', label: 'automatically' },",
		"\t\t\t\t\t{ value: 'list', label: 'as a list' },",
		"\t\t\t\t],",
		"\t\t\t},",
		"\t\t\t{ kind: 'text', key: 'views.worktrees.defaultLocation', label: 'Location', placeholder: 'absolute path to put new worktrees into' },",
		"\t\t],",
		"\t},",
		"];",
		"const metadata = { name: 'internal-name', group: 'internal-group' };",
		"",
	].join("\n");

	const plan = analyzeWebviewSource({
		file: "src/webviews/apps/settings/categories/views.ts",
		source: source,
		syntax: "ts",
		bundle: "settings",
	});

	expect(plan.sites.map((site) => site.pattern.text)).toEqual([
		"Search & Compare view",
		"Views",
		"Adds a Search & Compare view to search and explore commit histories",
		"File layout",
		"automatically",
		"as a list",
		"Location",
		"absolute path to put new worktrees into",
	]);
});

test("plans SettingsGroup literal members for synchronized localization", () => {
	const source = "export type SettingsGroup = 'Annotations' | 'Views' | 'General';\n";
	const plan = analyzeWebviewSource({
		file: "src/webviews/apps/settings/model.ts",
		source: source,
		syntax: "ts",
		bundle: "settings",
	});

	expect(plan.sites.map((site) => site.pattern.text)).toEqual(["Annotations", "Views", "General"]);
});

test("keeps duplicate settings labels bound to their semantic descriptors after reordering", () => {
	const control = (key: string) => `\t\t\t{ kind: 'check', key: '${key}', label: 'Show associated pull requests' },`;
	const createSource = (keys: readonly string[]) =>
		[
			"import type { SettingsCategory } from '../model.js';",
			"export const viewsCategories: SettingsCategory[] = [",
			"\t{",
			"\t\tid: 'search-compare-view',",
			"\t\tname: 'Search & Compare view',",
			"\t\tgroup: 'Views',",
			"\t\ticon: 'gl-search-view',",
			"\t\thint: 'Search and compare commits',",
			"\t\tcontrols: [",
			...keys.map(control),
			"\t\t],",
			"\t},",
			"];",
			"",
		].join("\n");
	const input = {
		file: "src/webviews/apps/settings/categories/views.ts",
		syntax: "ts" as const,
		bundle: "settings",
	};
	const firstSource = createSource(["views.alpha", "views.beta"]);
	const movedSource = createSource(["views.beta", "views.alpha"]);
	const firstPlan = analyzeWebviewSource({ ...input, source: firstSource });
	const movedPlan = analyzeWebviewSource({ ...input, source: movedSource });
	const getDuplicateLabelIds = (plan: typeof firstPlan) =>
		plan.sites.filter((site) => site.pattern.text === "Show associated pull requests").map((site) => site.id);
	const firstIds = getDuplicateLabelIds(firstPlan);
	const movedIds = getDuplicateLabelIds(movedPlan);

	expect(firstIds).toHaveLength(2);
	expect(firstIds).toEqual(movedIds.toReversed());
});

test("plans display text returned by variable-bound functions", () => {
	const source = [
		'const getLabel = () => { return "Show Details"; };',
		'const getMessage = function () { return "Open Details"; };',
		'const getTooltip = () => "Hover Details";',
		"",
	].join("\n");
	const plan = analyzeWebviewSource({
		file: "src/webviews/apps/shared/display-producers.ts",
		source: source,
		syntax: "ts",
		bundle: "graph",
	});

	expect(plan.sites.map((site) => [site.pattern.text, site.role])).toEqual([
		["Show Details", { kind: "imperative", target: "label" }],
		["Open Details", { kind: "imperative", target: "message" }],
		["Hover Details", { kind: "imperative", target: "tooltip" }],
	]);
});

test("keeps identical local display variables stable when methods move", () => {
	const firstMethod = [
		"\tfirst(element: HTMLElement) {",
		'\t\tconst label = "Open Details";',
		"\t\telement.title = label;",
		"\t}",
	].join("\n");
	const secondMethod = [
		"\tsecond(element: HTMLElement) {",
		'\t\tconst label = "Open Details";',
		"\t\telement.title = label;",
		"\t}",
	].join("\n");
	const source = ["export class View {", firstMethod, secondMethod, "}", ""].join("\n");
	const movedSource = ["export class View {", secondMethod, firstMethod, "}", ""].join("\n");
	const input = {
		file: "src/webviews/apps/shared/view.ts",
		syntax: "ts" as const,
		bundle: "graph",
	};
	const plan = analyzeWebviewSource({ ...input, source: source });
	const movedPlan = analyzeWebviewSource({ ...input, source: movedSource });
	const getMethodSiteId = (contents: string, method: string, sites: typeof plan.sites): string | undefined => {
		const start = contents.indexOf(`\t${method}(`);
		const end = contents.indexOf("\n\t}", start);
		return sites.find((site) => site.replacement.start > start && site.replacement.start < end)?.id;
	};

	expect(plan.sites).toHaveLength(2);
	expect(getMethodSiteId(source, "first", plan.sites)).toBe(getMethodSiteId(movedSource, "first", movedPlan.sites));
	expect(getMethodSiteId(source, "second", plan.sites)).toBe(getMethodSiteId(movedSource, "second", movedPlan.sites));
});
