/*global window Node NodeFilter*/

import {
	normalizeWebviewLocalizationText,
	translatePreservingWhitespace as translatePreservingWhitespaceCore,
} from '../../webviewRuntimeLocalizationCore.js';

type RuntimeLocalizationPayload = {
	locale?: string;
	translations?: Record<string, string>;
};

type RuntimeLocalizationState = {
	locale: string;
	translations: ReadonlyMap<string, string>;
};

type LocalizeRootOptions = {
	includeAttributes?: boolean;
};

const localizableAttributes = ['aria-label', 'placeholder', 'title'];
const ignoredTags = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE']);

let runtimeState: RuntimeLocalizationState | undefined;
let rootObserver: MutationObserver | undefined;
let shadowRootLocalizationInstalled = false;
const localizedRoots = new WeakSet<Node>();
const queuedRoots = new Set<Node>();
let flushHandle: number | undefined;

export function getWebviewLocale(): string {
	return getRuntimeLocalizationState().locale;
}

export function t(value: string): string {
	const normalized = normalizeWebviewLocalizationText(value);
	if (normalized.length === 0) return value;

	return getRuntimeLocalizationState().translations.get(normalized) ?? value;
}

export function localizeRoot(root: Node, options?: LocalizeRootOptions): void {
	ensureShadowRootLocalization();
	if (getRuntimeLocalizationState().translations.size === 0) return;
	if (localizedRoots.has(root)) return;

	localizedRoots.add(root);
	localizeSubtree(root, options);
	ensureObserver();
	rootObserver?.observe(root, {
		attributes: options?.includeAttributes ?? true,
		attributeFilter: localizableAttributes,
		childList: true,
		characterData: true,
		subtree: true,
	});
}

function ensureShadowRootLocalization(): void {
	if (shadowRootLocalizationInstalled) return;
	if (typeof Element === 'undefined' || typeof Element.prototype.attachShadow !== 'function') return;

	shadowRootLocalizationInstalled = true;

	const originalAttachShadow = Element.prototype.attachShadow;
	Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit): ShadowRoot {
		const shadowRoot = originalAttachShadow.call(this, init);
		localizeRoot(shadowRoot, { includeAttributes: true });
		return shadowRoot;
	};
}

function getRuntimeLocalizationState(): RuntimeLocalizationState {
	if (runtimeState != null) return runtimeState;

	const payload = ((window as typeof window & { __GL_WEBVIEW_I18N__?: RuntimeLocalizationPayload })
		.__GL_WEBVIEW_I18N__ ?? Object.create(null)) as RuntimeLocalizationPayload;
	const locale = normalizeLocale(payload.locale ?? document.documentElement.lang);
	const rawTranslations: Record<string, string> = payload.translations ?? {};
	const translations = new Map<string, string>();

	for (const [english, localized] of Object.entries(rawTranslations)) {
		const normalizedEnglish = normalizeWebviewLocalizationText(english);
		if (normalizedEnglish.length === 0 || localized == null || localized === english) continue;

		translations.set(normalizedEnglish, localized);
	}

	runtimeState = {
		locale: locale,
		translations: translations,
	};
	return runtimeState;
}

function ensureObserver(): void {
	if (rootObserver != null) return;

	rootObserver = new MutationObserver(records => {
		for (const record of records) {
			switch (record.type) {
				case 'attributes':
					if (record.target instanceof Element) {
						localizeAttributes(record.target);
					}
					break;
				case 'characterData':
					queueLocalization(record.target);
					break;
				case 'childList':
					for (const node of record.addedNodes) {
						queueLocalization(node);
					}
					break;
			}
		}
	});
}

function queueLocalization(root: Node): void {
	queuedRoots.add(root);
	if (flushHandle != null) return;

	flushHandle = window.requestAnimationFrame(() => {
		flushHandle = undefined;

		for (const node of queuedRoots) {
			localizeSubtree(node, { includeAttributes: true });
		}
		queuedRoots.clear();
	});
}

function localizeSubtree(root: Node, options?: LocalizeRootOptions): void {
	if (root.nodeType === Node.TEXT_NODE) {
		localizeTextNode(root);
		return;
	}

	if (root instanceof Element) {
		if (options?.includeAttributes ?? true) {
			localizeAttributes(root);
		}

		if (ignoredTags.has(root.tagName)) return;
	}

	const ownerDocument = root instanceof Document ? root : root.ownerDocument;
	if (ownerDocument == null) return;

	const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let current = walker.nextNode();
	while (current != null) {
		localizeTextNode(current);
		current = walker.nextNode();
	}
}

function localizeTextNode(node: Node): void {
	if (!(node instanceof Text)) return;
	if (!shouldLocalizeTextNode(node)) return;

	const originalValue = node.nodeValue ?? '';
	const translated = translateDomValue(originalValue);
	if (translated == null || translated === originalValue) return;

	node.nodeValue = translated;
}

function localizeAttributes(element: Element): void {
	for (const attributeName of localizableAttributes) {
		const value = element.getAttribute(attributeName);
		if (value == null) continue;

		const translated = translateDomValue(value);
		if (translated == null || translated === value) continue;

		element.setAttribute(attributeName, translated);
	}
}

function shouldLocalizeTextNode(node: Text): boolean {
	const parent = node.parentElement;
	if (parent == null) return false;
	if (ignoredTags.has(parent.tagName)) return false;

	const raw = node.nodeValue ?? '';
	if (raw.trim().length === 0) return false;
	if (raw.includes('#{') || raw.includes('__GL_I18N__')) return false;

	return true;
}

function translateDomValue(value: string): string | undefined {
	return translatePreservingWhitespaceCore(value, getRuntimeLocalizationState().translations);
}

function normalizeLocale(value: string | undefined): string {
	if (value == null || value.trim().length === 0) return 'en';
	return value.toLowerCase();
}

ensureShadowRootLocalization();
