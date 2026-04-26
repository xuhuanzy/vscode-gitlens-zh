import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createDomainContext, createI18nWorkspaceContext } from '../context.mts';
import { readJsonFile, readJsonFileIfMissing, saveWorkset } from '../store.mts';

run();

function run(): void {
	testReadJsonFileThrowsOnInvalidJson();
	testReadJsonFileIfMissingOnlyUsesInitialValueForMissingFiles();
	testSaveWorksetSkipsGeneratedAtOnlyChanges();
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

function testSaveWorksetSkipsGeneratedAtOnlyChanges(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-i18n-store-'));
	try {
		const context = createDomainContext(createI18nWorkspaceContext(rootDir), {
			domain: 'manifest',
			artifactId: 'package',
		});
		const initial = {
			$schema: '../schemas/translationWorkset.schema.json',
			version: 2,
			locale: 'zh-cn',
			domain: 'manifest',
			generatedAt: '2026-01-01T00:00:00.000Z',
			entries: [
				{
					id: 'message.open',
					kind: 'literal',
					source: 'Open',
					translation: null,
					sourceHash: 'hash-open',
					occurrenceIds: ['manifest:command.open#title'],
					status: 'pending',
				},
			],
		} as const;

		saveWorkset(context, initial);
		const firstContents = fs.readFileSync(context.worksetFile, 'utf8');

		saveWorkset(context, {
			...initial,
			generatedAt: '2026-01-02T00:00:00.000Z',
		});
		assert.equal(fs.readFileSync(context.worksetFile, 'utf8'), firstContents);

		saveWorkset(context, {
			...initial,
			generatedAt: '2026-01-03T00:00:00.000Z',
			entries: [
				{
					...initial.entries[0],
					translation: '打开',
					status: 'translated',
				},
			],
		});
		assert.notEqual(fs.readFileSync(context.worksetFile, 'utf8'), firstContents);
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
