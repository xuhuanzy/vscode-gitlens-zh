import fs from "node:fs";
import path from "node:path";
import { afterAll, expect, test } from "vitest";

import { isWithin, loadLayerConfig } from "../config.mts";

const fixtureRoot = path.resolve(".work", "tests", `config-${process.pid}`);

afterAll(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

test("config accepts a full lowercase commit and resolves managed directories", () => {
	const controlRoot = path.join(fixtureRoot, "valid");
	const commit = "0123456789abcdef0123456789abcdef01234567";
	writeConfigFixture(controlRoot, "18.2.0", commit);

	const config = loadLayerConfig(controlRoot);

	expect(config.upstream.tag).toBe("18.2.0");
	expect(config.upstream.commit).toBe(commit);
	expect(config.upstreamRoot).toBe(path.join(controlRoot, ".upstream"));
	expect(config.workRoot).toBe(path.join(controlRoot, ".work"));
	expect(config.artifactsRoot).toBe(path.join(controlRoot, "artifacts"));
});

test("config rejects a commit that is not a full lowercase Git SHA", () => {
	const controlRoot = path.join(fixtureRoot, "invalid-commit");
	writeConfigFixture(controlRoot, "18.2.0", "ABCDEF");

	expect(() => loadLayerConfig(controlRoot)).toThrow(expect.objectContaining({ code: "CONFIG_INVALID" }));
});

test("overlay targets are accepted only inside the configured upstream root", () => {
	const upstreamRoot = path.join(fixtureRoot, "overlay-boundary", ".upstream");

	expect(isWithin(upstreamRoot, path.join(upstreamRoot, "src", "localized.ts"))).toBe(true);
	expect(isWithin(upstreamRoot, path.resolve(upstreamRoot, "..", "i18n", "authority", "messages.json"))).toBe(false);
	expect(isWithin(upstreamRoot, path.resolve(upstreamRoot, "..", ".work", "overlay.ts"))).toBe(false);
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
