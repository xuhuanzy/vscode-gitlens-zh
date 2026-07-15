import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

interface AuthorityMessagesFile {
	readonly entries: AuthorityMessageEntry[];
}

type AuthorityMessageEntry =
	| {
			readonly kind: "literal";
			readonly source: string;
			readonly translation: string;
	  }
	| {
			readonly kind: "template" | "rich";
			readonly source: string;
			readonly translation: string;
			readonly slots: readonly string[];
	  };

interface AuthorityTermsFile {
	readonly entries: Array<{
		readonly source: string;
		readonly translation: string;
	}>;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const weakTemplateWords = new Set([
	"a",
	"an",
	"and",
	"are",
	"at",
	"be",
	"been",
	"being",
	"by",
	"for",
	"from",
	"had",
	"has",
	"have",
	"in",
	"is",
	"more",
	"need",
	"needs",
	"of",
	"on",
	"or",
	"other",
	"require",
	"requires",
	"the",
	"to",
	"was",
	"were",
	"with",
]);

test("messages do not contain empty translations", () => {
	const messages = readJson<AuthorityMessagesFile>("i18n/authority/zh-cn/messages.json");
	const emptyTranslations = messages.entries
		.filter((entry) => entry.translation.length === 0)
		.map((entry) => entry.source)
		.sort((left, right) => left.localeCompare(right));

	expect(emptyTranslations).toEqual([]);
});

test("messages do not contain weak structural templates", () => {
	const messages = readJson<AuthorityMessagesFile>("i18n/authority/zh-cn/messages.json");
	const weakTemplates = messages.entries
		.filter(
			(entry) => (entry.kind === "template" || entry.kind === "rich") && isWeakStructuralTemplate(entry.source),
		)
		.map((entry) => entry.source)
		.sort((left, right) => left.localeCompare(right));

	expect(weakTemplates).toEqual([]);
});

test("working tree terms use Git terminology", () => {
	const terms = readJson<AuthorityTermsFile>("i18n/authority/zh-cn/terms.json");
	const workingTree = terms.entries.find((entry) => entry.source === "Working Tree");

	expect(workingTree?.translation).toBe("工作树");
});

function isWeakStructuralTemplate(source: string): boolean {
	if (!/\$\{slot\d+\}/u.test(source)) return false;

	const withoutSlots = source.replace(/\$\{slot\d+\}/gu, "");
	if (withoutSlots.length === 0) return true;
	if (/^[\s\p{P}\p{S}]+$/u.test(withoutSlots)) return true;

	const words = [...withoutSlots.matchAll(/\p{L}+/gu)].map((match) => match[0].toLowerCase());
	if (words.length === 0) return false;
	if (!words.every((word) => weakTemplateWords.has(word))) return false;

	const withoutWords = withoutSlots.replace(/\p{L}+/gu, "");
	return /^[\s\p{P}\p{S}]*$/u.test(withoutWords);
}

function readJson<T>(relativePath: string): T {
	return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8")) as T;
}
