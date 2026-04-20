import { collectAcceptedEqualValues, type StringCatalog } from './catalog.mts';
import {
	applyZhCnProofreaderCatalog,
	collectAcceptedZhCnProofreaderEqualValues,
	sharedZhCnGlossaryOverrides,
	sharedZhCnPassthroughValues,
	type ZhCnProofreaderCatalogOptions,
} from './zhCnProofreader.mts';

export { sharedZhCnGlossaryOverrides, sharedZhCnPassthroughValues };

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
	return applyZhCnProofreaderCatalog(catalog, englishCatalog, {
		extraExceptions: options?.extraOverrides,
	});
}

export function applyZhCnProofreader<T extends StringCatalog>(
	catalog: T,
	englishCatalog: T,
	options?: ZhCnProofreaderCatalogOptions,
): T {
	return applyZhCnProofreaderCatalog(catalog, englishCatalog, options);
}

export function collectAcceptedZhCnEqualValuesWithProofreader<T extends StringCatalog>(options: {
	baseCatalog: T;
	baseZhCnCatalog: T;
	currentCatalog?: T;
	extraPassthroughValues?: Iterable<string>;
	extraProtectedTerms?: Iterable<string>;
	isImplicitPassthroughValue?: (value: string) => boolean;
}): Set<string> {
	return collectAcceptedZhCnProofreaderEqualValues(options);
}
