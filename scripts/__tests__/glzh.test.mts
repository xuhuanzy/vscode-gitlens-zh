import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeEach, expect, test, vi } from "vitest";

const upstream = vi.hoisted(() => ({
	getStatus: vi.fn<(config: unknown) => unknown>(),
	markFullBuildComplete: vi.fn<(config: unknown) => void>(),
	prepare: vi.fn<(config: unknown, options?: { readonly requireFullBuild?: boolean }) => unknown>(),
	runInteractive: vi.fn<(command: string, args: readonly string[], cwd: string, errorCode: string) => void>(),
	runScript: vi.fn<(config: unknown, script: string) => void>(),
}));
const overlay = vi.hoisted(() => ({
	applyManifest: vi.fn<(config: unknown) => unknown>(),
	generate: vi.fn<(config: unknown) => unknown>(),
	promote: vi.fn<(config: unknown) => unknown>(),
	report: vi.fn<(config: unknown) => unknown>(),
	sync: vi.fn<(config: unknown) => unknown>(),
}));

vi.mock("../upstream.mts", () => ({
	getUpstreamStatus: upstream.getStatus,
	markFullBuildComplete: upstream.markFullBuildComplete,
	prepareUpstream: upstream.prepare,
	runInteractiveCommand: upstream.runInteractive,
	runUpstreamScript: upstream.runScript,
}));
vi.mock("../overlay.mts", () => ({
	applyLocalizedManifest: overlay.applyManifest,
	generateAndApplySourceOverlay: overlay.generate,
	promoteI18n: overlay.promote,
	reportI18n: overlay.report,
	syncI18n: overlay.sync,
}));

const { execute } = await import("../glzh.mts");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "glzh-tests-"));

afterAll(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

beforeEach(() => {
	vi.clearAllMocks();
	upstream.getStatus.mockReturnValue({ exists: true, managed: true });
	upstream.prepare.mockReturnValue({ exists: true, managed: true, requiresFullBuild: true });
	overlay.generate.mockReturnValue({ files: ["src/localized.ts"], translated: 3, unresolved: 1 });
	overlay.applyManifest.mockReturnValue({ englishKeys: 5, localizedKeys: 4, unresolvedKeys: 1 });
});

test("upstream exposes explicit full and quick builds without replaying localization", async () => {
	await expect(execute(["upstream", "build"])).resolves.toMatchObject({ script: "build" });
	expect(upstream.runScript).toHaveBeenLastCalledWith(expect.any(Object), "build");
	expect(upstream.markFullBuildComplete).toHaveBeenCalledOnce();
	expect(upstream.prepare).not.toHaveBeenCalled();
	expect(overlay.generate).not.toHaveBeenCalled();

	upstream.markFullBuildComplete.mockClear();
	await expect(execute(["upstream", "build:quick"])).resolves.toMatchObject({
		script: "build:quick",
	});
	expect(upstream.runScript).toHaveBeenLastCalledWith(expect.any(Object), "build:quick");
	expect(upstream.markFullBuildComplete).not.toHaveBeenCalled();
	expect(overlay.generate).not.toHaveBeenCalled();
});

test("upstream refresh requires a new full build", async () => {
	await expect(execute(["upstream", "refresh"])).resolves.toMatchObject({ requiresFullBuild: true });
	expect(upstream.prepare).toHaveBeenCalledWith(expect.any(Object), { requireFullBuild: true });
});

test("build performs a full build when the managed build state requires it", async () => {
	const root = path.join(fixtureRoot, "build-full");
	writeControlFixture(root, "v18.3.0", "2d76f8e4364be4c1877bd37d201561126e8c01fb");
	const i18nBefore = readI18nSnapshot(root);

	await expect(execute(["build"], root)).resolves.toMatchObject({ mode: "full" });
	expect(upstream.prepare).toHaveBeenCalledOnce();
	expect(overlay.generate).toHaveBeenCalledOnce();
	expect(upstream.runScript).toHaveBeenCalledWith(expect.any(Object), "build");
	expect(upstream.markFullBuildComplete).toHaveBeenCalledOnce();
	expect(overlay.applyManifest).toHaveBeenCalledOnce();
	expect(overlay.sync).not.toHaveBeenCalled();
	expect(overlay.promote).not.toHaveBeenCalled();
	expect(overlay.report).not.toHaveBeenCalled();
	expect(readI18nSnapshot(root)).toEqual(i18nBefore);

	await expect(execute(["build", "watch"], root)).rejects.toMatchObject({ code: "CONFIG_INVALID" });
	await expect(execute(["build", "prepare"], root)).rejects.toMatchObject({ code: "CONFIG_INVALID" });
});

test("build uses a quick build when prepare reports that a full build is not required", async () => {
	const root = path.join(fixtureRoot, "build-quick");
	writeControlFixture(root, "v18.3.0", "2d76f8e4364be4c1877bd37d201561126e8c01fb");
	upstream.prepare.mockReturnValue({
		exists: true,
		managed: true,
		requiresFullBuild: false,
	});

	await expect(execute(["build"], root)).resolves.toMatchObject({ mode: "quick" });
	expect(upstream.runScript).toHaveBeenCalledWith(expect.any(Object), "build:quick");
	expect(upstream.markFullBuildComplete).not.toHaveBeenCalled();
});

test("report and promote no longer reset upstream when they only consume controlled i18n data", async () => {
	await execute(["i18n", "report"]);
	await execute(["i18n", "promote"]);

	expect(upstream.prepare).not.toHaveBeenCalled();
	expect(overlay.report).toHaveBeenCalledOnce();
	expect(overlay.promote).toHaveBeenCalledOnce();
});

test("i18n overlay applies localized sources and manifest without running an upstream build", async () => {
	const root = path.join(fixtureRoot, "i18n-overlay");
	writeControlFixture(root, "v18.3.0", "2d76f8e4364be4c1877bd37d201561126e8c01fb");
	const i18nBefore = readI18nSnapshot(root);

	await expect(execute(["i18n", "overlay"], root)).resolves.toMatchObject({ mode: "overlay" });
	expect(upstream.prepare).toHaveBeenCalledOnce();
	expect(overlay.generate).toHaveBeenCalledOnce();
	expect(overlay.applyManifest).toHaveBeenCalledOnce();
	expect(upstream.runScript).not.toHaveBeenCalled();
	expect(upstream.markFullBuildComplete).not.toHaveBeenCalled();
	expect(readI18nSnapshot(root)).toEqual(i18nBefore);
});

test("package uses the complete production bundle before creating the localized VSIX", async () => {
	const root = path.join(fixtureRoot, "package");
	fs.mkdirSync(path.join(root, ".upstream"), { recursive: true });
	writeControlFixture(root, "18.3.0", "0123456789abcdef0123456789abcdef01234567");
	fs.writeFileSync(
		path.join(root, ".upstream", "package.json"),
		JSON.stringify({ name: "gitlens", version: "18.3.0" }),
		"utf8",
	);
	const i18nBefore = readI18nSnapshot(root);

	await expect(execute(["package", "--", "--pre-release"], root)).resolves.toMatchObject({
		artifact: path.join(root, "artifacts", "gitlens-18.3.0-zh-cn.vsix"),
	});
	expect(upstream.runScript).toHaveBeenCalledWith(expect.any(Object), "bundle");
	expect(upstream.runScript).not.toHaveBeenCalledWith(expect.any(Object), "bundle:quick");
	expect(overlay.sync).not.toHaveBeenCalled();
	expect(overlay.promote).not.toHaveBeenCalled();
	expect(overlay.report).not.toHaveBeenCalled();
	expect(upstream.runInteractive).toHaveBeenCalledWith(
		"pnpm",
		[
			"exec",
			"vsce",
			"package",
			"--no-dependencies",
			"--out",
			path.join(root, "artifacts", "gitlens-18.3.0-zh-cn.vsix"),
			"--pre-release",
		],
		path.join(root, ".upstream"),
		"PACKAGE_FAILED",
	);
	expect(readI18nSnapshot(root)).toEqual(i18nBefore);
});

test("clean and offline options are rejected after their behavior moves inside upstream refresh", async () => {
	await expect(execute(["upstream", "refresh", "--clean"])).rejects.toMatchObject({ code: "CONFIG_INVALID" });
	await expect(execute(["build", "--offline"])).rejects.toMatchObject({ code: "CONFIG_INVALID" });
});

test("removed commands are rejected instead of kept as compatibility aliases", async () => {
	await expect(execute(["replay"])).rejects.toMatchObject({ code: "CONFIG_INVALID" });
	await expect(execute(["dev"])).rejects.toMatchObject({ code: "CONFIG_INVALID" });
	await expect(execute(["verify"])).rejects.toMatchObject({ code: "CONFIG_INVALID" });
});

function writeControlFixture(root: string, tag: string, commit: string): void {
	fs.mkdirSync(root, { recursive: true });
	fs.writeFileSync(
		path.join(root, "gitlens-zh.config.json"),
		JSON.stringify({
			upstream: {
				repository: "https://example.invalid/gitlens.git",
				tag: tag,
				commit: commit,
			},
		}),
		"utf8",
	);
	const authorityRoot = path.join(root, "i18n", "authority", "zh-cn");
	fs.mkdirSync(authorityRoot, { recursive: true });
	fs.writeFileSync(path.join(authorityRoot, "messages.json"), '{"entries":[]}\n', "utf8");
}

function readI18nSnapshot(root: string): Record<string, string> {
	const i18nRoot = path.join(root, "i18n");
	const files = fs
		.globSync("**/*", { cwd: i18nRoot, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => path.relative(i18nRoot, path.join(entry.parentPath, entry.name)))
		.sort((left, right) => left.localeCompare(right));
	return Object.fromEntries(
		files.map((file) => [file.replaceAll("\\", "/"), fs.readFileSync(path.join(i18nRoot, file), "utf8")]),
	);
}
