import { syncPackageManifestI18n, writeWorkflowReadme } from './workflow.mts';

const result = syncPackageManifestI18n({
	rootDir: readOption('--root'),
});

writeWorkflowReadme(result.context);
console.log(
	`Synchronized package manifest i18n: ${result.occurrenceCount} occurrences, ${result.worksetCount} workset entries`,
);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
