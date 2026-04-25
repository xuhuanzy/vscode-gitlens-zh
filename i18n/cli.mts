#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { I18nDomain, PendingReportFile } from './core/model.mts';
import { createManifestDomainContext } from './domains/manifest/context.mts';
import {
	createPendingReport as createManifestPendingReport,
	generateManifestLocalizedOutputs,
	promoteManifestAuthority,
	syncManifestI18n,
} from './domains/manifest/workflow.mts';
import {
	createPendingReport as createRuntimeDynamicPendingReport,
	ensureRuntimeDynamicDomainFiles,
	generateRuntimeDynamicLocalizedOutputs,
	promoteRuntimeDynamicAuthority,
	syncRuntimeDynamicI18n,
} from './domains/runtimeDynamic/workflow.mts';
import type { RuntimeDynamicDomain } from './domains/runtimeDynamic/context.mts';
import { createWebviewsDomainContext } from './domains/webviews/context.mts';
import {
	createPendingReport as createWebviewPendingReport,
	ensureControlledWebviewFiles,
	generateWebviewsLocalizedDynamicSources,
	generateWebviewsLocalizedOutputs,
	generateWebviewsLocalizedSettingsShell,
	promoteWebviewsAuthority,
	syncWebviewsI18n,
} from './domains/webviews/workflow.mts';
import { execute as executeAuthorityMessagesReview } from './authority/messagesReview.mts';

const args = process.argv.slice(2);
const runtimeDynamicDomains: readonly RuntimeDynamicDomain[] = ['formatter', 'quickpicks', 'webviewHost'];

type AggregatePendingReportEntry =
	| {
			readonly domain: I18nDomain;
			readonly skipped?: false;
			readonly counts: PendingReportFile['counts'];
			readonly coverage: PendingReportFile['coverage'];
			readonly sinceBase?: PendingReportFile['sinceBase'];
	  }
	| {
			readonly domain: I18nDomain;
			readonly skipped: true;
			readonly reason: string;
			readonly requiredFile?: string;
	  };

if (isDirectExecution()) {
	try {
		execute(args);
	} catch (ex) {
		console.error(ex instanceof Error ? ex.message : String(ex));
		process.exitCode = 1;
	}
}

export function execute(args: readonly string[]): void {
	const domain = args[0];
	const action = args[1];
	const rest = args.slice(2);

	switch (domain) {
		case 'sync':
			runSync(args.slice(1));
			break;
		case 'promote':
			runPromote(args.slice(1));
			break;
		case 'report':
			runReport(args.slice(1));
			break;
		case 'generate':
			runGenerate(args.slice(1));
			break;
		case 'manifest':
			runManifest(action, rest);
			break;
		case 'webviews':
			runWebviews(action, rest);
			break;
		case 'formatter':
		case 'quickpicks':
		case 'webviewHost':
			runRuntimeDynamic(action, domain, rest);
			break;
		case 'authority':
			runAuthority(action, rest);
			break;
		default:
			printUsageAndExit(`Unknown i18n domain: ${domain ?? '<missing>'}`);
	}
}

function runSync(args: readonly string[]): void {
	const rootDir = readOption(args, '--root');

	const manifest = syncManifestI18n({ rootDir: rootDir });
	console.log(
		`Synchronized package manifest i18n: ${manifest.occurrenceCount} occurrences, ${manifest.worksetCount} workset entries`,
	);

	for (const domain of runtimeDynamicDomains) {
		const result = syncRuntimeDynamicI18n({ rootDir: rootDir, domain: domain });
		console.log(
			`Synchronized ${result.context.domain} runtime dynamic i18n: ${result.occurrenceCount} occurrences, ${result.worksetCount} workset entries`,
		);
	}

	const webviews = getRunnableWebviewsContext(rootDir, args);
	if (webviews.skipped) {
		console.log(`Skipped webview i18n sync: ${webviews.reason}`);
		return;
	}

	const result = syncWebviewsI18n({ rootDir: webviews.context.rootDir });
	console.log(
		`Synchronized webview i18n: ${result.occurrenceCount} occurrences, ${result.worksetCount} workset entries`,
	);
}

function runPromote(args: readonly string[]): void {
	const rootDir = readOption(args, '--root');

	const manifest = promoteManifestAuthority({ rootDir: rootDir });
	console.log(`Promoted package manifest translations: ${manifest.promoted.length}`);

	for (const domain of runtimeDynamicDomains) {
		const result = promoteRuntimeDynamicAuthority({ rootDir: rootDir, domain: domain });
		console.log(`Promoted ${result.context.domain} runtime dynamic translations: ${result.promoted.length}`);
	}

	if (readBooleanFlag(args, '--skip-webviews')) {
		console.log('Skipped webview translation promotion: --skip-webviews was provided');
		return;
	}

	const webviews = promoteWebviewsAuthority({ rootDir: rootDir });
	console.log(`Promoted webview translations: ${webviews.promoted.length}`);
}

function runReport(args: readonly string[]): void {
	const rootDir = readOption(args, '--root');
	const baseRef = readOption(args, '--base');
	const reports: AggregatePendingReportEntry[] = [
		summarizePendingReport(
			createManifestPendingReport({
				rootDir: rootDir,
				baseRef: baseRef,
			}),
		),
	];

	for (const domain of runtimeDynamicDomains) {
		reports.push(
			summarizePendingReport(
				createRuntimeDynamicPendingReport({
					rootDir: rootDir,
					domain: domain,
					baseRef: baseRef,
				}),
			),
		);
	}

	const webviews = getRunnableWebviewsContext(rootDir, args);
	if (webviews.skipped) {
		reports.push({
			domain: 'webviews',
			skipped: true,
			reason: webviews.reason,
			...(webviews.requiredFile == null ? {} : { requiredFile: webviews.requiredFile }),
		});
	} else {
		reports.push(
			summarizePendingReport(
				createWebviewPendingReport({
					rootDir: webviews.context.rootDir,
					baseRef: baseRef,
				}),
			),
		);
	}

	const report = {
		generatedAt: new Date().toISOString(),
		...(baseRef == null ? {} : { baseRef: baseRef }),
		reports: reports,
	};
	writeAggregateReport(rootDir, readOption(args, '--write'), report);
	console.log(JSON.stringify(report, undefined, '\t'));
}

function runGenerate(args: readonly string[]): void {
	const rootDir = readOption(args, '--root');
	const includeManifest = readBooleanFlag(args, '--with-manifest');
	const skipSettingsShell = readBooleanFlag(args, '--skip-settings-shell');

	if (includeManifest) {
		const manifest = generateManifestLocalizedOutputs({
			rootDir: rootDir,
			outputRoot: readOption(args, '--out-root'),
		});
		console.log(
			`Generated staged package.nls outputs in ${manifest.context.stagedManifestRootDir}: ${manifest.englishKeys} english keys, ${manifest.localizedKeys} localized keys, ${manifest.unresolvedKeys} unresolved keys`,
		);
	}

	for (const domain of runtimeDynamicDomains) {
		const result = generateRuntimeDynamicLocalizedOutputs({
			rootDir: rootDir,
			domain: domain,
			dynamicSourcesOnly: true,
		});
		console.log(
			`Generated ${result.context.domain} runtime dynamic artifacts: translated=${result.translatedCount}, unresolved=${result.unresolvedCount}`,
		);
	}

	const dynamicSources = generateWebviewsLocalizedDynamicSources({ rootDir: rootDir });
	console.log(
		`Generated localized webview dynamic sources: translated=${dynamicSources.translatedCount}, unresolved=${dynamicSources.unresolvedCount}`,
	);

	if (skipSettingsShell) return;

	const webviewsContext = createWebviewsDomainContext(rootDir);
	if (!fs.existsSync(webviewsContext.settingsBuildFile)) {
		console.log(`Skipped localized webview settings shell: ${webviewsContext.settingsBuildFile} does not exist`);
		return;
	}

	const settingsShell = generateWebviewsLocalizedSettingsShell({ rootDir: rootDir });
	console.log(
		`Generated localized webview settings shell: translated=${settingsShell.translatedCount}, unresolved=${settingsShell.unresolvedCount}`,
	);
}

function summarizePendingReport(report: PendingReportFile): AggregatePendingReportEntry {
	return {
		domain: report.domain,
		counts: report.counts,
		coverage: report.coverage,
		...(report.sinceBase == null ? {} : { sinceBase: report.sinceBase }),
	};
}

function runManifest(action: string | undefined, args: readonly string[]): void {
	switch (action) {
		case 'sync': {
			const result = syncManifestI18n({ rootDir: readOption(args, '--root') });
			console.log(
				`Synchronized package manifest i18n: ${result.occurrenceCount} occurrences, ${result.worksetCount} workset entries`,
			);
			return;
		}
		case 'generate': {
			const result = generateManifestLocalizedOutputs({
				rootDir: readOption(args, '--root'),
				outputRoot: readOption(args, '--out-root'),
			});
			console.log(
				`Generated staged package.nls outputs in ${result.context.stagedManifestRootDir}: ${result.englishKeys} english keys, ${result.localizedKeys} localized keys, ${result.unresolvedKeys} unresolved keys`,
			);
			return;
		}
		case 'package': {
			const rootDir = readOption(args, '--root');
			const outputRoot = readOption(args, '--out-root');
			const context = createManifestDomainContext(rootDir, outputRoot);
			console.log(`Building localized package assets from ${context.rootDir}`);
			runCommand('pnpm', ['run', 'bundle'], context.rootDir, 'Localized package build failed');
			const result = generateManifestLocalizedOutputs({
				rootDir: rootDir,
				outputRoot: outputRoot,
			});
			const disabledPrepublish = disableStagedPrepublishScript(result.context.generatedManifestFile);
			if (disabledPrepublish) {
				console.log(`Disabled staged vscode:prepublish in ${result.context.generatedManifestFile}`);
			}
			writeStagedPackageIgnoreFile(result.context.stagedManifestRootDir);
			const packageArgs = ['exec', 'vsce', 'package', '--no-dependencies', ...readPassthroughArgs(args)];
			console.log(`Running localized package from ${result.context.stagedManifestRootDir}`);
			runCommand('pnpm', packageArgs, result.context.stagedManifestRootDir, 'Localized package failed');
			return;
		}
		case 'promote': {
			const result = promoteManifestAuthority({ rootDir: readOption(args, '--root') });
			console.log(`Promoted package manifest translations: ${result.promoted.length}`);
			return;
		}
		case 'report': {
			const report = createManifestPendingReport({
				rootDir: readOption(args, '--root'),
				baseRef: readOption(args, '--base'),
				writeTo: readOption(args, '--write'),
			});
			console.log(
				JSON.stringify(
					{
						counts: report.counts,
						coverage: report.coverage,
						baseRef: report.baseRef,
						sinceBase: report.sinceBase,
						items: report.items,
					},
					undefined,
					'\t',
				),
			);
			return;
		}
		default:
			printUsageAndExit(`Unknown manifest action: ${action ?? '<missing>'}`);
	}
}

function runWebviews(action: string | undefined, args: readonly string[]): void {
	const context = ensureControlledWebviewFiles({ rootDir: readOption(args, '--root') });
	switch (action) {
		case 'sync': {
			const result = syncWebviewsI18n({ rootDir: context.rootDir });
			console.log(
				`Synchronized webview i18n: ${result.occurrenceCount} occurrences, ${result.worksetCount} workset entries`,
			);
			return;
		}
		case 'generate': {
			const generator = readBooleanFlag(args, '--dynamic-sources-only')
				? generateWebviewsLocalizedDynamicSources
				: readBooleanFlag(args, '--settings-shell-only')
					? generateWebviewsLocalizedSettingsShell
					: generateWebviewsLocalizedOutputs;
			const result = generator({ rootDir: context.rootDir });
			console.log(
				`Generated localized webview build artifacts: translated=${result.translatedCount}, unresolved=${result.unresolvedCount}`,
			);
			return;
		}
		case 'promote': {
			const result = promoteWebviewsAuthority({ rootDir: context.rootDir });
			console.log(`Promoted webview translations: ${result.promoted.length}`);
			return;
		}
		case 'report': {
			const report = createWebviewPendingReport({
				rootDir: context.rootDir,
				baseRef: readOption(args, '--base'),
				writeTo: readOption(args, '--write'),
			});
			console.log(JSON.stringify(report, undefined, '\t'));
			return;
		}
		default:
			printUsageAndExit(`Unknown webviews action: ${action ?? '<missing>'}`);
	}
}

function runRuntimeDynamic(
	action: string | undefined,
	runtimeDomain: RuntimeDynamicDomain,
	args: readonly string[],
): void {
	const context = ensureRuntimeDynamicDomainFiles({
		rootDir: readOption(args, '--root'),
		domain: runtimeDomain,
	});

	switch (action) {
		case 'sync': {
			const result = syncRuntimeDynamicI18n({ rootDir: context.rootDir, domain: context.domain });
			console.log(
				`Synchronized ${result.context.domain} runtime dynamic i18n: ${result.occurrenceCount} occurrences, ${result.worksetCount} workset entries`,
			);
			return;
		}
		case 'generate': {
			const result = generateRuntimeDynamicLocalizedOutputs({
				rootDir: context.rootDir,
				domain: context.domain,
				dynamicSourcesOnly: readBooleanFlag(args, '--dynamic-sources-only'),
			});
			console.log(
				`Generated ${result.context.domain} runtime dynamic artifacts: translated=${result.translatedCount}, unresolved=${result.unresolvedCount}`,
			);
			return;
		}
		case 'promote': {
			const result = promoteRuntimeDynamicAuthority({ rootDir: context.rootDir, domain: context.domain });
			console.log(`Promoted ${result.context.domain} runtime dynamic translations: ${result.promoted.length}`);
			return;
		}
		case 'report': {
			const report = createRuntimeDynamicPendingReport({
				rootDir: context.rootDir,
				domain: context.domain,
				baseRef: readOption(args, '--base'),
				writeTo: readOption(args, '--write'),
			});
			console.log(JSON.stringify(report, undefined, '\t'));
			return;
		}
		default:
			printUsageAndExit(`Unknown runtime dynamic action: ${action ?? '<missing>'}`);
	}
}

function runAuthority(action: string | undefined, args: readonly string[]): void {
	switch (action) {
		case 'review': {
			console.log(JSON.stringify(executeAuthorityMessagesReview(args), undefined, '\t'));
			return;
		}
		default:
			printUsageAndExit(`Unknown authority action: ${action ?? '<missing>'}`);
	}
}

function getRunnableWebviewsContext(
	rootDir: string | undefined,
	args: readonly string[],
):
	| {
			readonly skipped: false;
			readonly context: ReturnType<typeof createWebviewsDomainContext>;
	  }
	| {
			readonly skipped: true;
			readonly reason: string;
			readonly requiredFile?: string;
	  } {
	if (readBooleanFlag(args, '--skip-webviews')) {
		return {
			skipped: true,
			reason: '--skip-webviews was provided',
		};
	}

	const context = createWebviewsDomainContext(rootDir);
	if (fs.existsSync(context.settingsBuildFile)) {
		return {
			skipped: false,
			context: context,
		};
	}

	return {
		skipped: true,
		reason: `${context.settingsBuildFile} does not exist`,
		requiredFile: context.settingsBuildFile,
	};
}

function writeAggregateReport(rootDir: string | undefined, writeTo: string | undefined, report: unknown): void {
	if (writeTo == null) return;

	const outputFile = resolveAggregateReportOutputFile(rootDir, writeTo);
	fs.mkdirSync(path.dirname(outputFile), { recursive: true });
	fs.writeFileSync(outputFile, `${JSON.stringify(report, undefined, '\t')}\n`, 'utf8');
}

function resolveAggregateReportOutputFile(rootDir: string | undefined, name: string): string {
	if (path.isAbsolute(name)) return name;

	const root = path.resolve(rootDir ?? process.cwd());
	if (name.includes('/') || name.includes('\\')) {
		return path.resolve(root, name);
	}

	return path.join(root, 'i18n', 'reports', name);
}

function readOption(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

function readBooleanFlag(args: readonly string[], name: string): boolean {
	return args.includes(name);
}

function readPassthroughArgs(args: readonly string[]): string[] {
	const separatorIndex = args.indexOf('--');
	return separatorIndex >= 0 ? [...args.slice(separatorIndex + 1)] : [];
}

export function disableStagedPrepublishScript(packageJsonFile: string): boolean {
	const manifest = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8')) as unknown;
	if (!isJsonObject(manifest)) {
		throw new Error(`Staged package manifest is not a JSON object: ${packageJsonFile}`);
	}

	const scripts = manifest.scripts;
	if (!isJsonObject(scripts) || !Object.hasOwn(scripts, 'vscode:prepublish')) return false;

	delete scripts['vscode:prepublish'];
	fs.writeFileSync(packageJsonFile, `${JSON.stringify(manifest, undefined, '\t')}\n`, 'utf8');
	return true;
}

export function writeStagedPackageIgnoreFile(stagedRootDir: string): void {
	const ignoreFile = path.join(stagedRootDir, '.vscodeignore');
	const baseIgnore = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile, 'utf8').trimEnd() : '';
	const ignoredRootDirectories = fs
		.readdirSync(stagedRootDir, { withFileTypes: true })
		.filter(entry => (entry.isDirectory() || entry.isSymbolicLink()) && !isStagedRootDirectoryPackaged(entry.name))
		.map(entry => entry.name.replaceAll('\\', '/'))
		.sort((left, right) => left.localeCompare(right));

	const generatedIgnore = ignoredRootDirectories.flatMap(name => [name, `${name}/**`]);
	fs.writeFileSync(
		ignoreFile,
		[
			baseIgnore,
			'',
			'# Generated by manifest package staging. vsce treats staged junction directories as files unless',
			'# the directory entries themselves are ignored.',
			...generatedIgnore,
			'',
		].join('\n'),
		'utf8',
	);
}

function runCommand(command: string, args: readonly string[], cwd: string, failureMessage: string): void {
	const result = spawnSync(command, [...args], { cwd: cwd, stdio: 'inherit' });
	if (result.error != null) {
		throw result.error;
	}

	if (result.status === 0) return;

	if (result.signal != null) {
		throw new Error(`${failureMessage} with signal ${result.signal}`);
	}

	throw new Error(`${failureMessage} with exit code ${result.status ?? 1}`);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value != null && !Array.isArray(value);
}

function isStagedRootDirectoryPackaged(name: string): boolean {
	return name === 'dist' || name === 'images' || name === 'walkthroughs';
}

function printUsageAndExit(message: string): never {
	console.error(message);
	console.error(
		[
			'Usage:',
			'  node ./i18n/cli.mts sync [--root <path>] [--skip-webviews]',
			'  node ./i18n/cli.mts promote [--root <path>] [--skip-webviews]',
			'  node ./i18n/cli.mts report [--root <path>] [--base <ref>] [--write <path>] [--skip-webviews]',
			'  node ./i18n/cli.mts generate [--root <path>] [--with-manifest] [--out-root <path>] [--skip-settings-shell]',
			'  node ./i18n/cli.mts manifest sync|generate|promote|report|package [--root <path>] [--out-root <path>] [-- <vsce args>]',
			'  node ./i18n/cli.mts webviews sync|generate|promote|report [--root <path>]',
			'  node ./i18n/cli.mts formatter|quickpicks|webviewHost sync|generate|promote|report [--root <path>]',
			'  node ./i18n/cli.mts authority review next|approve|unapprove|stats [...]',
		].join('\n'),
	);
	process.exit(1);
}

function isDirectExecution(): boolean {
	return pathToFileURL(process.argv[1] ?? '').href === import.meta.url;
}
