import { expect, test } from "vitest";

import { hasTranslation, type WorksetMessageRecord } from "../model.mts";

test("rejects empty translations", () => {
	const record: WorksetMessageRecord = {
		id: "message.empty",
		kind: "literal",
		source: " more ",
		translation: "",
	};

	expect(hasTranslation(record)).toBe(false);
});

test("accepts templates containing all slots", () => {
	const record: WorksetMessageRecord = {
		id: "message.valid-template",
		kind: "template",
		source: "${slot1} on ${slot2}",
		translation: "在 ${slot2} 上打开 ${slot1}",
		slots: ["slot1", "slot2"],
	};

	expect(hasTranslation(record)).toBe(true);
});
