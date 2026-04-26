import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * @typedef {string | RegExp | Array<string | RegExp> | undefined} WatchIgnored
 */

/**
 * @typedef {{ entry: string; plus?: boolean; alias?: Record<string, string>; template?: string }} WebviewEntry
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
		const localizedTemplate = getLocalizedWebviewTemplate(name);
		if (localizedEntry == null && localizedTemplate == null) continue;

		localized[name] = {
			...config,
			...(localizedEntry == null
				? {}
				: {
						entry: path.join(
							getGeneratedRootDir(options.rootDir, options.locale),
							...localizedEntry.split('/'),
						),
					}),
			...(localizedTemplate == null
				? {}
				: {
						template: path.join(
							getGeneratedRootDir(options.rootDir, options.locale),
							...localizedTemplate.split('/'),
						),
					}),
		};
	}

	return localized;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isLocalizedDynamicWebview(name) {
	return getLocalizedWebviewEntry(name) != null || getLocalizedWebviewTemplate(name) != null;
}

/**
 * @param {{
 *   rootDir: string;
 *   webviews: WebviewEntries;
 *   locale: string;
 *   config: import('webpack').Configuration;
 *   dependencies?: string[];
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
		dependencies: options.dependencies,
		entry: Object.fromEntries(Object.entries(options.webviews).map(([name, { entry }]) => [name, entry])),
		output: {
			...options.config.output,
			path: path.join(options.rootDir, 'dist', 'webviews'),
			publicPath: '#{root}/dist/webviews/',
			clean: false,
		},
		watchOptions: {
			...(options.config.watchOptions ?? {}),
			ignored: addIgnoredPaths(options.config.watchOptions?.ignored, [
				getGeneratedRootDir(options.rootDir, options.locale),
				path.join(options.rootDir, 'i18n', 'catalog'),
				path.join(options.rootDir, 'i18n', 'worksets'),
				path.join(options.rootDir, 'i18n', 'reports'),
			]),
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
		case 'composer':
			return 'src/webviews/apps/plus/composer/composer.ts';
		default:
			return undefined;
	}
}

/**
 * @param {string} name
 * @returns {string | undefined}
 */
function getLocalizedWebviewTemplate(name) {
	switch (name) {
		case 'settings':
			return 'src/webviews/apps/settings/settings.html';
		default:
			return undefined;
	}
}

/**
 * @param {string} rootDir
 * @param {string} locale
 * @returns {string}
 */
function getGeneratedRootDir(rootDir, locale) {
	return path.join(rootDir, '.work', 'i18n', 'generated', locale);
}

export class GenerateLocalizedDynamicSourcesPlugin {
	pluginName = 'GenerateLocalizedDynamicSourcesPlugin';

	/**
	 * @param {{ rootDir: string; locale: string }} options
	 */
	constructor(options) {
		this.rootDir = options.rootDir;
		this.locale = options.locale;
		this.pathsToWatch = [
			path.join(this.rootDir, 'src', 'webviews', 'apps'),
			path.join(this.rootDir, 'i18n', 'authority'),
		];
	}

	/**
	 * @param {import('webpack').Compiler} compiler
	 */
	apply(compiler) {
		const runGeneration = async () => {
			runWebviewGeneration(this.rootDir, ['--dynamic-sources-only'], 'localized dynamic source generation');
			runWebviewGeneration(this.rootDir, ['--settings-sources-only'], 'localized settings source generation');
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

/**
 * @param {string} rootDir
 * @param {string[]} flags
 * @param {string} description
 */
function runWebviewGeneration(rootDir, flags, description) {
	const result = spawnSync(
		process.execPath,
		[path.join(rootDir, 'i18n', 'cli.mts'), 'webviews', 'generate', '--root', rootDir, ...flags],
		{
			cwd: rootDir,
			stdio: 'inherit',
			env: {
				...process.env,
				NODE_FORCE_COLORS: '1',
				FORCE_COLOR: '1',
			},
		},
	);
	if (result.status !== 0) {
		throw new Error(`${description} failed with exit code ${result.status}`);
	}
}

/**
 * @param {WatchIgnored} ignored
 * @param {string[]} paths
 * @returns {WatchIgnored}
 */
function addIgnoredPaths(ignored, paths) {
	const normalizedPaths = paths.map(value => value.replaceAll('\\', '/'));
	if (ignored == null) return normalizedPaths;
	if (Array.isArray(ignored)) return [...ignored, ...normalizedPaths];
	return [ignored, ...normalizedPaths];
}

export class LocalizedWebviewSourcePlugin {
	/**
	 * @param {{ rootDir: string; locale: string }} options
	 */
	constructor(options) {
		this.pluginName = 'LocalizedWebviewSourcePlugin';
		this.sourceAppRoot = path.join(options.rootDir, 'src', 'webviews', 'apps');
		this.localizedAppRoot = path.join(
			getGeneratedRootDir(options.rootDir, options.locale),
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
				this.localizeResolveData(resolveData);
			});
		});
	}

	/**
	 * @param {import('webpack').ResolveData} resolveData
	 * @returns {boolean}
	 */
	localizeResolveData(resolveData) {
		const createData = resolveData.createData;
		const resource = createData?.resource;
		if (resource == null) return false;

		const localizedResource = this.getLocalizedResource(resource);
		if (localizedResource == null) return false;

		const localizedContext = path.dirname(localizedResource);
		createData.resource = localizedResource;
		createData.context = localizedContext;
		createData.request = replaceResourceInRequest(createData.request, resource, localizedResource);
		createData.userRequest = replaceResourceInRequest(createData.userRequest, resource, localizedResource);
		resolveData.context = localizedContext;

		return true;
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

/**
 * @param {string | undefined} value
 * @param {string} resource
 * @param {string} localizedResource
 * @returns {string | undefined}
 */
function replaceResourceInRequest(value, resource, localizedResource) {
	return value == null ? value : value.split(resource).join(localizedResource);
}
