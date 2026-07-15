#!/usr/bin/env node
import { spawn } from "node:child_process";
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
import { getUpstreamStatus, installUpstreamDependencies, prepareUpstream, runInteractiveCommand } from "./upstream.mts";

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

/** 解析控制层命令并按顺序执行上游准备, i18n 生成, 构建或打包流程. */
export async function execute(args: readonly string[]): Promise<unknown> {
	const config = loadLayerConfig(controlRoot);
	const command = args[0];
	const action = args[1];
	const clean = args.includes("--clean");
	const offline = args.includes("--offline");
	const passthroughIndex = args.indexOf("--");

	switch (command) {
		case "upstream":
			switch (action) {
				case "status":
					return getUpstreamStatus(config);
				case "refresh":
					return prepareUpstream(config, { clean: clean, offline: offline });
				default:
					throw new PipelineError(
						"CONFIG_INVALID",
						"Usage: glzh upstream status|refresh [--clean] [--offline]",
					);
			}
		case "i18n":
			prepareUpstream(config, { clean: clean, offline: offline });
			switch (action) {
				case "sync":
					return syncI18n(config);
				case "report":
					return reportI18n(config);
				case "promote":
					return promoteI18n(config);
				default:
					throw new PipelineError("CONFIG_INVALID", "Usage: glzh i18n sync|report|promote");
			}
		case "build":
			return build(config, { clean: clean, offline: offline });
		case "dev":
			switch (action) {
				case "prepare":
					return prepareDevelopment(config, {
						clean: clean,
						offline: offline,
					});
				case "watch":
					return watchDevelopment(config, {
						clean: clean,
						offline: offline,
					});
				default:
					throw new PipelineError(
						"CONFIG_INVALID",
						"Usage: glzh dev prepare [--clean] [--offline] | glzh dev watch [--clean] [--offline]",
					);
			}
		case "package":
			return packageExtension(config, {
				clean: clean,
				offline: offline,
				passthrough: passthroughIndex === -1 ? [] : args.slice(passthroughIndex + 1),
			});
		case "verify":
			return verify(config, { clean: clean, offline: offline });
		default:
			throw new PipelineError(
				"CONFIG_INVALID",
				"Usage: glzh upstream|i18n|build|dev|package|verify. See README.md for command details",
			);
	}
}

function build(
	config: ReturnType<typeof loadLayerConfig>,
	options: { readonly clean: boolean; readonly offline: boolean },
): unknown {
	prepareUpstream(config, options);
	const overlay = generateAndApplySourceOverlay(config);
	installUpstreamDependencies(config, { offline: options.offline });
	runInteractiveCommand("pnpm", ["run", "build:quick"], config.upstreamRoot, "BUILD_FAILED");
	return { upstream: config.upstream.commit, overlay: summarizeOverlay(overlay), mode: "quick" };
}

function prepareDevelopment(
	config: ReturnType<typeof loadLayerConfig>,
	options: { readonly clean: boolean; readonly offline: boolean },
): unknown {
	prepareUpstream(config, options);
	const overlay = generateAndApplySourceOverlay(config);
	installUpstreamDependencies(config, { offline: options.offline });
	runInteractiveCommand("pnpm", ["run", "build:quick"], config.upstreamRoot, "BUILD_FAILED");
	const manifest = applyLocalizedManifest(config);
	return {
		upstream: config.upstream.commit,
		overlay: summarizeOverlay(overlay),
		manifest: manifest,
		mode: "development-quick",
	};
}

async function watchDevelopment(
	config: ReturnType<typeof loadLayerConfig>,
	options: { readonly clean: boolean; readonly offline: boolean },
): Promise<unknown> {
	prepareUpstream(config, options);
	const initialOverlay = generateAndApplySourceOverlay(config);
	installUpstreamDependencies(config, { offline: options.offline });
	const manifestSourceFiles = ["package.json", "package.nls.json", `package.nls.${locale}.json`].map((file) => ({
		file: file,
		contents: fs.existsSync(path.join(config.upstreamRoot, file))
			? fs.readFileSync(path.join(config.upstreamRoot, file), "utf8")
			: undefined,
	}));
	const initialManifest = applyLocalizedManifest(config);

	let refreshTimer: NodeJS.Timeout | undefined;
	let refreshCount = 0;
	const authorityRoot = path.join(config.controlRoot, "i18n", "authority");
	const refresh = () => {
		if (refreshTimer != null) clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => {
			try {
				const overlay = generateAndApplySourceOverlay(config);
				for (const source of manifestSourceFiles) {
					const target = path.join(config.upstreamRoot, source.file);
					if (source.contents == null) fs.rmSync(target, { force: true });
					else fs.writeFileSync(target, source.contents, "utf8");
				}
				const manifest = applyLocalizedManifest(config);
				refreshCount++;
				console.log(
					`[glzh] i18n overlay refreshed (${overlay.files.length} files, ${overlay.translated} translations, ${manifest.localizedKeys} manifest keys)`,
				);
			} catch (ex) {
				const error =
					ex instanceof PipelineError
						? ex
						: new PipelineError("I18N_DEV_REFRESH_FAILED", ex instanceof Error ? ex.message : String(ex));
				console.error(
					JSON.stringify(
						{ code: error.code, message: error.message, details: error.details },
						undefined,
						"\t",
					),
				);
			}
		}, 150);
	};

	const watcher = fs.watch(authorityRoot, { recursive: true }, refresh);

	console.log(`[glzh] watching ${path.relative(config.controlRoot, authorityRoot)} and upstream development sources`);
	const child = spawn(
		process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm",
		process.platform === "win32" ? ["/d", "/s", "/c", "pnpm run watch"] : ["run", "watch"],
		{
			cwd: config.upstreamRoot,
			stdio: "inherit",
		},
	);

	await new Promise<void>((resolve, reject) => {
		child.once("error", (error) => reject(new PipelineError("BUILD_FAILED", error.message)));
		child.once("exit", (code, signal) => {
			if (code === 0 || signal != null) resolve();
			else reject(new PipelineError("BUILD_FAILED", `pnpm exited with code ${code ?? 1}`));
		});
	}).finally(() => {
		if (refreshTimer != null) clearTimeout(refreshTimer);
		watcher.close();
	});

	return {
		upstream: config.upstream.commit,
		overlay: summarizeOverlay(initialOverlay),
		manifest: initialManifest,
		refreshCount: refreshCount,
		mode: "development-watch",
	};
}

function packageExtension(
	config: ReturnType<typeof loadLayerConfig>,
	options: { readonly clean: boolean; readonly offline: boolean; readonly passthrough: readonly string[] },
): unknown {
	prepareUpstream(config, options);
	const overlay = generateAndApplySourceOverlay(config);
	installUpstreamDependencies(config, { offline: options.offline });
	runInteractiveCommand("pnpm", ["run", "check"], config.upstreamRoot, "BUILD_FAILED");
	runInteractiveCommand("pnpm", ["run", "bundle:quick"], config.upstreamRoot, "BUILD_FAILED");
	const manifest = applyLocalizedManifest(config);
	fs.mkdirSync(config.artifactsRoot, { recursive: true });
	const packageJson = JSON.parse(fs.readFileSync(path.join(config.upstreamRoot, "package.json"), "utf8")) as {
		name: string;
		version: string;
	};
	const artifact = path.join(config.artifactsRoot, `${packageJson.name}-${packageJson.version}-${locale}.vsix`);
	runInteractiveCommand(
		"pnpm",
		["exec", "vsce", "package", "--no-dependencies", "--out", artifact, ...options.passthrough],
		config.upstreamRoot,
		"PACKAGE_FAILED",
	);
	return {
		upstream: config.upstream.commit,
		overlay: summarizeOverlay(overlay),
		manifest: manifest,
		artifact: artifact,
	};
}

function verify(
	config: ReturnType<typeof loadLayerConfig>,
	options: { readonly clean: boolean; readonly offline: boolean },
): unknown {
	const upstream = prepareUpstream(config, options);
	const overlay = generateAndApplySourceOverlay(config);
	return { upstream: upstream, overlay: summarizeOverlay(overlay) };
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
	if (code.startsWith("I18N_")) return 5;
	if (code.startsWith("DEPENDENCY_")) return 6;
	if (code === "BUILD_FAILED") return 7;
	if (code === "PACKAGE_FAILED") return 8;
	return 1;
}
