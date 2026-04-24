import { parseRuntimeDynamicDomain } from './context.mts';
import { ensureRuntimeDynamicDomainFiles, promoteRuntimeDynamicAuthority } from './workflow.mts';

const context = ensureRuntimeDynamicDomainFiles({
	rootDir: readOption('--root'),
	domain: parseRuntimeDynamicDomain(readOption('--domain')),
});
const result = promoteRuntimeDynamicAuthority({
	rootDir: context.rootDir,
	domain: context.domain,
});

console.log(`Promoted ${result.context.domain} runtime dynamic translations: ${result.promoted.length}`);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
