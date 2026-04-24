import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { execute } from '../messagesReview.mts';

interface ReviewBatchResponse {
	readonly pagination: {
		readonly returned: number;
		readonly totalUnreviewed: number;
		readonly hasMore: boolean;
		readonly nextOffset?: number;
	};
	readonly items: Array<{ readonly id: string }>;
}

interface ReviewMutationResponse {
	readonly approved?: string[];
	readonly removed?: string[];
	readonly counts: {
		readonly reviewedCurrent: number;
		readonly staleReviewed?: number;
		readonly unreviewed: number;
	};
}

interface ReviewStatsResponse {
	readonly counts: {
		readonly reviewedCurrent: number;
		readonly staleReviewed: number;
		readonly unreviewed: number;
	};
}

interface FixtureMessagesFile {
	entries: Array<
		| {
				id: string;
				kind: 'literal';
				source: string;
				translation: string;
		  }
		| {
				id: string;
				kind: 'template';
				source: string;
				translation: string;
				slots: string[];
		  }
	>;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

run();

function run(): void {
	testNextReturnsOnlyUnreviewedEntries();
	testApprovePersistsFingerprintBasedReviewState();
	testChangedMessageBecomesUnreviewedAgain();
	testUnapproveRemovesRequestedAndStaleEntries();
}

function testNextReturnsOnlyUnreviewedEntries(): void {
	const fixture = createFixture();
	try {
		const first = runScript<ReviewBatchResponse>(fixture, ['next', '--limit', '2']);
		assert.equal(first.pagination.returned, 2);
		assert.equal(first.pagination.totalUnreviewed, 3);
		assert.equal(first.pagination.hasMore, true);
		assert.equal(first.pagination.nextOffset, 2);
		assert.deepEqual(
			first.items.map((item: { id: string }) => item.id),
			['message.a', 'message.b'],
		);

		const second = runScript<ReviewBatchResponse>(fixture, ['next', '--limit', '2', '--offset', '2']);
		assert.equal(second.pagination.returned, 1);
		assert.equal(second.pagination.hasMore, false);
		assert.deepEqual(
			second.items.map((item: { id: string }) => item.id),
			['message.c'],
		);
	} finally {
		cleanupFixture(fixture.rootDir);
	}
}

function testApprovePersistsFingerprintBasedReviewState(): void {
	const fixture = createFixture();
	try {
		const approved = runScript<ReviewMutationResponse>(fixture, [
			'approve',
			'--ids',
			'message.a,message.b',
			'--note',
			'checked',
		]);
		assert.deepEqual(approved.approved, ['message.a', 'message.b']);
		assert.equal(approved.counts.reviewedCurrent, 2);
		assert.equal(approved.counts.unreviewed, 1);

		const next = runScript<ReviewBatchResponse>(fixture, ['next', '--limit', '10']);
		assert.deepEqual(
			next.items.map((item: { id: string }) => item.id),
			['message.c'],
		);

		const state = readJson(path.join(fixture.localeDir, 'messages.review-state.json'));
		assert.equal(state.entries.length, 2);
		assert.equal(state.entries[0].decision, 'approved');
		assert.equal(state.entries[0].note, 'checked');
	} finally {
		cleanupFixture(fixture.rootDir);
	}
}

function testChangedMessageBecomesUnreviewedAgain(): void {
	const fixture = createFixture();
	try {
		runScript<ReviewMutationResponse>(fixture, ['approve', '--ids', 'message.a']);

		const messagesFile = path.join(fixture.localeDir, 'messages.json');
		const messages = readJson<FixtureMessagesFile>(messagesFile);
		messages.entries = messages.entries.map((entry: { id: string; translation: string }) =>
			entry.id === 'message.a' ? { ...entry, translation: '已变更译文' } : entry,
		);
		fs.writeFileSync(messagesFile, `${JSON.stringify(messages, undefined, '\t')}\n`, 'utf8');

		const stats = runScript<ReviewStatsResponse>(fixture, ['stats']);
		assert.equal(stats.counts.reviewedCurrent, 0);
		assert.equal(stats.counts.staleReviewed, 1);
		assert.equal(stats.counts.unreviewed, 3);

		const next = runScript<ReviewBatchResponse>(fixture, ['next', '--limit', '10']);
		assert.deepEqual(
			next.items.map((item: { id: string }) => item.id),
			['message.a', 'message.b', 'message.c'],
		);
	} finally {
		cleanupFixture(fixture.rootDir);
	}
}

function testUnapproveRemovesRequestedAndStaleEntries(): void {
	const fixture = createFixture();
	try {
		runScript<ReviewMutationResponse>(fixture, ['approve', '--ids', 'message.a,message.b']);

		const messagesFile = path.join(fixture.localeDir, 'messages.json');
		const messages = readJson<FixtureMessagesFile>(messagesFile);
		messages.entries = messages.entries.map((entry: { id: string; translation: string }) =>
			entry.id === 'message.b' ? { ...entry, translation: '另一个变更译文' } : entry,
		);
		fs.writeFileSync(messagesFile, `${JSON.stringify(messages, undefined, '\t')}\n`, 'utf8');

		const removed = runScript<ReviewMutationResponse>(fixture, ['unapprove', '--ids', 'message.a', '--all-stale']);
		assert.deepEqual(removed.removed, ['message.a', 'message.b']);
		assert.equal(removed.counts.reviewedCurrent, 0);

		const state = readJson(path.join(fixture.localeDir, 'messages.review-state.json'));
		assert.equal(state.entries.length, 0);
	} finally {
		cleanupFixture(fixture.rootDir);
	}
}

function createFixture(): { rootDir: string; authorityDir: string; localeDir: string } {
	const tempRoot = path.join(repoRoot, '.work', 'i18n', 'authority-review-tests');
	fs.mkdirSync(tempRoot, { recursive: true });
	const rootDir = fs.mkdtempSync(path.join(tempRoot, 'case-'));
	const authorityDir = path.join(rootDir, 'i18n', 'authority');
	const localeDir = path.join(authorityDir, 'zh-cn');
	fs.mkdirSync(localeDir, { recursive: true });

	writeJson(path.join(localeDir, 'messages.json'), {
		$schema: '../../schemas/authority.schema.json',
		version: 2,
		kind: 'messages',
		locale: 'zh-cn',
		updatedAt: '2026-04-24T00:00:00.000Z',
		entries: [
			{
				id: 'message.c',
				kind: 'literal',
				source: 'Show Stashes',
				translation: '显示贮藏',
			},
			{
				id: 'message.a',
				kind: 'literal',
				source: 'Branches View',
				translation: '分支视图',
			},
			{
				id: 'message.b',
				kind: 'template',
				source: 'Showing all ${slot1}',
				translation: '显示全部 ${slot1}',
				slots: ['slot1'],
			},
		],
	});

	writeJson(path.join(localeDir, 'messages.review-state.json'), {
		$schema: '../authority-review-state.schema.json',
		version: 1,
		kind: 'authorityMessageReviewState',
		locale: 'zh-cn',
		updatedAt: '1970-01-01T00:00:00.000Z',
		entries: [],
	});

	return { rootDir, authorityDir, localeDir };
}

function runScript<TOutput>(fixture: { rootDir: string; localeDir: string }, args: string[]): TOutput {
	const previousCwd = process.cwd();
	try {
		process.chdir(fixture.rootDir);
		return execute([
			...args,
			'--messages',
			path.join(fixture.localeDir, 'messages.json'),
			'--state',
			path.join(fixture.localeDir, 'messages.review-state.json'),
		]) as TOutput;
	} finally {
		process.chdir(previousCwd);
	}
}

function writeJson(filePath: string, value: unknown): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, undefined, '\t')}\n`, 'utf8');
}

function readJson<T>(filePath: string): T {
	return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function cleanupFixture(rootDir: string): void {
	fs.rmSync(rootDir, { recursive: true, force: true });
}
