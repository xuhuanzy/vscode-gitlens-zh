import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { disableStagedPrepublishScript, execute, writeStagedPackageIgnoreFile } from '../cli.mts';

run();

function run(): void {
	testManifestCliGeneratesStagedPackageOutputs();
	testLegacyCliDomainAliasesAreRejected();
	testDisableStagedPrepublishScript();
	testWriteStagedPackageIgnoreFileIgnoresLinkedRootDirectories();
}

function testManifestCliGeneratesStagedPackageOutputs(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-i18n-cli-'));
	try {
		const manifestFile = path.join(rootDir, 'package.json');
		fs.writeFileSync(
			manifestFile,
			JSON.stringify(
				{
					name: 'fixture',
					displayName: 'Fixture Git UI',
					description: 'Review Git history quickly',
					contributes: {
						commands: [{ command: 'fixture.open', title: 'Open Graph', category: 'GitLens' }],
					},
				},
				undefined,
				'\t',
			),
			'utf8',
		);
		const originalManifest = fs.readFileSync(manifestFile, 'utf8');

		execute(['manifest', 'sync', '--root', rootDir]);
		execute(['manifest', 'generate', '--root', rootDir]);

		assert.equal(fs.readFileSync(manifestFile, 'utf8'), originalManifest);
		assert.equal(
			JSON.parse(
				fs.readFileSync(path.join(rootDir, '.work', 'i18n', 'extension-root', 'zh-cn', 'package.json'), 'utf8'),
			).displayName,
			'%extension.displayName%',
		);
		assert.equal(
			JSON.parse(
				fs.readFileSync(
					path.join(rootDir, '.work', 'i18n', 'extension-root', 'zh-cn', 'package.nls.json'),
					'utf8',
				),
			)['extension.displayName'],
			'Fixture Git UI',
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testLegacyCliDomainAliasesAreRejected(): void {
	for (const domain of ['package', 'webview', 'runtime', 'runtime-dynamic']) {
		assertProcessExit(() => execute([domain, 'generate']));
	}
}

function testWriteStagedPackageIgnoreFileIgnoresLinkedRootDirectories(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-i18n-cli-'));
	try {
		fs.writeFileSync(path.join(rootDir, '.vscodeignore'), 'src/**\n');
		for (const name of ['dist', 'i18n', 'images', 'src', 'walkthroughs']) {
			fs.mkdirSync(path.join(rootDir, name));
		}

		writeStagedPackageIgnoreFile(rootDir);

		const ignore = fs.readFileSync(path.join(rootDir, '.vscodeignore'), 'utf8');
		assert.match(ignore, /^src\/\*\*/u);
		assert.match(ignore, /^src$/mu);
		assert.match(ignore, /^i18n$/mu);
		assert.doesNotMatch(ignore, /^dist$/mu);
		assert.doesNotMatch(ignore, /^images$/mu);
		assert.doesNotMatch(ignore, /^walkthroughs$/mu);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testDisableStagedPrepublishScript(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-i18n-cli-'));
	try {
		const packageJsonFile = path.join(rootDir, 'package.json');
		fs.writeFileSync(
			packageJsonFile,
			JSON.stringify(
				{
					name: 'fixture',
					scripts: {
						bundle: 'node ./scripts/build.mjs --mode production',
						'vscode:prepublish': 'pnpm run bundle',
					},
				},
				undefined,
				'\t',
			),
			'utf8',
		);

		assert.equal(disableStagedPrepublishScript(packageJsonFile), true);
		const manifest = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8')) as {
			readonly scripts: Record<string, string>;
		};
		assert.deepEqual(manifest.scripts, {
			bundle: 'node ./scripts/build.mjs --mode production',
		});
		assert.equal(disableStagedPrepublishScript(packageJsonFile), false);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function assertProcessExit(callback: () => void): void {
	const originalExit = process.exit;
	const originalConsoleError = console.error;
	try {
		process.exit = ((code?: string | number | null | undefined): never => {
			throw new Error(`process.exit:${code ?? 0}`);
		}) as typeof process.exit;
		console.error = (): void => undefined;

		assert.throws(callback, /process\.exit:1/u);
	} finally {
		process.exit = originalExit;
		console.error = originalConsoleError;
	}
}
