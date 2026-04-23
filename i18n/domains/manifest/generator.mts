import type { AuthorityBundle, OutputReference, SourceOccurrence } from '../../core/model.mts';
import { isJsonSourceReference } from '../../core/model.mts';
import { resolveOccurrenceTranslation } from '../../core/authority.mts';

export interface GeneratedManifestOutputs {
	readonly manifest: Record<string, unknown>;
	readonly englishPackageNls: Record<string, string>;
	readonly localizedPackageNls: Record<string, string>;
	readonly englishKeys: number;
	readonly localizedKeys: number;
	readonly unresolvedKeys: number;
}

export function generateManifestOutputs(
	manifestInput: Record<string, unknown>,
	occurrences: readonly SourceOccurrence[],
	bundle: AuthorityBundle,
): GeneratedManifestOutputs {
	const manifest = JSON.parse(JSON.stringify(manifestInput)) as Record<string, unknown>;
	const englishPackageNls: Record<string, string> = {};
	const localizedPackageNls: Record<string, string> = {};

	for (const occurrence of occurrences) {
		const outputKey = getManifestOutputKey(occurrence.output);
		if (outputKey == null) continue;

		englishPackageNls[outputKey] = occurrence.sourceText;

		if (isJsonSourceReference(occurrence.reference)) {
			setManifestValue(manifest, occurrence.reference.segments, `%${outputKey}%`);
		}

		const resolved = resolveOccurrenceTranslation(occurrence, bundle);
		if (resolved != null) {
			localizedPackageNls[outputKey] = resolved.pattern.text;
		}
	}

	return {
		manifest: manifest,
		englishPackageNls: englishPackageNls,
		localizedPackageNls: localizedPackageNls,
		englishKeys: Object.keys(englishPackageNls).length,
		localizedKeys: Object.keys(localizedPackageNls).length,
		unresolvedKeys: Object.keys(englishPackageNls).length - Object.keys(localizedPackageNls).length,
	};
}

function getManifestOutputKey(output: OutputReference | undefined): string | undefined {
	return output?.kind === 'manifest-key' ? output.key : undefined;
}

function setManifestValue(
	target: Record<string, unknown>,
	segments: readonly (string | number)[],
	value: string,
): void {
	let current: unknown = target;
	for (let index = 0; index < segments.length - 1; index++) {
		const segment = segments[index];
		if (typeof segment === 'number') {
			current = Array.isArray(current) ? current[segment] : undefined;
			continue;
		}

		current =
			current != null && typeof current === 'object' ? (current as Record<string, unknown>)[segment] : undefined;
	}

	const lastSegment = segments.at(-1);
	if (lastSegment == null || current == null || typeof current !== 'object') return;

	if (typeof lastSegment === 'number') {
		if (Array.isArray(current)) {
			current[lastSegment] = value;
		}
		return;
	}

	(current as Record<string, unknown>)[lastSegment] = value;
}
