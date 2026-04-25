import { generateManifestLocalizedOutputs } from './workflow.mts';

const result = generateManifestLocalizedOutputs({
	rootDir: readOption('--root'),
	outputRoot: readOption('--out-root'),
});

console.log(
	`Generated staged package.nls outputs in ${result.context.stagedManifestRootDir}: ${result.englishKeys} english keys, ${result.localizedKeys} localized keys, ${result.unresolvedKeys} unresolved keys`,
);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
