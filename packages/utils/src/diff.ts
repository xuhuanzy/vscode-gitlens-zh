// Annotates diff to make is easier for agentic reference to line number.
// Brackets sit AFTER the line-type marker so file-level diff parsers
// (e.g. `filterDiffFiles`) that key off `diff --git` / `+++` / `---` headers still work.
export function annotateDiffWithNewLineNumbers(diff: string): string {
	if (!diff) return diff;

	const lines = diff.split('\n');
	const out: string[] = new Array(lines.length);
	let newLine = 0;
	let inHunk = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith('@@')) {
			const match = /\+(\d+)(?:,\d+)?\s/.exec(line);
			newLine = match != null ? parseInt(match[1], 10) : 0;
			inHunk = true;
			out[i] = line;
			continue;
		}

		if (
			line.startsWith('diff --git') ||
			line.startsWith('index ') ||
			line.startsWith('--- ') ||
			line.startsWith('+++ ') ||
			line.startsWith('new file') ||
			line.startsWith('deleted file') ||
			line.startsWith('rename ') ||
			line.startsWith('copy ') ||
			line.startsWith('similarity ') ||
			line.startsWith('dissimilarity ') ||
			line.startsWith('Binary files')
		) {
			inHunk = false;
			out[i] = line;
			continue;
		}

		if (!inHunk || line.startsWith('\\')) {
			out[i] = line;
			continue;
		}

		const marker = line[0];
		if (marker === '-') {
			out[i] = `-[     ]${line.slice(1)}`;
			continue;
		}
		if (marker === '+' || marker === ' ') {
			out[i] = `${marker}[${String(newLine).padStart(5, ' ')}]${line.slice(1)}`;
			newLine++;
			continue;
		}

		out[i] = line;
	}

	return out.join('\n');
}
