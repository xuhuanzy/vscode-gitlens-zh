import { expect, test } from "vitest";
import * as ts from "typescript";

import { shouldLocalizeDisplaySite, type DisplayRole } from "../displayPolicy.mts";
import { getSyntheticHtmlTemplateSlotContext } from "../template.mts";

test("preserves Lit attribute binding kinds", () => {
	const cases = [
		{
			source: "const view = html`<gl-button tooltip=${value}></gl-button>`;",
			expected: { kind: "attribute", tag: "gl-button", attribute: "tooltip", binding: "attribute" },
		},
		{
			source: "const view = html`<gl-button .tooltip=${value}></gl-button>`;",
			expected: { kind: "attribute", tag: "gl-button", attribute: "tooltip", binding: "property" },
		},
		{
			source: "const view = html`<gl-button ?disabled=${value}></gl-button>`;",
			expected: { kind: "attribute", tag: "gl-button", attribute: "disabled", binding: "boolean" },
		},
		{
			source: "const view = html`<gl-button @click=${handler}></gl-button>`;",
			expected: { kind: "attribute", tag: "gl-button", attribute: "click", binding: "event" },
		},
	] as const;

	for (const { source, expected } of cases) {
		const sourceFile = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const statement = sourceFile.statements[0];
		if (!ts.isVariableStatement(statement)) throw new Error("Expected variable statement fixture");

		const declaration = statement.declarationList.declarations[0];
		const initializer = declaration.initializer;
		if (initializer == null || !ts.isTaggedTemplateExpression(initializer)) {
			throw new Error("Expected tagged template fixture");
		}

		expect(getSyntheticHtmlTemplateSlotContext(initializer.template, 0)).toEqual(expected);
	}
});

test("decides localization from display roles", () => {
	const cases: readonly (readonly [DisplayRole, boolean])[] = [
		[{ kind: "content" }, true],
		[{ kind: "attribute", name: "tooltip", binding: "attribute" }, true],
		[{ kind: "attribute", name: "aria-label", binding: "attribute" }, true],
		[{ kind: "attribute", tag: "gl-tooltip", name: "content", binding: "attribute" }, true],
		[{ kind: "attribute", name: "tooltip", binding: "property" }, false],
		[{ kind: "attribute", name: "disabled", binding: "boolean" }, false],
		[{ kind: "attribute", name: "click", binding: "event" }, false],
		[{ kind: "attribute", name: "class", binding: "attribute" }, false],
		[{ kind: "imperative", target: "label" }, true],
		[{ kind: "imperative", target: "message" }, true],
		[{ kind: "imperative", target: "placeholder" }, true],
		[{ kind: "imperative", target: "title" }, true],
		[{ kind: "imperative", target: "tooltip" }, true],
	];

	for (const [role, expected] of cases) {
		expect(shouldLocalizeDisplaySite(role)).toBe(expected);
	}
});
