import { expect, test } from "vitest";

import type { SourceCatalogFile } from "../model.mts";
import { createReconciliationReport } from "../reconcile.mts";

test("reports catalog v6 occurrences without anchor or slot identity fields", () => {
	const previous: SourceCatalogFile = {
		$schema: "../schemas/sourceCatalog.schema.json",
		version: 6,
		domain: "webviews",
		occurrences: [],
	};
	const current: SourceCatalogFile = {
		...previous,
		occurrences: [
			{
				id: "webviews:graph:stable-site",
				scope: "webviews.graph.runtime",
				authorityId: "message.open-graph",
				pattern: { kind: "literal", text: "Open Graph" },
				reference: { kind: "source", file: "src/graph.ts" },
				output: { kind: "runtime-key", bundle: "graph", key: "graph.open-graph" },
			},
		],
	};

	const report = createReconciliationReport(previous, current, [], {
		domain: "webviews",
		schemaPath: "../schemas/reconciliationReport.schema.json",
	});

	expect(report.entries[0]).toEqual({
		occurrenceId: "webviews:graph:stable-site",
		change: "added",
		currentReference: { kind: "source", file: "src/graph.ts" },
		currentSourceHash: expect.any(String),
		output: { kind: "runtime-key", bundle: "graph", key: "graph.open-graph" },
	});
});
