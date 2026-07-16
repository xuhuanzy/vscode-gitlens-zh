import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";

import { createTestLayerOptions } from "../../testing/tempRoot.mts";
import { createDomainContext, createI18nLayerContext } from "../context.mts";
import type { TranslationWorksetFile } from "../model.mts";
import { createEmptyCatalogFile, loadCatalog, readJsonFile, readJsonFileIfMissing, saveWorkset } from "../store.mts";

test("creates catalog v6 files", () => {
	expect(
		createEmptyCatalogFile({
			schemaPath: "../schemas/sourceCatalog.schema.json",
			domain: "webviews",
		}),
	).toEqual({
		$schema: "../schemas/sourceCatalog.schema.json",
		version: 6,
		domain: "webviews",
		occurrences: [],
	});
});

test("rejects catalog v5 files", () => {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitlens-i18n-store-"));
	try {
		const context = createDomainContext(createI18nLayerContext(createTestLayerOptions(rootDir)), {
			domain: "webviews",
			artifactId: "webviews",
		});
		fs.mkdirSync(path.dirname(context.catalogFile), { recursive: true });
		fs.writeFileSync(
			context.catalogFile,
			JSON.stringify({
				$schema: "../schemas/sourceCatalog.schema.json",
				version: 5,
				domain: "webviews",
				occurrences: [],
			}),
			"utf8",
		);

		expect(() => loadCatalog(context)).toThrow("Unsupported source catalog version: 5");
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
});

test("throws when reading invalid JSON", () => {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitlens-i18n-store-"));
	try {
		const filePath = path.join(rootDir, "broken.json");
		fs.writeFileSync(filePath, "{", "utf8");

		expect(() => readJsonFile(filePath)).toThrow(SyntaxError);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
});

test("skips writes when only generatedAt changes", () => {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitlens-i18n-store-"));
	try {
		const context = createDomainContext(createI18nLayerContext(createTestLayerOptions(rootDir)), {
			domain: "manifest",
			artifactId: "package",
		});
		const initial: TranslationWorksetFile = {
			$schema: "../schemas/translationWorkset.schema.json",
			version: 2,
			locale: "zh-cn",
			domain: "manifest",
			generatedAt: "2026-01-01T00:00:00.000Z",
			entries: [
				{
					id: "message.open",
					kind: "literal",
					source: "Open",
					translation: null,
					sourceHash: "hash-open",
					occurrenceIds: ["manifest:command.open#title"],
					status: "pending",
				},
			],
		};

		saveWorkset(context, initial);
		const firstContents = fs.readFileSync(context.worksetFile, "utf8");

		saveWorkset(context, {
			...initial,
			generatedAt: "2026-01-02T00:00:00.000Z",
		});
		expect(fs.readFileSync(context.worksetFile, "utf8")).toBe(firstContents);

		saveWorkset(context, {
			...initial,
			generatedAt: "2026-01-03T00:00:00.000Z",
			entries: [
				{
					...initial.entries[0],
					translation: "打开",
					status: "translated",
				},
			],
		});
		expect(fs.readFileSync(context.worksetFile, "utf8")).not.toBe(firstContents);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
});

test("uses the initial value only for missing files", () => {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitlens-i18n-store-"));
	try {
		expect(readJsonFileIfMissing(path.join(rootDir, "missing.json"), { entries: [] })).toEqual({ entries: [] });

		const filePath = path.join(rootDir, "broken.json");
		fs.writeFileSync(filePath, "{", "utf8");
		expect(() => readJsonFileIfMissing(filePath, { entries: [] })).toThrow(SyntaxError);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
});
