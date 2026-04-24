import { ensureRuntimeDynamicDomainFiles, syncRuntimeDynamicI18n, writeWorkflowReadme } from './workflow.mts';
import { parseRuntimeDynamicDomain } from './context.mts';

const context = ensureRuntimeDynamicDomainFiles({
	rootDir: readOption('--root'),
	domain: parseRuntimeDynamicDomain(readOption('--domain')),
});
const result = syncRuntimeDynamicI18n({
	rootDir: context.rootDir,
	domain: context.domain,
});
writeWorkflowReadme(result.context);

console.log(
	`Synchronized ${result.context.domain} runtime dynamic i18n: ${result.occurrenceCount} occurrences, ${result.worksetCount} workset entries`,
);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
