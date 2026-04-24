import { spawnSync } from 'child_process';
import path from 'path';

const runtimeDynamicDomains = ['formatter', 'quickpicks'];

export class GenerateLocalizedRuntimeDynamicSourcesPlugin {
	static _generationPromise;
	pluginName = 'GenerateLocalizedRuntimeDynamicSourcesPlugin';

	/**
	 * @param {{ rootDir: string; locale: string }} options
	 */
	constructor(options) {
		this.rootDir = options.rootDir;
		this.locale = options.locale;
		this.pathsToWatch = [
			path.join(this.rootDir, 'src', 'git', 'formatters'),
			path.join(this.rootDir, 'src', 'git', 'utils', '-webview'),
			path.join(this.rootDir, 'src', 'quickpicks', 'remoteProviderPicker.ts'),
			path.join(this.rootDir, 'src', 'quickpicks', 'items'),
			path.join(this.rootDir, 'src', 'commands', 'quick-wizard', 'steps', 'commits.ts'),
			path.join(this.rootDir, 'packages', 'git', 'src', 'utils', 'remote.utils.ts'),
			path.join(this.rootDir, 'i18n', 'authority'),
			path.join(this.rootDir, 'i18n', 'catalog'),
		];
	}

	/**
	 * @param {import('webpack').Compiler} compiler
	 */
	apply(compiler) {
		const runGeneration = async () => {
			if (GenerateLocalizedRuntimeDynamicSourcesPlugin._generationPromise != null) {
				return GenerateLocalizedRuntimeDynamicSourcesPlugin._generationPromise;
			}

			GenerateLocalizedRuntimeDynamicSourcesPlugin._generationPromise = Promise.resolve().then(() =>
				this.generate(),
			);
			try {
				return await GenerateLocalizedRuntimeDynamicSourcesPlugin._generationPromise;
			} finally {
				GenerateLocalizedRuntimeDynamicSourcesPlugin._generationPromise = undefined;
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

	generate() {
		for (const domain of runtimeDynamicDomains) {
			const result = spawnSync(
				process.execPath,
				[
					path.join(this.rootDir, 'i18n', 'domains', 'runtimeDynamic', 'generateRuntimeDynamicNls.mts'),
					'--root',
					this.rootDir,
					'--domain',
					domain,
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
				throw new Error(
					`localized runtime dynamic source generation for ${domain} failed with exit code ${result.status}`,
				);
			}
		}
	}
}
