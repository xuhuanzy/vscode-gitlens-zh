import fs from "node:fs";
import path from "node:path";

import type { RuntimeDynamicDomain, RuntimeDynamicDomainContext } from "./context.mts";
import type { RuntimeDynamicSourceTarget } from "./extractor.mts";

interface TargetDefinition {
	readonly group: string;
	readonly files?: readonly string[];
	readonly directories?: readonly string[];
}

const targetsByDomain: Record<RuntimeDynamicDomain, readonly TargetDefinition[]> = {
	formatter: [
		{
			group: "commitFormatter",
			files: ["src/git/formatters/commitFormatter.ts"],
		},
		{
			group: "statusFormatter",
			files: ["src/git/formatters/statusFormatter.ts"],
		},
		{
			group: "stats",
			files: ["src/git/utils/-webview/commit.utils.ts", "src/git/utils/-webview/fileChange.utils.ts"],
		},
	],
	quickpicks: [
		{
			group: "remoteProviderPicker",
			files: ["src/quickpicks/remoteProviderPicker.ts"],
		},
		{
			group: "remoteUtils",
			files: ["packages/git/src/utils/remote.utils.ts"],
		},
		{
			group: "items",
			directories: ["src/quickpicks/items"],
		},
		{
			group: "quickWizardCommits",
			files: ["src/commands/quick-wizard/steps/commits.ts"],
		},
		{
			group: "gitReset",
			files: ["src/commands/git/reset.ts"],
		},
	],
	webviewHost: [
		{
			group: "registration",
			files: [
				"src/webviews/commitDetails/registration.ts",
				"src/webviews/home/registration.ts",
				"src/webviews/plus/graph/registration.ts",
				"src/webviews/plus/patchDetails/registration.ts",
				"src/webviews/plus/timeline/registration.ts",
				"src/webviews/welcome/registration.ts",
			],
		},
	],
};

/** 按 domain 声明加载存在的上游源码目标, 并以仓库相对路径稳定排序. */
export function loadRuntimeDynamicSourceTargets(context: RuntimeDynamicDomainContext): RuntimeDynamicSourceTarget[] {
	const results = new Map<string, RuntimeDynamicSourceTarget>();

	for (const target of targetsByDomain[context.domain]) {
		for (const file of target.files ?? []) {
			addTarget(context, results, target.group, file);
		}

		for (const directory of target.directories ?? []) {
			for (const file of enumerateSourceFiles(context.upstreamRoot, directory)) {
				addTarget(context, results, target.group, file);
			}
		}
	}

	return [...results.values()].sort((left, right) => left.file.localeCompare(right.file));
}

function addTarget(
	context: RuntimeDynamicDomainContext,
	results: Map<string, RuntimeDynamicSourceTarget>,
	group: string,
	file: string,
): void {
	const absolute = path.join(context.upstreamRoot, ...file.split("/"));
	if (!fs.existsSync(absolute)) return;

	const syntax = getSourceSyntax(file);
	if (syntax == null) return;

	results.set(file, {
		domain: context.domain,
		group: group,
		file: file,
		source: fs.readFileSync(absolute, "utf8"),
		syntax: syntax,
	});
}

function enumerateSourceFiles(rootDir: string, directory: string): string[] {
	const absoluteDirectory = path.join(rootDir, ...directory.split("/"));
	if (!fs.existsSync(absoluteDirectory)) return [];

	return fs
		.globSync("**/*.{ts,tsx}", {
			cwd: absoluteDirectory,
			exclude: ["**/__tests__/**", "**/*.d.ts", "**/*.test.ts"],
		})
		.map((file) => path.relative(rootDir, path.join(absoluteDirectory, file)).replaceAll("\\", "/"))
		.sort((left, right) => left.localeCompare(right));
}

function getSourceSyntax(file: string): RuntimeDynamicSourceTarget["syntax"] | undefined {
	if (file.endsWith(".tsx")) return "tsx";
	if (file.endsWith(".ts")) return "ts";
	return undefined;
}
