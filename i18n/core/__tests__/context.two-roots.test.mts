import path from "node:path";
import { expect, test } from "vitest";

import { createI18nLayerContext } from "../context.mts";

test("i18n context keeps persistent data in the control root and generated data in the work root", () => {
	const fixtureRoot = path.resolve("test-fixtures", "two-roots");
	const controlRoot = path.join(fixtureRoot, "control");
	const upstreamRoot = path.join(fixtureRoot, "gitlens");
	const workRoot = path.join(fixtureRoot, "scratch");
	const context = createI18nLayerContext({ controlRoot, upstreamRoot, workRoot, locale: "zh-cn" });

	expect(context.controlRoot).toBe(controlRoot);
	expect(context.upstreamRoot).toBe(upstreamRoot);
	expect(context.authorityMessagesFile).toBe(path.join(controlRoot, "i18n", "authority", "zh-cn", "messages.json"));
	expect(context.catalogDir).toBe(path.join(controlRoot, "i18n", "catalog"));
	expect(context.worksetDir).toBe(path.join(controlRoot, "i18n", "worksets"));
	expect(context.generatedRootDir).toBe(path.join(workRoot, "i18n", "generated", "zh-cn"));
	expect(context.upstreamRoot.startsWith(context.controlRoot)).toBe(false);
});

test("relative upstream and work roots resolve from the control root", () => {
	const controlRoot = path.resolve("test-fixtures", "relative-roots");
	const context = createI18nLayerContext({
		controlRoot,
		upstreamRoot: ".fixtures/upstream",
		workRoot: ".fixtures/work",
	});

	expect(context.upstreamRoot).toBe(path.join(controlRoot, ".fixtures", "upstream"));
	expect(context.workRoot).toBe(path.join(controlRoot, ".fixtures", "work"));
	expect(context.i18nDir).toBe(path.join(controlRoot, "i18n"));
});
