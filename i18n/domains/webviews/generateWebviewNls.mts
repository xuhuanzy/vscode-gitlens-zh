import { ensureControlledWebviewFiles, generateWebviewsLocalizedOutputs } from './workflow.mts';

const context = ensureControlledWebviewFiles({
	rootDir: readOption('--root'),
});
const result = generateWebviewsLocalizedOutputs({
	rootDir: context.rootDir,
});

console.log(
	`Generated localized webview shells: translated=${result.translatedCount}, unresolved=${result.unresolvedCount}`,
);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
