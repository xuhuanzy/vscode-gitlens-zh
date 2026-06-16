import type { Uri } from 'vscode';
import { workspace } from 'vscode';
import { Logger } from '@gitlens/utils/logger.js';

export const conflictMarkerPattern = /^<{7}(?=[ \t\n\r])/gm;

const maxConflictFileSize = 5 * 1024 * 1024;

export interface ConflictMarkerCache {
	get(key: string): { mtime: number; count: number } | undefined;
	set(key: string, value: { mtime: number; count: number }): void;
}

export async function countConflictMarkers(uri: Uri, cache?: ConflictMarkerCache): Promise<number> {
	try {
		const stat = await workspace.fs.stat(uri);
		if (stat.size > maxConflictFileSize) return 0;

		const key = uri.fsPath;
		const cached = cache?.get(key);
		if (cached?.mtime === stat.mtime) return cached.count;

		const content = await workspace.fs.readFile(uri);
		const text = new TextDecoder().decode(content);
		const count = text.match(conflictMarkerPattern)?.length ?? 0;
		cache?.set(key, { mtime: stat.mtime, count: count });
		return count;
	} catch (ex) {
		Logger.debug(ex, 'countConflictMarkers');
		return 0;
	}
}
