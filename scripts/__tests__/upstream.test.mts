import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, expect, test } from "vitest";

import { loadLayerConfig } from "../config.mts";
import {
	applyConfiguredPatches,
	getUpstreamStatus,
	markFullBuildComplete,
	prepareUpstream,
	runUpstreamScripts,
} from "../upstream.mts";

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "upstream-tests-"));

afterAll(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

test("prepare creates a managed depth-one checkout from a local tagged repository", { tags: "upstream" }, () => {
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
		tag: "18.2.0",
		commit: repository.commit,
		requiresFullBuild: true,
	});
	expect(status.requiresFullBuild).toBe(true);
	fs.rmSync(managedFile);
	const restored = prepareUpstream(config);
	expect(restored.managed).toBe(true);
	expect(fs.existsSync(managedFile)).toBe(true);
	markFullBuildComplete(config);
	expect(getUpstreamStatus(config).requiresFullBuild).toBe(false);
	expect(prepareUpstream(config).requiresFullBuild).toBe(false);
	const refreshed = prepareUpstream(config, { requireFullBuild: true });
	expect(refreshed.requiresFullBuild).toBe(true);
	expect(refreshed.builtTag).toBe("18.2.0");
	expect(refreshed.builtCommit).toBe(repository.commit);
});

test("prepare reuses a locally available locked tag without contacting the remote", { tags: "upstream" }, () => {
	const controlRoot = path.join(fixtureRoot, "local-revision");
	const repository = createBareTaggedRepository(path.join(fixtureRoot, "local-revision-remote"));
	writeLayerConfig(controlRoot, repository.url, repository.commit);
	let config = loadLayerConfig(controlRoot);
	prepareUpstream(config);
	markFullBuildComplete(config);

	const nextCommit = addTaggedCommit(repository, "18.3.0");
	runGit(config.upstreamRoot, ["fetch", "--depth", "1", "origin", "refs/tags/18.3.0:refs/tags/18.3.0"]);
	fs.rmSync(repository.bare, { recursive: true, force: true });
	writeLayerConfig(controlRoot, repository.url, nextCommit, "18.3.0");
	config = loadLayerConfig(controlRoot);

	const prepared = prepareUpstream(config);

	expect(prepared.commit).toBe(nextCommit);
	expect(prepared.dirty).toBe(false);
	expect(prepared.requiresFullBuild).toBe(true);
	expect(prepared.builtTag).toBe("18.3.0");
	expect(prepared.builtCommit).toBe(nextCommit);
});

test("prepare fetches the locked tag when the local git repository does not contain it", { tags: "upstream" }, () => {
	const controlRoot = path.join(fixtureRoot, "fetched-revision");
	const repository = createBareTaggedRepository(path.join(fixtureRoot, "fetched-revision-remote"));
	writeLayerConfig(controlRoot, repository.url, repository.commit);
	let config = loadLayerConfig(controlRoot);
	prepareUpstream(config);

	const nextCommit = addTaggedCommit(repository, "18.3.0");
	writeLayerConfig(controlRoot, repository.url, nextCommit, "18.3.0");
	config = loadLayerConfig(controlRoot);

	const prepared = prepareUpstream(config);

	expect(prepared.commit).toBe(nextCommit);
	expect(runGit(config.upstreamRoot, ["rev-parse", "refs/tags/18.3.0^{commit}"]).trim()).toBe(nextCommit);
});

test("upstream scripts install once and run in order without resetting localized changes", { tags: "upstream" }, () => {
	const controlRoot = path.join(fixtureRoot, "upstream-scripts");
	const repository = createBareTaggedRepository(path.join(fixtureRoot, "script-remote"));
	writeLayerConfig(controlRoot, repository.url, repository.commit);
	const config = loadLayerConfig(controlRoot);
	prepareUpstream(config);
	const localizedFile = path.join(config.upstreamRoot, "localized.txt");
	fs.writeFileSync(localizedFile, "keep", "utf8");
	const calls: string[][] = [];

	runUpstreamScripts(config, ["fmt", "build"], (_command, args) => {
		calls.push([...args]);
		if (args.includes("install")) {
			const webpackEntry = path.join(config.upstreamRoot, "node_modules", "webpack", "bin", "webpack.js");
			fs.mkdirSync(path.dirname(webpackEntry), { recursive: true });
			fs.writeFileSync(webpackEntry, "", "utf8");
		}
	});

	expect(calls).toEqual([
		["install", "--frozen-lockfile"],
		["run", "fmt"],
		["run", "build"],
	]);
	expect(fs.readFileSync(localizedFile, "utf8")).toBe("keep");
});

test("configured patches can be enabled or disabled", { tags: "upstream" }, () => {
	const controlRoot = path.join(fixtureRoot, "configured-patches");
	const repository = createBareTaggedRepository(path.join(fixtureRoot, "patch-remote"));
	writeLayerConfig(controlRoot, repository.url, repository.commit, "18.2.0", true);
	let config = loadLayerConfig(controlRoot);
	prepareUpstream(config);
	fs.mkdirSync(path.join(controlRoot, "patches"), { recursive: true });
	fs.writeFileSync(
		path.join(controlRoot, "patches", "readme.patch"),
		"diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-fixture upstream\n+patched upstream\n",
		"utf8",
	);

	expect(applyConfiguredPatches(config)).toEqual(["readme.patch"]);
	expect(fs.readFileSync(path.join(config.upstreamRoot, "README.md"), "utf8").trim()).toBe("patched upstream");

	writeLayerConfig(controlRoot, repository.url, repository.commit, "18.2.0", false);
	config = loadLayerConfig(controlRoot);
	prepareUpstream(config);
	expect(applyConfiguredPatches(config)).toEqual([]);
	expect(fs.readFileSync(path.join(config.upstreamRoot, "README.md"), "utf8").trim()).toBe("fixture upstream");
});

interface RepositoryFixture {
	readonly url: string;
	readonly commit: string;
	readonly source: string;
	readonly bare: string;
}

function createBareTaggedRepository(root: string): RepositoryFixture {
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
	const url = pathToFileURL(bare).href;
	runGit(source, ["remote", "add", "origin", url]);
	return { url, commit, source, bare };
}

function addTaggedCommit(repository: RepositoryFixture, tag: string): string {
	fs.appendFileSync(path.join(repository.source, "README.md"), `${tag}\n`, "utf8");
	runGit(repository.source, ["add", "README.md"]);
	runGit(repository.source, ["commit", "-m", tag]);
	runGit(repository.source, ["tag", tag]);
	runGit(repository.source, ["push", "origin", `refs/tags/${tag}`]);
	return runGit(repository.source, ["rev-parse", "HEAD"]).trim();
}

function writeLayerConfig(
	controlRoot: string,
	repository: string,
	commit: string,
	tag = "18.2.0",
	applyPatches = false,
): void {
	fs.mkdirSync(controlRoot, { recursive: true });
	fs.writeFileSync(
		path.join(controlRoot, "gitlens-zh.config.json"),
		JSON.stringify({
			applyPatches,
			upstream: { repository, tag, commit },
		}),
		"utf8",
	);
}

function runGit(cwd: string, args: readonly string[]): string {
	const result = spawnSync("git", [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	expect(result.status, `${result.stdout ?? ""}${result.stderr ?? ""}`).toBe(0);
	return result.stdout ?? "";
}
