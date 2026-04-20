import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ContributesBuilder } from '../../scripts/contributions/contributionsBuilder.mts';
import type {
	Command,
	IconPath,
	PackageJson as GeneratedContributionsPackageJson,
	View,
} from '../../scripts/contributions/models';
import {
	contributionsPath,
	mergePackageNls,
	packageJsonPath,
	type PackageNlsDiff,
	type PackageNlsJson,
	packageNlsPath,
	packageNlsZhCnPath,
	readPackageNls,
	resolveNlsValue,
	syncPackageNlsZhCn,
} from './packageLocalization.mts';

type ManifestJsonObject = Record<string, unknown>;

type ConfigurationPropertySchema = ManifestJsonObject & {
	enum?: unknown[];
};

type ConfigurationCategory = ManifestJsonObject & {
	id: string;
	title?: string;
	properties?: Record<string, ConfigurationPropertySchema>;
};

type McpServerDefinitionProvider = {
	id: string;
	label?: string;
};

type ViewContainerContribution = {
	id: string;
	title?: string;
	icon?: IconPath;
};

type CustomEditorContribution = ManifestJsonObject & {
	viewType: string;
	displayName?: string;
};

type WalkthroughStepContribution = ManifestJsonObject & {
	id: string;
	title?: string;
	description?: string;
};

type WalkthroughContribution = ManifestJsonObject & {
	id: string;
	title?: string;
	description?: string;
	steps?: WalkthroughStepContribution[];
};

type ColorContribution = {
	id: string;
	description?: string;
	defaults?: ManifestJsonObject;
};

type ManifestPackageJson = GeneratedContributionsPackageJson & {
	contributes: GeneratedContributionsPackageJson['contributes'] & {
		mcpServerDefinitionProviders?: McpServerDefinitionProvider[];
		configuration?: ConfigurationCategory | ConfigurationCategory[];
		colors?: ColorContribution[];
		customEditors?: CustomEditorContribution[];
		viewsContainers?: Record<string, ViewContainerContribution[]>;
		walkthroughs?: WalkthroughContribution[];
	};
};

export type GeneratePackageManifestResult = {
	packageJsonChanged: boolean;
	packageNlsChanged: boolean;
	packageNlsZhCnChanged: boolean;
	packageNls: PackageNlsJson;
	packageNlsZhCn: PackageNlsJson;
	packageNlsZhCnDiff: PackageNlsDiff;
};

const localizableConfigurationScalarFields = new Set([
	'title',
	'description',
	'markdownDescription',
	'deprecationMessage',
	'markdownDeprecationMessage',
]);
const localizableConfigurationArrayFields = new Set(['enumDescriptions', 'markdownEnumDescriptions']);

export function generatePackageManifest(): GeneratePackageManifestResult {
	const builder = new ContributesBuilder();
	builder.load(contributionsPath);

	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as ManifestPackageJson;
	const existingPackageNls = readPackageNls(packageNlsPath);
	const existingPackageNlsZhCn = readPackageNls(packageNlsZhCnPath);
	const generatedPackageNls: PackageNlsJson = Object.create(null);
	const generatedContributes = localizeGeneratedContributions(builder.build(), generatedPackageNls);
	const localizedMcpServerDefinitionProviders = localizeMcpServerDefinitionProvidersContribution(
		packageJson.contributes.mcpServerDefinitionProviders,
		existingPackageNls,
		generatedPackageNls,
	);
	const localizedConfiguration = localizeConfigurationContribution(
		packageJson.contributes.configuration,
		existingPackageNls,
		generatedPackageNls,
	);
	const localizedColors = localizeColorsContribution(packageJson.contributes.colors, existingPackageNls);
	const localizedCustomEditors = localizeCustomEditorsContribution(
		packageJson.contributes.customEditors,
		existingPackageNls,
		generatedPackageNls,
	);
	const localizedViewsContainers = localizeViewsContainersContribution(
		packageJson.contributes.viewsContainers,
		existingPackageNls,
		generatedPackageNls,
	);
	const localizedWalkthroughs = localizeWalkthroughsContribution(
		packageJson.contributes.walkthroughs,
		existingPackageNls,
		generatedPackageNls,
	);

	const nextPackageJson = structuredClone(packageJson);
	nextPackageJson.contributes.commands = generatedContributes.commands;
	nextPackageJson.contributes.keybindings = generatedContributes.keybindings;
	nextPackageJson.contributes.menus = generatedContributes.menus;
	nextPackageJson.contributes.submenus = generatedContributes.submenus;
	nextPackageJson.contributes.views = generatedContributes.views;
	nextPackageJson.contributes.viewsWelcome = generatedContributes.viewsWelcome;
	if (localizedMcpServerDefinitionProviders != null) {
		nextPackageJson.contributes.mcpServerDefinitionProviders = localizedMcpServerDefinitionProviders;
	}
	if (localizedConfiguration != null) {
		nextPackageJson.contributes.configuration = localizedConfiguration;
	}
	if (localizedColors != null) {
		nextPackageJson.contributes.colors = localizedColors;
	}
	if (localizedCustomEditors != null) {
		nextPackageJson.contributes.customEditors = localizedCustomEditors;
	}
	if (localizedViewsContainers != null) {
		nextPackageJson.contributes.viewsContainers = localizedViewsContainers;
	}
	if (localizedWalkthroughs != null) {
		nextPackageJson.contributes.walkthroughs = localizedWalkthroughs;
	}

	const nextPackageNls = mergePackageNls(existingPackageNls, generatedPackageNls);
	const { catalog: nextPackageNlsZhCn, diff: packageNlsZhCnDiff } = syncPackageNlsZhCn(
		nextPackageNls,
		existingPackageNlsZhCn,
	);

	const packageJsonChanged = !areEqualJson(packageJson, nextPackageJson);
	const packageNlsChanged = !areEqualJson(existingPackageNls, nextPackageNls);
	const packageNlsZhCnChanged = !areEqualJson(existingPackageNlsZhCn, nextPackageNlsZhCn);

	if (packageNlsChanged) {
		writeJson(packageNlsPath, nextPackageNls);
	}

	if (packageNlsZhCnChanged) {
		writeJson(packageNlsZhCnPath, nextPackageNlsZhCn);
	}

	if (packageJsonChanged) {
		writeJson(packageJsonPath, nextPackageJson);
	}

	return {
		packageJsonChanged: packageJsonChanged,
		packageNlsChanged: packageNlsChanged,
		packageNlsZhCnChanged: packageNlsZhCnChanged,
		packageNls: nextPackageNls,
		packageNlsZhCn: nextPackageNlsZhCn,
		packageNlsZhCnDiff: packageNlsZhCnDiff,
	};
}

function localizeGeneratedContributions(
	contributions: GeneratedContributionsPackageJson['contributes'],
	generatedPackageNls: PackageNlsJson,
): GeneratedContributionsPackageJson['contributes'] {
	return {
		commands: contributions.commands.map(command => localizeCommand(command, generatedPackageNls)),
		keybindings: contributions.keybindings,
		menus: contributions.menus,
		submenus: contributions.submenus.map(submenu => ({
			...submenu,
			label: addNlsEntry(generatedPackageNls, getSubmenuLabelNlsKey(submenu.id), submenu.label),
		})),
		views: Object.fromEntries(
			Object.entries(contributions.views).map(([container, views]) => [
				container,
				views.map(view => localizeView(view, generatedPackageNls)),
			]),
		),
		viewsWelcome: contributions.viewsWelcome.map(viewWelcome => ({
			...viewWelcome,
			contents: addNlsEntry(
				generatedPackageNls,
				getViewWelcomeContentsNlsKey(viewWelcome.view, viewWelcome.contents, viewWelcome.when),
				viewWelcome.contents,
			),
		})),
	};
}

function localizeCommand(command: Command, generatedPackageNls: PackageNlsJson): Command {
	return {
		...command,
		title: addNlsEntry(generatedPackageNls, getCommandTitleNlsKey(command.command), command.title),
	};
}

function localizeView(view: View, generatedPackageNls: PackageNlsJson): View {
	return {
		...view,
		name: addNlsEntry(generatedPackageNls, getViewNameNlsKey(view.id), view.name),
		contextualTitle:
			view.contextualTitle == null
				? undefined
				: addNlsEntry(generatedPackageNls, getViewContextualTitleNlsKey(view.id), view.contextualTitle),
	};
}

function localizeConfigurationContribution(
	configuration: ConfigurationCategory | ConfigurationCategory[] | undefined,
	existingPackageNls: PackageNlsJson,
	generatedPackageNls: PackageNlsJson,
): ConfigurationCategory | ConfigurationCategory[] | undefined {
	if (configuration == null) return configuration;

	if (Array.isArray(configuration)) {
		return configuration.map(category =>
			localizeConfigurationCategory(category, existingPackageNls, generatedPackageNls),
		);
	}

	return localizeConfigurationCategory(configuration, existingPackageNls, generatedPackageNls);
}

function localizeMcpServerDefinitionProvidersContribution(
	providers: McpServerDefinitionProvider[] | undefined,
	existingPackageNls: PackageNlsJson,
	generatedPackageNls: PackageNlsJson,
): McpServerDefinitionProvider[] | undefined {
	if (providers == null) return providers;

	return providers.map(provider => {
		const next: McpServerDefinitionProvider = { ...provider };

		if (typeof provider.label === 'string') {
			next.label = localizePackageJsonString(
				provider.label,
				getMcpServerDefinitionProviderLabelNlsKey(provider.id),
				existingPackageNls,
				generatedPackageNls,
			);
		}

		return next;
	});
}

function localizeConfigurationCategory(
	category: ConfigurationCategory,
	existingPackageNls: PackageNlsJson,
	generatedPackageNls: PackageNlsJson,
): ConfigurationCategory {
	const next: ConfigurationCategory = { ...category };

	if (typeof category.title === 'string') {
		next.title = localizePackageJsonString(
			category.title,
			getConfigurationCategoryTitleNlsKey(category.id),
			existingPackageNls,
			generatedPackageNls,
		);
	}

	if (isRecord(category.properties)) {
		next.properties = Object.fromEntries(
			Object.entries(category.properties).map(([settingId, schema]) => [
				settingId,
				isRecord(schema)
					? localizeConfigurationSchema(schema, existingPackageNls, generatedPackageNls, [
							'settings',
							settingId,
						])
					: schema,
			]),
		);
	}

	return next;
}

function localizeConfigurationSchema(
	schema: ConfigurationPropertySchema,
	existingPackageNls: PackageNlsJson,
	generatedPackageNls: PackageNlsJson,
	ownerSegments: string[],
): ConfigurationPropertySchema {
	const next: ConfigurationPropertySchema = {};

	for (const [key, value] of Object.entries(schema)) {
		if (localizableConfigurationScalarFields.has(key) && typeof value === 'string') {
			next[key] = localizePackageJsonString(
				value,
				getConfigurationFieldNlsKey(ownerSegments, [key]),
				existingPackageNls,
				generatedPackageNls,
			);
			continue;
		}

		if (localizableConfigurationArrayFields.has(key) && Array.isArray(value)) {
			next[key] = value.map((item, index) => {
				if (typeof item !== 'string') return item;

				return localizePackageJsonString(
					item,
					getConfigurationFieldNlsKey(ownerSegments, [key, getEnumDescriptionIdentity(schema, index)]),
					existingPackageNls,
					generatedPackageNls,
				);
			});
			continue;
		}

		if (isRecord(value)) {
			next[key] = localizeConfigurationSchema(value, existingPackageNls, generatedPackageNls, [
				...ownerSegments,
				key,
			]);
			continue;
		}

		if (Array.isArray(value)) {
			next[key] = value.map((item, index) =>
				isRecord(item)
					? localizeConfigurationSchema(item, existingPackageNls, generatedPackageNls, [
							...ownerSegments,
							key,
							String(index),
						])
					: item,
			);
			continue;
		}

		next[key] = value;
	}

	return next;
}

function localizeColorsContribution(
	colors: ColorContribution[] | undefined,
	existingPackageNls: PackageNlsJson,
): ColorContribution[] | undefined {
	if (colors == null) return colors;

	return colors.map(color => {
		const next: ColorContribution = { ...color };

		if (typeof color.description === 'string') {
			next.description = resolvePackageJsonString(color.description, existingPackageNls);
		}

		return next;
	});
}

function localizeCustomEditorsContribution(
	customEditors: CustomEditorContribution[] | undefined,
	existingPackageNls: PackageNlsJson,
	generatedPackageNls: PackageNlsJson,
): CustomEditorContribution[] | undefined {
	if (customEditors == null) return customEditors;

	return customEditors.map(customEditor => {
		const next: CustomEditorContribution = { ...customEditor };

		if (typeof customEditor.displayName === 'string') {
			next.displayName = localizePackageJsonString(
				customEditor.displayName,
				getCustomEditorDisplayNameNlsKey(customEditor.viewType),
				existingPackageNls,
				generatedPackageNls,
			);
		}

		return next;
	});
}

function getEnumDescriptionIdentity(schema: ConfigurationPropertySchema, index: number): string {
	if (!Array.isArray(schema.enum) || index >= schema.enum.length) {
		return String(index);
	}

	const value = schema.enum[index];
	if (typeof value === 'string') {
		const normalized = normalizeNlsKeyPart(value);
		return normalized || String(index);
	}

	const normalized = normalizeNlsKeyPart(JSON.stringify(value));
	return normalized || String(index);
}

function getCommandTitleNlsKey(commandId: string): string {
	return `commands.${normalizeNlsKeyPart(commandId)}.title`;
}

function getConfigurationCategoryTitleNlsKey(categoryId: string): string {
	return getConfigurationFieldNlsKey(['categories', categoryId], ['title']);
}

function getConfigurationFieldNlsKey(ownerSegments: string[], fieldSegments: string[]): string {
	return getContributionFieldNlsKey('configuration', ownerSegments, fieldSegments);
}

function getContributionFieldNlsKey(prefix: string, ownerSegments: string[], fieldSegments: string[]): string {
	const segments = [...ownerSegments, ...fieldSegments].map(segment => normalizeNlsKeyPart(segment));
	return `${prefix}.${segments.join('.')}`;
}

function getCustomEditorDisplayNameNlsKey(viewType: string): string {
	return getContributionFieldNlsKey('customEditors', [viewType], ['displayName']);
}

function getMcpServerDefinitionProviderLabelNlsKey(providerId: string): string {
	return getContributionFieldNlsKey('mcpServerDefinitionProviders', [providerId], ['label']);
}

function localizePackageJsonString(
	value: string,
	key: string,
	existingPackageNls: PackageNlsJson,
	generatedPackageNls: PackageNlsJson,
): string {
	return addNlsEntry(generatedPackageNls, key, resolvePackageJsonString(value, existingPackageNls));
}

function resolvePackageJsonString(value: string, existingPackageNls: PackageNlsJson): string {
	return resolveNlsValue(value, existingPackageNls) ?? value;
}

function getSubmenuLabelNlsKey(submenuId: string): string {
	return `submenus.${normalizeNlsKeyPart(submenuId)}.label`;
}

function getViewsContainerTitleNlsKey(location: string, containerId: string): string {
	return getContributionFieldNlsKey('viewsContainers', [location, containerId], ['title']);
}

function localizeViewsContainersContribution(
	containers: Record<string, ViewContainerContribution[]> | undefined,
	existingPackageNls: PackageNlsJson,
	generatedPackageNls: PackageNlsJson,
): Record<string, ViewContainerContribution[]> | undefined {
	if (containers == null) return containers;

	return Object.fromEntries(
		Object.entries(containers).map(([location, items]) => [
			location,
			items.map(item => {
				const next: ViewContainerContribution = { ...item };

				if (typeof item.title === 'string') {
					next.title = localizePackageJsonString(
						item.title,
						getViewsContainerTitleNlsKey(location, item.id),
						existingPackageNls,
						generatedPackageNls,
					);
				}

				return next;
			}),
		]),
	);
}

function getViewNameNlsKey(viewId: string): string {
	return `views.${normalizeNlsKeyPart(viewId)}.name`;
}

function getViewContextualTitleNlsKey(viewId: string): string {
	return `views.${normalizeNlsKeyPart(viewId)}.contextualTitle`;
}

function getViewWelcomeContentsNlsKey(viewId: string, contents: string, when: string | undefined): string {
	const hash = createHash('sha256')
		.update(`${contents}\n${when ?? ''}`)
		.digest('hex')
		.slice(0, 8);

	return `viewsWelcome.${normalizeNlsKeyPart(viewId)}.${hash}.contents`;
}

function getWalkthroughFieldNlsKey(walkthroughId: string, field: 'title' | 'description'): string {
	return getContributionFieldNlsKey('walkthroughs', [walkthroughId], [field]);
}

function getWalkthroughStepFieldNlsKey(walkthroughId: string, stepId: string, field: 'title' | 'description'): string {
	return getContributionFieldNlsKey('walkthroughs', [walkthroughId, 'steps', stepId], [field]);
}

function localizeWalkthroughsContribution(
	walkthroughs: WalkthroughContribution[] | undefined,
	existingPackageNls: PackageNlsJson,
	generatedPackageNls: PackageNlsJson,
): WalkthroughContribution[] | undefined {
	if (walkthroughs == null) return walkthroughs;

	return walkthroughs.map(walkthrough => {
		const next: WalkthroughContribution = { ...walkthrough };

		if (typeof walkthrough.title === 'string') {
			next.title = localizePackageJsonString(
				walkthrough.title,
				getWalkthroughFieldNlsKey(walkthrough.id, 'title'),
				existingPackageNls,
				generatedPackageNls,
			);
		}

		if (typeof walkthrough.description === 'string') {
			next.description = localizePackageJsonString(
				walkthrough.description,
				getWalkthroughFieldNlsKey(walkthrough.id, 'description'),
				existingPackageNls,
				generatedPackageNls,
			);
		}

		if (Array.isArray(walkthrough.steps)) {
			next.steps = walkthrough.steps.map(step => {
				const nextStep: WalkthroughStepContribution = { ...step };

				if (typeof step.title === 'string') {
					nextStep.title = localizePackageJsonString(
						step.title,
						getWalkthroughStepFieldNlsKey(walkthrough.id, step.id, 'title'),
						existingPackageNls,
						generatedPackageNls,
					);
				}

				if (typeof step.description === 'string') {
					nextStep.description = localizePackageJsonString(
						step.description,
						getWalkthroughStepFieldNlsKey(walkthrough.id, step.id, 'description'),
						existingPackageNls,
						generatedPackageNls,
					);
				}

				return nextStep;
			});
		}

		return next;
	});
}

function addNlsEntry(packageNls: PackageNlsJson, key: string, value: string): string {
	const current = packageNls[key];
	if (current != null && current !== value) {
		throw new Error(`package NLS 条目 '${key}' 存在冲突：'${current}' !== '${value}'`);
	}

	packageNls[key] = value;
	return `%${key}%`;
}

function normalizeNlsKeyPart(value: string): string {
	const normalized = value
		.replace(/[^A-Za-z0-9]+/g, '.')
		.replace(/\.{2,}/g, '.')
		.replace(/^\.|\.$/g, '');
	return normalized || 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value != null && !Array.isArray(value);
}

function areEqualJson(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function writeJson(filePath: string, value: unknown): void {
	writeFileSync(filePath, `${JSON.stringify(value, undefined, '\t')}\n`, 'utf8');
}

function printCliResult(result: GeneratePackageManifestResult): void {
	if (!result.packageJsonChanged && !result.packageNlsChanged && !result.packageNlsZhCnChanged) {
		console.log('已跳过本地化 package 清单生成；未检测到变更。');
	} else {
		if (result.packageJsonChanged) {
			console.log("已生成 'package.json'。");
		}

		if (result.packageNlsChanged) {
			console.log("已生成 'package.nls.json'。");
		}

		if (result.packageNlsZhCnChanged) {
			console.log("已生成 'package.nls.zh-cn.json'。");
		} else {
			console.log("已跳过 'package.nls.zh-cn.json'；内容已同步。");
		}
	}

	console.log(
		`package.nls.zh-cn.json 摘要：新增 ${result.packageNlsZhCnDiff.added.length} 项，更新 ${result.packageNlsZhCnDiff.updated.length} 项，移除 ${result.packageNlsZhCnDiff.removed.length} 项，未变更 ${result.packageNlsZhCnDiff.unchanged.length} 项。`,
	);
}

const isMain = process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
	printCliResult(generatePackageManifest());
}
