import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import type { AuthorityMessageEntry } from "../core/model.mts";
import { createContentHash, nowIso, stableStringify } from "../core/model.mts";
import { readJsonFile, readJsonFileIfMissing, writeJsonFile } from "../core/store.mts";

interface ReviewStateEntry {
	readonly id: string;
	readonly fingerprint: string;
	readonly reviewedAt: string;
	readonly note?: string;
}

interface ReviewStateFile {
	readonly $schema: string;
	readonly version: 1;
	readonly kind: "authorityMessageReviewState";
	readonly locale: string;
	readonly updatedAt: string;
	readonly entries: ReviewStateEntry[];
}

type ReviewBatchItem = AuthorityMessageEntry & {
	readonly fingerprint: string;
};

interface AuthorityMessagesFile {
	readonly $schema: string;
	readonly version: 2;
	readonly kind: "messages";
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
const defaultLocale = "zh-cn";
const scriptDir = path.dirname(import.meta.filename);
const authorityDir = scriptDir;
const defaultMessagesFile = path.join(authorityDir, defaultLocale, "messages.json");
const defaultStateFile = path.join(authorityDir, defaultLocale, "messages.review-state.json");

if (path.resolve(process.argv[1] ?? "") === import.meta.filename) {
	console.log(JSON.stringify(execute(process.argv.slice(2)), undefined, "\t"));
}

/** 执行 authority 消息审核命令, 审核状态仅写入旁路 state 文件. */
export function execute(args: readonly string[]): unknown {
	const command = args[0] ?? "next";

	switch (command) {
		case "next":
			return createNextOutput(args.slice(1));
		case "approve":
			return createApproveOutput(args.slice(1));
		case "unapprove":
			return createUnapproveOutput(args.slice(1));
		case "stats":
			return createStatsOutput(args.slice(1));
		default:
			throw new Error(`Unknown command: ${command}`);
	}
}

function createNextOutput(args: readonly string[]): ReviewBatchOutput {
	const options = parseReviewOptions(args);
	const messages = loadMessages(options.messages ?? defaultMessagesFile);
	const stateFile = options.state ?? defaultStateFile;
	const state = loadState(stateFile, messages.locale);
	const offset = readIntegerOption(options.offset, "--offset", 0);
	const limit = readIntegerOption(options.limit, "--limit", defaultLimit);
	const unreviewed = collectUnreviewed(messages.entries, state);
	const items = unreviewed.slice(offset, offset + limit).map((entry) => toBatchItem(entry.entry, entry.fingerprint));

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
	readonly counts: ReviewBatchOutput["counts"];
} {
	const options = parseReviewOptions(args);
	const messages = loadMessages(options.messages ?? defaultMessagesFile);
	const stateFile = options.state ?? defaultStateFile;
	const state = loadState(stateFile, messages.locale);
	const ids = readIds(options, true);
	const note = options.note;
	const messageMap = new Map(messages.entries.map((entry) => [entry.id, entry]));
	const retained = state.entries.filter((entry) => messageMap.has(entry.id));
	const indexed = new Map(retained.map((entry) => [entry.id, entry]));
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
	readonly counts: ReviewBatchOutput["counts"];
} {
	const options = parseReviewOptions(args);
	const messages = loadMessages(options.messages ?? defaultMessagesFile);
	const stateFile = options.state ?? defaultStateFile;
	const state = loadState(stateFile, messages.locale);
	const ids = readIds(options, false);
	const removeAllStale = options["all-stale"] ?? false;
	if (!removeAllStale && ids.length === 0) {
		throw new Error("Missing required option: --ids or --ids-file");
	}

	const removableIds = new Set(ids);
	const currentFingerprints = new Map(messages.entries.map((entry) => [entry.id, createMessageFingerprint(entry)]));
	const retained = state.entries.filter((entry) => {
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
	const options = parseReviewOptions(args);
	const messages = loadMessages(options.messages ?? defaultMessagesFile);
	const state = loadState(options.state ?? defaultStateFile, messages.locale);
	return {
		locale: messages.locale,
		generatedAt: nowIso(),
		counts: createCounts(messages.entries, state),
	};
}

function loadMessages(filePath: string): AuthorityMessagesFile {
	return readJsonFile<AuthorityMessagesFile>(filePath);
}

function loadState(filePath: string, locale: string): ReviewStateFile {
	return readJsonFileIfMissing(filePath, createEmptyReviewState(filePath, locale));
}

function createEmptyReviewState(filePath: string, locale: string): ReviewStateFile {
	const schemaPath = path
		.relative(path.dirname(filePath), path.join(authorityDir, "authority-review-state.schema.json"))
		.replaceAll("\\", "/");
	return {
		$schema: schemaPath.startsWith(".") ? schemaPath : `./${schemaPath}`,
		version: 1,
		kind: "authorityMessageReviewState",
		locale: locale,
		updatedAt: new Date(0).toISOString(),
		entries: [],
	};
}

function collectUnreviewed(
	entries: readonly AuthorityMessageEntry[],
	state: ReviewStateFile,
): Array<{ readonly entry: AuthorityMessageEntry; readonly fingerprint: string }> {
	const reviewed = new Map(state.entries.map((entry) => [entry.id, entry]));
	return entries
		.map((entry) => ({ entry: entry, fingerprint: createMessageFingerprint(entry) }))
		.filter(({ entry, fingerprint }) => reviewed.get(entry.id)?.fingerprint !== fingerprint)
		.sort((left, right) => left.entry.id.localeCompare(right.entry.id));
}

function createCounts(entries: readonly AuthorityMessageEntry[], state: ReviewStateFile): ReviewBatchOutput["counts"] {
	const fingerprints = new Map(entries.map((entry) => [entry.id, createMessageFingerprint(entry)]));
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
	return { ...structuredClone(entry), fingerprint: fingerprint };
}

function findStaleIds(entries: readonly AuthorityMessageEntry[], state: ReviewStateFile): string[] {
	const fingerprints = new Map(entries.map((entry) => [entry.id, createMessageFingerprint(entry)]));
	return state.entries
		.filter((entry) => fingerprints.get(entry.id) != null && fingerprints.get(entry.id) !== entry.fingerprint)
		.map((entry) => entry.id)
		.sort((left, right) => left.localeCompare(right));
}

function readIntegerOption(value: string | undefined, name: string, fallback: number): number {
	if (value == null) return fallback;

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`Invalid integer for ${name}: ${value}`);
	}

	return parsed;
}

function readIds(options: ReturnType<typeof parseReviewOptions>, required: boolean): string[] {
	const ids = new Set<string>();
	const inline = options.ids;
	if (inline != null) {
		for (const id of inline
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean)) {
			ids.add(id);
		}
	}

	const file = options["ids-file"];
	if (file != null) {
		for (const id of parseIdsFile(file)) {
			ids.add(id);
		}
	}

	if (required && ids.size === 0) {
		throw new Error("Missing required option: --ids or --ids-file");
	}

	return [...ids].sort((left, right) => left.localeCompare(right));
}
function parseIdsFile(filePath: string): string[] {
	const content = fs.readFileSync(filePath, "utf8");
	const trimmed = content.trim();
	if (trimmed === "") return [];

	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		const parsed = JSON.parse(trimmed) as unknown;
		if (Array.isArray(parsed)) {
			return parsed.filter((value): value is string => typeof value === "string" && value.trim() !== "");
		}

		if (isObject(parsed) && Array.isArray(parsed.items)) {
			return parsed.items
				.map((item) => (isObject(item) && typeof item.id === "string" ? item.id : undefined))
				.filter((value): value is string => value != null && value.trim() !== "");
		}

		throw new Error(`Unsupported ids file JSON format: ${filePath}`);
	}

	return trimmed
		.split(/\r?\n|,/)
		.map((part) => part.trim())
		.filter(Boolean);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null;
}

function parseReviewOptions(args: readonly string[]) {
	return parseArgs({
		args: [...args],
		allowPositionals: false,
		strict: true,
		options: {
			messages: { type: "string" },
			state: { type: "string" },
			offset: { type: "string" },
			limit: { type: "string" },
			ids: { type: "string" },
			"ids-file": { type: "string" },
			note: { type: "string" },
			"all-stale": { type: "boolean" },
		},
	}).values;
}
