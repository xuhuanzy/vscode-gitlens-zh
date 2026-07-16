import * as ts from "typescript";

import type { CatalogIssue, MessagePattern } from "../../core/model.mts";
import {
	createContentHash,
	createPatternFingerprint,
	parseMessagePattern,
	sanitizeKeySegment,
} from "../../core/model.mts";

import { shouldLocalizeDisplaySite, type DisplayRole } from "./displayPolicy.mts";
import {
	collectElementContentPattern,
	findAttributeValueRange,
	getClassList,
	isTranslatableLiteralText,
	isTranslatablePatternText,
	parseHtmlDocument,
	shouldExtractElementContent,
	shouldExtractRootContent,
	shouldSkipLocalizationSubtree,
	visitHtmlElements,
	type HtmlElementNode,
} from "./html.mts";
import {
	buildSyntheticHtmlTemplateFragment,
	buildSyntheticTextTemplateFragment,
	getSyntheticHtmlTemplateSlotContext,
} from "./template.mts";

export interface WebviewSourceInput {
	readonly file: string;
	readonly source: string;
	readonly syntax: "ts" | "tsx" | "jsx";
	readonly bundle: string;
}

export type SourceReplacement =
	| {
			readonly kind: "lit-template";
			readonly start: number;
			readonly end: number;
			readonly innerStart: number;
			readonly innerEnd: number;
			readonly attribute?: string;
	  }
	| {
			readonly kind: "source";
			readonly start: number;
			readonly end: number;
			readonly format: "string-literal" | "template-expression" | "jsx-text" | "jsx-attribute";
	  };

export interface WebviewLocalizationSite {
	readonly id: string;
	readonly outputKey: string;
	readonly pattern: MessagePattern;
	readonly role: DisplayRole;
	readonly replacement: SourceReplacement;
}

export interface WebviewLocalizationPlan {
	readonly file: string;
	readonly source: string;
	readonly sites: readonly WebviewLocalizationSite[];
	readonly issues: readonly CatalogIssue[];
}

interface PlannedSiteInput {
	readonly owner: string;
	readonly pattern: MessagePattern;
	readonly role: DisplayRole;
	readonly replacement: SourceReplacement;
}

export function analyzeWebviewSource(input: WebviewSourceInput): WebviewLocalizationPlan {
	const sourceFile = ts.createSourceFile(
		input.file,
		input.source,
		ts.ScriptTarget.Latest,
		true,
		input.syntax === "tsx" ? ts.ScriptKind.TSX : input.syntax === "jsx" ? ts.ScriptKind.JSX : ts.ScriptKind.TS,
	);
	const plannedSites: PlannedSiteInput[] = [];
	const issues: CatalogIssue[] = [];

	const visit = (node: ts.Node): void => {
		if (ts.isTaggedTemplateExpression(node) && isLitTemplateTag(node.tag)) {
			plannedSites.push(...planLitTemplate(node, sourceFile));
		}
		if (ts.isJsxAttribute(node)) {
			const site = planJsxAttribute(node, sourceFile);
			if (site != null) plannedSites.push(site);
		}
		if (ts.isJsxText(node)) {
			const site = planJsxText(node, sourceFile);
			if (site != null) plannedSites.push(site);
		}
		if (ts.isTemplateExpression(node)) {
			const site = planImperativeTemplateDisplay(node, sourceFile);
			if (site != null) plannedSites.push(site);
		}
		if (ts.isStringLiteralLike(node)) {
			const site =
				planLitDisplayExpression(node, sourceFile, input.file, issues) ??
				planJsxDisplayExpression(node, sourceFile) ??
				planImperativeDisplay(node, sourceFile);
			if (site != null) plannedSites.push(site);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);

	const ordinals = new Map<string, number>();
	const sites = plannedSites.map((site) => {
		const roleIdentity =
			site.role.kind === "content"
				? "content"
				: site.role.kind === "imperative"
					? `imperative.${site.role.target}`
					: `${site.role.binding}.${site.role.tag ?? "*"}.${site.role.name}`;
		const fingerprint = createPatternFingerprint(site.pattern);
		const ordinalKey = `${site.owner}:${roleIdentity}:${fingerprint}`;
		const ordinal = (ordinals.get(ordinalKey) ?? 0) + 1;
		ordinals.set(ordinalKey, ordinal);

		const identity = [input.bundle, input.file, site.owner, roleIdentity, fingerprint, ordinal].join("\n");
		const id = `webviews:${input.bundle}:${createContentHash(identity)}`;
		return {
			id: id,
			outputKey: `${sanitizeKeySegment(input.bundle)}.${id.slice(id.lastIndexOf(":") + 1)}`,
			pattern: site.pattern,
			role: site.role,
			replacement: site.replacement,
		};
	});

	return {
		file: input.file,
		source: input.source,
		sites: sites,
		issues: issues,
	};
}

function planImperativeTemplateDisplay(
	node: ts.TemplateExpression,
	sourceFile: ts.SourceFile,
): PlannedSiteInput | undefined {
	if (ts.isTaggedTemplateExpression(node.parent) && node.parent.template === node) return undefined;
	if (isLiteralUnionCallArgument(node, sourceFile)) return undefined;

	const target = getImperativeDisplayTarget(node);
	const directDisplayValue =
		(ts.isPropertyAssignment(node.parent) && node.parent.initializer === node) ||
		(ts.isPropertyDeclaration(node.parent) && node.parent.initializer === node);
	if (!directDisplayValue && !hasImperativeDisplayContextAncestor(node)) return undefined;
	if (target == null) return undefined;

	const patternText = buildSyntheticTextTemplateFragment(node, sourceFile).text;
	if (!isTranslatablePatternText(patternText) || !looksLikeDisplayText(patternText, node)) return undefined;

	return {
		owner: getSemanticOwner(node, sourceFile),
		pattern: parseMessagePattern(patternText),
		role: { kind: "imperative", target: target },
		replacement: {
			kind: "source",
			start: node.getStart(sourceFile),
			end: node.getEnd(),
			format: "template-expression",
		},
	};
}

function planImperativeDisplay(node: ts.StringLiteralLike, sourceFile: ts.SourceFile): PlannedSiteInput | undefined {
	if (isLiteralUnionCallArgument(node, sourceFile)) return undefined;
	let crossedFunctionProducer = false;
	for (let current = node.parent; current != null; current = current.parent) {
		if (
			ts.isArrowFunction(current) ||
			ts.isFunctionDeclaration(current) ||
			ts.isFunctionExpression(current) ||
			ts.isMethodDeclaration(current) ||
			ts.isGetAccessorDeclaration(current)
		) {
			crossedFunctionProducer = true;
		}
		if (
			ts.isTemplateExpression(current) ||
			ts.isTemplateSpan(current) ||
			ts.isTaggedTemplateExpression(current) ||
			ts.isJsxExpression(current)
		) {
			if (!crossedFunctionProducer) return undefined;
			continue;
		}
		if (ts.isJsxAttribute(current) || ts.isJsxText(current)) return undefined;
		if (ts.isSourceFile(current)) break;
	}

	const target = getImperativeDisplayTarget(node);
	const directDisplayValue =
		(ts.isPropertyAssignment(node.parent) && node.parent.initializer === node) ||
		(ts.isPropertyDeclaration(node.parent) && node.parent.initializer === node);
	if (!directDisplayValue && !hasImperativeDisplayContextAncestor(node)) return undefined;
	if (target == null || !isTranslatableLiteralText(node.text) || !looksLikeDisplayText(node.text, node)) {
		return undefined;
	}

	const role: DisplayRole = { kind: "imperative", target: target };
	return {
		owner: getSemanticOwner(node, sourceFile),
		pattern: parseMessagePattern(node.text),
		role: role,
		replacement: {
			kind: "source",
			start: node.getStart(sourceFile),
			end: node.getEnd(),
			format: "string-literal",
		},
	};
}

function getImperativeDisplayTarget(
	node: ts.Node,
): Extract<DisplayRole, { readonly kind: "imperative" }>["target"] | undefined {
	let child = node;
	for (let current = node.parent; current != null; child = current, current = current.parent) {
		let name: string | undefined;
		if (ts.isPropertyAssignment(current) && current.initializer === child) {
			name = getPropertyName(current.name);
		} else if (ts.isPropertyDeclaration(current) && current.initializer === child) {
			name = getPropertyName(current.name);
		} else if (
			ts.isVariableDeclaration(current) &&
			current.initializer === child &&
			ts.isIdentifier(current.name)
		) {
			name = current.name.text;
		} else if (
			ts.isBinaryExpression(current) &&
			current.right === child &&
			current.operatorToken.kind === ts.SyntaxKind.EqualsToken
		) {
			if (ts.isIdentifier(current.left)) name = current.left.text;
			if (ts.isPropertyAccessExpression(current.left)) name = current.left.name.text;
		} else if (
			ts.isCallExpression(current) &&
			ts.isPropertyAccessExpression(current.expression) &&
			(current.expression.name.text === "setAttribute" || current.expression.name.text === "toggleAttribute") &&
			current.arguments[1] === child
		) {
			name = getStaticStringValue(current.arguments[0] as ts.Expression);
		} else if (ts.isReturnStatement(current) && current.expression === child) {
			for (let owner = current.parent; owner != null; owner = owner.parent) {
				if (isFunctionLikeNode(owner)) {
					name = getFunctionLikeName(owner);
					break;
				}
				if (ts.isSourceFile(owner)) break;
			}
		}

		const target = getImperativeDisplayTargetFromName(name);
		if (target != null) return target;
		if (isFunctionLikeNode(current)) {
			const producerTarget = getImperativeDisplayTargetFromName(getFunctionLikeName(current));
			if (producerTarget != null) return producerTarget;
		}
		if (ts.isSourceFile(current)) break;
	}

	return undefined;
}

function getImperativeDisplayTargetFromName(
	name: string | undefined,
): Extract<DisplayRole, { readonly kind: "imperative" }>["target"] | undefined {
	if (name == null) return undefined;
	if (/placeholder/iu.test(name)) return "placeholder";
	if (/tooltip/iu.test(name)) return "tooltip";
	if (/title/iu.test(name)) return "title";
	if (/label|displayName/iu.test(name)) return "label";
	if (/message|text/iu.test(name)) return "message";
	return undefined;
}

function isFunctionLikeNode(node: ts.Node): boolean {
	return (
		ts.isArrowFunction(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isSetAccessorDeclaration(node)
	);
}

function getFunctionLikeName(node: ts.Node): string | undefined {
	if (ts.isFunctionDeclaration(node)) return node.name?.text;
	if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
		return getPropertyName(node.name);
	}
	if (ts.isFunctionExpression(node) && node.name != null) return node.name.text;
	if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return undefined;

	const parent = node.parent;
	if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
	if (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) return getPropertyName(parent.name);
	return undefined;
}

function planJsxAttribute(node: ts.JsxAttribute, sourceFile: ts.SourceFile): PlannedSiteInput | undefined {
	const name = getJsxAttributeName(node.name);
	const tag = getJsxElementTagName(node);
	const role: DisplayRole = { kind: "attribute", name: name, tag: tag, binding: "attribute" };
	if (!shouldLocalizeDisplaySite(role) || node.initializer == null || !ts.isStringLiteral(node.initializer)) {
		return undefined;
	}
	if (!isTranslatableLiteralText(node.initializer.text)) return undefined;

	return {
		owner: getSemanticOwner(node, sourceFile),
		pattern: parseMessagePattern(node.initializer.text),
		role: role,
		replacement: {
			kind: "source",
			start: node.initializer.getStart(sourceFile),
			end: node.initializer.getEnd(),
			format: "jsx-attribute",
		},
	};
}

function planJsxText(node: ts.JsxText, sourceFile: ts.SourceFile): PlannedSiteInput | undefined {
	const text = normalizeJsxText(node.getText(sourceFile));
	if (!isTranslatableLiteralText(text)) return undefined;

	return {
		owner: getSemanticOwner(node, sourceFile),
		pattern: parseMessagePattern(text),
		role: { kind: "content" },
		replacement: {
			kind: "source",
			start: node.getStart(sourceFile),
			end: node.getEnd(),
			format: "jsx-text",
		},
	};
}

function planJsxDisplayExpression(node: ts.StringLiteralLike, sourceFile: ts.SourceFile): PlannedSiteInput | undefined {
	let child: ts.Node = node;
	for (let current = node.parent; current != null; child = current, current = current.parent) {
		if (ts.isJsxAttribute(current)) return undefined;
		if (!ts.isJsxExpression(current) || current.expression !== child) continue;

		const role: DisplayRole = ts.isJsxAttribute(current.parent)
			? {
					kind: "attribute",
					name: getJsxAttributeName(current.parent.name),
					tag: getJsxElementTagName(current.parent),
					binding: "attribute",
				}
			: { kind: "content" };
		if (
			!shouldLocalizeDisplaySite(role) ||
			!isTranslatableLiteralText(node.text) ||
			!looksLikeDisplayText(node.text, node)
		) {
			return undefined;
		}

		return {
			owner: getSemanticOwner(current, sourceFile),
			pattern: parseMessagePattern(node.text),
			role: role,
			replacement: {
				kind: "source",
				start: node.getStart(sourceFile),
				end: node.getEnd(),
				format: "string-literal",
			},
		};
	}

	return undefined;
}

function planLitDisplayExpression(
	node: ts.StringLiteralLike,
	sourceFile: ts.SourceFile,
	file: string,
	issues: CatalogIssue[],
): PlannedSiteInput | undefined {
	let child: ts.Node = node;
	let directDisplayExpression = true;
	for (let current = node.parent; current != null; child = current, current = current.parent) {
		if (!ts.isTemplateSpan(current) || current.expression !== child) {
			if (
				ts.isParenthesizedExpression(current) ||
				ts.isAsExpression(current) ||
				ts.isNonNullExpression(current) ||
				(ts.isConditionalExpression(current) && (current.whenTrue === child || current.whenFalse === child)) ||
				(ts.isBinaryExpression(current) &&
					(current.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
						current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
						current.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken))
			) {
				continue;
			}
			directDisplayExpression = false;
			continue;
		}
		if (!directDisplayExpression) return undefined;

		const template = current.parent;
		const taggedTemplate = template.parent;
		if (!ts.isTaggedTemplateExpression(taggedTemplate) || !isLitTemplateTag(taggedTemplate.tag)) return undefined;

		const slotIndex = template.templateSpans.indexOf(current);
		if (slotIndex === -1) return undefined;

		const slotContext = getSyntheticHtmlTemplateSlotContext(template, slotIndex);
		if (slotContext == null) return undefined;
		const role: DisplayRole =
			slotContext.kind === "text"
				? { kind: "content" }
				: {
						kind: "attribute",
						name: slotContext.attribute!,
						tag: slotContext.tag,
						binding: slotContext.binding!,
					};
		if (!isTranslatableLiteralText(node.text) || !looksLikeDisplayText(node.text, node)) {
			return undefined;
		}
		if (!shouldLocalizeDisplaySite(role)) {
			if (role.kind === "attribute" && role.binding !== "attribute") {
				issues.push({
					reference: { kind: "source", file: file, attribute: role.name },
					reason: `deferred webview ${role.binding} binding '${role.name}': ${node.text}`,
				});
			}
			return undefined;
		}

		return {
			owner: getSemanticOwner(taggedTemplate, sourceFile),
			pattern: parseMessagePattern(node.text),
			role: role,
			replacement: {
				kind: "source",
				start: node.getStart(sourceFile),
				end: node.getEnd(),
				format: "string-literal",
			},
		};
	}

	return undefined;
}

function planLitTemplate(node: ts.TaggedTemplateExpression, sourceFile: ts.SourceFile): PlannedSiteInput[] {
	if (node.getText(sourceFile).includes("localizeWebview")) return [];

	const fragment = buildSyntheticHtmlTemplateFragment(node.template);
	if (fragment.html.length === 0) return [];

	const root = parseHtmlDocument(fragment.html);
	const owner = getSemanticOwner(node, sourceFile);
	const templateStart = node.template.getStart(sourceFile);
	const templateEnd = node.template.getEnd();
	const contentSites: PlannedSiteInput[] = [];
	const attributeSites: PlannedSiteInput[] = [];

	if (shouldExtractRootContent(root)) {
		const pattern = collectElementContentPattern(root);
		if (pattern != null && pattern.text.trim().length !== 0 && !isPureStructuralTemplateText(pattern.text.trim())) {
			contentSites.push({
				owner: owner,
				pattern: parseMessagePattern(pattern.text),
				role: { kind: "content" },
				replacement: {
					kind: "lit-template",
					start: templateStart,
					end: templateEnd,
					innerStart: root.openTagEnd,
					innerEnd: root.closeTagStart,
				},
			});
		}
	}

	visitHtmlElements(root, (element) => {
		let current: HtmlElementNode | undefined = element;
		while (current != null) {
			if (shouldSkipLocalizationSubtree(current)) return;
			current = current.parent;
		}
		if (getClassList(element).includes("section__preview")) return;

		if (shouldExtractElementContent(element)) {
			const pattern = collectElementContentPattern(element);
			if (
				pattern != null &&
				pattern.text.trim().length !== 0 &&
				!isPureStructuralTemplateText(pattern.text.trim())
			) {
				contentSites.push({
					owner: owner,
					pattern: parseMessagePattern(pattern.text),
					role: { kind: "content" },
					replacement: {
						kind: "lit-template",
						start: templateStart,
						end: templateEnd,
						innerStart: element.openTagEnd,
						innerEnd: element.closeTagStart,
					},
				});
			}
		}

		const rawTag = fragment.html.slice(element.start, element.openTagEnd);
		for (const [name, value] of Object.entries(element.attributes)) {
			const role: DisplayRole = { kind: "attribute", tag: element.tag, name: name, binding: "attribute" };
			if (!shouldLocalizeDisplaySite(role) || !isTranslatableLiteralText(value)) continue;

			const range = findAttributeValueRange(rawTag, name);
			if (range == null) continue;
			attributeSites.push({
				owner: owner,
				pattern: parseMessagePattern(value),
				role: role,
				replacement: {
					kind: "lit-template",
					start: templateStart,
					end: templateEnd,
					innerStart: element.start + range.start,
					innerEnd: element.start + range.end,
					attribute: name,
				},
			});
		}
	});

	return [...contentSites, ...attributeSites];
}

function getSemanticOwner(node: ts.Node, sourceFile: ts.SourceFile): string {
	const parts: string[] = [];
	for (let current: ts.Node | undefined = node; current != null; current = current.parent) {
		if (
			ts.isMethodDeclaration(current) ||
			ts.isGetAccessorDeclaration(current) ||
			ts.isSetAccessorDeclaration(current)
		) {
			parts.unshift(current.name.getText(sourceFile));
			continue;
		}
		if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
			parts.unshift(current.name?.text ?? "<anonymous-class>");
			break;
		}
		if (ts.isFunctionDeclaration(current)) {
			parts.unshift(current.name?.text ?? "<anonymous-function>");
			break;
		}
		if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
			parts.unshift(current.name.text);
			continue;
		}
	}

	return parts.join(".") || "<module>";
}

function isLiteralUnionCallArgument(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	let argument: ts.Node = node;
	let parent = node.parent;
	while (
		parent != null &&
		(ts.isParenthesizedExpression(parent) ||
			ts.isAsExpression(parent) ||
			ts.isNonNullExpression(parent) ||
			(ts.isConditionalExpression(parent) && (parent.whenTrue === argument || parent.whenFalse === argument)))
	) {
		argument = parent;
		parent = parent.parent;
	}
	if (!ts.isCallExpression(parent)) return false;

	const parameterIndex = parent.arguments.indexOf(argument as ts.Expression);
	if (parameterIndex === -1 || !ts.isIdentifier(parent.expression)) return false;
	const functionName = parent.expression.text;

	let declaration: ts.FunctionDeclaration | undefined;
	const visit = (current: ts.Node): void => {
		if (declaration != null) return;
		if (ts.isFunctionDeclaration(current) && current.name?.text === functionName) {
			declaration = current;
			return;
		}
		ts.forEachChild(current, visit);
	};
	visit(sourceFile);

	const parameterType = declaration?.parameters[parameterIndex]?.type;
	if (parameterType == null) return false;
	const members = ts.isUnionTypeNode(parameterType) ? parameterType.types : [parameterType];
	return (
		members.length > 0 &&
		members.every((member) => ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal))
	);
}

function hasImperativeDisplayContextAncestor(node: ts.Node): boolean {
	for (let child: ts.Node = node, current = node.parent; current != null; child = current, current = current.parent) {
		if (ts.isPropertyAssignment(current) && current.initializer === child) {
			return getImperativeDisplayTarget(current.initializer) != null;
		}
		if (ts.isVariableDeclaration(current) && current.initializer === child) {
			return variableDeclarationFlowsToDisplay(current);
		}
		if (ts.isReturnStatement(current) && current.expression === child) {
			return returnStatementFlowsToNamedDisplayProducer(current);
		}
		if (ts.isArrowFunction(current) && current.body === child) {
			return getImperativeDisplayTargetFromName(getFunctionLikeName(current)) != null;
		}
		if (
			ts.isBinaryExpression(current) &&
			current.right === child &&
			current.operatorToken.kind === ts.SyntaxKind.EqualsToken
		) {
			return isDisplayAssignmentTarget(current.left);
		}
		if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
			const method = current.expression.name.text;
			if (
				(method === "setAttribute" || method === "toggleAttribute") &&
				current.arguments[1] === child &&
				getStaticStringValue(current.arguments[0] as ts.Expression) != null
			) {
				return true;
			}
		}
		if (ts.isSourceFile(current)) break;
	}

	return false;
}

function variableDeclarationFlowsToDisplay(node: ts.VariableDeclaration): boolean {
	if (!ts.isIdentifier(node.name) || node.initializer == null) return false;
	const variableName = node.name.text;

	let scopeRoot: ts.Node | undefined;
	for (let current: ts.Node | undefined = node.parent; current != null; current = current.parent) {
		if (
			ts.isBlock(current) ||
			ts.isCaseClause(current) ||
			ts.isCatchClause(current) ||
			ts.isDefaultClause(current) ||
			ts.isForInStatement(current) ||
			ts.isForOfStatement(current) ||
			ts.isForStatement(current) ||
			ts.isModuleBlock(current) ||
			ts.isSourceFile(current)
		) {
			scopeRoot = current;
			break;
		}
	}
	if (scopeRoot == null) return false;

	const usageContexts: boolean[] = [];
	const visit = (current: ts.Node): void => {
		if (current.getEnd() <= node.end) return;
		if (ts.isIdentifier(current) && current.text === variableName && isVariableUsageIdentifier(current)) {
			usageContexts.push(identifierFlowsToDisplay(current));
		}
		ts.forEachChild(current, visit);
	};
	ts.forEachChild(scopeRoot, visit);
	return usageContexts.length > 0 && usageContexts.every(Boolean);
}

function isVariableUsageIdentifier(node: ts.Identifier): boolean {
	const parent = node.parent;
	if (parent == null) return false;
	if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
	if (ts.isParameter(parent) && parent.name === node) return false;
	if (
		ts.isBinaryExpression(parent) &&
		parent.left === node &&
		parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
	) {
		return false;
	}
	if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
	if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
	if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) return false;
	if (ts.isBindingElement(parent) && parent.name === node) return false;
	if (ts.isImportClause(parent) || ts.isImportSpecifier(parent) || ts.isNamespaceImport(parent)) return false;
	if (ts.isExportSpecifier(parent)) return false;
	return true;
}

function identifierFlowsToDisplay(node: ts.Identifier): boolean {
	let current: ts.Node = node;
	let parent = node.parent;
	while (parent != null) {
		if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent)) {
			current = parent;
			parent = parent.parent;
			continue;
		}
		if (ts.isPropertyAccessExpression(parent) && parent.expression === current) return false;
		if (ts.isCallExpression(parent) && parent.expression === current) return false;
		if (ts.isTaggedTemplateExpression(parent) && parent.tag === current) return false;
		if (ts.isTemplateSpan(parent) && parent.expression === current) {
			const template = parent.parent;
			const taggedTemplate = template.parent;
			if (!ts.isTaggedTemplateExpression(taggedTemplate) || !isLitTemplateTag(taggedTemplate.tag)) {
				current = template;
				parent = template.parent;
				continue;
			}

			const slotIndex = template.templateSpans.indexOf(parent);
			const context = slotIndex === -1 ? undefined : getSyntheticHtmlTemplateSlotContext(template, slotIndex);
			if (context == null) return false;
			return context.kind === "text"
				? true
				: shouldLocalizeDisplaySite({
						kind: "attribute",
						name: context.attribute!,
						tag: context.tag,
						binding: context.binding!,
					});
		}
		if (ts.isReturnStatement(parent) && parent.expression === current) {
			return returnStatementFlowsToNamedDisplayProducer(parent);
		}
		if (ts.isJsxExpression(parent) && parent.expression === current) {
			if (!ts.isJsxAttribute(parent.parent)) return true;
			return shouldLocalizeDisplaySite({
				kind: "attribute",
				name: getJsxAttributeName(parent.parent.name),
				tag: getJsxElementTagName(parent.parent),
				binding: "attribute",
			});
		}
		if (
			ts.isBinaryExpression(parent) &&
			parent.right === current &&
			parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
		) {
			return isDisplayAssignmentTarget(parent.left);
		}
		if (ts.isPropertyAssignment(parent) && parent.initializer === current) {
			return getImperativeDisplayTarget(parent.initializer) != null;
		}
		if (ts.isConditionalExpression(parent)) {
			if (parent.whenTrue !== current && parent.whenFalse !== current) return false;
			current = parent;
			parent = parent.parent;
			continue;
		}
		if (
			ts.isBinaryExpression(parent) &&
			(parent.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
				parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
				parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
		) {
			current = parent;
			parent = parent.parent;
			continue;
		}
		return false;
	}

	return false;
}

function returnStatementFlowsToNamedDisplayProducer(node: ts.ReturnStatement): boolean {
	for (let current = node.parent; current != null; current = current.parent) {
		if (isFunctionLikeNode(current)) {
			return getImperativeDisplayTargetFromName(getFunctionLikeName(current)) != null;
		}
		if (ts.isSourceFile(current)) break;
	}
	return false;
}

function isDisplayAssignmentTarget(node: ts.Node): boolean {
	if (ts.isIdentifier(node))
		return /^(?:label|message|title|tooltip|placeholder|ariaLabel|validityMessage)$/iu.test(node.text);
	if (ts.isPropertyAccessExpression(node)) {
		return /^(?:label|message|title|tooltip|placeholder|ariaLabel|validityMessage)$/iu.test(node.name.text);
	}
	return false;
}

function looksLikeDisplayText(text: string, node: ts.StringLiteralLike | ts.TemplateExpression): boolean {
	const trimmed = text.trim();
	if (trimmed.length === 0 || isPureStructuralTemplateText(trimmed)) return false;
	if (/^\[[A-Z][A-Z0-9_-]*\]\s/u.test(trimmed)) return false;
	if (/^@[\w-]+\s+can only be used on\b/u.test(trimmed)) return false;
	if (/\b(?:var|color-mix|rgba?|hsla?)\(/iu.test(trimmed)) return false;
	if (/^[.#]?[a-z][\w-]*(?:--[\w-]+)+(?:\s+[.#]?[a-z][\w-]*(?:--[\w-]+)+)*$/u.test(trimmed)) {
		return false;
	}
	if (/[<>=]/u.test(text) && /\b(?:class|role|aria-|tabindex|href|slot|style|content)\b/u.test(text)) {
		return false;
	}
	if (/^(?:[.#]?[a-z][\w-]*)(?:\s+[.#]?[a-z][\w-]*)+$/u.test(trimmed)) return false;
	if (isFileCountUnitConditionalBranch(node)) return true;
	if (/^[a-z0-9_.:/-]+$/u.test(trimmed)) return false;
	if (/^[A-Z][A-Z0-9._-]*$/u.test(trimmed)) return false;
	if (/^[A-Z][a-z]+[A-Z][A-Za-z]*$/u.test(text)) return false;
	if (/^[A-Z][a-z]+ing(?:[.!?…]+)?$/u.test(trimmed)) return true;
	if (/\s/u.test(text)) return true;
	return /^[A-Z][a-z]+(?:\s|$)/u.test(text);
}

function isFileCountUnitConditionalBranch(node: ts.StringLiteralLike | ts.TemplateExpression): boolean {
	if (!ts.isStringLiteralLike(node) || (node.text !== "file" && node.text !== "files")) return false;
	const conditional = node.parent;
	if (!ts.isConditionalExpression(conditional)) return false;
	if (
		getStaticStringValue(conditional.whenTrue) !== "file" ||
		getStaticStringValue(conditional.whenFalse) !== "files"
	) {
		return false;
	}

	let current: ts.Node = conditional;
	let parent = conditional.parent;
	while (parent != null) {
		if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent)) {
			current = parent;
			parent = parent.parent;
			continue;
		}
		if (ts.isTemplateSpan(parent) && parent.expression === current) {
			const template = parent.parent;
			const taggedTemplate = template.parent;
			if (!ts.isTaggedTemplateExpression(taggedTemplate) || !isLitTemplateTag(taggedTemplate.tag)) return false;
			const slotIndex = template.templateSpans.indexOf(parent);
			const context = slotIndex === -1 ? undefined : getSyntheticHtmlTemplateSlotContext(template, slotIndex);
			return context?.kind === "text";
		}
		if (ts.isConditionalExpression(parent) && (parent.whenTrue === current || parent.whenFalse === current)) {
			current = parent;
			parent = parent.parent;
			continue;
		}
		return false;
	}
	return false;
}

function isPureStructuralTemplateText(text: string): boolean {
	const withoutSlots = text.replace(/\$\{slot\d+\}/gu, "");
	if (!/\$\{slot\d+\}/u.test(text)) return false;
	if (withoutSlots.length === 0 || /^[\s\p{P}\p{S}]+$/u.test(withoutSlots)) return true;

	const words = [...withoutSlots.matchAll(/\p{L}+/gu)].map((match) => match[0].toLowerCase());
	if (words.length === 0 || !words.every((word) => structuralGlueWords.has(word))) return false;
	return /^[\s\p{P}\p{S}]*$/u.test(withoutSlots.replace(/\p{L}+/gu, ""));
}

const structuralGlueWords = new Set([
	"a",
	"an",
	"and",
	"are",
	"at",
	"be",
	"been",
	"being",
	"by",
	"for",
	"from",
	"had",
	"has",
	"have",
	"in",
	"is",
	"more",
	"need",
	"needs",
	"of",
	"on",
	"or",
	"other",
	"require",
	"requires",
	"the",
	"to",
	"was",
	"were",
	"with",
]);

function isLitTemplateTag(tag: ts.LeftHandSideExpression): boolean {
	return ts.isIdentifier(tag) && tag.text === "html";
}

function getJsxAttributeName(name: ts.JsxAttributeName): string {
	return ts.isIdentifier(name) ? name.text : name.getText();
}

function getJsxElementTagName(node: ts.JsxAttribute): string | undefined {
	const owner = node.parent.parent;
	if (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner)) {
		return owner.tagName.getText().toLowerCase();
	}
	return undefined;
}

function getPropertyName(name: ts.PropertyName): string | undefined {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
	return undefined;
}

function getStaticStringValue(node: ts.Expression): string | undefined {
	if (ts.isStringLiteralLike(node)) return node.text;
	if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	return undefined;
}

function normalizeJsxText(text: string): string {
	return text.replace(/\s+/gu, " ").trim();
}
