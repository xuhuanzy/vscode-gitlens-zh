import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { I18nLayerOptions } from "../core/context.mts";

export function createTestLayerOptions(rootDir: string): I18nLayerOptions {
	return {
		controlRoot: rootDir,
		upstreamRoot: rootDir,
		workRoot: path.join(rootDir, ".work"),
	};
}

/** 在系统临时目录中运行文件系统测试, 并在结束后清理测试根目录. */
export function withTempRoot(prefix: string, run: (rootDir: string) => void): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	try {
		run(rootDir);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}
