import { createPendingReport } from './workflow.mts';

const report = createPendingReport({
	rootDir: readOption('--root'),
	baseRef: readOption('--base'),
	writeTo: readOption('--write'),
});

const output = {
	counts: report.counts,
	coverage: report.coverage,
	baseRef: report.baseRef,
	sinceBase: report.sinceBase,
	items: report.items,
};

console.log(JSON.stringify(output, undefined, '\t'));

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
