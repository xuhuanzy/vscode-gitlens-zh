import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { isWithin, loadLayerConfig, PipelineError } from "../config.mts";

const fixtureRoot = path.resolve(".work", "tests", `config-${process.pid}`);

test.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

test("config accepts a full lowercase commit and resolves managed directories", () => {
	const controlRoot = path.join(fixtureRoot, "valid");
	const commit = "0123456789abcdef0123456789abcdef01234567";
	writeConfigFixture(controlRoot, "18.2.0", commit);

	const config = loadLayerConfig(controlRoot);

	assert.equal(config.upstream.tag, "18.2.0");
	assert.equal(config.upstream.commit, commit);
	assert.equal(config.upstreamRoot, path.join(controlRoot, ".upstream"));
	assert.equal(config.workRoot, path.join(controlRoot, ".work"));
	assert.equal(config.artifactsRoot, path.join(controlRoot, "artifacts"));
});

test("config rejects a commit that is not a full lowercase Git SHA", () => {
	const controlRoot = path.join(fixtureRoot, "invalid-commit");
	writeConfigFixture(controlRoot, "18.2.0", "ABCDEF");

	assert.throws(
		() => loadLayerConfig(controlRoot),
		(error: unknown) => error instanceof PipelineError && error.code === "CONFIG_INVALID",
	);
});

test("overlay targets are accepted only inside the configured upstream root", () => {
	const upstreamRoot = path.join(fixtureRoot, "overlay-boundary", ".upstream");

	assert.equal(isWithin(upstreamRoot, path.join(upstreamRoot, "src", "localized.ts")), true);
	assert.equal(isWithin(upstreamRoot, path.resolve(upstreamRoot, "..", "i18n", "authority", "messages.json")), false);
	assert.equal(isWithin(upstreamRoot, path.resolve(upstreamRoot, "..", ".work", "overlay.ts")), false);
});

function writeConfigFixture(controlRoot: string, tag: string, commit: string): void {
	fs.mkdirSync(controlRoot, { recursive: true });
	fs.writeFileSync(
		path.join(controlRoot, "gitlens-zh.config.json"),
		JSON.stringify({
			upstream: { repository: "file:///fixture/upstream.git", tag, commit },
		}),
		"utf8",
	);
}
