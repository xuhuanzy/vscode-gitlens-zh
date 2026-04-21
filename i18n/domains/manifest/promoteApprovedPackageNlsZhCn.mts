import { promoteManifestAuthority } from './workflow.mts';

const result = promoteManifestAuthority({
	rootDir: readOption('--root'),
});

console.log(`Promoted ${result.promoted.length} approved package zh-cn entries into authority`);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
