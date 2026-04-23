import {
	ensureControlledWebviewFiles,
	generateWebviewsLocalizedDynamicSources,
	generateWebviewsLocalizedOutputs,
	generateWebviewsLocalizedSettingsShell,
} from './workflow.mts';

const context = ensureControlledWebviewFiles({
	rootDir: readOption('--root'),
});
const generator = process.argv.includes('--dynamic-sources-only')
	? generateWebviewsLocalizedDynamicSources
	: process.argv.includes('--settings-shell-only')
		? generateWebviewsLocalizedSettingsShell
		: generateWebviewsLocalizedOutputs;
const result = generator({
	rootDir: context.rootDir,
});

console.log(
	`Generated localized webview build artifacts: translated=${result.translatedCount}, unresolved=${result.unresolvedCount}`,
);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
