import { parseRuntimeDynamicDomain } from './context.mts';
import { createPendingReport, ensureRuntimeDynamicDomainFiles } from './workflow.mts';

const context = ensureRuntimeDynamicDomainFiles({
	rootDir: readOption('--root'),
	domain: parseRuntimeDynamicDomain(readOption('--domain')),
});
const report = createPendingReport({
	rootDir: context.rootDir,
	domain: context.domain,
	baseRef: readOption('--base'),
	writeTo: readOption('--write'),
});

console.log(JSON.stringify(report, undefined, '\t'));

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
