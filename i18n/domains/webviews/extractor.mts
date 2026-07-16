import type { CatalogIssue, OutputReference, SourceOccurrence } from "../../core/model.mts";
import { createAuthorityId } from "../../core/model.mts";

import { analyzeWebviewSource, type WebviewLocalizationSite } from "./sourcePlan.mts";

export interface WebviewsExtractionResult {
	readonly occurrences: SourceOccurrence[];
	readonly issues: CatalogIssue[];
}

export interface RuntimeSourceTarget {
	readonly kind: "source";
	readonly file: string;
	readonly source: string;
	readonly syntax: "ts" | "tsx" | "jsx";
	readonly bundle: string;
	readonly mode?: "supported" | "deferred";
	readonly deferredReason?: string;
}

/** 将 source plan 转换为 catalog occurrence，延后目标只记录问题. */
export function extractSupportedWebviewOccurrences(targets: readonly RuntimeSourceTarget[]): WebviewsExtractionResult {
	const occurrences: SourceOccurrence[] = [];
	const issues: CatalogIssue[] = [];
	const seenIds = new Set<string>();

	for (const target of targets) {
		const plan = analyzeWebviewSource(target);
		issues.push(...plan.issues);
		for (const site of plan.sites) {
			const occurrence = createOccurrence(target, site);
			if (target.mode === "deferred") {
				issues.push({
					occurrenceId: occurrence.id,
					reference: occurrence.reference,
					output: occurrence.output,
					reason: `deferred ${target.bundle}: ${target.deferredReason ?? `unsupported ${target.syntax} or follow-up runtime path`}`,
				});
				continue;
			}
			if (seenIds.has(occurrence.id)) {
				issues.push({
					occurrenceId: occurrence.id,
					reference: occurrence.reference,
					output: occurrence.output,
					reason: `duplicate webview occurrence id: ${occurrence.id}`,
				});
				continue;
			}

			seenIds.add(occurrence.id);
			occurrences.push(occurrence);
		}
	}

	return {
		occurrences: occurrences.sort((left, right) => left.id.localeCompare(right.id)),
		issues: issues,
	};
}

function createOccurrence(target: RuntimeSourceTarget, site: WebviewLocalizationSite): SourceOccurrence {
	return {
		id: site.id,
		scope: `webviews.${target.bundle}.runtime`,
		authorityId: createAuthorityId(site.pattern),
		pattern: site.pattern,
		reference: {
			kind: "source",
			file: target.file,
			attribute: site.role.kind === "attribute" ? site.role.name : undefined,
		},
		output: createRuntimeOutputReference(target.bundle, site.outputKey),
	};
}

function createRuntimeOutputReference(bundle: string, key: string): OutputReference {
	return {
		kind: "runtime-key",
		bundle: bundle,
		key: key,
	};
}
