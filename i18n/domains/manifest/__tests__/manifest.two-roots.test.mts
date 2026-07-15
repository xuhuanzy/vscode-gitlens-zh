import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

import { withTempRoot } from "../../../testing/tempRoot.mts";
import { generateManifestLocalizedOutputs, syncManifestI18n } from "../workflow.mts";

test("manifest workflow reads upstream while persisting and generating outside it", () => {
	withTempRoot("gitlens-manifest-layer-", (fixtureRoot) => {
		const controlRoot = path.join(fixtureRoot, "control");
		const upstreamRoot = path.join(fixtureRoot, "upstream");
		const workRoot = path.join(fixtureRoot, "work");
		const options = { controlRoot, upstreamRoot, workRoot };

		fs.mkdirSync(upstreamRoot, { recursive: true });
		const manifestFile = path.join(upstreamRoot, "package.json");
		const sourceManifest = `${JSON.stringify(
			{
				name: "gitlens",
				displayName: "GitLens",
				description: "Supercharge Git inside VS Code",
				version: "18.2.0",
				publisher: "eamodio",
				engines: { vscode: "^1.99.0" },
			},
			undefined,
			"\t",
		)}\n`;
		fs.writeFileSync(manifestFile, sourceManifest, "utf8");

		const syncResult = syncManifestI18n(options);
		expect(syncResult.context.manifestFile).toBe(manifestFile);
		expect(syncResult.context.catalogFile).toBe(path.join(controlRoot, "i18n", "catalog", "package.catalog.json"));
		expect(fs.existsSync(syncResult.context.catalogFile)).toBe(true);
		expect(fs.existsSync(path.join(upstreamRoot, "i18n"))).toBe(false);

		const generateResult = generateManifestLocalizedOutputs(options);
		expect(generateResult.context.generatedManifestFile).toBe(
			path.join(workRoot, "i18n", "package-root", "zh-cn", "package.json"),
		);
		expect(fs.existsSync(generateResult.context.generatedManifestFile)).toBe(true);
		expect(fs.readFileSync(manifestFile, "utf8")).toBe(sourceManifest);
	});
});
