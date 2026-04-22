import { createPendingReport, ensureControlledWebviewFiles } from './workflow.mts';

const context = ensureControlledWebviewFiles({
	rootDir: readOption('--root'),
});
const report = createPendingReport({
	rootDir: context.rootDir,
	baseRef: readOption('--base'),
	writeTo: readOption('--write'),
});

console.log(JSON.stringify(report, undefined, '\t'));

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
