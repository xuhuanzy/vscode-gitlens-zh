import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

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
		assert.equal(syncResult.context.manifestFile, manifestFile);
		assert.equal(syncResult.context.catalogFile, path.join(controlRoot, "i18n", "catalog", "package.catalog.json"));
		assert.equal(fs.existsSync(syncResult.context.catalogFile), true);
		assert.equal(fs.existsSync(path.join(upstreamRoot, "i18n")), false);

		const generateResult = generateManifestLocalizedOutputs(options);
		assert.equal(
			generateResult.context.generatedManifestFile,
			path.join(workRoot, "i18n", "package-root", "zh-cn", "package.json"),
		);
		assert.equal(fs.existsSync(generateResult.context.generatedManifestFile), true);
		assert.equal(fs.readFileSync(manifestFile, "utf8"), sourceManifest);
	});
});
