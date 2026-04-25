import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readJsonFile, readJsonFileIfMissing } from '../store.mts';

run();

function run(): void {
	testReadJsonFileThrowsOnInvalidJson();
	testReadJsonFileIfMissingOnlyUsesInitialValueForMissingFiles();
}

function testReadJsonFileThrowsOnInvalidJson(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-i18n-store-'));
	try {
		const filePath = path.join(rootDir, 'broken.json');
		fs.writeFileSync(filePath, '{', 'utf8');

		assert.throws(() => readJsonFile(filePath), SyntaxError);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testReadJsonFileIfMissingOnlyUsesInitialValueForMissingFiles(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-i18n-store-'));
	try {
		assert.deepEqual(readJsonFileIfMissing(path.join(rootDir, 'missing.json'), { entries: [] }), { entries: [] });

		const filePath = path.join(rootDir, 'broken.json');
		fs.writeFileSync(filePath, '{', 'utf8');
		assert.throws(() => readJsonFileIfMissing(filePath, { entries: [] }), SyntaxError);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}
