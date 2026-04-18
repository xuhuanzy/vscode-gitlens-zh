export function buildRuntimeTranslationMap(
	englishCatalog: Record<string, string>,
	localizedCatalog: Record<string, string>,
): Record<string, string> {
	const resolved = new Map<string, string>();
	const collisions = new Set<string>();

	for (const [key, english] of Object.entries(englishCatalog)) {
		const localized = localizedCatalog[key];
		if (localized == null || localized === english) continue;

		const normalizedEnglish = normalizeWebviewLocalizationText(english);
		if (normalizedEnglish.length === 0) continue;

		const existing = resolved.get(normalizedEnglish);
		if (existing == null) {
			resolved.set(normalizedEnglish, localized);
			continue;
		}

		if (existing !== localized) {
			resolved.delete(normalizedEnglish);
			collisions.add(normalizedEnglish);
		}
	}

	for (const collision of collisions) {
		resolved.delete(collision);
	}

	return Object.fromEntries([...resolved.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function normalizeWebviewLocalizationText(value: string): string {
	return value.replace(/[ \t\r\n\f]+/g, ' ').trim();
}

export function translatePreservingWhitespace(
	value: string,
	translations: ReadonlyMap<string, string>,
): string | undefined {
	const match = /^(\s*)([\s\S]*?\S)(\s*)$/.exec(value);
	if (match == null) return undefined;

	const [, leadingWhitespace, content, trailingWhitespace] = match;
	const translated = translations.get(normalizeWebviewLocalizationText(content));
	if (translated == null) return undefined;

	return `${leadingWhitespace}${translated}${trailingWhitespace}`;
}
