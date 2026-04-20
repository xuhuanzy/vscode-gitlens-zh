import { createRequire } from 'module';
import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';
import {
	collectAcceptedEqualValues as collectAcceptedEqualValuesCore,
	diffStringCatalog,
	findPendingTranslations,
	hasCatalogChanges,
	readStringCatalog,
	syncLocaleCatalog,
	type PendingTranslation,
	type StringCatalogDiff,
} from '../shared/catalog.mts';
import { writeStableFile, writeStableJsonFile } from '../shared/files.mts';

export type WebviewNlsJson = Record<string, string>;
export type WebviewNlsDiff = StringCatalogDiff;
export type WebviewNlsPendingTranslation = PendingTranslation;

export type WebviewLocalizationMetadata = {
	sourceIdentity: string;
	templateIdentity: string;
	webviewFileName: string;
	version: 1;
};

type LocalizableAttributeName = 'aria-label' | 'placeholder' | 'title';

type HtmlReplacement = {
	endOffset: number;
	replacement: string;
	startOffset: number;
};

type PendingHtmlReplacement = {
	baseKey: string;
	catalogValue: string;
	collisionIdentity: string;
	endOffset: number;
	renderReplacement: (key: string) => string;
	startOffset: number;
};

type ResolvedHtmlReplacement = HtmlReplacement & {
	catalogKey: string;
	catalogValue: string;
};

type GeneratedWebviewLocalizationArtifacts = {
	englishCatalog: WebviewNlsJson;
	metadata: WebviewLocalizationMetadata;
	templateHtml: string;
	webviewFileName: string;
};

type ManagedWebviewDefinition = {
	distFileName: string;
	keyPrefix: string;
	runtimeMetadataFileName: string;
	runtimeTemplateFileName: string;
};

type GenerateManagedWebviewLocalizationOptions = {
	rootDir?: string;
	writeEnglishCatalog?: boolean;
};

type GenerateManagedWebviewLocalizationResult = {
	changedFiles: string[];
	englishCatalog: WebviewNlsJson;
	generated: GeneratedWebviewLocalizationArtifacts[];
	runtimeCatalog: WebviewNlsJson;
};

type Parse5Attribute = {
	name: string;
	value: string;
};

type Parse5AttributeLocation = {
	endOffset: number;
	startOffset: number;
};

type Parse5NodeLocation = {
	attrs?: Record<string, Parse5AttributeLocation | undefined>;
	endOffset?: number;
	endTag?: {
		endOffset?: number;
		startOffset?: number;
	};
	startOffset?: number;
	startTag?: {
		endOffset?: number;
		startOffset?: number;
	};
};

type Parse5Node = {
	attrs?: Parse5Attribute[];
	childNodes?: Parse5Node[];
	content?: Parse5Node;
	nodeName?: string;
	parentNode?: Parse5Node;
	sourceCodeLocation?: Parse5NodeLocation;
	tagName?: string;
	value?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export const rootDir = path.resolve(__dirname, '..', '..');
export const distWebviewsDir = path.join(rootDir, 'dist', 'webviews');
export const webviewCatalogDir = path.join(rootDir, 'src', 'i18n', 'webviews');
export const webviewNlsPath = path.join(webviewCatalogDir, 'webviews.nls.json');
export const webviewNlsZhCnPath = path.join(webviewCatalogDir, 'webviews.nls.zh-cn.json');

const managedWebviews: ManagedWebviewDefinition[] = [
	{
		distFileName: 'settings.html',
		keyPrefix: 'settings.',
		runtimeMetadataFileName: 'settings.i18n.json',
		runtimeTemplateFileName: 'settings.i18n.html',
	},
];

const runtimeCatalogPrefix = 'runtime.';
const managedWebviewNlsPrefixes = [...managedWebviews.map(webview => webview.keyPrefix), runtimeCatalogPrefix];
const localizableAttributeNames = new Set<LocalizableAttributeName>(['aria-label', 'placeholder', 'title']);
const runtimeHtmlAttributeNames = new Set([
	...localizableAttributeNames,
	'content',
	'emptytext',
	'filter-placeholder',
	'label',
	'tooltip',
]);
const runtimeObjectPropertyNames = new Set(['ariaLabel', 'emptyText', 'label', 'placeholder', 'title', 'tooltip']);
const runtimeSourceExtensions = new Set(['.ts', '.tsx']);
const parse5 = loadParse5();

export function readWebviewNls(filePath: string): WebviewNlsJson {
	return readStringCatalog<WebviewNlsJson>(filePath);
}

export function getManagedWebviewLocalizationDefinition(fileName: string): ManagedWebviewDefinition | undefined {
	return managedWebviews.find(webview => webview.distFileName === fileName);
}

export function mergeWebviewNls(
	existingWebviewNls: WebviewNlsJson,
	generatedWebviewNls: WebviewNlsJson,
): WebviewNlsJson {
	const preservedEntries = Object.entries(existingWebviewNls).filter(
		([key]) => !managedWebviewNlsPrefixes.some(prefix => key.startsWith(prefix)),
	);

	return Object.fromEntries(
		[...preservedEntries, ...Object.entries(generatedWebviewNls)].sort(([a], [b]) => a.localeCompare(b)),
	);
}

export function syncWebviewNlsZhCn(
	webviewNls: WebviewNlsJson,
	existingZhCn: WebviewNlsJson,
): { diff: WebviewNlsDiff; catalog: WebviewNlsJson } {
	return syncLocaleCatalog(webviewNls, existingZhCn);
}

export function hasWebviewNlsChanges(diff: Pick<WebviewNlsDiff, 'added' | 'removed' | 'updated'>): boolean {
	return hasCatalogChanges(diff);
}

export function diffWebviewNlsCatalog(previous: WebviewNlsJson, next: WebviewNlsJson): WebviewNlsDiff {
	return diffStringCatalog(previous, next);
}

export function findPendingWebviewNlsZhCnTranslations(
	baseWebviewNls: WebviewNlsJson,
	currentWebviewNls: WebviewNlsJson,
	currentZhCn: WebviewNlsJson,
	options?: { acceptedEqualValues?: Iterable<string> },
): WebviewNlsPendingTranslation[] {
	return findPendingTranslations(baseWebviewNls, currentWebviewNls, currentZhCn, options);
}

export function collectAcceptedEqualValues(webviewNls: WebviewNlsJson, webviewNlsZhCn: WebviewNlsJson): Set<string> {
	return collectAcceptedEqualValuesCore(webviewNls, webviewNlsZhCn);
}

export function generateManagedWebviewLocalizationArtifacts(
	options?: GenerateManagedWebviewLocalizationOptions,
): GenerateManagedWebviewLocalizationResult {
	const resolvedRootDir = options?.rootDir != null ? path.resolve(options.rootDir) : rootDir;
	const resolvedDistDir = path.join(resolvedRootDir, 'dist', 'webviews');
	const changedFiles: string[] = [];
	const generated: GeneratedWebviewLocalizationArtifacts[] = [];
	const generatedCatalog: WebviewNlsJson = Object.create(null);

	for (const definition of managedWebviews) {
		const sourcePath = path.join(resolvedDistDir, definition.distFileName);
		if (!existsSync(sourcePath)) continue;

		const html = readFileSync(sourcePath, 'utf8');
		const artifacts = generateWebviewLocalizationArtifactsFromHtml(definition, html);
		generated.push(artifacts);

		for (const [key, value] of Object.entries(artifacts.englishCatalog)) {
			generatedCatalog[key] = value;
		}

		const templatePath = path.join(resolvedDistDir, definition.runtimeTemplateFileName);
		const metadataPath = path.join(resolvedDistDir, definition.runtimeMetadataFileName);
		if (writeStableFile(templatePath, `${artifacts.templateHtml}\n`)) {
			changedFiles.push(templatePath);
		}
		if (writeStableJsonFile(metadataPath, artifacts.metadata)) {
			changedFiles.push(metadataPath);
		}
	}

	const runtimeCatalog = generateRuntimeWebviewLocalizationCatalog(resolvedRootDir);
	for (const [key, value] of Object.entries(runtimeCatalog)) {
		generatedCatalog[key] = value;
	}

	const existingCatalog = readWebviewNls(resolveCatalogPath(resolvedRootDir, path.basename(webviewNlsPath)));
	const nextCatalog =
		generated.length > 0 || Object.keys(runtimeCatalog).length > 0
			? mergeWebviewNls(existingCatalog, generatedCatalog)
			: existingCatalog;
	if (options?.writeEnglishCatalog !== false && (generated.length > 0 || Object.keys(runtimeCatalog).length > 0)) {
		const outputPath = resolveCatalogPath(resolvedRootDir, path.basename(webviewNlsPath));
		if (writeStableJsonFile(outputPath, nextCatalog)) {
			changedFiles.push(outputPath);
		}
	}
	return {
		changedFiles: changedFiles,
		englishCatalog: nextCatalog,
		generated: generated,
		runtimeCatalog: runtimeCatalog,
	};
}

export function generateWebviewLocalizationArtifactsFromHtml(
	definition: ManagedWebviewDefinition,
	html: string,
): GeneratedWebviewLocalizationArtifacts {
	const document = parse5.parse(html, { sourceCodeLocationInfo: true }) as Parse5Node;
	const pendingReplacements: PendingHtmlReplacement[] = [];
	const englishCatalog: WebviewNlsJson = Object.create(null);

	const visit = (node: Parse5Node): void => {
		if (node.nodeName === '#text') {
			addTextNodeReplacement(node, definition, pendingReplacements);
			return;
		}

		if (node.tagName != null) {
			addOptionElementReplacement(node, definition, pendingReplacements);
			addAttributeReplacements(node, html, definition, pendingReplacements);
		}

		if (node.content?.childNodes != null) {
			for (const child of node.content.childNodes) {
				visit(child);
			}
		}

		if (node.childNodes != null) {
			for (const child of node.childNodes) {
				visit(child);
			}
		}
	};

	visit(document);

	const replacements = resolveHtmlReplacements(pendingReplacements);
	for (const replacement of replacements) {
		setCatalogEntry(englishCatalog, replacement.catalogKey, replacement.catalogValue);
	}

	const templateHtml = applyHtmlReplacements(html, replacements);
	const sourceIdentity = `md5:${md5Hex(html)}`;
	const templateIdentity = `md5:${md5Hex(templateHtml)}`;

	return {
		englishCatalog: Object.fromEntries(Object.entries(englishCatalog).sort(([a], [b]) => a.localeCompare(b))),
		metadata: {
			sourceIdentity: sourceIdentity,
			templateIdentity: templateIdentity,
			version: 1,
			webviewFileName: definition.distFileName,
		},
		templateHtml: templateHtml,
		webviewFileName: definition.distFileName,
	};
}

export function generateRuntimeWebviewLocalizationCatalog(resolvedRootDir: string = rootDir): WebviewNlsJson {
	const sourceRoot = path.join(resolvedRootDir, 'src', 'webviews', 'apps');
	const catalog: WebviewNlsJson = Object.create(null);
	if (!existsSync(sourceRoot)) return catalog;

	for (const filePath of walkRuntimeSourceFiles(sourceRoot)) {
		const source = readFileSync(filePath, 'utf8');
		const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
		const relativePath = path.relative(sourceRoot, filePath).replace(/\\/g, '/');

		collectRuntimeStringsFromSourceFile(sourceFile, relativePath, catalog);
	}

	return Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)));
}

function collectRuntimeStringsFromSourceFile(
	sourceFile: ts.SourceFile,
	relativePath: string,
	catalog: WebviewNlsJson,
): void {
	const visit = (node: ts.Node): void => {
		if (ts.isTaggedTemplateExpression(node) && isLitHtmlTag(node.tag)) {
			collectRuntimeStringsFromHtmlTemplate(node.template, sourceFile, relativePath, catalog);
		} else if (ts.isJsxText(node)) {
			addRuntimeCatalogEntryFromNode(
				node.getText(sourceFile),
				sourceFile,
				relativePath,
				node,
				catalog,
				'jsx-text',
			);
		} else if (ts.isJsxAttribute(node) && isRuntimeLocalizableJsxAttribute(node.name.text)) {
			const initializer = node.initializer;
			if (initializer != null && ts.isStringLiteral(initializer)) {
				addRuntimeCatalogEntryFromNode(
					initializer.text,
					sourceFile,
					relativePath,
					initializer,
					catalog,
					`jsx-attr-${sanitizeSegment(String(node.name.text))}`,
				);
			}
		} else if (ts.isPropertyAssignment(node) && isRuntimeLocalizablePropertyName(node.name)) {
			if (ts.isStringLiteralLike(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) {
				addRuntimeCatalogEntryFromNode(
					node.initializer.text,
					sourceFile,
					relativePath,
					node.initializer,
					catalog,
					`property-${sanitizeSegment(getPropertyNameText(node.name))}`,
				);
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
}

function collectRuntimeStringsFromHtmlTemplate(
	template: ts.TemplateLiteral,
	sourceFile: ts.SourceFile,
	relativePath: string,
	catalog: WebviewNlsJson,
): void {
	let html = '';
	let expressionIndex = 0;
	if (ts.isNoSubstitutionTemplateLiteral(template)) {
		html = template.text;
	} else {
		html += template.head.text;
		for (const span of template.templateSpans) {
			if (ts.isStringLiteralLike(span.expression) || ts.isNoSubstitutionTemplateLiteral(span.expression)) {
				addRuntimeCatalogEntryFromNode(
					span.expression.text,
					sourceFile,
					relativePath,
					span.expression,
					catalog,
					`lit-expr-string-${expressionIndex}`,
				);
			}

			html += `__GL_EXPR_${expressionIndex++}__`;
			html += span.literal.text;
		}
	}

	const fragment = parse5.parseFragment(html, { sourceCodeLocationInfo: false }) as Parse5Node;
	let textIndex = 0;
	let attributeIndex = 0;
	const visit = (node: Parse5Node, parentTagName?: string): void => {
		if (node.nodeName === '#text') {
			const normalizedValue = normalizeLocalizableValue(node.value ?? '');
			if (isRuntimeLocalizableValue(normalizedValue)) {
				addRuntimeCatalogEntryFromNode(
					normalizedValue,
					sourceFile,
					relativePath,
					template,
					catalog,
					`lit-text-${textIndex++}`,
				);
			}
			return;
		}

		if (node.tagName != null) {
			for (const attr of node.attrs ?? []) {
				if (!runtimeHtmlAttributeNames.has(attr.name)) continue;

				const normalizedValue = normalizeLocalizableValue(attr.value);
				if (!isRuntimeLocalizableValue(normalizedValue)) continue;

				addRuntimeCatalogEntryFromNode(
					normalizedValue,
					sourceFile,
					relativePath,
					template,
					catalog,
					`lit-attr-${sanitizeSegment(attr.name)}-${attributeIndex++}`,
				);
			}
		}

		if (node.content?.childNodes != null) {
			for (const child of node.content.childNodes) {
				visit(child, node.tagName ?? parentTagName);
			}
		}

		if (node.childNodes != null && (node.tagName == null || !shouldSkipElement(node.tagName))) {
			for (const child of node.childNodes) {
				visit(child, node.tagName ?? parentTagName);
			}
		}
	};

	visit(fragment);
}

function addRuntimeCatalogEntryFromNode(
	value: string,
	sourceFile: ts.SourceFile,
	relativePath: string,
	node: ts.Node,
	catalog: WebviewNlsJson,
	field: string,
): void {
	const normalizedValue = normalizeLocalizableValue(value);
	if (!isRuntimeLocalizableValue(normalizedValue)) return;

	const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
	const sourceIdentity = `${relativePath}:${line + 1}:${character + 1}:${field}`;
	const key = `${runtimeCatalogPrefix}${sanitizeSegment(relativePath.replace(/\.[tj]sx?$/, ''))}.${sanitizeSegment(
		field,
	)}.${getStableHash(`${sourceIdentity}|${normalizedValue}`)}`;
	setCatalogEntry(catalog, key, normalizedValue);
}

function isRuntimeLocalizableValue(value: string): boolean {
	if (value.length === 0) return false;
	if (!/[A-Za-z]/.test(value)) return false;
	if (value.includes('<') || value.includes('>')) return false;
	if (value.includes('__GL_EXPR_')) return false;
	if (/^[a-z][a-z0-9._:-]*$/i.test(value) && value.includes('.')) return false;
	if (/^(command|http|https|mailto|data|vscode):/i.test(value)) return false;
	if (/^(#[{A-Za-z0-9_-]+|\$[{(])/.test(value)) return false;
	if (/^[A-Z0-9_]+$/.test(value)) return false;
	if (/^[a-z0-9-]+$/.test(value) && !value.includes(' ')) return false;

	return true;
}

function isLitHtmlTag(tag: ts.LeftHandSideExpression): boolean {
	return ts.isIdentifier(tag) && tag.text === 'html';
}

function isRuntimeLocalizableJsxAttribute(name: string | ts.__String): boolean {
	return localizableAttributeNames.has(String(name) as LocalizableAttributeName);
}

function isRuntimeLocalizablePropertyName(name: ts.PropertyName): boolean {
	const text = getPropertyNameText(name);
	if (text == null) return false;
	return runtimeObjectPropertyNames.has(text);
}

function getPropertyNameText(name: ts.PropertyName): string | undefined {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
	return undefined;
}

function walkRuntimeSourceFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'out') continue;

		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkRuntimeSourceFiles(fullPath));
			continue;
		}

		if (!entry.isFile()) continue;
		if (entry.name.endsWith('.d.ts')) continue;
		if (entry.name.endsWith('.compiled.ts')) continue;
		if (!runtimeSourceExtensions.has(path.extname(entry.name))) continue;

		files.push(fullPath);
	}

	return files.sort((a, b) => a.localeCompare(b));
}

function getScriptKind(filePath: string): ts.ScriptKind {
	return filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function addTextNodeReplacement(
	node: Parse5Node,
	definition: ManagedWebviewDefinition,
	replacements: PendingHtmlReplacement[],
): void {
	const value = node.value;
	const location = node.sourceCodeLocation;
	if (value == null || location?.startOffset == null || location.endOffset == null) return;

	const parent = node.parentNode;
	if (parent?.tagName != null && shouldSkipElement(parent.tagName)) return;
	if (parent?.tagName === 'option') return;

	const match = /^(\s*)([\s\S]*?\S)(\s*)$/.exec(value);
	if (match == null) return;

	const [, leadingWhitespace, trimmedValue, trailingWhitespace] = match;
	const normalizedValue = normalizeLocalizableValue(trimmedValue);
	if (normalizedValue.length === 0) return;
	if (normalizedValue.startsWith('#{') && normalizedValue.endsWith('}')) return;

	const key = getFragmentKey(definition, parent, 'text', normalizedValue, node);
	replacements.push({
		baseKey: key,
		catalogValue: normalizedValue,
		collisionIdentity: getCollisionIdentity(parent, node),
		endOffset: location.endOffset,
		renderReplacement: resolvedKey => `${leadingWhitespace}${getPlaceholder(resolvedKey)}${trailingWhitespace}`,
		startOffset: location.startOffset,
	});
}

function addOptionElementReplacement(
	node: Parse5Node,
	definition: ManagedWebviewDefinition,
	replacements: PendingHtmlReplacement[],
): void {
	if (node.tagName !== 'option') return;

	const location = node.sourceCodeLocation;
	const startOffset = location?.startTag?.endOffset;
	const endOffset = location?.endTag?.startOffset;
	if (startOffset == null || endOffset == null || endOffset <= startOffset) return;

	const normalizedValue = normalizeLocalizableValue(getNodeTextContent(node));
	if (normalizedValue.length === 0) return;

	const key = getFragmentKey(definition, node, 'text', normalizedValue, node);
	replacements.push({
		baseKey: key,
		catalogValue: normalizedValue,
		collisionIdentity: getCollisionIdentity(node, node),
		endOffset: endOffset,
		renderReplacement: resolvedKey => getPlaceholder(resolvedKey),
		startOffset: startOffset,
	});
}

function addAttributeReplacements(
	node: Parse5Node,
	html: string,
	definition: ManagedWebviewDefinition,
	replacements: PendingHtmlReplacement[],
): void {
	const attrs = node.attrs;
	const attrLocations = node.sourceCodeLocation?.attrs;
	if (attrs == null || attrLocations == null) return;

	for (const attr of attrs) {
		if (!localizableAttributeNames.has(attr.name as LocalizableAttributeName)) continue;
		const normalizedValue = normalizeLocalizableValue(attr.value);
		if (normalizedValue.length === 0 || normalizedValue.includes('#{')) continue;

		const location = attrLocations[attr.name];
		if (location?.startOffset == null || location.endOffset == null) continue;

		const rawAttribute = readAttributeSlice(html, node, attr.name);
		if (rawAttribute == null) continue;

		const key = getFragmentKey(definition, node, `attr-${attr.name}`, normalizedValue, node);
		replacements.push({
			baseKey: key,
			catalogValue: normalizedValue,
			collisionIdentity: getCollisionIdentity(node, node),
			endOffset: location.endOffset,
			renderReplacement: resolvedKey => replaceAttributeValue(rawAttribute, getPlaceholder(resolvedKey)),
			startOffset: location.startOffset,
		});
	}
}

function readAttributeSlice(html: string, node: Parse5Node, attrName: string): string | undefined {
	const attrLocation = node.sourceCodeLocation?.attrs?.[attrName];
	if (attrLocation?.startOffset == null || attrLocation.endOffset == null) return undefined;

	return html.slice(attrLocation.startOffset, attrLocation.endOffset);
}

function applyHtmlReplacements(html: string, replacements: HtmlReplacement[]): string {
	const ordered = [...replacements].sort((a, b) => b.startOffset - a.startOffset);
	let updated = html;
	for (const replacement of ordered) {
		updated =
			updated.slice(0, replacement.startOffset) + replacement.replacement + updated.slice(replacement.endOffset);
	}
	return updated;
}

function resolveHtmlReplacements(replacements: PendingHtmlReplacement[]): ResolvedHtmlReplacement[] {
	const grouped = new Map<string, PendingHtmlReplacement[]>();
	for (const replacement of replacements) {
		const group = grouped.get(replacement.baseKey);
		if (group == null) {
			grouped.set(replacement.baseKey, [replacement]);
		} else {
			group.push(replacement);
		}
	}

	const resolved: ResolvedHtmlReplacement[] = [];
	for (const group of grouped.values()) {
		const groupedByValue = new Map<string, PendingHtmlReplacement[]>();
		for (const replacement of [...group].sort((a, b) => a.startOffset - b.startOffset)) {
			const valueGroup = groupedByValue.get(replacement.catalogValue);
			if (valueGroup == null) {
				groupedByValue.set(replacement.catalogValue, [replacement]);
			} else {
				valueGroup.push(replacement);
			}
		}

		if (groupedByValue.size === 1) {
			const [replacement] = group;
			for (const item of group) {
				resolved.push(resolveHtmlReplacement(item, replacement.baseKey));
			}
			continue;
		}

		const usedKeys = new Set<string>();
		for (const valueGroup of groupedByValue.values()) {
			const key = getCollisionKey(valueGroup[0].baseKey, valueGroup[0].collisionIdentity, usedKeys);
			for (const item of valueGroup) {
				resolved.push(resolveHtmlReplacement(item, key));
			}
		}
	}

	return resolved;
}

function resolveHtmlReplacement(replacement: PendingHtmlReplacement, key: string): ResolvedHtmlReplacement {
	return {
		catalogKey: key,
		catalogValue: replacement.catalogValue,
		endOffset: replacement.endOffset,
		replacement: replacement.renderReplacement(key),
		startOffset: replacement.startOffset,
	};
}

function getCollisionKey(baseKey: string, collisionIdentity: string, usedKeys: Set<string>): string {
	let candidate = `${baseKey}.${collisionIdentity}`;
	let counter = 2;
	while (usedKeys.has(candidate)) {
		candidate = `${baseKey}.${collisionIdentity}-${counter++}`;
	}

	usedKeys.add(candidate);
	return candidate;
}

function replaceAttributeValue(rawAttribute: string, replacementValue: string): string {
	const match = /^([^=]+=\s*["'])([\s\S]*)(["'])$/.exec(rawAttribute);
	if (match == null) {
		throw new Error(`无法替换属性值：${rawAttribute}`);
	}

	return `${match[1]}${replacementValue}${match[3]}`;
}

function getFragmentKey(
	definition: ManagedWebviewDefinition,
	ownerElement: Parse5Node | undefined,
	field: string,
	sourceValue: string,
	node: Parse5Node,
): string {
	const sectionToken = getSectionToken(ownerElement);
	const ownerToken = getOwnerToken(ownerElement, node, sourceValue);
	const fieldToken = sanitizeSegment(field);

	return `${definition.keyPrefix}${sectionToken}.${ownerToken}.${fieldToken}`;
}

function getSectionToken(node: Parse5Node | undefined): string {
	const section = findNearestElement(node, element => {
		if (element.tagName === 'section' && getAttributeValue(element, 'id') != null) return true;
		if (element.tagName === 'template' && getAttributeValue(element, 'id') != null) return true;
		return false;
	});

	if (section != null) {
		return sanitizeSegment(getAttributeValue(section, 'id')!);
	}

	return 'root';
}

function getOwnerToken(ownerElement: Parse5Node | undefined, node: Parse5Node, sourceValue: string): string {
	if (ownerElement != null) {
		const stableIdentity = getStableElementIdentity(ownerElement);
		if (stableIdentity != null) {
			return stableIdentity;
		}
	}

	const pathIdentity = getNodePath(ownerElement ?? node);
	const fallback = microhash(`${pathIdentity}|${sourceValue}`, 8) ?? '@unknown';
	const tagName = sanitizeSegment(ownerElement?.tagName ?? node.nodeName ?? 'fragment');
	return `${tagName}.fallback${fallback.replace('@', '-')}`;
}

function getStableElementIdentity(node: Parse5Node): string | undefined {
	const tagName = sanitizeSegment(node.tagName ?? 'fragment');
	const id = getAttributeValue(node, 'id');
	if (id != null) return `${tagName}.id.${sanitizeSegment(id)}`;

	const labelFor = getAttributeValue(node, 'for');
	if (labelFor != null) return `${tagName}.for.${sanitizeSegment(labelFor)}`;

	const dataAction = getAttributeValue(node, 'data-action');
	if (dataAction != null) return `${tagName}.action.${sanitizeSegment(dataAction)}`;

	const name = getAttributeValue(node, 'name');
	if (name != null) return `${tagName}.name.${sanitizeSegment(name)}`;

	if (node.tagName === 'option') {
		const value = getAttributeValue(node, 'value');
		if (value != null) return `${tagName}.value.${sanitizeSegment(value)}`;
	}

	const href = getAttributeValue(node, 'href');
	if (href != null) {
		if (href.startsWith('command:')) {
			return `${tagName}.command.${sanitizeSegment(href.slice('command:'.length))}`;
		}

		return `${tagName}.href.${sanitizeSegment(microhash(href, 8) ?? 'external')}`;
	}

	return undefined;
}

function getNodePath(node: Parse5Node): string {
	const segments: string[] = [];
	let current: Parse5Node | undefined = node;
	while (current != null) {
		if (current.tagName != null) {
			segments.push(`${current.tagName}:${getElementIndex(current)}`);
		}

		current = current.parentNode;
	}

	return segments.reverse().join('/');
}

function getElementIndex(node: Parse5Node): number {
	const parent = node.parentNode;
	const tagName = node.tagName;
	if (parent?.childNodes == null || tagName == null) return 0;

	let index = 0;
	for (const child of parent.childNodes) {
		if (child === node) {
			return index;
		}

		if (child.tagName === tagName) {
			index++;
		}
	}

	return index;
}

function findNearestElement(
	node: Parse5Node | undefined,
	predicate: (node: Parse5Node) => boolean,
): Parse5Node | undefined {
	let current = node;
	while (current != null) {
		if (current.tagName != null && predicate(current)) {
			return current;
		}

		current = current.parentNode;
	}

	return undefined;
}

function getNodeTextContent(node: Parse5Node): string {
	if (node.nodeName === '#text') {
		return node.value ?? '';
	}

	let value = '';
	if (node.childNodes != null) {
		for (const child of node.childNodes) {
			value += getNodeTextContent(child);
		}
	}

	if (node.content?.childNodes != null) {
		for (const child of node.content.childNodes) {
			value += getNodeTextContent(child);
		}
	}

	return value;
}

function getAttributeValue(node: Parse5Node, attrName: string): string | undefined {
	return node.attrs?.find(attr => attr.name === attrName)?.value;
}

function shouldSkipElement(tagName: string): boolean {
	return tagName === 'script' || tagName === 'style';
}

function getPlaceholder(key: string): string {
	return `__GL_I18N__${key}__`;
}

function getCollisionIdentity(ownerElement: Parse5Node | undefined, node: Parse5Node): string {
	return `variant-${getStableHash(getNodePath(ownerElement ?? node))}`;
}

function sanitizeSegment(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
}

function normalizeLocalizableValue(value: string): string {
	return value.replace(/[ \t\r\n\f]+/g, ' ').trim();
}

function setCatalogEntry(catalog: WebviewNlsJson, key: string, value: string): void {
	const existing = catalog[key];
	if (existing == null) {
		catalog[key] = value;
		return;
	}

	if (existing !== value) {
		throw new Error(`检测到冲突的 webview 本地化 key：${key}`);
	}
}

function resolveCatalogPath(resolvedRootDir: string, fileName: string): string {
	return path.join(resolvedRootDir, 'src', 'i18n', 'webviews', fileName);
}

function loadParse5(): {
	parse: (html: string, options: { sourceCodeLocationInfo: boolean }) => Parse5Node;
	parseFragment: (html: string, options: { sourceCodeLocationInfo: boolean }) => Parse5Node;
} {
	try {
		return require('parse5') as {
			parse: (html: string, options: { sourceCodeLocationInfo: boolean }) => Parse5Node;
			parseFragment: (html: string, options: { sourceCodeLocationInfo: boolean }) => Parse5Node;
		};
	} catch {
		for (const candidate of getParse5FallbackCandidates()) {
			if (!existsSync(candidate)) continue;

			try {
				return require(candidate) as {
					parse: (html: string, options: { sourceCodeLocationInfo: boolean }) => Parse5Node;
					parseFragment: (html: string, options: { sourceCodeLocationInfo: boolean }) => Parse5Node;
				};
			} catch {}
		}

		throw new Error('无法解析 parse5 模块；请确认依赖已安装。');
	}
}

function getParse5FallbackCandidates(): string[] {
	const candidates = [
		path.join(rootDir, 'node_modules', 'parse5'),
		path.join(rootDir, 'node_modules', '.pnpm', 'node_modules', 'parse5'),
	];
	const pnpmDir = path.join(rootDir, 'node_modules', '.pnpm');
	if (existsSync(pnpmDir)) {
		for (const entry of readdirSync(pnpmDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			if (!entry.name.startsWith('parse5@') && !entry.name.startsWith('cheerio@')) continue;

			candidates.push(path.join(pnpmDir, entry.name, 'node_modules', 'parse5'));
		}
	}

	return [...new Set(candidates)];
}

function fnv1aHash(value: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash;
}

function microhash(value: undefined, length: number): undefined;
function microhash(value: string, length?: number): string;
function microhash(value: string | undefined, length?: number): string | undefined;
function microhash(value: string | undefined, length: number = 4): string | undefined {
	return !value ? undefined : `@${(fnv1aHash(value) >>> 0).toString(16).padStart(8, '0').substring(0, length)}`;
}

function md5Hex(value: string): string {
	return createHash('md5').update(value).digest('hex');
}

function getStableHash(value: string): string {
	return (microhash(value, 8) ?? '@unknown').replace(/^@/, 'unknown-');
}
