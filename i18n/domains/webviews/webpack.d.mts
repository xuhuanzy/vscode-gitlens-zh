import type { Compiler, Configuration, WebpackError } from 'webpack';

export interface WebviewEntry {
	readonly entry: string;
	readonly plus?: boolean;
	readonly alias?: Record<string, string>;
}

export type WebviewEntries = Record<string, WebviewEntry>;

export function getLocalizedWebviewEntries(options: {
	readonly rootDir: string;
	readonly webviews: WebviewEntries;
	readonly locale: string;
}): WebviewEntries;

export function isLocalizedDynamicWebview(name: string): boolean;

export function createLocalizedWebviewConfig(options: {
	readonly rootDir: string;
	readonly webviews: WebviewEntries;
	readonly locale: string;
	readonly config: Configuration;
	readonly dependencies?: string[];
	readonly excludePlugin: (plugin: unknown) => boolean;
}): Configuration;

export class GenerateLocalizedDynamicSourcesPlugin {
	readonly pluginName: string;
	readonly rootDir: string;
	readonly locale: string;
	readonly pathsToWatch: string[];

	constructor(options: { readonly rootDir: string; readonly locale: string });
	apply(compiler: Compiler): void;
}

export class GenerateLocalizedSettingsShellPlugin {
	readonly pluginName: string;
	readonly rootDir: string;
	readonly WebpackError: typeof WebpackError;

	constructor(options: { readonly rootDir: string; readonly WebpackError: typeof WebpackError });
	apply(compiler: Compiler): void;
}

export class LocalizedWebviewSourcePlugin {
	readonly pluginName: string;
	readonly sourceAppRoot: string;
	readonly localizedAppRoot: string;

	constructor(options: { readonly rootDir: string; readonly locale: string });
	apply(compiler: Compiler): void;
	getLocalizedResource(resource: string): string | undefined;
}
