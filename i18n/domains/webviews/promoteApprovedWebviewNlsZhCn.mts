import { ensureControlledWebviewFiles, promoteWebviewsAuthority } from './workflow.mts';

const context = ensureControlledWebviewFiles({
	rootDir: readOption('--root'),
});
const result = promoteWebviewsAuthority({
	rootDir: context.rootDir,
});

console.log(`Promoted webview translations: ${result.promoted.length}`);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
