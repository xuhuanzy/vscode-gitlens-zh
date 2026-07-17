import fs from "node:fs";
import path from "node:path";

export interface UpstreamConfig {
	readonly repository: string;
	readonly tag: string;
	readonly commit: string;
}

export interface LayerConfig {
	readonly applyPatches: boolean;
	readonly upstream: UpstreamConfig;
}

export const upstreamDirectory = ".upstream";
export const locale = "zh-cn";

export interface ResolvedLayerConfig extends LayerConfig {
	readonly controlRoot: string;
	readonly upstreamRoot: string;
	readonly workRoot: string;
	readonly artifactsRoot: string;
}

export class PipelineError extends Error {
	readonly code: string;
	readonly details?: Readonly<Record<string, unknown>>;

	constructor(code: string, message: string, details?: Readonly<Record<string, unknown>>) {
		super(message);
		this.name = "PipelineError";
		this.code = code;
		this.details = details;
	}
}

/** 加载并校验控制仓库配置, 同时解析所有受管理目录. */
export function loadLayerConfig(controlRoot: string): ResolvedLayerConfig {
	const resolvedControlRoot = path.resolve(controlRoot);
	const configFile = path.join(resolvedControlRoot, "gitlens-zh.config.json");
	const config = readJson<LayerConfig>(configFile);
	if (typeof config.applyPatches !== "boolean") {
		throw new PipelineError("CONFIG_INVALID", "applyPatches must be a boolean");
	}
	if (!/^[0-9a-f]{40}$/u.test(config.upstream.commit)) {
		throw new PipelineError("CONFIG_INVALID", "upstream.commit must be a full lowercase Git SHA");
	}

	const upstreamRoot = path.resolve(resolvedControlRoot, upstreamDirectory);

	return {
		...config,
		controlRoot: resolvedControlRoot,
		upstreamRoot: upstreamRoot,
		workRoot: path.join(resolvedControlRoot, ".work"),
		artifactsRoot: path.join(resolvedControlRoot, "artifacts"),
	};
}

export function isWithin(root: string, target: string): boolean {
	const relative = path.relative(path.resolve(root), path.resolve(target));
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function readJson<T>(file: string): T {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8")) as T;
	} catch (ex) {
		throw new PipelineError("CONFIG_INVALID", `Unable to read JSON file: ${file}`, {
			cause: ex instanceof Error ? ex.message : String(ex),
		});
	}
}
