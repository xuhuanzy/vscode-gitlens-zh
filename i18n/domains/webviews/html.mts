import { sanitizeKeySegment } from '../../core/model.mts';

import { containsSyntheticAttributeSlotToken } from './template.mts';

export interface HtmlTextNode {
	readonly kind: 'text';
	readonly start: number;
	readonly end: number;
	readonly raw: string;
	readonly parent: HtmlElementNode;
}

export interface HtmlElementNode {
	readonly kind: 'element';
	readonly tag: string;
	readonly attributes: Record<string, string>;
	readonly start: number;
	readonly openTagEnd: number;
	closeTagStart: number;
	end: number;
	path: string;
	readonly children: HtmlNode[];
	readonly parent?: HtmlElementNode;
}

export type HtmlNode = HtmlTextNode | HtmlElementNode;

export interface HtmlSlotDefinition {
	readonly name: string;
	readonly node: HtmlElementNode;
}

export interface HtmlPreservedNodeDefinition {
	readonly gapIndex: number;
	readonly node: HtmlElementNode;
}

export interface HtmlContentPattern {
	readonly text: string;
	readonly slots: readonly HtmlSlotDefinition[];
	readonly preserves: readonly HtmlPreservedNodeDefinition[];
}

const skippedTags = new Set(['style', 'script', 'template']);
const voidTags = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
]);
const translatableContentTags = new Set([
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'p',
	'li',
	'label',
	'button',
	'option',
	'a',
	'b',
	'em',
	'i',
	'small',
	'strong',
	'gl-button',
	'menu-label',
	'menu-item',
	'gl-checkbox',
	'gl-radio',
]);
const slotOnlyTags = new Set(['a', 'button', 'kbd', 'code', 'select', 'textarea', 'input', 'b', 'strong', 'i', 'em']);
const ignoredPatternTags = new Set(['img', 'svg']);

export function parseHtmlDocument(html: string): HtmlElementNode {
	const root: HtmlElementNode = {
		kind: 'element',
		tag: 'root',
		attributes: {},
		start: 0,
		openTagEnd: 0,
		closeTagStart: html.length,
		end: html.length,
		path: 'root',
		children: [],
	};

	const stack: HtmlElementNode[] = [root];
	let index = 0;

	while (index < html.length) {
		const current = stack[stack.length - 1];
		const char = html[index];
		if (char !== '<') {
			const nextTag = html.indexOf('<', index);
			const end = nextTag === -1 ? html.length : nextTag;
			current.children.push({
				kind: 'text',
				start: index,
				end: end,
				raw: html.slice(index, end),
				parent: current,
			});
			index = end;
			continue;
		}

		if (html.startsWith('<!--', index)) {
			const commentEnd = html.indexOf('-->', index + 4);
			index = commentEnd === -1 ? html.length : commentEnd + 3;
			continue;
		}

		const tagEnd = findTagEnd(html, index + 1);
		if (tagEnd === -1) break;

		const rawTag = html.slice(index, tagEnd + 1);
		const tagInfo = parseTag(rawTag);
		if (tagInfo == null) {
			index = tagEnd + 1;
			continue;
		}

		if (tagInfo.kind === 'open') {
			const node: HtmlElementNode = {
				kind: 'element',
				tag: tagInfo.name,
				attributes: tagInfo.attributes,
				start: index,
				openTagEnd: tagEnd + 1,
				closeTagStart: tagEnd + 1,
				end: tagEnd + 1,
				path: '',
				children: [],
				parent: current,
			};
			current.children.push(node);
			if (!tagInfo.selfClosing && !voidTags.has(tagInfo.name)) {
				stack.push(node);
			}
		} else {
			for (let stackIndex = stack.length - 1; stackIndex > 0; stackIndex--) {
				const candidate = stack[stackIndex];
				if (candidate.tag !== tagInfo.name) continue;
				candidate.closeTagStart = index;
				candidate.end = tagEnd + 1;
				stack.splice(stackIndex);
				break;
			}
		}

		index = tagEnd + 1;
	}

	assignElementPaths(root);
	return root;
}

export function visitHtmlElements(root: HtmlElementNode, visitor: (element: HtmlElementNode) => void): void {
	for (const child of root.children) {
		if (child.kind !== 'element') continue;
		visitHtmlElement(child, visitor);
	}
}

export function shouldExtractElementContent(element: HtmlElementNode): boolean {
	if (shouldSkipWrapperContentExtraction(element)) return false;
	if (element.attributes.slot != null) return shouldExtractSlottedElementContent(element);
	if (translatableContentTags.has(element.tag)) return true;
	if (element.tag === 'div') {
		if (hasTranslatableContentAncestor(element.parent)) return false;
		return hasMeaningfulDirectTextChild(element);
	}
	if (element.tag !== 'span') return false;

	const classList = getClassList(element);
	if (classList.includes('setting__hint') || classList.includes('token-popup__hint')) return true;
	if (hasTranslatableContentAncestor(element.parent)) return false;
	return true;
}

export function shouldExtractRootContent(root: HtmlElementNode): boolean {
	return root.tag === 'root' && hasMeaningfulDirectTextChild(root);
}

export function shouldSkipLocalizationSubtree(element: HtmlElementNode): boolean {
	if (skippedTags.has(element.tag)) return true;
	if (element.attributes['data-setting-preview'] != null) return true;
	if (element.attributes['data-setting-preview-type'] != null) return true;

	const classList = getClassList(element);
	return classList.includes('section__preview');
}

export function collectElementContentPattern(element: HtmlElementNode): HtmlContentPattern | undefined {
	const state = { slotIndex: 0 };
	const segments = collectPatternSegments(element.children, element, state);
	const text = normalizePatternSegments(segments);
	if (!isTranslatablePatternText(text)) return undefined;
	if (/^\$\{[^}]+\}$/u.test(text)) return undefined;

	return {
		text: text,
		slots: segments
			.filter(
				(segment): segment is Extract<(typeof segments)[number], { readonly kind: 'slot' }> =>
					segment.kind === 'slot',
			)
			.map(segment => ({ name: segment.name, node: segment.node })),
		preserves: collectPreservedSegments(segments),
	};
}

export function isTranslatableLiteralText(text: string): boolean {
	if (text.length === 0) return false;
	if (text.includes('#{')) return false;
	if (text.includes('<%=')) return false;
	if (text.includes('${')) return false;
	if (containsSyntheticAttributeSlotToken(text)) return false;
	if (text === '•') return false;
	if (/^\d+(?:\.\d+)?$/u.test(text)) return false;
	return /[\p{L}\p{N}]/u.test(text);
}

export function isTranslatablePatternText(text: string): boolean {
	if (text.length === 0) return false;
	const literalText = text.replace(/\$\{[^}]+\}/gu, '').trim();
	if (literalText.length === 0) return false;
	if (literalText === '•') return false;
	if (/^\d+(?:\.\d+)?$/u.test(literalText)) return false;
	return /[\p{L}\p{N}]/u.test(literalText);
}

export function normalizeWhitespace(text: string): string {
	return decodeHtmlEntities(text.replace(/\s+/g, ' ').trim());
}

export function decodeHtmlEntities(text: string): string {
	return text
		.replaceAll('&nbsp;', '\u00a0')
		.replaceAll('&amp;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>');
}

export function findTagEnd(html: string, start: number): number {
	let quote: '"' | "'" | undefined;
	for (let index = start; index < html.length; index++) {
		const char = html[index];
		if ((char === '"' || char === "'") && html[index - 1] !== '\\') {
			quote = quote === char ? undefined : quote == null ? (char as '"' | "'") : quote;
			continue;
		}
		if (char === '>' && quote == null) return index;
	}
	return -1;
}

export function parseTag(rawTag: string):
	| {
			readonly kind: 'open' | 'close';
			readonly name: string;
			readonly attributes: Record<string, string>;
			readonly selfClosing: boolean;
	  }
	| undefined {
	const match = /^<\s*(\/)?\s*([A-Za-z0-9:_-]+)([\s\S]*?)\s*(\/)?>$/u.exec(rawTag);
	if (match == null) return undefined;

	const [, closing, rawName, attributeSource, selfClosing] = match;
	const name = rawName.toLowerCase();
	if (closing != null) {
		return {
			kind: 'close',
			name: name,
			attributes: {},
			selfClosing: false,
		};
	}

	return {
		kind: 'open',
		name: name,
		attributes: parseAttributes(attributeSource ?? ''),
		selfClosing: selfClosing != null || rawTag.endsWith('/>'),
	};
}

export function findAttributeValueRange(
	rawTag: string,
	attribute: string,
): { readonly start: number; readonly end: number } | undefined {
	const escapedAttribute = escapeRegex(attribute);
	const regex = new RegExp(
		'(?:^|\\s)' + escapedAttribute + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'=<>`]+))',
		'iu',
	);
	const match = regex.exec(rawTag);
	if (match == null) return undefined;

	const value = match[1] ?? match[2] ?? match[3];
	if (value == null) return undefined;

	const offset = match.index + match[0].indexOf(value);
	return {
		start: offset,
		end: offset + value.length,
	};
}

export function getContentRangeKey(start: number, end: number): string {
	return `${start}:${end}`;
}

export function getClassList(element: HtmlElementNode): string[] {
	return (element.attributes.class ?? '').split(/\s+/u).filter(Boolean);
}

function hasTranslatableContentAncestor(element: HtmlElementNode | undefined): boolean {
	for (let current = element; current != null; current = current.parent) {
		if (shouldSkipWrapperContentExtraction(current)) continue;
		if (translatableContentTags.has(current.tag)) return true;
		if (current.tag !== 'span') continue;

		const classList = getClassList(current);
		if (classList.includes('setting__hint') || classList.includes('token-popup__hint')) {
			return true;
		}
	}

	return false;
}

function shouldSkipWrapperContentExtraction(element: HtmlElementNode): boolean {
	if (!translatableContentTags.has(element.tag) && element.tag !== 'span') return false;
	if (hasMeaningfulDirectTextChild(element)) return false;

	const meaningfulChildren = element.children.filter(
		(child): child is HtmlElementNode =>
			child.kind === 'element' && !shouldSkipLocalizationSubtree(child) && !isDecorativeElement(child),
	);
	if (meaningfulChildren.length === 0) return false;

	// If the container only contributes structure and its visible copy lives inside
	// nested elements (for example <a><header><span>...</span></header><progress /></a>),
	// localizing the parent would flatten that structure into plain text.
	if (
		meaningfulChildren.some(
			child =>
				(!translatableContentTags.has(child.tag) && child.tag !== 'span' && !child.tag.includes('-')) ||
				child.tag === 'progress',
		)
	) {
		return true;
	}

	return meaningfulChildren.every(
		child => child.tag.includes('-') || translatableContentTags.has(child.tag) || child.tag === 'span',
	);
}

function hasMeaningfulDirectTextChild(element: HtmlElementNode): boolean {
	return element.children.some(child => child.kind === 'text' && normalizeWhitespace(child.raw).length !== 0);
}

function shouldExtractSlottedElementContent(element: HtmlElementNode): boolean {
	if (hasMeaningfulDirectTextChild(element)) return true;
	if (translatableContentTags.has(element.tag)) return false;
	if (element.tag === 'span') return false;
	if (element.tag === 'div') return false;

	return true;
}

function visitHtmlElement(element: HtmlElementNode, visitor: (element: HtmlElementNode) => void): void {
	visitor(element);
	for (const child of element.children) {
		if (child.kind === 'element') {
			visitHtmlElement(child, visitor);
		}
	}
}

function assignElementPaths(root: HtmlElementNode): void {
	assignChildPaths(root);
}

function assignChildPaths(parent: HtmlElementNode): void {
	const siblingCounts = new Map<string, number>();
	for (const child of parent.children) {
		if (child.kind !== 'element') continue;

		const siblingIndex = (siblingCounts.get(child.tag) ?? 0) + 1;
		siblingCounts.set(child.tag, siblingIndex);

		const segment = getPathSegment(child, siblingIndex);
		child.path = parent.path === 'root' ? segment : `${parent.path}.${segment}`;
		assignChildPaths(child);
	}
}

function getPathSegment(element: HtmlElementNode, siblingIndex: number): string {
	const id = element.attributes.id;
	if (id != null && id.length !== 0) return `${element.tag}#${sanitizeKeySegment(id)}`;

	const firstClass = getClassList(element)[0];
	if (firstClass != null) return `${element.tag}.${sanitizeKeySegment(firstClass)}`;

	return `${element.tag}-${siblingIndex}`;
}

function parseAttributes(source: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	const regex = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;
	for (const match of source.matchAll(regex)) {
		const [, rawName, doubleQuoted, singleQuoted, unquoted] = match;
		const name = rawName.toLowerCase();
		if (name === '/') continue;
		attributes[name] = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
	}
	return attributes;
}

function collectPatternSegments(
	nodes: readonly HtmlNode[],
	parent: HtmlElementNode,
	state: { slotIndex: number },
): Array<
	| {
			readonly kind: 'text';
			readonly value: string;
	  }
	| {
			readonly kind: 'slot';
			readonly name: string;
			readonly node: HtmlElementNode;
	  }
	| {
			readonly kind: 'preserve';
			readonly node: HtmlElementNode;
	  }
> {
	const segments: Array<
		| {
				readonly kind: 'text';
				readonly value: string;
		  }
		| {
				readonly kind: 'slot';
				readonly name: string;
				readonly node: HtmlElementNode;
		  }
		| {
				readonly kind: 'preserve';
				readonly node: HtmlElementNode;
		  }
	> = [];

	for (const node of nodes) {
		if (node.kind === 'text') {
			const text = normalizeWhitespace(node.raw);
			if (text.length === 0) continue;
			segments.push({ kind: 'text', value: text });
			continue;
		}

		if (shouldPreserveAsDynamicSlot(node)) {
			state.slotIndex++;
			segments.push({
				kind: 'slot',
				name: `slot${state.slotIndex}`,
				node: node,
			});
			continue;
		}

		if (shouldSkipLocalizationSubtree(node) || isDecorativeElement(node)) {
			continue;
		}

		if (shouldRepresentElementAsSlot(node, parent)) {
			state.slotIndex++;
			segments.push({
				kind: 'slot',
				name: `slot${state.slotIndex}`,
				node: node,
			});
			continue;
		}

		if (shouldPreserveAsStructuralNode(node)) {
			segments.push({
				kind: 'preserve',
				node: node,
			});
			continue;
		}

		segments.push(...collectPatternSegments(node.children, node, state));
	}

	return segments;
}

function shouldRepresentElementAsSlot(element: HtmlElementNode, parent: HtmlElementNode): boolean {
	if (element.tag === 'gl-i18n-slot') {
		return true;
	}

	if (element.tag === 'div') {
		return getClassList(element).includes('select-container');
	}

	if (element.tag === 'span') {
		return getClassList(element).includes('token');
	}

	if (!slotOnlyTags.has(element.tag)) return false;
	if (element.tag === 'i' && isDecorativeElement(element)) return false;
	if (element.tag === 'a' && getVisibleElementText(element).length === 0) return false;
	if (
		element.tag !== 'select' &&
		element.tag !== 'input' &&
		element.tag !== 'textarea' &&
		getVisibleElementText(element).length === 0
	) {
		return false;
	}

	void parent;
	return true;
}

function shouldPreserveAsDynamicSlot(element: HtmlElementNode): boolean {
	return (
		element.attributes['data-setting-preview'] != null || element.attributes['data-setting-preview-type'] != null
	);
}

function shouldPreserveAsStructuralNode(element: HtmlElementNode): boolean {
	if (element.attributes.slot != null) return true;
	if (getVisibleElementText(element).length !== 0) return false;
	if (voidTags.has(element.tag)) return true;
	if (element.tag.includes('-')) return true;
	if (element.attributes.id != null) return true;

	return Object.keys(element.attributes).some(attribute => attribute.startsWith('data-'));
}

function getVisibleElementText(element: HtmlElementNode): string {
	const parts: string[] = [];
	for (const child of element.children) {
		if (child.kind === 'text') {
			const text = normalizeWhitespace(child.raw);
			if (text.length !== 0) {
				parts.push(text);
			}
			continue;
		}

		if (shouldSkipLocalizationSubtree(child) || isDecorativeElement(child)) continue;
		const nested = getVisibleElementText(child);
		if (nested.length !== 0) {
			parts.push(nested);
		}
	}

	return normalizePatternSegments(parts.map(value => ({ kind: 'text', value })));
}

function normalizePatternSegments(
	segments: ReadonlyArray<
		| {
				readonly kind: 'text';
				readonly value: string;
		  }
		| {
				readonly kind: 'slot';
				readonly name: string;
		  }
		| {
				readonly kind: 'preserve';
		  }
	>,
): string {
	const combined = segments
		.flatMap(segment => {
			switch (segment.kind) {
				case 'text':
					return segment.value;
				case 'slot':
					return `\${${segment.name}}`;
				case 'preserve':
					return [];
			}
		})
		.join(' ');

	return combined
		.replace(/\s+/gu, ' ')
		.replace(/\s+([,.;:!?])/gu, '$1')
		.replace(/([([{])\s+/gu, '$1')
		.replace(/\s+([)\]}])/gu, '$1')
		.replace(/(\$\{[^}]+\})\s*\/\s*(\$\{[^}]+\})/gu, '$1/$2')
		.trim();
}

function isDecorativeElement(element: HtmlElementNode): boolean {
	if (ignoredPatternTags.has(element.tag)) return true;
	if (element.tag !== 'i') return false;
	return getClassList(element).includes('icon');
}

function collectPreservedSegments(
	segments: ReadonlyArray<
		| {
				readonly kind: 'text';
				readonly value: string;
		  }
		| {
				readonly kind: 'slot';
				readonly name: string;
				readonly node: HtmlElementNode;
		  }
		| {
				readonly kind: 'preserve';
				readonly node: HtmlElementNode;
		  }
	>,
): HtmlPreservedNodeDefinition[] {
	const preserves: HtmlPreservedNodeDefinition[] = [];
	let visibleCount = 0;

	for (const segment of segments) {
		switch (segment.kind) {
			case 'text':
			case 'slot':
				visibleCount++;
				break;
			case 'preserve':
				preserves.push({
					gapIndex: visibleCount,
					node: segment.node,
				});
				break;
		}
	}

	return preserves;
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
