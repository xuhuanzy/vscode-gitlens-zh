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

	expect(launch.configurations).toHaveLength(1);
	expect(launch.configurations[0]).toMatchObject({
		args: expect.arrayContaining(["--extensionDevelopmentPath=${workspaceFolder}/.upstream"]),
		debugWebviews: true,
		outFiles: ["${workspaceFolder}/.upstream/dist/**/*.js"],
		preLaunchTask: "glzh: build",
		rendererDebugOptions: {
			outFiles: ["${workspaceFolder}/.upstream/dist/webviews/**/*.js"],
			webRoot: "${workspaceFolder}/.upstream/src/webviews/apps",
		},
	});
});

test("VS Code build task delegates the localized build to the project controller", () => {
	const tasks = JSON.parse(fs.readFileSync(path.join(controlRoot, ".vscode", "tasks.json"), "utf8")) as {
		tasks: Array<{
			label: string;
			args?: string[];
		}>;
	};

	expect(tasks.tasks).toHaveLength(1);
	expect(tasks.tasks[0]?.label).toBe("glzh: build");
	expect(tasks.tasks[0]?.args).toEqual(["build"]);
});
