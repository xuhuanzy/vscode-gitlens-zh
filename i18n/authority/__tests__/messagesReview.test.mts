import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { execute } from "../messagesReview.mts";

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

interface ReviewStateFile {
	readonly entries: Array<{
		readonly note?: string;
	}>;
}

interface FixtureMessagesFile {
	entries: Array<
		| {
				id: string;
				kind: "literal";
				source: string;
				translation: string;
		  }
		| {
				id: string;
				kind: "template";
				source: string;
				translation: string;
				slots: string[];
		  }
	>;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("returns only unreviewed entries", () => {
	const fixture = createFixture();
	try {
		const first = runScript<ReviewBatchResponse>(fixture, ["next", "--limit", "2"]);
		expect(first.pagination.returned).toBe(2);
		expect(first.pagination.totalUnreviewed).toBe(3);
		expect(first.pagination.hasMore).toBe(true);
		expect(first.pagination.nextOffset).toBe(2);
		expect(first.items.map((item: { id: string }) => item.id)).toEqual(["message.a", "message.b"]);

		const second = runScript<ReviewBatchResponse>(fixture, ["next", "--limit", "2", "--offset", "2"]);
		expect(second.pagination.returned).toBe(1);
		expect(second.pagination.hasMore).toBe(false);
		expect(second.items.map((item: { id: string }) => item.id)).toEqual(["message.c"]);
	} finally {
		cleanupFixture(fixture.rootDir);
	}
});

test("persists fingerprint-based review state", () => {
	const fixture = createFixture();
	try {
		const approved = runScript<ReviewMutationResponse>(fixture, [
			"approve",
			"--ids",
			"message.a,message.b",
			"--note",
			"checked",
		]);
		expect(approved.approved).toEqual(["message.a", "message.b"]);
		expect(approved.counts.reviewedCurrent).toBe(2);
		expect(approved.counts.unreviewed).toBe(1);

		const next = runScript<ReviewBatchResponse>(fixture, ["next", "--limit", "10"]);
		expect(next.items.map((item: { id: string }) => item.id)).toEqual(["message.c"]);

		const state = readJson<ReviewStateFile>(path.join(fixture.localeDir, "messages.review-state.json"));
		expect(state.entries.length).toBe(2);
		expect(state.entries[0].note).toBe("checked");
	} finally {
		cleanupFixture(fixture.rootDir);
	}
});

test("marks changed messages unreviewed again", () => {
	const fixture = createFixture();
	try {
		runScript<ReviewMutationResponse>(fixture, ["approve", "--ids", "message.a"]);

		const messagesFile = path.join(fixture.localeDir, "messages.json");
		const messages = readJson<FixtureMessagesFile>(messagesFile);
		messages.entries = messages.entries.map((entry) =>
			entry.id === "message.a" ? { ...entry, translation: "已变更译文" } : entry,
		);
		fs.writeFileSync(messagesFile, `${JSON.stringify(messages, undefined, "\t")}\n`, "utf8");

		const stats = runScript<ReviewStatsResponse>(fixture, ["stats"]);
		expect(stats.counts.reviewedCurrent).toBe(0);
		expect(stats.counts.staleReviewed).toBe(1);
		expect(stats.counts.unreviewed).toBe(3);

		const next = runScript<ReviewBatchResponse>(fixture, ["next", "--limit", "10"]);
		expect(next.items.map((item: { id: string }) => item.id)).toEqual(["message.a", "message.b", "message.c"]);
	} finally {
		cleanupFixture(fixture.rootDir);
	}
});

test("removes requested and stale entries when unapproved", () => {
	const fixture = createFixture();
	try {
		runScript<ReviewMutationResponse>(fixture, ["approve", "--ids", "message.a,message.b"]);

		const messagesFile = path.join(fixture.localeDir, "messages.json");
		const messages = readJson<FixtureMessagesFile>(messagesFile);
		messages.entries = messages.entries.map((entry) =>
			entry.id === "message.b" ? { ...entry, translation: "另一个变更译文" } : entry,
		);
		fs.writeFileSync(messagesFile, `${JSON.stringify(messages, undefined, "\t")}\n`, "utf8");

		const removed = runScript<ReviewMutationResponse>(fixture, ["unapprove", "--ids", "message.a", "--all-stale"]);
		expect(removed.removed).toEqual(["message.a", "message.b"]);
		expect(removed.counts.reviewedCurrent).toBe(0);

		const state = readJson<ReviewStateFile>(path.join(fixture.localeDir, "messages.review-state.json"));
		expect(state.entries.length).toBe(0);
	} finally {
		cleanupFixture(fixture.rootDir);
	}
});

function createFixture(): { rootDir: string; authorityDir: string; localeDir: string } {
	const tempRoot = path.join(repoRoot, ".work", "i18n", "authority-review-tests");
	fs.mkdirSync(tempRoot, { recursive: true });
	const rootDir = fs.mkdtempSync(path.join(tempRoot, "case-"));
	const authorityDir = path.join(rootDir, "i18n", "authority");
	const localeDir = path.join(authorityDir, "zh-cn");
	fs.mkdirSync(localeDir, { recursive: true });

	writeJson(path.join(localeDir, "messages.json"), {
		$schema: "../../schemas/authority.schema.json",
		version: 2,
		kind: "messages",
		locale: "zh-cn",
		updatedAt: "2026-04-24T00:00:00.000Z",
		entries: [
			{
				id: "message.c",
				kind: "literal",
				source: "Show Stashes",
				translation: "显示贮藏",
			},
			{
				id: "message.a",
				kind: "literal",
				source: "Branches View",
				translation: "分支视图",
			},
			{
				id: "message.b",
				kind: "template",
				source: "Showing all ${slot1}",
				translation: "显示全部 ${slot1}",
				slots: ["slot1"],
			},
		],
	});

	writeJson(path.join(localeDir, "messages.review-state.json"), {
		$schema: "../authority-review-state.schema.json",
		version: 1,
		kind: "authorityMessageReviewState",
		locale: "zh-cn",
		updatedAt: "1970-01-01T00:00:00.000Z",
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
			"--messages",
			path.join(fixture.localeDir, "messages.json"),
			"--state",
			path.join(fixture.localeDir, "messages.review-state.json"),
		]) as TOutput;
	} finally {
		process.chdir(previousCwd);
	}
}

function writeJson(filePath: string, value: unknown): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, undefined, "\t")}\n`, "utf8");
}

function readJson<T>(filePath: string): T {
	return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function cleanupFixture(rootDir: string): void {
	fs.rmSync(rootDir, { recursive: true, force: true });
}
