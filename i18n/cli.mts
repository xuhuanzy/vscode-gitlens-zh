#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
		case 'manifest':
			runManifest(action, rest);
			break;
		case 'webviews':
			runWebviews(action, rest);
			break;
		case 'formatter':
		case 'quickpicks':
			runRuntimeDynamic(action, domain, rest);
			break;
		case 'authority':
			runAuthority(action, rest);
			break;
		default:
			printUsageAndExit(`Unknown i18n domain: ${domain ?? '<missing>'}`);
	}
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
			'  node ./i18n/cli.mts manifest sync|generate|promote|report|package [--root <path>] [--out-root <path>] [-- <vsce args>]',
			'  node ./i18n/cli.mts webviews sync|generate|promote|report [--root <path>]',
			'  node ./i18n/cli.mts formatter|quickpicks sync|generate|promote|report [--root <path>]',
			'  node ./i18n/cli.mts authority review next|approve|unapprove|stats [...]',
		].join('\n'),
	);
	process.exit(1);
}

function isDirectExecution(): boolean {
	return pathToFileURL(process.argv[1] ?? '').href === import.meta.url;
}
