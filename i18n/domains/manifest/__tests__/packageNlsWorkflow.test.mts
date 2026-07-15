import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

import { createLiteralPattern, shortHash } from "../../../core/model.mts";
import { createTestLayerOptions, withTempRoot } from "../../../testing/tempRoot.mts";
import {
	loadAuthorityBundle,
	loadCatalog as loadManifestCatalog,
	loadReconciliationReport as loadManifestReconciliationReport,
	loadWorkset as loadManifestWorkset,
	readJsonFile,
	saveAuthorityBundle,
	saveWorkset as saveManifestWorkset,
} from "../../../core/store.mts";
import { createManifestDomainContext } from "../context.mts";
import {
	createPendingReport,
	generateManifestLocalizedOutputs,
	promoteManifestAuthority,
	syncManifestI18n,
} from "../workflow.mts";

test("promotes localized manifest entries", () => {
	withTempRoot("gitlens-package-nls-", (rootDir) => {
		fs.writeFileSync(
			path.join(rootDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					displayName: "Fixture Git UI",
					description: "Review Git history quickly",
					contributes: {
						mcpServerDefinitionProviders: [{ id: "fixture.provider", label: "Fixture Provider" }],
						configuration: [
							{
								id: "core",
								title: "Core",
								properties: {
									"fixture.enabled": {
										type: "boolean",
										markdownDescription: "Show `${author}` in the panel",
										enumDescriptions: ["Enabled", "Disabled"],
									},
								},
							},
						],
						commands: [{ command: "fixture.open", title: "Open Graph", category: "GitLens" }],
						submenus: [{ id: "fixture.submenu", label: "Tools" }],
						viewsContainers: {
							activitybar: [{ id: "fixture.container", title: "GitLens" }],
						},
						views: {
							explorer: [{ id: "fixture.view", name: "History", contextualTitle: "History" }],
						},
						viewsWelcome: [
							{ view: "fixture.view", contents: "[Open](command:fixture.open)", when: "view == fixture" },
						],
						walkthroughs: [
							{
								id: "welcome",
								title: "Get Started",
								description: "Welcome to the extension",
								steps: [{ id: "intro", title: "Intro", description: "See **Git** activity" }],
							},
						],
					},
				},
				undefined,
				"\t",
			),
			"utf8",
		);

		const rootManifestBeforeGeneration = fs.readFileSync(path.join(rootDir, "package.json"), "utf8");
		const syncResult = syncManifestI18n(createTestLayerOptions(rootDir));
		expect(syncResult.occurrenceCount).toBeGreaterThan(0);

		const context = createManifestDomainContext(createTestLayerOptions(rootDir));
		const catalog = loadManifestCatalog(context);
		const workset = loadManifestWorkset(context);
		expect(workset.entries.length).toBeGreaterThan(0);
		expect("firstSeenAt" in workset.entries[0]).toEqual(false);
		expect("occurrences" in workset.entries[0]).toEqual(false);
		expect(Array.isArray(workset.entries[0].occurrenceIds)).toEqual(true);

		const commandTitleOccurrence = catalog.occurrences.find(
			(occurrence) =>
				occurrence.output?.kind === "manifest-key" &&
				occurrence.output.key === "contributes.commands.fixture.open.title",
		);
		const commandCategoryOccurrence = catalog.occurrences.find(
			(occurrence) =>
				occurrence.output?.kind === "manifest-key" &&
				occurrence.output.key === "contributes.commands.fixture.open.category",
		);
		expect(commandTitleOccurrence).toBeDefined();
		expect(commandCategoryOccurrence).toBeDefined();
		expect(commandTitleOccurrence!.anchor).toBe(commandCategoryOccurrence!.anchor);
		expect(commandTitleOccurrence!.id).not.toBe(commandCategoryOccurrence!.id);
		expect(commandTitleOccurrence!.slot).toBe("title");
		expect(commandCategoryOccurrence!.slot).toBe("category");
		expect(commandTitleOccurrence!.reference.kind).toBe("json");
		expect("extractedFrom" in commandTitleOccurrence!.reference).toBe(false);

		const targetEntry = workset.entries.find((entry) => entry.source === "GitLens");
		expect(targetEntry).toBeDefined();

		saveManifestWorkset(context, {
			...workset,
			entries: workset.entries.map((entry) =>
				entry.id === targetEntry!.id
					? {
							...entry,
							status: "approved",
							translation: "GitLens 中文",
						}
					: entry,
			),
		});

		const promoteResult = promoteManifestAuthority(createTestLayerOptions(rootDir));
		expect(promoteResult.promoted).toEqual([targetEntry!.id]);

		const generateResult = generateManifestLocalizedOutputs(createTestLayerOptions(rootDir));
		expect(generateResult.englishKeys).toBeGreaterThan(0);
		expect(generateResult.localizedKeys).toBeGreaterThan(0);
		expect(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")).toBe(rootManifestBeforeGeneration);

		const manifest = readJsonFile<Record<string, unknown>>(context.manifestFile);
		expect(manifest.displayName).toBe("Fixture Git UI");

		const generatedManifest = readJsonFile<Record<string, unknown>>(context.generatedManifestFile);
		expect(generatedManifest.displayName).toBe("%extension.displayName%");
		expect(fs.existsSync(path.join(context.outputRootDir, "package.nls.json"))).toBe(true);
		expect(fs.existsSync(path.join(context.outputRootDir, "package.nls.zh-cn.json"))).toBe(true);

		const englishPackageNls = readJsonFile<Record<string, string>>(context.englishPackageNlsFile);
		expect(englishPackageNls["extension.displayName"]).toBe("Fixture Git UI");

		const authority = loadAuthorityBundle(context);
		expect(authority.messages.entries.some((entry) => entry.translation === "GitLens 中文")).toBe(true);

		const resyncResult = syncManifestI18n(createTestLayerOptions(rootDir));
		expect(resyncResult.occurrenceCount).toBe(syncResult.occurrenceCount);
	});
});

test("rejects root tokenized manifests", () => {
	withTempRoot("gitlens-package-nls-", (rootDir) => {
		fs.writeFileSync(
			path.join(rootDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					displayName: "%extension.displayName%",
					description: "Review Git history quickly",
				},
				undefined,
				"\t",
			),
			"utf8",
		);

		expect(() => generateManifestLocalizedOutputs(createTestLayerOptions(rootDir))).toThrow(
			/Root package\.json contains generated/u,
		);
	});
});

test("detects duplicate views and welcome keys", () => {
	withTempRoot("gitlens-package-nls-", (rootDir) => {
		fs.writeFileSync(
			path.join(rootDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					displayName: "Fixture Git UI",
					description: "Review Git history quickly",
					contributes: {
						viewsWelcome: [
							{
								view: "fixture.view",
								contents: "Open the fixture history",
								when: "view == fixture",
							},
							{
								view: "fixture.view",
								contents: "Compare the fixture refs",
								when: "view == fixture",
							},
						],
					},
				},
				undefined,
				"\t",
			),
			"utf8",
		);

		syncManifestI18n(createTestLayerOptions(rootDir));
		const context = createManifestDomainContext(createTestLayerOptions(rootDir));
		const reconciliation = loadManifestReconciliationReport(context);
		expect(reconciliation.summary.ambiguous).toBe(0);

		generateManifestLocalizedOutputs(createTestLayerOptions(rootDir));

		const manifest = readJsonFile<Record<string, unknown>>(context.manifestFile);
		expect(manifest.displayName).toBe("Fixture Git UI");

		const generatedManifest = readJsonFile<Record<string, unknown>>(context.generatedManifestFile);
		const welcomes = (((generatedManifest.contributes as Record<string, unknown>).viewsWelcome as unknown[]) ??
			[]) as Array<Record<string, unknown>>;
		const selector = `when-${shortHash("view == fixture")}`;
		expect(welcomes[0].contents).toBe(`%contributes.viewsWelcome.fixture.view.${selector}.slot-1.contents%`);
		expect(welcomes[1].contents).toBe(`%contributes.viewsWelcome.fixture.view.${selector}.slot-2.contents%`);

		const englishPackageNls = readJsonFile<Record<string, string>>(context.englishPackageNlsFile);
		expect(englishPackageNls[`contributes.viewsWelcome.fixture.view.${selector}.slot-1.contents`]).toBe(
			"Open the fixture history",
		);
		expect(englishPackageNls[`contributes.viewsWelcome.fixture.view.${selector}.slot-2.contents`]).toBe(
			"Compare the fixture refs",
		);
	});
});

test("does not leave overrides pending", () => {
	withTempRoot("gitlens-package-nls-", (rootDir) => {
		fs.writeFileSync(
			path.join(rootDir, "package.json"),
			JSON.stringify(
				{
					name: "fixture",
					displayName: "Fixture Git UI",
					description: "Review Git history quickly",
					contributes: {
						commands: [{ command: "fixture.open", title: "Open Graph", category: "GitLens" }],
					},
				},
				undefined,
				"\t",
			),
			"utf8",
		);

		syncManifestI18n(createTestLayerOptions(rootDir));
		const context = createManifestDomainContext(createTestLayerOptions(rootDir));
		const initialWorkset = loadManifestWorkset(context);
		expect(initialWorkset.entries.length).toBe(4);
		const titleEntry = initialWorkset.entries.find((entry) => entry.source === "Open Graph");
		expect(titleEntry).toBeDefined();

		const bundle = loadAuthorityBundle(context);
		saveAuthorityBundle(context, {
			...bundle,
			overrides: {
				...bundle.overrides,
				updatedAt: new Date().toISOString(),
				entries: [
					{
						selector: {
							kind: "output",
							output: {
								kind: "manifest-key",
								key: "contributes.commands.fixture.open.title",
							},
						},
						translationPattern: createLiteralPattern("打开图表"),
						updatedAt: new Date().toISOString(),
					},
				],
			},
		});

		const report = createPendingReport(createTestLayerOptions(rootDir));
		expect(
			report.items.some((item) => item.occurrenceIds.some((id) => titleEntry!.occurrenceIds.includes(id))),
		).toBe(false);
		expect(report.items.every((item) => "sourceText" in item)).toBe(false);
		expect(report.items.every((item) => "scope" in item)).toBe(false);
		expect(report.items.every((item) => "occurrences" in item)).toBe(false);
		expect(fs.existsSync(context.pendingReportFile)).toBe(true);

		const reportedWorkset = loadManifestWorkset(context);
		expect(reportedWorkset.entries.some((entry) => entry.id === titleEntry!.id)).toBe(false);

		const generateResult = generateManifestLocalizedOutputs(createTestLayerOptions(rootDir));
		expect(generateResult.localizedKeys).toBe(1);

		const localizedPackageNls = readJsonFile<Record<string, string>>(context.localizedPackageNlsFile);
		expect(localizedPackageNls["contributes.commands.fixture.open.title"]).toBe("打开图表");
	});
});
