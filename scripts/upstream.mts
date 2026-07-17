import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { isWithin, PipelineError, type ResolvedLayerConfig } from "./config.mts";

type CommandRunner = (command: string, args: readonly string[], cwd: string, errorCode: string) => void;

export interface UpstreamStatus {
	readonly exists: boolean;
	readonly managed: boolean;
	readonly repository?: string;
	readonly commit?: string;
	readonly shallow?: boolean;
	readonly dirty?: boolean;
	readonly builtTag?: string;
	readonly builtCommit?: string;
	readonly requiresFullBuild: boolean;
}

export type UpstreamScript = "build" | "build:quick" | "fmt" | "bundle";

interface ManagedMetadata {
	readonly tag: string;
	readonly commit: string;
	readonly requiresFullBuild: boolean;
}

const managedFileName = "gl-managed.json";

/** 读取当前上游工作树状态, 不创建, 更新或删除任何文件. */
export function getUpstreamStatus(config: ResolvedLayerConfig): UpstreamStatus {
	if (!fs.existsSync(config.upstreamRoot)) return { exists: false, managed: false, requiresFullBuild: true };
	const gitDir = path.join(config.upstreamRoot, ".git");
	const managedFile = path.join(gitDir, managedFileName);
	if (!fs.existsSync(gitDir)) return { exists: true, managed: false, requiresFullBuild: true };
	let metadata: ManagedMetadata | undefined;
	if (fs.existsSync(managedFile)) {
		try {
			metadata = JSON.parse(fs.readFileSync(managedFile, "utf8")) as ManagedMetadata;
		} catch {
			metadata = undefined;
		}
	}

	return {
		exists: true,
		managed: metadata != null,
		repository: runGit(config.upstreamRoot, ["remote", "get-url", "origin"], "UPSTREAM_IDENTITY_MISMATCH").trim(),
		commit: runGit(config.upstreamRoot, ["rev-parse", "HEAD"], "UPSTREAM_IDENTITY_MISMATCH").trim(),
		shallow:
			runGit(
				config.upstreamRoot,
				["rev-parse", "--is-shallow-repository"],
				"UPSTREAM_IDENTITY_MISMATCH",
			).trim() === "true",
		dirty: runGit(config.upstreamRoot, ["status", "--porcelain"], "UPSTREAM_IDENTITY_MISMATCH").trim().length !== 0,
		builtTag: metadata?.tag,
		builtCommit: metadata?.commit,
		requiresFullBuild:
			metadata == null ||
			metadata.tag !== config.upstream.tag ||
			metadata.commit !== config.upstream.commit ||
			metadata.requiresFullBuild !== false,
	};
}

/** 记录当前锁定版本已经成功完成完整 development build. */
export function markFullBuildComplete(config: ResolvedLayerConfig): void {
	writeManagedMetadata(config, false);
}

/** 按文件名顺序将控制仓库中的 patch 应用到已重置的上游工作树. */
export function applyConfiguredPatches(config: ResolvedLayerConfig): readonly string[] {
	if (!config.applyPatches) return [];

	const patchesRoot = path.join(config.controlRoot, "patches");
	if (!fs.existsSync(patchesRoot)) return [];
	const patches = fs
		.globSync("*.patch", { cwd: patchesRoot, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));
	for (const patch of patches) {
		runGit(config.upstreamRoot, ["apply", path.join(patchesRoot, patch)], "PATCH_APPLY_FAILED");
	}
	return patches;
}

/** 确保受管上游树指向锁定版本, 优先复用本地 tag, 缺失时再拉取或重建. */
export function prepareUpstream(
	config: ResolvedLayerConfig,
	options: { readonly requireFullBuild?: boolean } = {},
): UpstreamStatus {
	if (
		!isWithin(config.controlRoot, config.upstreamRoot) ||
		path.dirname(config.upstreamRoot) !== config.controlRoot
	) {
		throw new PipelineError("CONFIG_INVALID", "Refusing to manage an upstream directory outside the control root");
	}

	let reuseLocalGit = false;
	let requiresFullBuild = true;
	if (fs.existsSync(config.upstreamRoot)) {
		try {
			const status = getUpstreamStatus(config);
			reuseLocalGit = status.repository === config.upstream.repository && status.shallow === true;
			if (reuseLocalGit) {
				requiresFullBuild = options.requireFullBuild === true || status.requiresFullBuild;
			}
		} catch {
			reuseLocalGit = false;
			requiresFullBuild = true;
		}
		if (!reuseLocalGit) fs.rmSync(config.upstreamRoot, { recursive: true, force: true });
	}

	if (!reuseLocalGit) {
		try {
			runCommand(
				"git",
				[
					...(process.platform === "win32" ? ["-c", "http.sslBackend=openssl"] : []),
					"clone",
					"--depth",
					"1",
					"--single-branch",
					"--branch",
					config.upstream.tag,
					config.upstream.repository,
					config.upstreamRoot,
				],
				config.controlRoot,
				"UPSTREAM_UNAVAILABLE",
			);
		} catch (ex) {
			if (fs.existsSync(config.upstreamRoot)) fs.rmSync(config.upstreamRoot, { recursive: true, force: true });
			throw ex;
		}
	}

	const tagRef = `refs/tags/${config.upstream.tag}^{commit}`;
	let tagCommit: string | undefined;
	const probe = spawnSync(
		"git",
		[...(process.platform === "win32" ? ["-c", "http.sslBackend=openssl"] : []), "rev-parse", "--verify", tagRef],
		{ cwd: config.upstreamRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	);
	if (probe.error != null) throw new PipelineError("UPSTREAM_UNAVAILABLE", probe.error.message);
	if (probe.status === 0) tagCommit = probe.stdout.trim();

	if (tagCommit == null) {
		runGit(
			config.upstreamRoot,
			["fetch", "--depth", "1", "origin", `refs/tags/${config.upstream.tag}:refs/tags/${config.upstream.tag}`],
			"UPSTREAM_UNAVAILABLE",
		);
		tagCommit = runGit(config.upstreamRoot, ["rev-parse", "--verify", tagRef], "UPSTREAM_UNAVAILABLE").trim();
	}
	if (tagCommit !== config.upstream.commit) {
		throw new PipelineError(
			"UPSTREAM_TAG_MOVED",
			`Tag ${config.upstream.tag} resolved to ${tagCommit}, expected ${config.upstream.commit}`,
		);
	}

	runGit(config.upstreamRoot, ["reset", "--hard", config.upstream.commit], "UPSTREAM_RESET_FAILED");
	runGit(config.upstreamRoot, ["clean", "-ffd"], "UPSTREAM_RESET_FAILED");
	writeManagedMetadata(config, requiresFullBuild);
	return getUpstreamStatus(config);
}

function writeManagedMetadata(config: ResolvedLayerConfig, requiresFullBuild: boolean): void {
	fs.writeFileSync(
		path.join(config.upstreamRoot, ".git", managedFileName),
		JSON.stringify(
			{
				tag: config.upstream.tag,
				commit: config.upstream.commit,
				requiresFullBuild: requiresFullBuild,
			},
			undefined,
			2,
		) + "\n",
		"utf8",
	);
}

/** 在当前已准备的上游树中安装依赖并按顺序执行上游脚本, 不重置工作树或应用本地化覆盖层. */
export function runUpstreamScripts(
	config: ResolvedLayerConfig,
	scripts: readonly UpstreamScript[],
	run: CommandRunner = runInteractiveCommand,
): void {
	const status = getUpstreamStatus(config);
	if (
		!status.exists ||
		!status.managed ||
		status.repository !== config.upstream.repository ||
		status.commit !== config.upstream.commit ||
		status.shallow !== true
	) {
		throw new PipelineError(
			"UPSTREAM_NOT_READY",
			"The locked upstream checkout is not ready; run glzh upstream refresh first",
			{ ...status },
		);
	}

	installUpstreamDependencies(config, run);
	for (const script of scripts) {
		run("pnpm", ["run", script], config.upstreamRoot, "BUILD_FAILED");
	}
}

/** 安装上游依赖, 并清理已失效的 node_modules 链接. */
export function installUpstreamDependencies(
	config: ResolvedLayerConfig,
	run: CommandRunner = runInteractiveCommand,
): void {
	const nodeModulesRoot = path.resolve(config.upstreamRoot, "node_modules");
	if (!isWithin(config.upstreamRoot, nodeModulesRoot)) {
		throw new PipelineError("CONFIG_INVALID", "Dependency path must remain inside the managed upstream directory");
	}

	const webpackEntry = path.join(nodeModulesRoot, "webpack", "bin", "webpack.js");
	if (fs.existsSync(nodeModulesRoot) && !fs.existsSync(webpackEntry)) {
		fs.rmSync(nodeModulesRoot, { recursive: true, force: true });
	}

	run("pnpm", ["install", "--frozen-lockfile"], config.upstreamRoot, "DEPENDENCY_INSTALL_FAILED");

	if (!fs.existsSync(webpackEntry)) {
		throw new PipelineError(
			"DEPENDENCY_INSTALL_FAILED",
			"Upstream webpack dependency is unavailable after installation",
			{
				missing: webpackEntry,
			},
		);
	}
}

export function runCommand(command: string, args: readonly string[], cwd: string, errorCode: string): string {
	const result = spawnSync(command, [...args], { cwd: cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	if (result.error != null) {
		throw new PipelineError(errorCode, result.error.message);
	}
	if (result.status !== 0) {
		const diagnostic = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
		throw new PipelineError(errorCode, diagnostic || `${command} exited with code ${result.status ?? 1}`);
	}
	return result.stdout ?? "";
}

export function runInteractiveCommand(command: string, args: readonly string[], cwd: string, errorCode: string): void {
	const result = spawnSync(command, [...args], { cwd: cwd, stdio: "inherit" });
	if (result.error != null) throw new PipelineError(errorCode, result.error.message);
	if (result.status !== 0) {
		throw new PipelineError(errorCode, `${command} exited with code ${result.status ?? 1}`);
	}
}

function runGit(cwd: string, args: readonly string[], errorCode: string): string {
	return runCommand(
		"git",
		[...(process.platform === "win32" ? ["-c", "http.sslBackend=openssl"] : []), ...args],
		cwd,
		errorCode,
	);
}
