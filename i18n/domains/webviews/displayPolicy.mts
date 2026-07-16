import type { SyntheticHtmlTemplateBinding } from "./template.mts";

export type DisplayRole =
	| { readonly kind: "content" }
	| {
			readonly kind: "attribute";
			readonly name: string;
			readonly tag?: string;
			readonly binding: SyntheticHtmlTemplateBinding;
	  }
	| {
			readonly kind: "imperative";
			readonly target: "label" | "message" | "placeholder" | "title" | "tooltip";
	  };

const translatableAttributes = new Set([
	"title",
	"aria-label",
	"placeholder",
	"tooltip",
	"label",
	"alt-label",
	"banner-title",
	"primary-button",
	"secondary-button",
]);
const translatableTagAttributes = new Set(["gl-tooltip:content"]);

export function shouldLocalizeDisplaySite(role: DisplayRole): boolean {
	if (role.kind === "content" || role.kind === "imperative") return true;
	if (role.binding !== "attribute") return false;

	const name = role.name.toLowerCase();
	return translatableAttributes.has(name) || translatableTagAttributes.has(`${role.tag?.toLowerCase()}:${name}`);
}
