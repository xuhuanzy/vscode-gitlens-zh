import { ensureControlledWebviewFiles, syncWebviewsI18n, writeWorkflowReadme } from './workflow.mts';

const context = ensureControlledWebviewFiles({
	rootDir: readOption('--root'),
});
const result = syncWebviewsI18n({
	rootDir: context.rootDir,
});
writeWorkflowReadme(result.context);

console.log(`Synchronized webview i18n: ${result.occurrenceCount} occurrences, ${result.worksetCount} workset entries`);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
