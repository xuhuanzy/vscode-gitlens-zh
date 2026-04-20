import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

export function readJsonFileIfExists<T>(filePath: string, fallbackFactory: () => T): T {
	if (!existsSync(filePath)) {
		return fallbackFactory();
	}

	return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

export function writeStableJsonFile(filePath: string, data: unknown): boolean {
	return writeStableFile(filePath, `${JSON.stringify(data, undefined, '\t')}\n`);
}

export function writeStableFile(filePath: string, contents: string): boolean {
	mkdirSync(path.dirname(filePath), { recursive: true });

	if (existsSync(filePath) && readFileSync(filePath, 'utf8') === contents) {
		return false;
	}

	writeFileSync(filePath, contents, 'utf8');
	return true;
}
