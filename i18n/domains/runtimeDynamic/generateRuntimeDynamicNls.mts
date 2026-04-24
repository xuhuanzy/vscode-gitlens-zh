import { ensureRuntimeDynamicDomainFiles, generateRuntimeDynamicLocalizedOutputs } from './workflow.mts';
import { parseRuntimeDynamicDomain } from './context.mts';

const context = ensureRuntimeDynamicDomainFiles({
	rootDir: readOption('--root'),
	domain: parseRuntimeDynamicDomain(readOption('--domain')),
});
const result = generateRuntimeDynamicLocalizedOutputs({
	rootDir: context.rootDir,
	domain: context.domain,
	dynamicSourcesOnly: process.argv.includes('--dynamic-sources-only'),
});

console.log(
	`Generated ${result.context.domain} runtime dynamic artifacts: translated=${result.translatedCount}, unresolved=${result.unresolvedCount}`,
);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
