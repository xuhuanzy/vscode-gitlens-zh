import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createI18nLayerContext } from "../context.mts";

test("i18n context keeps persistent data in the control root and generated data in the work root", () => {
	const fixtureRoot = path.resolve("test-fixtures", "two-roots");
	const controlRoot = path.join(fixtureRoot, "control");
	const upstreamRoot = path.join(fixtureRoot, "gitlens");
	const workRoot = path.join(fixtureRoot, "scratch");
	const context = createI18nLayerContext({ controlRoot, upstreamRoot, workRoot, locale: "zh-cn" });

	assert.equal(context.controlRoot, controlRoot);
	assert.equal(context.upstreamRoot, upstreamRoot);
	assert.equal(context.authorityMessagesFile, path.join(controlRoot, "i18n", "authority", "zh-cn", "messages.json"));
	assert.equal(context.catalogDir, path.join(controlRoot, "i18n", "catalog"));
	assert.equal(context.worksetDir, path.join(controlRoot, "i18n", "worksets"));
	assert.equal(context.generatedRootDir, path.join(workRoot, "i18n", "generated", "zh-cn"));
	assert.equal(context.upstreamRoot.startsWith(context.controlRoot), false);
});

test("relative upstream and work roots resolve from the control root", () => {
	const controlRoot = path.resolve("test-fixtures", "relative-roots");
	const context = createI18nLayerContext({
		controlRoot,
		upstreamRoot: ".fixtures/upstream",
		workRoot: ".fixtures/work",
	});

	assert.equal(context.upstreamRoot, path.join(controlRoot, ".fixtures", "upstream"));
	assert.equal(context.workRoot, path.join(controlRoot, ".fixtures", "work"));
	assert.equal(context.i18nDir, path.join(controlRoot, "i18n"));
});
