import * as ts from "typescript";

import { getSyntheticHtmlTemplateSlotContext } from "./template.mts";

interface DisplayContextAdapter {
	readonly isHtmlTemplateTag: (tag: ts.LeftHandSideExpression, sourceFile: ts.SourceFile) => boolean;
	readonly getPropertyName: (name: ts.PropertyName) => string | undefined;
	readonly getStaticStringValue: (node: ts.Expression) => string | undefined;
	readonly getJsxAttributeName: (name: ts.JsxAttributeName) => string | undefined;
	readonly getJsxElementTagName: (node: ts.JsxAttribute) => string | undefined;
	readonly isTranslatableAttribute: (attribute: string, tag?: string) => boolean;
}

/** 创建共享 AST 判定器, 用于识别最终流向 HTML, JSX 或命令式 UI 的文本表达式. */
export function createDisplayContextAnalyzer(adapter: DisplayContextAdapter) {
	function hasHtmlTemplateAncestor(node: ts.Node, sourceFile: ts.SourceFile): boolean {
		for (let current = node.parent; current != null; current = current.parent) {
			if (ts.isTaggedTemplateExpression(current) && adapter.isHtmlTemplateTag(current.tag, sourceFile))
				return true;
			if (ts.isSourceFile(current)) break;
		}

		return false;
	}

	function hasRenderedJsxExpressionAncestor(node: ts.Node): boolean {
		for (let current = node.parent; current != null; current = current.parent) {
			if (ts.isJsxAttribute(current)) return false;
			if (ts.isJsxExpression(current)) return !ts.isJsxAttribute(current.parent);
			if (ts.isSourceFile(current)) break;
		}

		return false;
	}

	function isImperativeDisplayPropertyValue(parent: ts.Node | undefined): boolean {
		if (parent == null || !ts.isPropertyAssignment(parent)) return false;

		const propertyName = adapter.getPropertyName(parent.name);
		return (
			propertyName === "label" ||
			propertyName === "message" ||
			propertyName === "title" ||
			propertyName === "tooltip"
		);
	}

	function hasImperativeDisplayContextAncestor(node: ts.Node, sourceFile: ts.SourceFile): boolean {
		const withinDisplayProducer = hasDisplayProducingAncestor(node, sourceFile);

		for (
			let child: ts.Node = node, current = node.parent;
			current != null;
			child = current, current = current.parent
		) {
			if (isImperativeDisplayPropertyValue(current)) return true;
			if (ts.isVariableDeclaration(current) && current.initializer === child) {
				return variableDeclarationFlowsToDisplay(current);
			}
			if (ts.isReturnStatement(current) && current.expression === child) {
				return returnStatementFlowsToNamedDisplayProducer(current);
			}
			if (withinDisplayProducer) {
				if (isImperativeDisplayCallArgument(current, child)) return true;
				if (isImperativeDisplayAssignment(current, child)) return true;
			}
			if (ts.isSourceFile(current)) break;
		}

		return false;
	}

	function returnStatementFlowsToNamedDisplayProducer(node: ts.ReturnStatement): boolean {
		for (let current = node.parent; current != null; current = current.parent) {
			if (isFunctionLike(current)) {
				const name = getFunctionLikeName(current);
				return name != null && looksLikeTextReturnProducerName(name);
			}
			if (ts.isSourceFile(current)) break;
		}

		return false;
	}

	function hasDisplayProducingAncestor(node: ts.Node, sourceFile: ts.SourceFile): boolean {
		for (let current = node.parent; current != null; current = current.parent) {
			if (isFunctionLike(current) && functionProducesDisplay(current, sourceFile)) return true;
			if (ts.isSourceFile(current)) break;
		}

		return false;
	}

	function functionProducesDisplay(node: ts.Node, sourceFile: ts.SourceFile): boolean {
		const name = getFunctionLikeName(node);
		if (name != null && /(displayName|label|message|placeholder|render|text|title|tooltip)/iu.test(name))
			return true;

		const body = getFunctionLikeBody(node);
		if (body == null) return false;

		let found = false;
		const visit = (child: ts.Node): void => {
			if (found) return;
			if (ts.isTaggedTemplateExpression(child) && adapter.isHtmlTemplateTag(child.tag, sourceFile)) {
				found = true;
				return;
			}
			ts.forEachChild(child, visit);
		};
		visit(body);
		return found;
	}

	function looksLikeTextReturnProducerName(name: string): boolean {
		return /(displayName|label|message|placeholder|text|title|tooltip)/iu.test(name);
	}

	function isImperativeDisplayCallArgument(current: ts.Node, child: ts.Node): boolean {
		if (!ts.isCallExpression(current) || !ts.isPropertyAccessExpression(current.expression)) return false;

		const method = current.expression.name.text;
		return (
			(method === "setAttribute" || method === "toggleAttribute") &&
			current.arguments[1] === child &&
			adapter.getStaticStringValue(current.arguments[0] as ts.Expression) != null
		);
	}

	function isImperativeDisplayAssignment(current: ts.Node, child: ts.Node): boolean {
		return (
			ts.isBinaryExpression(current) &&
			current.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
			current.right === child &&
			isDisplayAssignmentTarget(current.left)
		);
	}

	function isDisplayAssignmentTarget(node: ts.Node): boolean {
		if (ts.isIdentifier(node)) return looksLikeDisplayAssignmentTargetName(node.text);
		if (ts.isPropertyAccessExpression(node)) return looksLikeDisplayAssignmentTargetName(node.name.text);
		return false;
	}

	function looksLikeDisplayAssignmentTargetName(name: string): boolean {
		return /^(?:label|message|title|tooltip|placeholder|ariaLabel|validityMessage)$/iu.test(name);
	}

	function variableDeclarationFlowsToDisplay(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name) || node.initializer == null) return false;
		const variableName = node.name.text;

		const scopeRoot = getVariableUsageScope(node);
		if (scopeRoot == null) return false;

		const usageContexts: Array<"display" | "non-display"> = [];
		const visit = (current: ts.Node): void => {
			if (current.getEnd() <= node.end) return;
			if (ts.isIdentifier(current) && current.text === variableName && isVariableUsageIdentifier(current)) {
				usageContexts.push(identifierFlowsToDisplay(current) ? "display" : "non-display");
			}
			ts.forEachChild(current, visit);
		};
		ts.forEachChild(scopeRoot, visit);

		return usageContexts.length > 0 && usageContexts.every((context) => context === "display");
	}

	function getVariableUsageScope(node: ts.VariableDeclaration): ts.Node | undefined {
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
				return current;
			}
		}

		return undefined;
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
				const templateContext = templateSpanDisplayContext(parent);
				if (templateContext != null) return templateContext;
				current = parent.parent;
				parent = current.parent;
				continue;
			}
			if (ts.isReturnStatement(parent) && parent.expression === current) {
				return returnStatementFlowsToNamedDisplayProducer(parent);
			}
			if (ts.isJsxExpression(parent) && parent.expression === current) return jsxExpressionDisplayContext(parent);
			if (ts.isJsxAttribute(parent)) {
				const attribute = adapter.getJsxAttributeName(parent.name);
				return (
					attribute != null &&
					adapter.isTranslatableAttribute(attribute, adapter.getJsxElementTagName(parent))
				);
			}
			if (
				ts.isBinaryExpression(parent) &&
				parent.right === current &&
				parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
			) {
				return isDisplayAssignmentTarget(parent.left);
			}
			if (ts.isPropertyAssignment(parent) && parent.initializer === current) {
				return isImperativeDisplayPropertyValue(parent);
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

	function templateSpanDisplayContext(span: ts.TemplateSpan): boolean | undefined {
		const template = span.parent;
		const templateParent = template.parent;
		if (!ts.isTaggedTemplateExpression(templateParent) || templateParent.template !== template) return undefined;
		if (
			!adapter.isHtmlTemplateTag(templateParent.tag, span.getSourceFile()) ||
			!ts.isTemplateExpression(template)
		) {
			return false;
		}

		const slotIndex = template.templateSpans.indexOf(span);
		if (slotIndex === -1) return false;

		const slotContext = getSyntheticHtmlTemplateSlotContext(template, slotIndex);
		if (slotContext == null) return false;
		if (slotContext.kind === "text") return true;
		return slotContext.attribute != null && adapter.isTranslatableAttribute(slotContext.attribute, slotContext.tag);
	}

	function jsxExpressionDisplayContext(node: ts.JsxExpression): boolean {
		const parent = node.parent;
		if (!ts.isJsxAttribute(parent)) return true;

		const attribute = adapter.getJsxAttributeName(parent.name);
		return attribute != null && adapter.isTranslatableAttribute(attribute, adapter.getJsxElementTagName(parent));
	}

	function isFunctionLike(node: ts.Node): boolean {
		return (
			ts.isArrowFunction(node) ||
			ts.isFunctionDeclaration(node) ||
			ts.isFunctionExpression(node) ||
			ts.isGetAccessorDeclaration(node) ||
			ts.isMethodDeclaration(node)
		);
	}

	function getFunctionLikeBody(node: ts.Node): ts.ConciseBody | undefined {
		if (!isFunctionLike(node)) return undefined;
		return (
			node as
				| ts.ArrowFunction
				| ts.FunctionDeclaration
				| ts.FunctionExpression
				| ts.GetAccessorDeclaration
				| ts.MethodDeclaration
		).body;
	}

	function getFunctionLikeName(node: ts.Node): string | undefined {
		if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) {
			return node.name?.getText();
		}
		if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.parent != null) {
			if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name))
				return node.parent.name.text;
			if (ts.isPropertyAssignment(node.parent)) return adapter.getPropertyName(node.parent.name);
		}
		return undefined;
	}

	return {
		hasHtmlTemplateAncestor: hasHtmlTemplateAncestor,
		hasRenderedJsxExpressionAncestor: hasRenderedJsxExpressionAncestor,
		hasImperativeDisplayContextAncestor: hasImperativeDisplayContextAncestor,
		isImperativeDisplayPropertyValue: isImperativeDisplayPropertyValue,
		templateSpanDisplayContext: templateSpanDisplayContext,
	};
}
