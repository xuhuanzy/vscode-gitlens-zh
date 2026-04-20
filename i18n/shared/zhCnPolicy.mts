import { collectAcceptedEqualValues, type StringCatalog } from './catalog.mts';

export const sharedZhCnPassthroughValues = new Set([
	'Git CodeLens',
	'Git Supercharged',
	'GitHub',
	'GitKraken',
	'GitKraken AI',
	'GitKraken AI:',
	'GitKraken DevEx platform',
	'GitKraken MCP',
	"GitKraken's DevEx platform",
	'GitLens',
	'GitLens Community',
	'GitLens Pro',
	'Jira',
	'Launchpad',
	'Live Share',
	'Visual Studio Live Share',
]);

export const sharedZhCnGlossaryOverrides = new Map<string, string>();

export function collectAcceptedZhCnEqualValues<T extends StringCatalog>(options: {
	baseCatalog: T;
	baseZhCnCatalog: T;
	currentCatalog?: T;
	extraPassthroughValues?: Iterable<string>;
	isImplicitPassthroughValue?: (value: string) => boolean;
}): Set<string> {
	const accepted = collectAcceptedEqualValues(options.baseCatalog, options.baseZhCnCatalog);

	for (const value of sharedZhCnPassthroughValues) {
		accepted.add(value);
	}

	for (const value of options.extraPassthroughValues ?? []) {
		accepted.add(value);
	}

	if (options.currentCatalog != null && options.isImplicitPassthroughValue != null) {
		for (const english of Object.values(options.currentCatalog)) {
			if (options.isImplicitPassthroughValue(english)) {
				accepted.add(english);
			}
		}
	}

	return accepted;
}

export function applyZhCnValueOverrides<T extends StringCatalog>(
	catalog: T,
	englishCatalog: T,
	options?: { extraOverrides?: ReadonlyMap<string, string> },
): T {
	const nextCatalog = { ...catalog } as T;

	for (const [key, english] of Object.entries(englishCatalog)) {
		const override = options?.extraOverrides?.get(english) ?? sharedZhCnGlossaryOverrides.get(english);
		if (override != null) {
			nextCatalog[key] = override;
		}
	}

	return nextCatalog;
}
