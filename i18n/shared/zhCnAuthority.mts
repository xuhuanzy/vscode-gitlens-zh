import * as path from 'path';
import { fileURLToPath } from 'url';
import { readJsonFileIfExists } from './files.mts';

export type ZhCnAuthorityDictionary = Record<string, string>;

type ZhCnAuthorityViews = {
	glossaryOverrides: ReadonlyMap<string, string>;
	identityMappings: ReadonlySet<string>;
	protectedTerms: ReadonlySet<string>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const authorityRootDir = path.resolve(__dirname, '..', 'authority', 'zh-cn');
export const sharedZhCnAuthorityPath = path.join(authorityRootDir, 'shared', 'dictionary.json');

const sharedZhCnAuthorityDictionary = loadAuthorityDictionary(sharedZhCnAuthorityPath);
const sharedZhCnAuthorityViews = createZhCnAuthorityViews(sharedZhCnAuthorityDictionary);

export const sharedZhCnGlossaryOverrides = sharedZhCnAuthorityViews.glossaryOverrides;
export const sharedZhCnPassthroughValues = sharedZhCnAuthorityViews.identityMappings;
export const sharedZhCnProtectedTerms = sharedZhCnAuthorityViews.protectedTerms;

export function readZhCnAuthorityDictionary(filePath: string): ZhCnAuthorityDictionary {
	return loadAuthorityDictionary(filePath);
}

function loadAuthorityDictionary(filePath: string): ZhCnAuthorityDictionary {
	return readJsonFileIfExists<ZhCnAuthorityDictionary>(
		filePath,
		() => Object.create(null) as ZhCnAuthorityDictionary,
	);
}

function createZhCnAuthorityViews(dictionary: ZhCnAuthorityDictionary): ZhCnAuthorityViews {
	const glossaryOverrides = new Map<string, string>();
	const identityMappings = new Set<string>();

	for (const [source, localized] of Object.entries(dictionary)) {
		if (source === localized) {
			identityMappings.add(source);
			continue;
		}

		glossaryOverrides.set(source, localized);
	}

	return {
		glossaryOverrides: glossaryOverrides,
		identityMappings: identityMappings,
		protectedTerms: new Set(identityMappings),
	};
}
