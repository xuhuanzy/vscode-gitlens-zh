import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

const controlRoot = path.resolve(import.meta.dirname, "..", "..");

test("VS Code launch configurations always debug the prepared upstream tree", () => {
	const launchFile = path.join(controlRoot, ".vscode", "launch.json");
	const parsed = ts.parseConfigFileTextToJson(launchFile, fs.readFileSync(launchFile, "utf8"));
	assert.equal(parsed.error, undefined);
	const launch = parsed.config as {
		configurations: Array<{
			args: string[];
			debugWebviews: boolean;
			outFiles: string[];
			rendererDebugOptions: { outFiles: string[]; webRoot: string };
			preLaunchTask: string;
		}>;
	};

	assert.equal(launch.configurations.length, 2);
	assert.deepEqual(
		launch.configurations.map((configuration) => configuration.preLaunchTask),
		["glzh: prepare", "glzh: watch"],
	);
	for (const configuration of launch.configurations) {
		assert.equal(configuration.args.includes("--extensionDevelopmentPath=${workspaceFolder}/.upstream"), true);
		assert.equal(configuration.debugWebviews, true);
		assert.deepEqual(configuration.outFiles, ["${workspaceFolder}/.upstream/dist/**/*.js"]);
		assert.deepEqual(configuration.rendererDebugOptions.outFiles, [
			"${workspaceFolder}/.upstream/dist/webviews/**/*.js",
		]);
		assert.equal(configuration.rendererDebugOptions.webRoot, "${workspaceFolder}/.upstream/src/webviews/apps");
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
	assert.notEqual(prepare, undefined);
	assert.deepEqual(prepare?.args, ["glzh", "dev", "prepare"]);
	assert.notEqual(watch, undefined);
	assert.deepEqual(watch?.args, ["glzh", "dev", "watch"]);
	assert.equal(watch?.isBackground, true);
	assert.equal(typeof watch?.problemMatcher, "object");
});
