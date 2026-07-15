import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { loadLayerConfig, PipelineError } from "../config.mts";
import { getUpstreamStatus, installUpstreamDependencies, markFullBuild, prepareUpstream } from "../upstream.mts";

const fixtureRoot = path.resolve(".work", "tests", `upstream-${process.pid}`);

test.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

test("prepare creates a managed depth-one checkout from a local tagged repository", () => {
	const controlRoot = path.join(fixtureRoot, "managed-checkout");
	const repository = createBareTaggedRepository(path.join(fixtureRoot, "remote"));
	writeLayerConfig(controlRoot, repository.url, repository.commit);
	const config = loadLayerConfig(controlRoot);

	const prepared = prepareUpstream(config);
	const status = getUpstreamStatus(config);

	assert.deepEqual(prepared, status);
	assert.equal(status.exists, true);
	assert.equal(status.managed, true);
	assert.equal(status.repository, repository.url);
	assert.equal(status.commit, repository.commit);
	assert.equal(status.shallow, true);
	assert.equal(status.dirty, false);
	const managedFile = path.join(config.upstreamRoot, ".git", "gl-managed.json");
	assert.deepEqual(JSON.parse(fs.readFileSync(managedFile, "utf8")), {
		repository: repository.url,
		tag: "18.2.0",
		commit: repository.commit,
		fullBuild: false,
	});
	assert.equal(status.fullBuild, false);
	fs.rmSync(managedFile);
	const restored = prepareUpstream(config);
	assert.equal(restored.managed, true);
	assert.equal(fs.existsSync(managedFile), true);
	markFullBuild(config);
	const built = getUpstreamStatus(config);
	assert.equal(built.fullBuild, true);
	assert.equal(built.builtTag, "18.2.0");
	assert.equal(built.builtCommit, repository.commit);
	const cleaned = prepareUpstream(config, { clean: true });
	assert.equal(cleaned.fullBuild, false);
});

test("prepare refuses an unknown existing upstream directory without deleting it", () => {
	const controlRoot = path.join(fixtureRoot, "unknown-directory");
	const repository = createBareTaggedRepository(path.join(fixtureRoot, "unused-remote"));
	writeLayerConfig(controlRoot, repository.url, repository.commit);
	const config = loadLayerConfig(controlRoot);
	fs.mkdirSync(config.upstreamRoot, { recursive: true });
	const sentinel = path.join(config.upstreamRoot, "owned-by-user.txt");
	fs.writeFileSync(sentinel, "keep", "utf8");

	assert.throws(
		() => prepareUpstream(config),
		(error: unknown) => error instanceof PipelineError && error.code === "UPSTREAM_IDENTITY_MISMATCH",
	);
	assert.equal(fs.readFileSync(sentinel, "utf8"), "keep");
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
	assert.deepEqual(calls, [[`--config.store-dir=${storeRoot}`, "install", "--frozen-lockfile"]]);
	assert.equal(fs.existsSync(staleFile), false);
	assert.equal(fs.existsSync(path.join(controlRoot, ".pnpm-store")), false);
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
	assert.equal(result.status, 0, `${result.stdout ?? ""}${result.stderr ?? ""}`);
	return result.stdout ?? "";
}
