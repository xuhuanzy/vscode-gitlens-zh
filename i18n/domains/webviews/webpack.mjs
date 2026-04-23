import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * @typedef {{ entry: string; plus?: boolean; alias?: Record<string, string> }} WebviewEntry
 * @typedef {Record<string, WebviewEntry>} WebviewEntries
 */

/**
 * @param {{ rootDir: string; webviews: WebviewEntries; locale: string }} options
 * @returns {WebviewEntries}
 */
export function getLocalizedWebviewEntries(options) {
	/** @type {WebviewEntries} */
	const localized = {};

	for (const [name, config] of Object.entries(options.webviews)) {
		const localizedEntry = getLocalizedWebviewEntry(name);
		if (localizedEntry == null) continue;

		const absoluteEntry = path.join(
			options.rootDir,
			'.work',
			'i18n',
			'webviews-sources',
			options.locale,
			...localizedEntry.split('/'),
		);
		if (!fs.existsSync(absoluteEntry)) continue;

		localized[name] = { ...config, entry: absoluteEntry };
	}

	return localized;
}

/**
 * @param {{
 *   rootDir: string;
 *   webviews: WebviewEntries;
 *   locale: string;
 *   config: import('webpack').Configuration;
 *   excludePlugin: (plugin: unknown) => boolean;
 * }} options
 */
export function createLocalizedWebviewConfig(options) {
	const plugins = (options.config.plugins ?? []).filter(plugin => !options.excludePlugin(plugin));
	plugins.push(new GenerateLocalizedDynamicSourcesPlugin({ rootDir: options.rootDir, locale: options.locale }));
	plugins.push(new LocalizedWebviewSourcePlugin({ rootDir: options.rootDir, locale: options.locale }));

	return {
		...options.config,
		name: `webviews:i18n:${options.locale}`,
		context: options.rootDir,
		entry: Object.fromEntries(Object.entries(options.webviews).map(([name, { entry }]) => [name, entry])),
		output: {
			...options.config.output,
			path: path.join(options.rootDir, 'dist', 'webviews', 'i18n', options.locale),
			publicPath: `#{root}/dist/webviews/i18n/${options.locale}/`,
			clean: false,
		},
		plugins: plugins,
		resolve: {
			...options.config.resolve,
			modules: [options.rootDir, ...(options.config.resolve?.modules ?? [])],
		},
	};
}

/**
 * @param {string} name
 * @returns {string | undefined}
 */
function getLocalizedWebviewEntry(name) {
	switch (name) {
		case 'welcome':
			return 'src/webviews/apps/welcome/welcome.ts';
		case 'rebase':
			return 'src/webviews/apps/rebase/rebase.ts';
		case 'home':
			return 'src/webviews/apps/home/home.ts';
		case 'commitDetails':
			return 'src/webviews/apps/commitDetails/commitDetails.ts';
		case 'timeline':
			return 'src/webviews/apps/plus/timeline/timeline.ts';
		case 'graph':
			return 'src/webviews/apps/plus/graph/graph.ts';
		default:
			return undefined;
	}
}

export class GenerateLocalizedDynamicSourcesPlugin {
	pluginName = 'GenerateLocalizedDynamicSourcesPlugin';

	/**
	 * @param {{ rootDir: string; locale: string }} options
	 */
	constructor(options) {
		this.rootDir = options.rootDir;
		this.locale = options.locale;
		this.pathsToWatch = [path.join(this.rootDir, 'src', 'webviews', 'apps'), path.join(this.rootDir, 'i18n')];
	}

	/**
	 * @param {import('webpack').Compiler} compiler
	 */
	apply(compiler) {
		const runGeneration = async () => {
			const result = spawnSync(
				process.execPath,
				[
					path.join(this.rootDir, 'i18n', 'domains', 'webviews', 'generateWebviewNls.mts'),
					'--root',
					this.rootDir,
					'--dynamic-sources-only',
				],
				{
					cwd: this.rootDir,
					stdio: 'inherit',
					env: {
						...process.env,
						NODE_FORCE_COLORS: '1',
						FORCE_COLOR: '1',
					},
				},
			);
			if (result.status !== 0) {
				throw new Error(`localized dynamic source generation failed with exit code ${result.status}`);
			}
		};

		compiler.hooks.beforeRun.tapPromise(this.pluginName, runGeneration);
		compiler.hooks.watchRun.tapPromise(this.pluginName, runGeneration);
		compiler.hooks.thisCompilation.tap(this.pluginName, compilation => {
			for (const watchedPath of this.pathsToWatch) {
				compilation.contextDependencies.add(watchedPath);
			}
		});
	}
}

export class GenerateLocalizedSettingsShellPlugin {
	pluginName = 'GenerateLocalizedSettingsShellPlugin';

	/**
	 * @param {{ rootDir: string; WebpackError: typeof import('webpack').WebpackError }} options
	 */
	constructor(options) {
		this.rootDir = options.rootDir;
		this.WebpackError = options.WebpackError;
	}

	/**
	 * @param {import('webpack').Compiler} compiler
	 */
	apply(compiler) {
		compiler.hooks.afterEmit.tap(this.pluginName, compilation => {
			const result = spawnSync(
				process.execPath,
				[
					path.join(this.rootDir, 'i18n', 'domains', 'webviews', 'generateWebviewNls.mts'),
					'--settings-shell-only',
				],
				{
					cwd: this.rootDir,
					stdio: 'inherit',
					env: {
						...process.env,
						NODE_FORCE_COLORS: '1',
						FORCE_COLOR: '1',
					},
				},
			);
			if (result.status !== 0) {
				compilation.errors.push(
					new this.WebpackError(`localized settings shell generation failed with exit code ${result.status}`),
				);
			}
		});
	}
}

export class LocalizedWebviewSourcePlugin {
	/**
	 * @param {{ rootDir: string; locale: string }} options
	 */
	constructor(options) {
		this.pluginName = 'LocalizedWebviewSourcePlugin';
		this.sourceAppRoot = path.join(options.rootDir, 'src', 'webviews', 'apps');
		this.localizedAppRoot = path.join(
			options.rootDir,
			'.work',
			'i18n',
			'webviews-sources',
			options.locale,
			'src',
			'webviews',
			'apps',
		);
	}

	/**
	 * @param {import('webpack').Compiler} compiler
	 */
	apply(compiler) {
		compiler.hooks.normalModuleFactory.tap(this.pluginName, normalModuleFactory => {
			normalModuleFactory.hooks.afterResolve.tap(this.pluginName, resolveData => {
				const resource = resolveData.createData?.resource;
				if (resource == null) return;

				const localizedResource = this.getLocalizedResource(resource);
				if (localizedResource == null) return;

				resolveData.createData.resource = localizedResource;
			});
		});
	}

	/**
	 * @param {string} resource
	 * @returns {string | undefined}
	 */
	getLocalizedResource(resource) {
		const normalized = path.normalize(resource);
		const relative = path.relative(this.sourceAppRoot, normalized);
		if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined;

		const localized = path.join(this.localizedAppRoot, relative);
		return fs.existsSync(localized) ? localized : undefined;
	}
}
