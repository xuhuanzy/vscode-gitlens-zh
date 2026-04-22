export type WebviewLocalizedPattern =
	| {
			kind: 'literal';
			text: string;
	  }
	| {
			kind: 'template' | 'rich' | 'select' | 'plural';
			text: string;
			slots?: readonly string[];
			selector?: string;
			cases?: Record<string, string>;
	  };

export interface WebviewLocalizedMessage {
	readonly key: string;
	readonly source: string;
	readonly pattern: WebviewLocalizedPattern;
}

export interface WebviewLocalizationPayload {
	readonly version: 1;
	readonly locale: string;
	readonly bundle?: string;
	readonly messages: readonly WebviewLocalizedMessage[];
}

export interface RuntimeWebviewTemplateTranslation {
	readonly source: string;
	readonly target: string;
	readonly slots: readonly string[];
}

export interface RuntimeWebviewLocalizationPayload {
	readonly locale: string;
	readonly translations: Readonly<Record<string, string>>;
	readonly templates: readonly RuntimeWebviewTemplateTranslation[];
}

const runtimeUnsafeStandaloneWords = new Set(['are', 'has', 'have', 'is', 'need', 'needs', 'require', 'requires']);
const runtimeUnsafeExactTranslationsByBundle = new Map<string, ReadonlySet<string>>([
	['home', new Set(['No', 'recent', 'stale'])],
]);
const runtimeAllowedShortDerivedTranslations = new Set([
	'Connect hosting services like',
	'and issue trackers like',
	'Learn more about the',
	'Thanks for starting your',
	"You're now on the",
	"You're using",
]);
const runtimeExactDerivedTemplatePolicies: ReadonlyArray<{
	readonly source: string;
	readonly expand: (
		message: WebviewLocalizedMessage,
		exactTranslations: ReadonlyMap<string, string>,
	) => ReadonlyArray<{ readonly source: string; readonly target: string }>;
}> = [
	{
		source: 'No ${slot1} branches',
		expand: (_message, exactTranslations) => {
			const expansions: Array<{ readonly source: string; readonly target: string }> = [];
			for (const slotValue of ['recent', 'stale']) {
				const translatedSlotValue = exactTranslations.get(slotValue);
				if (translatedSlotValue == null) continue;

				expansions.push({
					source: `No ${slotValue} branches`,
					target: `没有${translatedSlotValue}分支`,
				});
			}

			return expansions;
		},
	},
];

export function buildRuntimeWebviewLocalizationPayload(
	payload: WebviewLocalizationPayload | undefined,
): RuntimeWebviewLocalizationPayload | undefined {
	if (payload == null) return undefined;

	const translations = new Map<string, string>();
	const translationCollisions = new Set<string>();
	const derivedTranslations = new Map<string, string>();
	const derivedTranslationCollisions = new Set<string>();
	const templates = new Map<string, RuntimeWebviewTemplateTranslation>();
	const templateCollisions = new Set<string>();
	const exactTranslations = collectExactTranslations(payload.messages);

	for (const message of payload.messages) {
		const source = normalizeWebviewLocalizationText(message.source);
		if (source.length === 0) continue;

		const target = message.pattern.text;
		if (target === message.source) continue;

		const slots = getTemplateSlots(message.source);
		if (slots.length === 0) {
			if (!shouldIncludeRuntimeExactTranslation(payload.bundle, source, target)) continue;
			if (translationCollisions.has(source)) continue;

			const existing = translations.get(source);
			if (existing == null) {
				translations.set(source, target);
				continue;
			}

			if (existing !== target) {
				translations.delete(source);
				translationCollisions.add(source);
			}
			continue;
		}

		if (shouldIncludeRuntimeTemplate(message.source)) {
			if (!templateCollisions.has(source)) {
				const existingTemplate = templates.get(source);
				if (existingTemplate == null) {
					templates.set(source, {
						source: source,
						target: target,
						slots: slots,
					});
				} else if (existingTemplate.target !== target) {
					templates.delete(source);
					templateCollisions.add(source);
				}
			}
		}

		const exactDerivedTranslations = collectRuntimeExactDerivedTranslations(message, exactTranslations);
		for (const translation of exactDerivedTranslations) {
			addRuntimeTranslation(translations, translation.source, translation.target, translationCollisions);
		}

		for (const fragment of collectDerivedTemplateFragmentTranslations(message.source, target)) {
			const normalizedFragmentSource = normalizeWebviewLocalizationText(fragment.source);
			if (normalizedFragmentSource.length === 0) continue;
			if (!shouldIncludeRuntimeDerivedTranslation(source, normalizedFragmentSource)) continue;
			if (translationCollisions.has(normalizedFragmentSource)) continue;

			const explicitTranslation = translations.get(normalizedFragmentSource);
			if (explicitTranslation != null) continue;
			if (derivedTranslationCollisions.has(normalizedFragmentSource)) continue;

			const existingDerived = derivedTranslations.get(normalizedFragmentSource);
			if (existingDerived == null) {
				derivedTranslations.set(normalizedFragmentSource, fragment.target);
				continue;
			}

			if (existingDerived !== fragment.target) {
				derivedTranslations.delete(normalizedFragmentSource);
				derivedTranslationCollisions.add(normalizedFragmentSource);
			}
		}
	}

	for (const collision of translationCollisions) {
		translations.delete(collision);
	}
	for (const collision of derivedTranslationCollisions) {
		derivedTranslations.delete(collision);
	}
	for (const [source, target] of derivedTranslations) {
		if (!translations.has(source)) {
			translations.set(source, target);
		}
	}

	const serializedTranslations = Object.fromEntries(
		[...translations.entries()].sort(([left], [right]) => left.localeCompare(right)),
	);
	const serializedTemplates = [...templates.values()].sort(compareRuntimeTemplateSpecificity);

	if (Object.keys(serializedTranslations).length === 0 && serializedTemplates.length === 0) {
		return undefined;
	}

	return {
		locale: payload.locale,
		translations: serializedTranslations,
		templates: serializedTemplates,
	};
}

export function normalizeWebviewLocalizationText(value: string): string {
	return value.replace(/[ \t\r\n\f]+/g, ' ').trim();
}

function getTemplateSlots(value: string): string[] {
	return [...value.matchAll(/\$\{([^}]+)\}/g)].map(([, slotName]) => slotName);
}

function shouldIncludeRuntimeExactTranslation(bundle: string | undefined, source: string, target: string): boolean {
	if (target.length === 0 && runtimeUnsafeStandaloneWords.has(source.toLowerCase())) return false;

	const bundleUnsafeTranslations = bundle == null ? undefined : runtimeUnsafeExactTranslationsByBundle.get(bundle);
	if (bundleUnsafeTranslations?.has(source) === true) return false;

	return true;
}

function shouldIncludeRuntimeDerivedTranslation(templateSource: string, source: string): boolean {
	if (isRuntimeExactDerivedTemplateSource(templateSource)) return false;

	const stats = getRuntimeLiteralStats([source]);
	if (runtimeAllowedShortDerivedTranslations.has(source)) return true;
	if (stats.totalLiteralLength >= 32) return true;
	if (stats.wordCount >= 6) return true;
	if (stats.wordCount >= 3 && /[.!?:]/.test(source)) return true;

	return false;
}

function shouldIncludeRuntimeTemplate(source: string): boolean {
	const parsed = parseTemplateText(source);
	const stats = getRuntimeLiteralStats(parsed.segments);
	if (stats.totalLiteralLength === 0) return false;
	if (!isSentenceLikeRuntimeTemplate(source, stats.wordCount)) return false;

	if (countAnchoredRuntimeTemplateSlots(parsed.segments) > 0) {
		return stats.longestLiteralLength >= 12 || stats.totalLiteralLength >= 24 || stats.wordCount >= 6;
	}

	if (
		hasStructuredRuntimeSlotSeparator(parsed.segments) &&
		hasStrongRuntimeEdgeAnchor(parsed.segments, { minLength: 12, minWords: 2 })
	) {
		return stats.longestLiteralLength >= 12 || stats.totalLiteralLength >= 20 || stats.wordCount >= 6;
	}

	return (
		stats.totalLiteralLength >= 24 && hasStrongRuntimeEdgeAnchor(parsed.segments, { minLength: 20, minWords: 5 })
	);
}

function isSentenceLikeRuntimeTemplate(source: string, wordCount: number): boolean {
	if (wordCount >= 6) return true;
	if (wordCount >= 4 && /[.!?:;]/.test(source)) return true;

	return false;
}

function compareRuntimeTemplateSpecificity(
	left: RuntimeWebviewTemplateTranslation,
	right: RuntimeWebviewTemplateTranslation,
): number {
	const leftStats = getRuntimeLiteralStats(parseTemplateText(left.source).segments);
	const rightStats = getRuntimeLiteralStats(parseTemplateText(right.source).segments);

	return (
		rightStats.longestLiteralLength - leftStats.longestLiteralLength ||
		rightStats.totalLiteralLength - leftStats.totalLiteralLength ||
		rightStats.wordCount - leftStats.wordCount ||
		right.source.length - left.source.length ||
		left.source.localeCompare(right.source)
	);
}

function getRuntimeLiteralStats(segments: readonly string[]): {
	readonly longestLiteralLength: number;
	readonly totalLiteralLength: number;
	readonly wordCount: number;
} {
	let longestLiteralLength = 0;
	let totalLiteralLength = 0;
	let wordCount = 0;

	for (const segment of segments) {
		const normalized = normalizeWebviewLocalizationText(segment);
		if (normalized.length === 0) continue;

		longestLiteralLength = Math.max(longestLiteralLength, normalized.length);
		totalLiteralLength += normalized.length;
		wordCount += countRuntimeLiteralWords(normalized);
	}

	return {
		longestLiteralLength: longestLiteralLength,
		totalLiteralLength: totalLiteralLength,
		wordCount: wordCount,
	};
}

function countRuntimeLiteralWords(value: string): number {
	return value.match(/[\p{L}\p{N}]+(?:[+#&./'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function countAnchoredRuntimeTemplateSlots(segments: readonly string[]): number {
	let count = 0;

	for (let index = 0; index < segments.length - 1; index++) {
		const left = normalizeWebviewLocalizationText(segments[index] ?? '');
		const right = normalizeWebviewLocalizationText(segments[index + 1] ?? '');
		if (left.length === 0 || right.length === 0) continue;

		count++;
	}

	return count;
}

function hasStructuredRuntimeSlotSeparator(segments: readonly string[]): boolean {
	for (let index = 1; index < segments.length - 1; index++) {
		const separator = segments[index] ?? '';
		if (!/[^\s]/.test(separator)) continue;
		if (!/[^\p{L}\p{N}\s]/u.test(separator)) continue;

		return true;
	}

	return false;
}

function hasStrongRuntimeEdgeAnchor(
	segments: readonly string[],
	thresholds: {
		readonly minLength: number;
		readonly minWords: number;
	},
): boolean {
	const first = normalizeWebviewLocalizationText(segments[0] ?? '');
	const last = normalizeWebviewLocalizationText(segments[segments.length - 1] ?? '');

	return [first, last].some(segment => {
		return segment.length >= thresholds.minLength || countRuntimeLiteralWords(segment) >= thresholds.minWords;
	});
}

function collectDerivedTemplateFragmentTranslations(
	source: string,
	target: string,
): Array<{ readonly source: string; readonly target: string }> {
	const sourceTemplate = parseTemplateText(source);
	if (sourceTemplate.slots.length === 0) return [];

	const targetTemplate = parseTemplateText(target);
	if (sourceTemplate.slots.length !== targetTemplate.slots.length) return [];
	if (!sourceTemplate.slots.every((slotName, index) => targetTemplate.slots[index] === slotName)) return [];

	const fragments: Array<{ readonly source: string; readonly target: string }> = [];
	for (let index = 0; index < sourceTemplate.segments.length; index++) {
		const sourceFragment = normalizeWebviewLocalizationText(sourceTemplate.segments[index] ?? '');
		const targetFragment = normalizeWebviewLocalizationText(targetTemplate.segments[index] ?? '');
		if (sourceFragment.length === 0) continue;
		if (sourceFragment === targetFragment) continue;

		fragments.push({
			source: sourceFragment,
			target: targetFragment,
		});
	}

	return fragments;
}

function parseTemplateText(value: string): { readonly segments: string[]; readonly slots: string[] } {
	const segments: string[] = [];
	const slots: string[] = [];
	let lastIndex = 0;

	for (const match of value.matchAll(/\$\{([^}]+)\}/g)) {
		const placeholder = match[0];
		const slotName = match[1];
		const index = match.index ?? 0;

		segments.push(value.slice(lastIndex, index));
		slots.push(slotName);
		lastIndex = index + placeholder.length;
	}

	segments.push(value.slice(lastIndex));
	return {
		segments: segments,
		slots: slots,
	};
}

function collectExactTranslations(messages: readonly WebviewLocalizedMessage[]): ReadonlyMap<string, string> {
	const translations = new Map<string, string>();
	const collisions = new Set<string>();

	for (const message of messages) {
		const source = normalizeWebviewLocalizationText(message.source);
		if (source.length === 0) continue;
		if (getTemplateSlots(message.source).length !== 0) continue;

		const target = message.pattern.text;
		if (target === message.source) continue;
		if (collisions.has(source)) continue;

		const existing = translations.get(source);
		if (existing == null) {
			translations.set(source, target);
			continue;
		}

		if (existing !== target) {
			translations.delete(source);
			collisions.add(source);
		}
	}

	return translations;
}

function addRuntimeTranslation(
	translations: Map<string, string>,
	source: string,
	target: string,
	collisions: Set<string>,
): void {
	const normalizedSource = normalizeWebviewLocalizationText(source);
	if (normalizedSource.length === 0) return;
	if (collisions.has(normalizedSource)) return;

	const existing = translations.get(normalizedSource);
	if (existing == null) {
		translations.set(normalizedSource, target);
		return;
	}

	if (existing !== target) {
		translations.delete(normalizedSource);
		collisions.add(normalizedSource);
	}
}

function collectRuntimeExactDerivedTranslations(
	message: WebviewLocalizedMessage,
	exactTranslations: ReadonlyMap<string, string>,
): ReadonlyArray<{ readonly source: string; readonly target: string }> {
	const policy = runtimeExactDerivedTemplatePolicies.find(candidate => candidate.source === message.source);
	if (policy == null) return [];

	return policy
		.expand(message, exactTranslations)
		.map(translation => ({
			source: normalizeWebviewLocalizationText(translation.source),
			target: translation.target,
		}))
		.filter(translation => translation.source.length !== 0 && translation.target !== translation.source);
}

function isRuntimeExactDerivedTemplateSource(source: string): boolean {
	return runtimeExactDerivedTemplatePolicies.some(policy => policy.source === source);
}
