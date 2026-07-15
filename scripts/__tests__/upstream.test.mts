import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, expect, test } from "vitest";

import { loadLayerConfig } from "../config.mts";
import { getUpstreamStatus, installUpstreamDependencies, markFullBuild, prepareUpstream } from "../upstream.mts";

const fixtureRoot = path.resolve(".work", "tests", `upstream-${process.pid}`);

afterAll(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

test("prepare creates a managed depth-one checkout from a local tagged repository", () => {
	const controlRoot = path.join(fixtureRoot, "managed-checkout");
	const repository = createBareTaggedRepository(path.join(fixtureRoot, "remote"));
	writeLayerConfig(controlRoot, repository.url, repository.commit);
	const config = loadLayerConfig(controlRoot);

	const prepared = prepareUpstream(config);
	const status = getUpstreamStatus(config);

	expect(prepared).toEqual(status);
	expect(status.exists).toBe(true);
	expect(status.managed).toBe(true);
	expect(status.repository).toBe(repository.url);
	expect(status.commit).toBe(repository.commit);
	expect(status.shallow).toBe(true);
	expect(status.dirty).toBe(false);
	const managedFile = path.join(config.upstreamRoot, ".git", "gl-managed.json");
	expect(JSON.parse(fs.readFileSync(managedFile, "utf8"))).toEqual({
		repository: repository.url,
		tag: "18.2.0",
		commit: repository.commit,
		fullBuild: false,
	});
	expect(status.fullBuild).toBe(false);
	fs.rmSync(managedFile);
	const restored = prepareUpstream(config);
	expect(restored.managed).toBe(true);
	expect(fs.existsSync(managedFile)).toBe(true);
	markFullBuild(config);
	const built = getUpstreamStatus(config);
	expect(built.fullBuild).toBe(true);
	expect(built.builtTag).toBe("18.2.0");
	expect(built.builtCommit).toBe(repository.commit);
	const cleaned = prepareUpstream(config, { clean: true });
	expect(cleaned.fullBuild).toBe(false);
});

test("prepare refuses an unknown existing upstream directory without deleting it", () => {
	const controlRoot = path.join(fixtureRoot, "unknown-directory");
	const repository = createBareTaggedRepository(path.join(fixtureRoot, "unused-remote"));
	writeLayerConfig(controlRoot, repository.url, repository.commit);
	const config = loadLayerConfig(controlRoot);
	fs.mkdirSync(config.upstreamRoot, { recursive: true });
	const sentinel = path.join(config.upstreamRoot, "owned-by-user.txt");
	fs.writeFileSync(sentinel, "keep", "utf8");

	expect(() => prepareUpstream(config)).toThrow(expect.objectContaining({ code: "UPSTREAM_IDENTITY_MISMATCH" }));
	expect(fs.readFileSync(sentinel, "utf8")).toBe("keep");
});

test("dependency install keeps the pnpm store under work root and replaces stale upstream links", () => {
	const controlRoot = path.join(fixtureRoot, "dependency-store");
	writeLayerConfig(controlRoot, "https://example.invalid/upstream.git", "a".repeat(40));
	const config = loadLayerConfig(controlRoot);
	const staleFile = path.join(config.upstreamRoot, "node_modules", "stale-link.txt");
	fs.mkdirSync(path.dirname(staleFile), { recursive: true });
	fs.writeFileSync(staleFile, "stale", "utf8");
	const calls: string[][] = [];

	installUpstreamDependencies(config, {
		run: (_command, args) => {
			calls.push([...args]);
			const webpackEntry = path.join(config.upstreamRoot, "node_modules", "webpack", "bin", "webpack.js");
			fs.mkdirSync(path.dirname(webpackEntry), { recursive: true });
			fs.writeFileSync(webpackEntry, "", "utf8");
		},
	});

	const storeRoot = path.join(config.workRoot, "pnpm-store");
	expect(calls).toEqual([[`--config.store-dir=${storeRoot}`, "install", "--frozen-lockfile"]]);
	expect(fs.existsSync(staleFile)).toBe(false);
	expect(fs.existsSync(path.join(controlRoot, ".pnpm-store"))).toBe(false);
});

function createBareTaggedRepository(root: string): { readonly url: string; readonly commit: string } {
	const source = path.join(root, "source");
	const bare = path.join(root, "upstream.git");
	fs.mkdirSync(source, { recursive: true });
	runGit(source, ["init"]);
	runGit(source, ["config", "user.name", "GitLens zh tests"]);
	runGit(source, ["config", "user.email", "tests@example.invalid"]);
	fs.writeFileSync(path.join(source, "README.md"), "fixture upstream\n", "utf8");
	runGit(source, ["add", "README.md"]);
	runGit(source, ["commit", "-m", "fixture"]);
	runGit(source, ["tag", "18.2.0"]);
	const commit = runGit(source, ["rev-parse", "HEAD"]).trim();
	fs.mkdirSync(root, { recursive: true });
	runGit(root, ["clone", "--bare", source, bare]);
	return { url: pathToFileURL(bare).href, commit };
}

function writeLayerConfig(controlRoot: string, repository: string, commit: string): void {
	fs.mkdirSync(controlRoot, { recursive: true });
	fs.writeFileSync(
		path.join(controlRoot, "gitlens-zh.config.json"),
		JSON.stringify({
			upstream: { repository, tag: "18.2.0", commit },
		}),
		"utf8",
	);
}

function runGit(cwd: string, args: readonly string[]): string {
	const result = spawnSync("git", [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	expect(result.status, `${result.stdout ?? ""}${result.stderr ?? ""}`).toBe(0);
	return result.stdout ?? "";
}
