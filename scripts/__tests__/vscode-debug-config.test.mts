import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

import ts from "typescript";

const controlRoot = path.resolve(import.meta.dirname, "..", "..");

test("VS Code launch configurations always debug the prepared upstream tree", () => {
	const launchFile = path.join(controlRoot, ".vscode", "launch.json");
	const parsed = ts.parseConfigFileTextToJson(launchFile, fs.readFileSync(launchFile, "utf8"));
	expect(parsed.error).toBeUndefined();
	const launch = parsed.config as {
		configurations: Array<{
			args: string[];
			debugWebviews: boolean;
			outFiles: string[];
			rendererDebugOptions: { outFiles: string[]; webRoot: string };
			preLaunchTask: string;
		}>;
	};

	expect(launch.configurations.length).toBe(2);
	expect(launch.configurations.map((configuration) => configuration.preLaunchTask)).toEqual([
		"glzh: prepare",
		"glzh: watch",
	]);
	for (const configuration of launch.configurations) {
		expect(configuration.args).toContain("--extensionDevelopmentPath=${workspaceFolder}/.upstream");
		expect(configuration.debugWebviews).toBe(true);
		expect(configuration.outFiles).toEqual(["${workspaceFolder}/.upstream/dist/**/*.js"]);
		expect(configuration.rendererDebugOptions.outFiles).toEqual([
			"${workspaceFolder}/.upstream/dist/webviews/**/*.js",
		]);
		expect(configuration.rendererDebugOptions.webRoot).toBe("${workspaceFolder}/.upstream/src/webviews/apps");
	}
});

test("VS Code tasks delegate both development modes to the project controller", () => {
	const tasks = JSON.parse(fs.readFileSync(path.join(controlRoot, ".vscode", "tasks.json"), "utf8")) as {
		tasks: Array<{
			label: string;
			args?: string[];
			isBackground?: boolean;
			problemMatcher?: unknown;
		}>;
	};

	const prepare = tasks.tasks.find((task) => task.label === "glzh: prepare");
	const watch = tasks.tasks.find((task) => task.label === "glzh: watch");
	expect(prepare).toBeDefined();
	expect(prepare?.args).toEqual(["glzh", "dev", "prepare"]);
	expect(watch).toBeDefined();
	expect(watch?.args).toEqual(["glzh", "dev", "watch"]);
	expect(watch?.isBackground).toBe(true);
	expect(typeof watch?.problemMatcher).toBe("object");
});
