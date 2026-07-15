import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { isWithin, PipelineError, type ResolvedLayerConfig } from "./config.mts";

export interface PrepareOptions {
	readonly clean?: boolean;
	readonly offline?: boolean;
}

export interface InstallUpstreamDependenciesOptions {
	readonly offline?: boolean;
	readonly run?: (command: string, args: readonly string[], cwd: string, errorCode: string) => void;
}

export interface UpstreamStatus {
	readonly exists: boolean;
	readonly managed: boolean;
	readonly repository?: string;
	readonly commit?: string;
	readonly shallow?: boolean;
	readonly dirty?: boolean;
}

const managedFileName = "glzh-managed.json";

/** 读取当前上游工作树状态, 不创建, 更新或删除任何文件. */
export function getUpstreamStatus(config: ResolvedLayerConfig): UpstreamStatus {
	if (!fs.existsSync(config.upstreamRoot)) return { exists: false, managed: false };
	const gitDir = path.join(config.upstreamRoot, ".git");
	const managedFile = path.join(gitDir, managedFileName);
	if (!fs.existsSync(gitDir)) return { exists: true, managed: false };

	return {
		exists: true,
		managed: fs.existsSync(managedFile),
		repository: runGit(config.upstreamRoot, ["remote", "get-url", "origin"], "UPSTREAM_IDENTITY_MISMATCH").trim(),
		commit: runGit(config.upstreamRoot, ["rev-parse", "HEAD"], "UPSTREAM_IDENTITY_MISMATCH").trim(),
		shallow:
			runGit(
				config.upstreamRoot,
				["rev-parse", "--is-shallow-repository"],
				"UPSTREAM_IDENTITY_MISMATCH",
			).trim() === "true",
		dirty: runGit(config.upstreamRoot, ["status", "--porcelain"], "UPSTREAM_IDENTITY_MISMATCH").trim().length !== 0,
	};
}

/** 准备锁定版本的浅克隆, 仅在明确允许时重建受管理的上游目录. */
export function prepareUpstream(config: ResolvedLayerConfig, options: PrepareOptions = {}): UpstreamStatus {
	if (
		!isWithin(config.controlRoot, config.upstreamRoot) ||
		path.dirname(config.upstreamRoot) !== config.controlRoot
	) {
		throw new PipelineError("CONFIG_INVALID", "Refusing to manage an upstream directory outside the control root");
	}

	let status = getUpstreamStatus(config);
	const identityMatches =
		status.exists &&
		status.managed &&
		status.repository === config.upstream.repository &&
		status.commit === config.upstream.commit &&
		status.shallow === true;

	if (status.exists && !identityMatches) {
		if (!options.clean) {
			throw new PipelineError(
				"UPSTREAM_IDENTITY_MISMATCH",
				"The existing .upstream is not the managed locked checkout; rerun with --clean to rebuild it",
				{ ...status },
			);
		}
		fs.rmSync(config.upstreamRoot, { recursive: true, force: true });
		status = { exists: false, managed: false };
	}

	if (!status.exists) {
		if (options.offline)
			throw new PipelineError("UPSTREAM_OFFLINE_MISS", "No upstream checkout is available offline");
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
			const actualCommit = runGit(
				config.upstreamRoot,
				["rev-parse", "HEAD"],
				"UPSTREAM_IDENTITY_MISMATCH",
			).trim();
			if (actualCommit !== config.upstream.commit) {
				throw new PipelineError(
					"UPSTREAM_TAG_MOVED",
					`Tag ${config.upstream.tag} resolved to ${actualCommit}, expected ${config.upstream.commit}`,
				);
			}
			fs.writeFileSync(path.join(config.upstreamRoot, ".git", managedFileName), "", "utf8");
		} catch (ex) {
			if (fs.existsSync(config.upstreamRoot)) fs.rmSync(config.upstreamRoot, { recursive: true, force: true });
			throw ex;
		}
	}

	runGit(config.upstreamRoot, ["reset", "--hard", config.upstream.commit], "UPSTREAM_RESET_FAILED");
	runGit(config.upstreamRoot, ["clean", "-ffd"], "UPSTREAM_RESET_FAILED");
	return getUpstreamStatus(config);
}

/** 使用控制层管理的 pnpm store 安装上游依赖, 并清理已失效的 node_modules 链接. */
export function installUpstreamDependencies(
	config: ResolvedLayerConfig,
	options: InstallUpstreamDependenciesOptions = {},
): void {
	const storeRoot = path.resolve(config.workRoot, "pnpm-store");
	const nodeModulesRoot = path.resolve(config.upstreamRoot, "node_modules");
	if (!isWithin(config.workRoot, storeRoot) || !isWithin(config.upstreamRoot, nodeModulesRoot)) {
		throw new PipelineError("CONFIG_INVALID", "Dependency paths must remain inside managed project directories");
	}

	const webpackEntry = path.join(nodeModulesRoot, "webpack", "bin", "webpack.js");
	if (fs.existsSync(nodeModulesRoot) && (!fs.existsSync(storeRoot) || !fs.existsSync(webpackEntry))) {
		fs.rmSync(nodeModulesRoot, { recursive: true, force: true });
	}

	fs.mkdirSync(config.workRoot, { recursive: true });
	const args = [`--config.store-dir=${storeRoot}`, "install", "--frozen-lockfile"];
	if (options.offline) args.push("--offline");
	(options.run ?? runInteractiveCommand)("pnpm", args, config.upstreamRoot, "DEPENDENCY_INSTALL_FAILED");

	if (!fs.existsSync(webpackEntry)) {
		throw new PipelineError(
			"DEPENDENCY_INSTALL_FAILED",
			"Upstream webpack dependency is unavailable after installation",
			{
				missing: webpackEntry,
				store: storeRoot,
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
