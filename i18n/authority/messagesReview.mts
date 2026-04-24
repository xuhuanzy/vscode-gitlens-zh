import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { AuthorityMessageEntry } from '../core/model.mts';
import { createContentHash, nowIso, stableStringify } from '../core/model.mts';
import { createEmptyAuthorityFile, readJsonFile, writeJsonFile } from '../core/store.mts';

type ReviewDecision = 'approved';

interface ReviewStateEntry {
	readonly id: string;
	readonly fingerprint: string;
	readonly reviewedAt: string;
	readonly decision: ReviewDecision;
	readonly note?: string;
}

interface ReviewStateFile {
	readonly $schema: string;
	readonly version: 1;
	readonly kind: 'authorityMessageReviewState';
	readonly locale: string;
	readonly updatedAt: string;
	readonly entries: ReviewStateEntry[];
}

interface ReviewBatchItem {
	readonly id: string;
	readonly kind: AuthorityMessageEntry['kind'];
	readonly source: string;
	readonly translation: string;
	readonly fingerprint: string;
	readonly slots?: readonly string[];
	readonly selector?: string;
	readonly cases?: Record<string, { readonly source: string; readonly translation: string }>;
	readonly format?: 'markdown';
}

interface AuthorityMessagesFile {
	readonly $schema: string;
	readonly version: 2;
	readonly kind: 'messages';
	readonly locale: string;
	readonly updatedAt: string;
	readonly entries: AuthorityMessageEntry[];
}

interface ReviewBatchOutput {
	readonly locale: string;
	readonly generatedAt: string;
	readonly pagination: {
		readonly offset: number;
		readonly limit: number;
		readonly totalUnreviewed: number;
		readonly returned: number;
		readonly hasMore: boolean;
		readonly nextOffset?: number;
	};
	readonly counts: {
		readonly total: number;
		readonly reviewedCurrent: number;
		readonly staleReviewed: number;
		readonly unreviewed: number;
	};
	readonly items: ReviewBatchItem[];
}

interface ReviewStatsOutput {
	readonly locale: string;
	readonly generatedAt: string;
	readonly counts: {
		readonly total: number;
		readonly reviewedCurrent: number;
		readonly staleReviewed: number;
		readonly unreviewed: number;
	};
}

const defaultLimit = 1000;
const defaultLocale = 'zh-cn';
const scriptDir = path.dirname(import.meta.filename);
const authorityDir = scriptDir;
const defaultMessagesFile = path.join(authorityDir, defaultLocale, 'messages.json');
const defaultStateFile = path.join(authorityDir, defaultLocale, 'messages.review-state.json');

if (isDirectExecution()) {
	runCli();
}

export function execute(args: readonly string[]): unknown {
	const command = args[0] ?? 'next';

	switch (command) {
		case 'next':
			return createNextOutput(args.slice(1));
		case 'approve':
			return createApproveOutput(args.slice(1));
		case 'unapprove':
			return createUnapproveOutput(args.slice(1));
		case 'stats':
			return createStatsOutput(args.slice(1));
		default:
			throw new Error(`Unknown command: ${command}`);
	}
}

function runCli(): void {
	console.log(JSON.stringify(execute(process.argv.slice(2)), undefined, '\t'));
}

function createNextOutput(args: readonly string[]): ReviewBatchOutput {
	const messages = loadMessages(readOption(args, '--messages') ?? defaultMessagesFile);
	const stateFile = readOption(args, '--state') ?? defaultStateFile;
	const state = loadState(stateFile, messages.locale);
	const offset = readIntegerOption(args, '--offset', 0);
	const limit = readIntegerOption(args, '--limit', defaultLimit);
	const unreviewed = collectUnreviewed(messages.entries, state);
	const items = unreviewed.slice(offset, offset + limit).map(entry => toBatchItem(entry.entry, entry.fingerprint));

	return {
		locale: messages.locale,
		generatedAt: nowIso(),
		pagination: {
			offset: offset,
			limit: limit,
			totalUnreviewed: unreviewed.length,
			returned: items.length,
			hasMore: offset + items.length < unreviewed.length,
			nextOffset: offset + items.length < unreviewed.length ? offset + items.length : undefined,
		},
		counts: createCounts(messages.entries, state),
		items: items,
	};
}

function createApproveOutput(args: readonly string[]): {
	readonly locale: string;
	readonly updatedAt: string;
	readonly approved: string[];
	readonly counts: ReviewBatchOutput['counts'];
} {
	const messages = loadMessages(readOption(args, '--messages') ?? defaultMessagesFile);
	const stateFile = readOption(args, '--state') ?? defaultStateFile;
	const state = loadState(stateFile, messages.locale);
	const ids = readIds(args, { required: true });
	const note = readOption(args, '--note');
	const messageMap = new Map(messages.entries.map(entry => [entry.id, entry]));
	const retained = state.entries.filter(entry => messageMap.has(entry.id));
	const indexed = new Map(retained.map(entry => [entry.id, entry]));
	const reviewedAt = nowIso();

	for (const id of ids) {
		const entry = messageMap.get(id);
		if (entry == null) {
			throw new Error(`Unknown authority message id: ${id}`);
		}

		indexed.set(id, {
			id: id,
			fingerprint: createMessageFingerprint(entry),
			reviewedAt: reviewedAt,
			decision: 'approved',
			note: note,
		});
	}

	const nextState: ReviewStateFile = {
		...state,
		updatedAt: reviewedAt,
		entries: [...indexed.values()].sort((left, right) => left.id.localeCompare(right.id)),
	};

	writeJsonFile(stateFile, nextState);
	return {
		locale: messages.locale,
		updatedAt: reviewedAt,
		approved: ids,
		counts: createCounts(messages.entries, nextState),
	};
}

function createUnapproveOutput(args: readonly string[]): {
	readonly locale: string;
	readonly updatedAt: string;
	readonly removed: string[];
	readonly counts: ReviewBatchOutput['counts'];
} {
	const messages = loadMessages(readOption(args, '--messages') ?? defaultMessagesFile);
	const stateFile = readOption(args, '--state') ?? defaultStateFile;
	const state = loadState(stateFile, messages.locale);
	const ids = readIds(args, { required: false });
	const removeAllStale = readBooleanFlag(args, '--all-stale');
	if (!removeAllStale && ids.length === 0) {
		throw new Error('Missing required option: --ids or --ids-file');
	}

	const removableIds = new Set(ids);
	const currentFingerprints = new Map(messages.entries.map(entry => [entry.id, createMessageFingerprint(entry)]));
	const retained = state.entries.filter(entry => {
		if (removeAllStale && currentFingerprints.get(entry.id) !== entry.fingerprint) {
			return false;
		}

		return !removableIds.has(entry.id);
	});

	const nextState: ReviewStateFile = {
		...state,
		updatedAt: nowIso(),
		entries: retained.sort((left, right) => left.id.localeCompare(right.id)),
	};

	writeJsonFile(stateFile, nextState);
	return {
		locale: messages.locale,
		updatedAt: nextState.updatedAt,
		removed: removeAllStale ? [...new Set([...ids, ...findStaleIds(messages.entries, state)])].sort() : ids,
		counts: createCounts(messages.entries, nextState),
	};
}

function createStatsOutput(args: readonly string[]): ReviewStatsOutput {
	const messages = loadMessages(readOption(args, '--messages') ?? defaultMessagesFile);
	const state = loadState(readOption(args, '--state') ?? defaultStateFile, messages.locale);
	return {
		locale: messages.locale,
		generatedAt: nowIso(),
		counts: createCounts(messages.entries, state),
	};
}

function loadMessages(filePath: string): AuthorityMessagesFile {
	return readJsonFile(filePath, createEmptyAuthorityFile('messages', defaultLocale)) as AuthorityMessagesFile;
}

function loadState(filePath: string, locale: string): ReviewStateFile {
	return readJsonFile(filePath, createEmptyReviewState(filePath, locale));
}

function createEmptyReviewState(filePath: string, locale: string): ReviewStateFile {
	const schemaPath = normalizePathSeparators(
		path.relative(path.dirname(filePath), path.join(authorityDir, 'authority-review-state.schema.json')),
	);
	return {
		$schema: schemaPath.startsWith('.') ? schemaPath : `./${schemaPath}`,
		version: 1,
		kind: 'authorityMessageReviewState',
		locale: locale,
		updatedAt: new Date(0).toISOString(),
		entries: [],
	};
}

function collectUnreviewed(
	entries: readonly AuthorityMessageEntry[],
	state: ReviewStateFile,
): Array<{ readonly entry: AuthorityMessageEntry; readonly fingerprint: string }> {
	const reviewed = new Map(state.entries.map(entry => [entry.id, entry]));
	return entries
		.map(entry => ({ entry: entry, fingerprint: createMessageFingerprint(entry) }))
		.filter(({ entry, fingerprint }) => reviewed.get(entry.id)?.fingerprint !== fingerprint)
		.sort((left, right) => left.entry.id.localeCompare(right.entry.id));
}

function createCounts(entries: readonly AuthorityMessageEntry[], state: ReviewStateFile): ReviewBatchOutput['counts'] {
	const fingerprints = new Map(entries.map(entry => [entry.id, createMessageFingerprint(entry)]));
	let reviewedCurrent = 0;
	let staleReviewed = 0;

	for (const review of state.entries) {
		const currentFingerprint = fingerprints.get(review.id);
		if (currentFingerprint == null) continue;
		if (currentFingerprint === review.fingerprint) {
			reviewedCurrent++;
			continue;
		}

		staleReviewed++;
	}

	return {
		total: entries.length,
		reviewedCurrent: reviewedCurrent,
		staleReviewed: staleReviewed,
		unreviewed: entries.length - reviewedCurrent,
	};
}

function createMessageFingerprint(entry: AuthorityMessageEntry): string {
	return createContentHash(stableStringify(entry));
}

function toBatchItem(entry: AuthorityMessageEntry, fingerprint: string): ReviewBatchItem {
	switch (entry.kind) {
		case 'literal':
			return {
				id: entry.id,
				kind: entry.kind,
				source: entry.source,
				translation: entry.translation,
				fingerprint: fingerprint,
			};
		case 'template':
			return {
				id: entry.id,
				kind: entry.kind,
				source: entry.source,
				translation: entry.translation,
				fingerprint: fingerprint,
				slots: [...entry.slots],
			};
		case 'rich':
			return {
				id: entry.id,
				kind: entry.kind,
				source: entry.source,
				translation: entry.translation,
				fingerprint: fingerprint,
				slots: [...entry.slots],
				format: entry.format,
			};
		case 'select':
		case 'plural':
			return {
				id: entry.id,
				kind: entry.kind,
				source: entry.source,
				translation: entry.translation,
				fingerprint: fingerprint,
				selector: entry.selector,
				cases: entry.cases,
			};
	}
}

function findStaleIds(entries: readonly AuthorityMessageEntry[], state: ReviewStateFile): string[] {
	const fingerprints = new Map(entries.map(entry => [entry.id, createMessageFingerprint(entry)]));
	return state.entries
		.filter(entry => fingerprints.get(entry.id) != null && fingerprints.get(entry.id) !== entry.fingerprint)
		.map(entry => entry.id)
		.sort((left, right) => left.localeCompare(right));
}

function readOption(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

function readIntegerOption(args: readonly string[], name: string, fallback: number): number {
	const value = readOption(args, name);
	if (value == null) return fallback;

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`Invalid integer for ${name}: ${value}`);
	}

	return parsed;
}

function readIds(args: readonly string[], options: { readonly required: boolean }): string[] {
	const ids = new Set<string>();
	const inline = readOption(args, '--ids');
	if (inline != null) {
		for (const id of inline
			.split(',')
			.map(part => part.trim())
			.filter(Boolean)) {
			ids.add(id);
		}
	}

	const file = readOption(args, '--ids-file');
	if (file != null) {
		for (const id of parseIdsFile(file)) {
			ids.add(id);
		}
	}

	if (options.required && ids.size === 0) {
		throw new Error('Missing required option: --ids or --ids-file');
	}

	return [...ids].sort((left, right) => left.localeCompare(right));
}

function readBooleanFlag(args: readonly string[], name: string): boolean {
	return args.includes(name);
}

function parseIdsFile(filePath: string): string[] {
	const content = requireTextFile(filePath);
	const trimmed = content.trim();
	if (trimmed === '') return [];

	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		const parsed = JSON.parse(trimmed) as unknown;
		if (Array.isArray(parsed)) {
			return parsed.filter((value): value is string => typeof value === 'string' && value.trim() !== '');
		}

		if (isObject(parsed) && Array.isArray(parsed.items)) {
			return parsed.items
				.map(item => (isObject(item) && typeof item.id === 'string' ? item.id : undefined))
				.filter((value): value is string => value != null && value.trim() !== '');
		}

		throw new Error(`Unsupported ids file JSON format: ${filePath}`);
	}

	return trimmed
		.split(/\r?\n|,/)
		.map(part => part.trim())
		.filter(Boolean);
}

function requireTextFile(filePath: string): string {
	return path.isAbsolute(filePath) ? readTextFile(filePath) : readTextFile(path.resolve(process.cwd(), filePath));
}

function readTextFile(filePath: string): string {
	return fs.readFileSync(filePath, 'utf8');
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value != null;
}

function normalizePathSeparators(value: string): string {
	return value.replaceAll('\\', '/');
}

function isDirectExecution(): boolean {
	return process.argv[1] != null && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}
