import * as ts from 'typescript';

export interface SyntheticHtmlTemplateFragment {
	readonly html: string;
	readonly expressions: ReadonlyMap<string, string>;
}

export interface SyntheticTextTemplateFragment {
	readonly text: string;
	readonly expressions: ReadonlyMap<string, string>;
}

interface HtmlInsertionContext {
	inTag: boolean;
	quote?: '"' | "'";
	inUnquotedAttributeValue: boolean;
	tagTail: string;
}

const syntheticAttributeSlotTokenPattern = /__GL_I18N_SLOT_slot\d+__/u;

export function containsSyntheticAttributeSlotToken(text: string): boolean {
	return syntheticAttributeSlotTokenPattern.test(text);
}

export function buildSyntheticHtmlTemplateFragment(
	template: ts.TemplateLiteral,
	sourceFile?: ts.SourceFile,
	getExpressionText?: (expression: ts.Expression, slotName: string) => string,
): SyntheticHtmlTemplateFragment {
	if (ts.isNoSubstitutionTemplateLiteral(template)) {
		return {
			html: template.text,
			expressions: new Map<string, string>(),
		};
	}

	const context = createHtmlInsertionContext();
	const expressions = new Map<string, string>();
	const parts: string[] = [];

	appendStaticPart(parts, context, template.head.text);
	for (const [index, span] of template.templateSpans.entries()) {
		const slotName = `slot${index + 1}`;
		const attributeValueSlot = isAttributeValueContext(context);
		parts.push(
			attributeValueSlot
				? createSyntheticAttributeSlotToken(slotName)
				: `<gl-i18n-slot data-slot="${slotName}"></gl-i18n-slot>`,
		);
		if (attributeValueSlot && context.quote == null) {
			context.inUnquotedAttributeValue = true;
		}
		if (sourceFile != null) {
			expressions.set(
				slotName,
				getExpressionText?.(span.expression, slotName) ?? `\${${span.expression.getText(sourceFile)}}`,
			);
		}

		appendStaticPart(parts, context, span.literal.text);
	}

	return {
		html: parts.join(''),
		expressions: expressions,
	};
}

export function buildSyntheticTextTemplateFragment(
	template: ts.TemplateLiteral,
	sourceFile?: ts.SourceFile,
	getExpressionText?: (expression: ts.Expression, slotName: string) => string,
): SyntheticTextTemplateFragment {
	if (ts.isNoSubstitutionTemplateLiteral(template)) {
		return {
			text: template.text,
			expressions: new Map<string, string>(),
		};
	}

	const expressions = new Map<string, string>();
	const parts: string[] = [template.head.text];
	for (const [index, span] of template.templateSpans.entries()) {
		const slotName = `slot${index + 1}`;
		parts.push(`\${${slotName}}`);
		if (sourceFile != null) {
			expressions.set(
				slotName,
				getExpressionText?.(span.expression, slotName) ?? `\${${span.expression.getText(sourceFile)}}`,
			);
		}
		parts.push(span.literal.text);
	}

	return {
		text: parts.join(''),
		expressions: expressions,
	};
}

function createSyntheticAttributeSlotToken(slotName: string): string {
	return `__GL_I18N_SLOT_${slotName}__`;
}

function createHtmlInsertionContext(): HtmlInsertionContext {
	return {
		inTag: false,
		inUnquotedAttributeValue: false,
		tagTail: '',
	};
}

function appendStaticPart(parts: string[], context: HtmlInsertionContext, text: string): void {
	parts.push(text);
	advanceHtmlInsertionContext(context, text);
}

function advanceHtmlInsertionContext(context: HtmlInsertionContext, text: string): void {
	let previousChar: string | undefined;
	for (const char of text) {
		if (!context.inTag) {
			if (char === '<') {
				context.inTag = true;
				context.quote = undefined;
				context.inUnquotedAttributeValue = false;
				context.tagTail = '<';
			}
			previousChar = char;
			continue;
		}

		if (context.quote != null) {
			pushTagTail(context, char);
			if (char === context.quote && previousChar !== '\\') {
				context.quote = undefined;
			}
			previousChar = char;
			continue;
		}

		if (context.inUnquotedAttributeValue) {
			if (char === '>') {
				context.inTag = false;
				context.inUnquotedAttributeValue = false;
				context.tagTail = '';
				previousChar = char;
				continue;
			}

			pushTagTail(context, char);
			if (/\s/u.test(char)) {
				context.inUnquotedAttributeValue = false;
			}
			previousChar = char;
			continue;
		}

		if (char === '>') {
			context.inTag = false;
			context.tagTail = '';
			previousChar = char;
			continue;
		}

		if (char === '"' || char === "'") {
			context.quote = char;
			pushTagTail(context, char);
			previousChar = char;
			continue;
		}

		if (char === '<') {
			context.inTag = true;
			context.quote = undefined;
			context.inUnquotedAttributeValue = false;
			context.tagTail = '<';
			previousChar = char;
			continue;
		}

		pushTagTail(context, char);
		previousChar = char;
	}
}

function isAttributeValueContext(context: HtmlInsertionContext): boolean {
	if (!context.inTag) return false;
	if (context.quote != null || context.inUnquotedAttributeValue) return true;

	return /(?:^|[\s<])[^\s=<>/]+\s*=\s*$/u.test(context.tagTail);
}

function pushTagTail(context: HtmlInsertionContext, char: string): void {
	context.tagTail = `${context.tagTail}${char}`.slice(-200);
}
