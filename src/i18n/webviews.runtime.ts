import type { RuntimeWebviewLocalizationPayload } from './webviews.shared.js';

type RuntimeDomNode = {
	readonly nodeType: number;
	readonly ownerDocument?: RuntimeDomDocument;
	readonly parentNode?: RuntimeDomNode | null;
};

type RuntimeDomNodeContainer = RuntimeDomNode & {
	readonly childNodes: ArrayLike<RuntimeDomNode>;
};

type RuntimeDomElement = RuntimeDomNodeContainer & {
	readonly attachShadow?: (init: RuntimeShadowRootInit) => RuntimeShadowRoot;
	readonly tagName: string;
	getAttribute(name: string): string | null;
	setAttribute(name: string, value: string): void;
};

type RuntimeDomDocument = {
	readonly documentElement: RuntimeDomElement & { lang: string };
};

type RuntimeDomText = RuntimeDomNode & {
	nodeValue: string | null;
	readonly parentElement: RuntimeDomElement | null;
};

type RuntimeDomMutationRecord = {
	readonly addedNodes: ArrayLike<RuntimeDomNode>;
	readonly target: RuntimeDomElement | RuntimeDomNode;
	readonly type: 'attributes' | 'characterData' | 'childList';
};

type RuntimeShadowRoot = RuntimeDomNodeContainer;
type RuntimeShadowRootInit = object;

declare const document: RuntimeDomDocument;
declare const window: {
	__GL_WEBVIEW_I18N__?: unknown;
	requestAnimationFrame(callback: () => void): number;
};
declare const Node: { readonly TEXT_NODE: number };
declare const Element: {
	new (): RuntimeDomElement;
	prototype: RuntimeDomElement & {
		attachShadow?: (init: RuntimeShadowRootInit) => RuntimeShadowRoot;
	};
};
declare const Text: { new (): RuntimeDomText };
declare class MutationObserver {
	constructor(callback: (records: RuntimeDomMutationRecord[]) => void);
	observe(target: object, options: object): void;
}

export function injectWebviewRuntimeLocalization(
	html: string,
	cspNonce: string,
	locale: string,
	payload: RuntimeWebviewLocalizationPayload | undefined,
): string {
	let localizedHtml = setHtmlLang(html, locale);
	if (payload == null) return localizedHtml;

	const runtimeScript =
		`<script type="text/javascript" nonce="${cspNonce}">` +
		`window.__GL_WEBVIEW_I18N__=${serializeRuntimeLocalizationPayload(payload)};` +
		`;(${installWebviewRuntimeLocalization.toString()})();` +
		`</script>`;

	if (/<\/head>/i.test(localizedHtml)) {
		return localizedHtml.replace(/<\/head>/i, () => `${runtimeScript}</head>`);
	}

	if (/<body\b/i.test(localizedHtml)) {
		return localizedHtml.replace(/<body\b([^>]*)>/i, (_substring, bodyAttributes: string) => {
			return `<body${bodyAttributes}>${runtimeScript}`;
		});
	}

	return `${runtimeScript}${localizedHtml}`;
}

function serializeRuntimeLocalizationPayload(payload: RuntimeWebviewLocalizationPayload): string {
	return JSON.stringify(payload)
		.replace(/</g, '\\u003c')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

function setHtmlLang(html: string, locale: string): string {
	if (/<html\b[^>]*\blang=/i.test(html)) {
		return html.replace(/(<html\b[^>]*\blang=["'])[^"']*(["'][^>]*>)/i, `$1${locale}$2`);
	}

	return html.replace(/<html\b([^>]*)>/i, `<html$1 lang="${locale}">`);
}

function installWebviewRuntimeLocalization(): void {
	type RuntimePayload = {
		readonly locale?: string;
		readonly templates?: ReadonlyArray<{
			readonly source: string;
			readonly target: string;
			readonly slots: readonly string[];
		}>;
		readonly translations?: Readonly<Record<string, string>>;
	};

	type CompiledTemplate = {
		readonly regex: RegExp;
		readonly slots: readonly string[];
		readonly source: string;
		readonly target: string;
	};

	type RuntimeVisibleSegment = {
		readonly end: number;
		readonly kind: 'element' | 'text';
		readonly node: RuntimeDomNode;
		readonly start: number;
		readonly text: string;
	};

	type RuntimeTemplateSlotMatch = {
		readonly endIndex: number;
		readonly slotName: string;
		readonly startIndex: number;
	};

	type RuntimeTemplateMatch = {
		readonly slotRanges: readonly RuntimeTemplateSlotMatch[];
	};

	type RuntimeState = {
		readonly locale: string;
		readonly templates: readonly CompiledTemplate[];
		readonly translations: ReadonlyMap<string, string>;
	};

	type LocalizeRootOptions = {
		readonly includeAttributes?: boolean;
	};

	const localizableAttributes = ['alt-label', 'aria-label', 'placeholder', 'title', 'tooltip'];
	const ignoredTags = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE']);
	const localizedRoots = new WeakSet<RuntimeDomNode>();
	const blockedCompositeElements = new WeakSet<RuntimeDomElement>();
	const queuedRoots = new Set<RuntimeDomNode>();
	let flushHandle: number | undefined;
	let observer: MutationObserver | undefined;
	let runtimeState: RuntimeState | undefined;
	let shadowRootLocalizationInstalled = false;

	function normalizeText(value: string): string {
		return value.replace(/[ \t\r\n\f]+/g, ' ').trim();
	}

	function getState(): RuntimeState {
		if (runtimeState != null) return runtimeState;

		const payload = ((window as typeof window & { __GL_WEBVIEW_I18N__?: RuntimePayload }).__GL_WEBVIEW_I18N__ ??
			Object.create(null)) as RuntimePayload;
		const translations = new Map<string, string>();
		for (const [source, target] of Object.entries(
			(payload.translations ?? Object.create(null)) as Record<string, string>,
		)) {
			const normalizedSource = normalizeText(source);
			if (normalizedSource.length === 0) continue;

			translations.set(normalizedSource, target);
		}

		runtimeState = {
			locale: normalizeLocale(payload.locale ?? document.documentElement.lang),
			templates: compileTemplates(payload.templates ?? []),
			translations: translations,
		};
		return runtimeState;
	}

	function compileTemplates(
		templates: ReadonlyArray<{
			readonly source: string;
			readonly target: string;
			readonly slots: readonly string[];
		}>,
	): CompiledTemplate[] {
		return templates
			.map(template => {
				const pattern = buildTemplatePattern(template.source, template.slots);
				if (pattern == null) return undefined;

				return {
					regex: pattern,
					slots: template.slots,
					source: template.source,
					target: template.target,
				};
			})
			.filter((template): template is CompiledTemplate => template != null);
	}

	function buildTemplatePattern(source: string, slots: readonly string[]): RegExp | undefined {
		if (slots.length === 0) return undefined;

		let pattern = '^';
		let lastIndex = 0;
		for (const match of source.matchAll(/\$\{([^}]+)\}/g)) {
			const placeholder = match[0];
			const index = match.index ?? 0;
			pattern += escapeRegExp(source.slice(lastIndex, index));
			pattern += '([\\s\\S]*?)';
			lastIndex = index + placeholder.length;
		}

		pattern += escapeRegExp(source.slice(lastIndex));
		pattern += '$';
		return new RegExp(pattern, 'd');
	}

	function escapeRegExp(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function ensureObserver(): void {
		if (observer != null) return;

		observer = new MutationObserver(records => {
			for (const record of records) {
				switch (record.type) {
					case 'attributes':
						if (isElementNode(record.target)) {
							localizeAttributes(record.target);
						}
						break;
					case 'characterData':
						queueLocalization(record.target);
						break;
					case 'childList':
						for (let index = 0; index < record.addedNodes.length; index++) {
							const node = record.addedNodes[index];
							if (node != null) {
								queueLocalization(node);
							}
						}
						break;
				}
			}
		});
	}

	function queueLocalization(root: RuntimeDomNode): void {
		queuedRoots.add(resolveLocalizationRoot(root));
		if (flushHandle != null) return;

		flushHandle = window.requestAnimationFrame(() => {
			flushHandle = undefined;

			for (const node of queuedRoots) {
				localizeSubtree(node, { includeAttributes: true });
			}
			queuedRoots.clear();
		});
	}

	function resolveLocalizationRoot(node: RuntimeDomNode): RuntimeDomNode {
		if (isElementNode(node) || hasChildNodes(node)) return node;

		let current = node.parentNode ?? null;
		while (current != null) {
			if (isElementNode(current) || hasChildNodes(current)) return current;
			current = current.parentNode ?? null;
		}

		return node;
	}

	function ensureShadowRootLocalization(): void {
		if (shadowRootLocalizationInstalled) return;
		if (typeof Element === 'undefined' || typeof Element.prototype.attachShadow !== 'function') return;

		shadowRootLocalizationInstalled = true;

		const originalAttachShadow = Element.prototype.attachShadow;
		Element.prototype.attachShadow = function (
			this: RuntimeDomElement,
			init: RuntimeShadowRootInit,
		): RuntimeShadowRoot {
			const shadowRoot = originalAttachShadow.call(this, init);
			localizeRoot(shadowRoot, { includeAttributes: true });
			return shadowRoot;
		};
	}

	function localizeRoot(root: RuntimeDomNode, options?: LocalizeRootOptions): void {
		ensureShadowRootLocalization();
		const state = getState();
		if (state.translations.size === 0 && state.templates.length === 0) return;
		if (localizedRoots.has(root)) return;

		localizedRoots.add(root);
		localizeSubtree(root, options);
		ensureObserver();
		observer?.observe(root, {
			attributes: options?.includeAttributes ?? true,
			attributeFilter: localizableAttributes,
			characterData: true,
			childList: true,
			subtree: true,
		});
	}

	function localizeSubtree(root: RuntimeDomNode | RuntimeDomDocument, options?: LocalizeRootOptions): void {
		if (isTextNode(root)) {
			localizeTextNode(root);
			return;
		}

		if (isDocumentNode(root)) {
			localizeSubtree(root.documentElement, options);
			return;
		}

		if (isElementNode(root)) {
			if (options?.includeAttributes ?? true) {
				localizeAttributes(root);
			}

			if (ignoredTags.has(root.tagName)) return;
			localizeElementTemplate(root);
		}

		if (!hasChildNodes(root)) return;
		for (const child of getChildNodesSnapshot(root)) {
			localizeSubtree(child, { includeAttributes: true });
		}
	}

	function localizeTextNode(node: RuntimeDomText): void {
		if (!shouldLocalizeTextNode(node)) return;

		const original = node.nodeValue ?? '';
		const translated = translateValue(original);
		if (translated == null || translated === original) return;

		node.nodeValue = translated;
	}

	function localizeAttributes(element: RuntimeDomElement): void {
		for (const attributeName of localizableAttributes) {
			const value = element.getAttribute(attributeName);
			if (value == null) continue;

			const translated = translateValue(value);
			if (translated == null || translated === value) continue;

			element.setAttribute(attributeName, translated);
		}
	}

	function localizeElementTemplate(element: RuntimeDomElement): void {
		const state = getState();
		const segments = collectVisibleSegments(element);
		if (segments == null || segments.length === 0) {
			blockedCompositeElements.delete(element);
			return;
		}

		const text = segments.map(segment => segment.text).join(' ');
		const exactTranslation = state.translations.get(text);
		if (exactTranslation != null && applyExactCompositeLocalization(segments, exactTranslation)) {
			blockedCompositeElements.delete(element);
			return;
		}

		if (state.templates.length !== 0) {
			for (const template of state.templates) {
				const match = matchTemplateSegments(template, segments, text);
				if (match == null) continue;
				if (!applyTemplateLiteralLocalization(template, segments, match)) continue;

				blockedCompositeElements.delete(element);
				return;
			}
		}

		if (shouldBlockCompositeElementTranslations(segments)) {
			blockedCompositeElements.add(element);
		} else {
			blockedCompositeElements.delete(element);
		}
	}

	function applyExactCompositeLocalization(segments: readonly RuntimeVisibleSegment[], translation: string): boolean {
		const textSegments = segments.filter(
			(segment): segment is RuntimeVisibleSegment & { readonly kind: 'text'; readonly node: RuntimeDomText } => {
				return segment.kind === 'text' && isTextNode(segment.node);
			},
		);
		if (textSegments.length === 0) return false;

		for (const [index, segment] of textSegments.entries()) {
			segment.node.nodeValue = index === 0 ? translation : '';
		}

		return true;
	}

	function shouldLocalizeTextNode(node: RuntimeDomText): boolean {
		const parent = node.parentElement;
		if (parent == null) return false;
		if (ignoredTags.has(parent.tagName)) return false;
		if (hasBlockedCompositeAncestor(parent)) return false;

		const raw = node.nodeValue ?? '';
		if (raw.trim().length === 0) return false;
		if (raw.includes('#{') || raw.includes('__GL_WEBVIEW_I18N__')) return false;

		return true;
	}

	function hasBlockedCompositeAncestor(element: RuntimeDomElement): boolean {
		let current: RuntimeDomNode | null | undefined = element;
		while (current != null) {
			if (isElementNode(current) && blockedCompositeElements.has(current)) return true;
			current = current.parentNode ?? null;
		}

		return false;
	}

	function shouldBlockCompositeElementTranslations(segments: readonly RuntimeVisibleSegment[]): boolean {
		return segments.length > 1 && segments.some(segment => segment.kind === 'text');
	}

	function translateValue(value: string): string | undefined {
		const match = /^(\s*)([\s\S]*?\S)(\s*)$/.exec(value);
		if (match == null) return undefined;

		const [, leadingWhitespace, content, trailingWhitespace] = match;
		const normalizedContent = normalizeText(content);
		if (normalizedContent.length === 0) return undefined;

		const state = getState();
		if (state.translations.has(normalizedContent)) {
			return `${leadingWhitespace}${state.translations.get(normalizedContent) ?? ''}${trailingWhitespace}`;
		}

		for (const template of state.templates) {
			const templateMatch = template.regex.exec(normalizedContent);
			if (templateMatch == null) continue;

			const translated = template.target.replace(/\$\{([^}]+)\}/g, (_substring, slotName: string) => {
				const slotIndex = template.slots.indexOf(slotName);
				return slotIndex === -1 ? '' : (templateMatch[slotIndex + 1] ?? '');
			});
			return `${leadingWhitespace}${translated}${trailingWhitespace}`;
		}

		return undefined;
	}

	function collectVisibleSegments(element: RuntimeDomElement): RuntimeVisibleSegment[] | undefined {
		if (!hasChildNodes(element)) return undefined;

		const segments: RuntimeVisibleSegment[] = [];
		let position = 0;

		for (const child of getChildNodesSnapshot(element)) {
			const text = getVisibleNodeText(child);
			if (text.length === 0) {
				if (!isIgnorableNode(child)) return undefined;
				continue;
			}

			const start = position;
			const end = start + text.length;
			segments.push({
				end: end,
				kind: isTextNode(child) ? 'text' : 'element',
				node: child,
				start: start,
				text: text,
			});
			position = end + 1;
		}

		return segments;
	}

	function getVisibleNodeText(node: RuntimeDomNode): string {
		if (isTextNode(node)) {
			return normalizeText(node.nodeValue ?? '');
		}

		if (!isElementNode(node)) return '';
		if (ignoredTags.has(node.tagName)) return '';
		if (!hasChildNodes(node)) return '';

		const parts: string[] = [];
		for (const child of getChildNodesSnapshot(node)) {
			const text = getVisibleNodeText(child);
			if (text.length !== 0) {
				parts.push(text);
			}
		}

		return normalizeText(parts.join(' '));
	}

	function isIgnorableNode(node: RuntimeDomNode): boolean {
		if (isTextNode(node)) {
			return normalizeText(node.nodeValue ?? '').length === 0;
		}

		return !isElementNode(node);
	}

	function matchTemplateSegments(
		template: CompiledTemplate,
		segments: readonly RuntimeVisibleSegment[],
		text: string,
	): RuntimeTemplateMatch | undefined {
		const match = template.regex.exec(text) as
			| (RegExpExecArray & {
					readonly indices?: ReadonlyArray<readonly [number, number] | undefined>;
			  })
			| null;
		if (match == null || match.indices == null) return undefined;

		const slotRanges: RuntimeTemplateSlotMatch[] = [];
		let previousEnd = -1;

		for (let index = 0; index < template.slots.length; index++) {
			const range = match.indices[index + 1];
			if (range == null || range[0] === range[1]) return undefined;

			const startSegment = findSegmentIndexByBoundary(segments, range[0], 'start');
			const endSegment = findSegmentIndexByBoundary(segments, range[1], 'end');
			if (startSegment === -1 || endSegment === -1 || startSegment > endSegment || startSegment <= previousEnd) {
				return undefined;
			}

			slotRanges.push({
				endIndex: endSegment,
				slotName: template.slots[index],
				startIndex: startSegment,
			});
			previousEnd = endSegment;
		}

		return {
			slotRanges: slotRanges,
		};
	}

	function findSegmentIndexByBoundary(
		segments: readonly RuntimeVisibleSegment[],
		boundary: number,
		kind: 'start' | 'end',
	): number {
		return segments.findIndex(segment => segment[kind] === boundary);
	}

	function applyTemplateLiteralLocalization(
		template: CompiledTemplate,
		segments: readonly RuntimeVisibleSegment[],
		match: RuntimeTemplateMatch,
	): boolean {
		const targetSlots: string[] = [];
		const literals: string[] = [];
		let lastIndex = 0;

		for (const match of template.target.matchAll(/\$\{([^}]+)\}/g)) {
			targetSlots.push(match[1]);
			literals.push(template.target.slice(lastIndex, match.index ?? 0));
			lastIndex = (match.index ?? 0) + match[0].length;
		}
		literals.push(template.target.slice(lastIndex));

		if (targetSlots.length !== template.slots.length) return false;
		if (!targetSlots.every((slotName, index) => slotName === template.slots[index])) {
			return false;
		}

		let previousEnd = -1;
		for (let index = 0; index < literals.length; index++) {
			const slotRange = match.slotRanges[index];
			const start = previousEnd + 1;
			const end = slotRange == null ? segments.length - 1 : slotRange.startIndex - 1;
			if (!applyLiteralToSegmentGap(segments, start, end, literals[index])) {
				return false;
			}

			previousEnd = slotRange?.endIndex ?? previousEnd;
		}

		return true;
	}

	function applyLiteralToSegmentGap(
		segments: readonly RuntimeVisibleSegment[],
		startIndex: number,
		endIndex: number,
		literal: string,
	): boolean {
		if (startIndex > endIndex) {
			return literal.length === 0;
		}

		const gapSegments = segments.slice(startIndex, endIndex + 1);
		if (gapSegments.some(segment => segment.kind !== 'text' || !isTextNode(segment.node))) {
			return false;
		}

		if (gapSegments.length === 0) {
			return literal.length === 0;
		}

		for (const [index, segment] of gapSegments.entries()) {
			const node = segment.node;
			if (!isTextNode(node)) return false;

			node.nodeValue = index === 0 ? literal : '';
		}

		return true;
	}

	function isDocumentNode(node: RuntimeDomNode | RuntimeDomDocument): node is RuntimeDomDocument {
		return 'documentElement' in node;
	}

	function isElementNode(node: RuntimeDomNode): node is RuntimeDomElement {
		return node instanceof Element;
	}

	function isTextNode(node: RuntimeDomNode | RuntimeDomDocument): node is RuntimeDomText {
		return node instanceof Text;
	}

	function hasChildNodes(node: RuntimeDomNode | RuntimeShadowRoot): node is RuntimeDomNodeContainer {
		return 'childNodes' in node && node.childNodes != null;
	}

	function getChildNodesSnapshot(node: RuntimeDomNodeContainer): RuntimeDomNode[] {
		return Array.from({ length: node.childNodes.length }, (_, index) => node.childNodes[index]!).filter(
			(child): child is RuntimeDomNode => child != null,
		);
	}

	function normalizeLocale(value: string | undefined): string {
		if (value == null || value.trim().length === 0) return 'en';
		return value.toLowerCase();
	}

	const state = getState();
	document.documentElement.lang = state.locale;
	localizeRoot(document.documentElement, { includeAttributes: true });
}
