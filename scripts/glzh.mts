#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { loadLayerConfig, locale, PipelineError } from "./config.mts";
import {
	applyLocalizedManifest,
	generateAndApplySourceOverlay,
	promoteI18n,
	reportI18n,
	syncI18n,
} from "./overlay.mts";
import {
	applyConfiguredPatches,
	getUpstreamStatus,
	markFullBuildComplete,
	prepareUpstream,
	runInteractiveCommand,
	runUpstreamScript,
} from "./upstream.mts";

const controlRoot = path.resolve(import.meta.dirname, "..");

if (path.resolve(process.argv[1] ?? "") === import.meta.filename) {
	try {
		const result = await execute(process.argv.slice(2));
		if (result != null) console.log(JSON.stringify(result, undefined, "\t"));
	} catch (ex) {
		const error =
			ex instanceof PipelineError
				? ex
				: new PipelineError("UNEXPECTED", ex instanceof Error ? ex.message : String(ex));
		console.error(
			JSON.stringify({ code: error.code, message: error.message, details: error.details }, undefined, "\t"),
		);
		process.exitCode = exitCode(error.code);
	}
}

/** 解析控制层命令, 将纯上游操作与本地化重放及制品流程分开执行. */
export async function execute(args: readonly string[], root = controlRoot): Promise<unknown> {
	const config = loadLayerConfig(root);
	const passthroughIndex = args.indexOf("--");
	const controllerArgs = passthroughIndex === -1 ? args : args.slice(0, passthroughIndex);
	const passthrough = passthroughIndex === -1 ? [] : args.slice(passthroughIndex + 1);
	const option = controllerArgs.find((arg) => arg.startsWith("--"));
	if (option != null) {
		throw new PipelineError("CONFIG_INVALID", `Unknown option: ${option}`);
	}

	const command = controllerArgs[0];
	const action = controllerArgs[1];
	if (command !== "package" && passthrough.length !== 0) {
		throw new PipelineError("CONFIG_INVALID", "Only glzh package accepts arguments after --");
	}

	switch (command) {
		case "upstream":
			if (controllerArgs.length !== 2) {
				throw new PipelineError("CONFIG_INVALID", "Usage: glzh upstream status|refresh|build|build:quick");
			}
			switch (action) {
				case "status":
					return getUpstreamStatus(config);
				case "refresh":
					return prepareUpstream(config, { requireFullBuild: true });
				case "build":
				case "build:quick":
					runUpstreamScript(config, action);
					if (action === "build") markFullBuildComplete(config);
					return { upstream: config.upstream.commit, script: action };
				default:
					throw new PipelineError("CONFIG_INVALID", "Usage: glzh upstream status|refresh|build|build:quick");
			}
		case "i18n":
			if (controllerArgs.length !== 2) {
				throw new PipelineError("CONFIG_INVALID", "Usage: glzh i18n sync|report|promote|overlay");
			}
			switch (action) {
				case "sync":
					prepareUpstream(config);
					return syncI18n(config);
				case "report":
					prepareUpstream(config);
					return reportI18n(config);
				case "promote":
					return promoteI18n(config);
				case "overlay": {
					const prepared = prepareLocalizedUpstream(config);
					const manifest = applyLocalizedManifest(config);
					return {
						upstream: config.upstream.commit,
						patches: prepared.patches,
						overlay: prepared.overlay,
						manifest: manifest,
						mode: "overlay",
					};
				}
				default:
					throw new PipelineError("CONFIG_INVALID", "Usage: glzh i18n sync|report|promote|overlay");
			}
		case "build": {
			if (controllerArgs.length !== 1) {
				throw new PipelineError("CONFIG_INVALID", "Usage: glzh build");
			}
			const prepared = prepareLocalizedUpstream(config);
			const requiresFullBuild = prepared.status.requiresFullBuild;
			runUpstreamScript(config, requiresFullBuild ? "build" : "build:quick");
			if (requiresFullBuild) markFullBuildComplete(config);
			const manifest = applyLocalizedManifest(config);
			return {
				upstream: config.upstream.commit,
				patches: prepared.patches,
				overlay: prepared.overlay,
				manifest: manifest,
				mode: requiresFullBuild ? "full" : "quick",
			};
		}
		case "package":
			if (controllerArgs.length !== 1) {
				throw new PipelineError("CONFIG_INVALID", "Usage: glzh package [-- <vsce arguments>]");
			}
			return packageExtension(config, passthrough);
		default:
			throw new PipelineError(
				"CONFIG_INVALID",
				"Usage: glzh upstream|i18n|build|package. See README.md for command details",
			);
	}
}

function prepareLocalizedUpstream(config: ReturnType<typeof loadLayerConfig>) {
	const status = prepareUpstream(config);
	const patches = applyConfiguredPatches(config);
	const overlay = generateAndApplySourceOverlay(config);
	return { status: status, patches: patches, overlay: summarizeOverlay(overlay) };
}

function packageExtension(config: ReturnType<typeof loadLayerConfig>, passthrough: readonly string[]): unknown {
	const prepared = prepareLocalizedUpstream(config);
	runUpstreamScript(config, "bundle");
	const manifest = applyLocalizedManifest(config);
	fs.mkdirSync(config.artifactsRoot, { recursive: true });
	const packageJson = JSON.parse(fs.readFileSync(path.join(config.upstreamRoot, "package.json"), "utf8")) as {
		name: string;
		version: string;
	};
	const artifact = path.join(config.artifactsRoot, `${packageJson.name}-${packageJson.version}-${locale}.vsix`);
	runInteractiveCommand(
		"pnpm",
		["exec", "vsce", "package", "--no-dependencies", "--out", artifact, ...passthrough],
		config.upstreamRoot,
		"PACKAGE_FAILED",
	);
	return {
		upstream: config.upstream.commit,
		patches: prepared.patches,
		overlay: prepared.overlay,
		manifest: manifest,
		artifact: artifact,
	};
}

function summarizeOverlay(overlay: ReturnType<typeof generateAndApplySourceOverlay>) {
	return {
		fileCount: overlay.files.length,
		translated: overlay.translated,
		unresolved: overlay.unresolved,
	};
}

function exitCode(code: string): number {
	if (code.startsWith("CONFIG_")) return 2;
	if (code.startsWith("UPSTREAM_")) return 3;
	if (code.startsWith("PATCH_")) return 4;
	if (code.startsWith("I18N_")) return 5;
	if (code.startsWith("DEPENDENCY_")) return 6;
	if (code === "BUILD_FAILED") return 7;
	if (code === "PACKAGE_FAILED") return 8;
	return 1;
}
