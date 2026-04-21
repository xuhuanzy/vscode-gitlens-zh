import type { CatalogIssue, JsonPathSegment, SourceOccurrence } from '../../core/model.mts';
import {
	createAuthorityId,
	createContentHash,
	createJsonSourceReference,
	createOccurrenceId,
	createPatternFingerprint,
	parseMessagePattern,
	sanitizeKeySegment,
	shortHash,
} from '../../core/model.mts';

export interface ManifestExtractionResult {
	readonly occurrences: SourceOccurrence[];
	readonly issues: CatalogIssue[];
}

interface OccurrenceInput {
	readonly scope: string;
	readonly anchor: string;
	readonly key: string;
	readonly slot: string;
	readonly pathSegments: JsonPathSegment[];
	readonly sourceText: string;
	readonly businessId?: string;
}

interface ResolvedSource {
	readonly sourceText: string;
	readonly missingTokenKey?: string;
}

const translatableSettingFields = [
	'description',
	'markdownDescription',
	'deprecationMessage',
	'markdownDeprecationMessage',
] as const;

export function extractManifestOccurrences(
	manifest: Record<string, unknown>,
	englishNls: Record<string, string>,
): ManifestExtractionResult {
	const occurrences: SourceOccurrence[] = [];
	const issues: CatalogIssue[] = [];
	const seenOutputKeys = new Map<string, SourceOccurrence>();

	addIfString(manifest.displayName, {
		scope: 'manifest.extension',
		anchor: 'manifest.extension',
		key: 'extension.displayName',
		slot: 'displayName',
		pathSegments: ['displayName'],
	});
	addIfString(manifest.description, {
		scope: 'manifest.extension',
		anchor: 'manifest.extension',
		key: 'extension.description',
		slot: 'description',
		pathSegments: ['description'],
	});

	const badges = asArray(manifest.badges);
	for (const [index, badge] of badges.entries()) {
		const description = asObject(badge).description;
		const identity = getPreferredId(asObject(badge).href, asObject(badge).url, `badge-${index + 1}`);
		addIfString(description, {
			scope: 'manifest.badge',
			anchor: `manifest.badge.${identity}`,
			key: `badges.${identity}.description`,
			slot: 'description',
			pathSegments: ['badges', index, 'description'],
			businessId: identity,
		});
	}

	const contributes = asObject(manifest.contributes);
	extractMcpLabels(contributes.mcpServerDefinitionProviders, englishNls, addIfString);
	extractConfiguration(contributes.configuration, englishNls, addIfString);
	extractCommands(contributes.commands, englishNls, addIfString);
	extractSubmenus(contributes.submenus, englishNls, addIfString);
	extractViewsContainers(contributes.viewsContainers, englishNls, addIfString);
	extractViews(contributes.views, englishNls, addIfString);
	extractViewsWelcome(contributes.viewsWelcome, englishNls, addIfString);
	extractWalkthroughs(contributes.walkthroughs, englishNls, addIfString);

	return {
		occurrences: occurrences,
		issues: issues,
	};

	function addIfString(
		value: unknown,
		definition: Omit<OccurrenceInput, 'sourceText'>,
	): void {
		if (typeof value !== 'string' || value.length === 0) return;

		const resolved = resolveSource(value, englishNls);
		if (resolved.missingTokenKey != null) {
			issues.push({
				occurrenceId: createOccurrenceId('manifest', definition.anchor, definition.slot),
				anchor: definition.anchor,
				reference: createJsonSourceReference('package.json', definition.pathSegments),
				output: createManifestKeyOutputReference(definition.key),
				reason: `Missing english package.nls entry for token '${resolved.missingTokenKey}'`,
			});
			return;
		}

		const occurrence = createOccurrence({
			...definition,
			sourceText: resolved.sourceText,
		});

		const existing = seenOutputKeys.get(definition.key);
		if (existing != null) {
			issues.push({
				occurrenceId: occurrence.id,
				anchor: occurrence.anchor,
				reference: occurrence.reference,
				output: occurrence.output,
				reason: `Duplicate manifest localization key detected for '${definition.key}'`,
			});
			return;
		}

		seenOutputKeys.set(definition.key, occurrence);
		occurrences.push(occurrence);
	}
}

function extractMcpLabels(
	providersValue: unknown,
	englishNls: Record<string, string>,
	addIfString: (value: unknown, definition: Omit<OccurrenceInput, 'sourceText'>) => void,
): void {
	const providers = asArray(providersValue);
	for (const [index, provider] of providers.entries()) {
		const record = asObject(provider);
		if (typeof record.id !== 'string') continue;

		addIfString(resolvePotentialToken(record.label, englishNls), {
			scope: 'manifest.mcpServerDefinitionProvider',
			anchor: `manifest.mcpServerDefinitionProvider.${record.id}`,
			key: `contributes.mcpServerDefinitionProviders.${sanitizeKeySegment(record.id)}.label`,
			slot: 'label',
			pathSegments: ['contributes', 'mcpServerDefinitionProviders', index, 'label'],
			businessId: record.id,
		});
	}
}

function extractConfiguration(
	configurationValue: unknown,
	englishNls: Record<string, string>,
	addIfString: (value: unknown, definition: Omit<OccurrenceInput, 'sourceText'>) => void,
): void {
	const sections = asArray(configurationValue);
	for (const [sectionIndex, sectionValue] of sections.entries()) {
		const section = asObject(sectionValue);
		if (typeof section.id === 'string') {
			addIfString(resolvePotentialToken(section.title, englishNls), {
				scope: 'manifest.configuration.section',
				anchor: `manifest.configuration.section.${section.id}`,
				key: `contributes.configuration.${sanitizeKeySegment(section.id)}.title`,
				slot: 'title',
				pathSegments: ['contributes', 'configuration', sectionIndex, 'title'],
				businessId: section.id,
			});
		}

		const properties = asObject(section.properties);
		for (const [settingKey, propertyValue] of Object.entries(properties)) {
			const property = asObject(propertyValue);
			for (const field of translatableSettingFields) {
				addIfString(resolvePotentialToken(property[field], englishNls), {
					scope: 'manifest.configuration.property',
					anchor: `manifest.configuration.property.${settingKey}`,
					key: `contributes.configuration.${sanitizeKeySegment(settingKey)}.${field}`,
					slot: field,
					pathSegments: ['contributes', 'configuration', sectionIndex, 'properties', settingKey, field],
					businessId: settingKey,
				});
			}

			const enumDescriptions = asArray(property.enumDescriptions);
			for (const [enumIndex, enumDescription] of enumDescriptions.entries()) {
				addIfString(resolvePotentialToken(enumDescription, englishNls), {
					scope: 'manifest.configuration.property',
					anchor: `manifest.configuration.property.${settingKey}.enumDescriptions`,
					key: `contributes.configuration.${sanitizeKeySegment(settingKey)}.enumDescriptions.${enumIndex + 1}`,
					slot: `item-${enumIndex + 1}`,
					pathSegments: [
						'contributes',
						'configuration',
						sectionIndex,
						'properties',
						settingKey,
						'enumDescriptions',
						enumIndex,
					],
					businessId: settingKey,
				});
			}
		}
	}
}

function extractCommands(
	commandsValue: unknown,
	englishNls: Record<string, string>,
	addIfString: (value: unknown, definition: Omit<OccurrenceInput, 'sourceText'>) => void,
): void {
	const commands = asArray(commandsValue);
	for (const [index, commandValue] of commands.entries()) {
		const command = asObject(commandValue);
		if (typeof command.command !== 'string') continue;

		const commandId = sanitizeKeySegment(command.command);
		addIfString(resolvePotentialToken(command.title, englishNls), {
			scope: 'manifest.command',
			anchor: `manifest.command.${command.command}`,
			key: `contributes.commands.${commandId}.title`,
			slot: 'title',
			pathSegments: ['contributes', 'commands', index, 'title'],
			businessId: command.command,
		});
		addIfString(resolvePotentialToken(command.category, englishNls), {
			scope: 'manifest.command',
			anchor: `manifest.command.${command.command}`,
			key: `contributes.commands.${commandId}.category`,
			slot: 'category',
			pathSegments: ['contributes', 'commands', index, 'category'],
			businessId: command.command,
		});
	}
}

function extractSubmenus(
	submenusValue: unknown,
	englishNls: Record<string, string>,
	addIfString: (value: unknown, definition: Omit<OccurrenceInput, 'sourceText'>) => void,
): void {
	const submenus = asArray(submenusValue);
	for (const [index, submenuValue] of submenus.entries()) {
		const submenu = asObject(submenuValue);
		if (typeof submenu.id !== 'string') continue;

		addIfString(resolvePotentialToken(submenu.label, englishNls), {
			scope: 'manifest.submenu',
			anchor: `manifest.submenu.${submenu.id}`,
			key: `contributes.submenus.${sanitizeKeySegment(submenu.id)}.label`,
			slot: 'label',
			pathSegments: ['contributes', 'submenus', index, 'label'],
			businessId: submenu.id,
		});
	}
}

function extractViewsContainers(
	viewsContainersValue: unknown,
	englishNls: Record<string, string>,
	addIfString: (value: unknown, definition: Omit<OccurrenceInput, 'sourceText'>) => void,
): void {
	const viewsContainers = asObject(viewsContainersValue);
	for (const [location, containersValue] of Object.entries(viewsContainers)) {
		const containers = asArray(containersValue);
		for (const [index, containerValue] of containers.entries()) {
			const container = asObject(containerValue);
			if (typeof container.id !== 'string') continue;

			addIfString(resolvePotentialToken(container.title, englishNls), {
				scope: 'manifest.viewsContainer',
				anchor: `manifest.viewsContainer.${location}.${container.id}`,
				key: `contributes.viewsContainers.${sanitizeKeySegment(location)}.${sanitizeKeySegment(container.id)}.title`,
				slot: 'title',
				pathSegments: ['contributes', 'viewsContainers', location, index, 'title'],
				businessId: container.id,
			});
		}
	}
}

function extractViews(
	viewsValue: unknown,
	englishNls: Record<string, string>,
	addIfString: (value: unknown, definition: Omit<OccurrenceInput, 'sourceText'>) => void,
): void {
	const views = asObject(viewsValue);
	for (const [containerId, viewListValue] of Object.entries(views)) {
		const viewList = asArray(viewListValue);
		for (const [index, viewValue] of viewList.entries()) {
			const view = asObject(viewValue);
			if (typeof view.id !== 'string') continue;

			const keyPrefix = `contributes.views.${sanitizeKeySegment(view.id)}`;
			addIfString(resolvePotentialToken(view.name, englishNls), {
				scope: 'manifest.view',
				anchor: `manifest.view.${view.id}`,
				key: `${keyPrefix}.name`,
				slot: 'name',
				pathSegments: ['contributes', 'views', containerId, index, 'name'],
				businessId: view.id,
			});
			addIfString(resolvePotentialToken(view.contextualTitle, englishNls), {
				scope: 'manifest.view',
				anchor: `manifest.view.${view.id}`,
				key: `${keyPrefix}.contextualTitle`,
				slot: 'contextualTitle',
				pathSegments: ['contributes', 'views', containerId, index, 'contextualTitle'],
				businessId: view.id,
			});
		}
	}
}

function extractViewsWelcome(
	viewsWelcomeValue: unknown,
	englishNls: Record<string, string>,
	addIfString: (value: unknown, definition: Omit<OccurrenceInput, 'sourceText'>) => void,
): void {
	const welcomes = asArray(viewsWelcomeValue);
	const selectorCounts = new Map<string, number>();

	for (const [index, welcomeValue] of welcomes.entries()) {
		const welcome = asObject(welcomeValue);
		if (typeof welcome.view !== 'string') continue;

		const baseSelector = getConditionalSegment(welcome.when, index);
		const duplicateId = `${welcome.view}\u0000${baseSelector}`;
		selectorCounts.set(duplicateId, (selectorCounts.get(duplicateId) ?? 0) + 1);
	}

	for (const [index, welcomeValue] of welcomes.entries()) {
		const welcome = asObject(welcomeValue);
		if (typeof welcome.view !== 'string') continue;

		const baseSelector = getConditionalSegment(welcome.when, index);
		const duplicateId = `${welcome.view}\u0000${baseSelector}`;
		const selector =
			(selectorCounts.get(duplicateId) ?? 0) > 1 ? `${baseSelector}.slot-${index + 1}` : baseSelector;
		const slot = (selectorCounts.get(duplicateId) ?? 0) > 1 ? `contents.${index + 1}` : 'contents';
		addIfString(resolvePotentialToken(welcome.contents, englishNls), {
			scope: 'manifest.viewsWelcome',
			anchor: `manifest.viewsWelcome.${welcome.view}.${baseSelector}`,
			key: `contributes.viewsWelcome.${sanitizeKeySegment(welcome.view)}.${selector}.contents`,
			slot: slot,
			pathSegments: ['contributes', 'viewsWelcome', index, 'contents'],
			businessId: welcome.view,
		});
	}
}

function extractWalkthroughs(
	walkthroughsValue: unknown,
	englishNls: Record<string, string>,
	addIfString: (value: unknown, definition: Omit<OccurrenceInput, 'sourceText'>) => void,
): void {
	const walkthroughs = asArray(walkthroughsValue);
	for (const [walkthroughIndex, walkthroughValue] of walkthroughs.entries()) {
		const walkthrough = asObject(walkthroughValue);
		if (typeof walkthrough.id !== 'string') continue;

		const walkthroughId = sanitizeKeySegment(walkthrough.id);
		addIfString(resolvePotentialToken(walkthrough.title, englishNls), {
			scope: 'manifest.walkthrough',
			anchor: `manifest.walkthrough.${walkthrough.id}`,
			key: `contributes.walkthroughs.${walkthroughId}.title`,
			slot: 'title',
			pathSegments: ['contributes', 'walkthroughs', walkthroughIndex, 'title'],
			businessId: walkthrough.id,
		});
		addIfString(resolvePotentialToken(walkthrough.description, englishNls), {
			scope: 'manifest.walkthrough',
			anchor: `manifest.walkthrough.${walkthrough.id}`,
			key: `contributes.walkthroughs.${walkthroughId}.description`,
			slot: 'description',
			pathSegments: ['contributes', 'walkthroughs', walkthroughIndex, 'description'],
			businessId: walkthrough.id,
		});

		const steps = asArray(walkthrough.steps);
		for (const [stepIndex, stepValue] of steps.entries()) {
			const step = asObject(stepValue);
			const stepId = typeof step.id === 'string' ? sanitizeKeySegment(step.id) : `step-${stepIndex + 1}`;
			addIfString(resolvePotentialToken(step.title, englishNls), {
				scope: 'manifest.walkthrough.step',
				anchor: `manifest.walkthrough.${walkthrough.id}.step.${stepId}`,
				key: `contributes.walkthroughs.${walkthroughId}.steps.${stepId}.title`,
				slot: 'title',
				pathSegments: ['contributes', 'walkthroughs', walkthroughIndex, 'steps', stepIndex, 'title'],
				businessId: `${walkthrough.id}:${stepId}`,
			});
			addIfString(resolvePotentialToken(step.description, englishNls), {
				scope: 'manifest.walkthrough.step',
				anchor: `manifest.walkthrough.${walkthrough.id}.step.${stepId}`,
				key: `contributes.walkthroughs.${walkthroughId}.steps.${stepId}.description`,
				slot: 'description',
				pathSegments: ['contributes', 'walkthroughs', walkthroughIndex, 'steps', stepIndex, 'description'],
				businessId: `${walkthrough.id}:${stepId}`,
			});
		}
	}
}

function createOccurrence(input: OccurrenceInput): SourceOccurrence {
	const pattern = parseMessagePattern(input.sourceText);
	return {
		id: createOccurrenceId('manifest', input.anchor, input.slot),
		domain: 'manifest',
		scope: input.scope,
		anchor: input.anchor,
		slot: input.slot,
		businessId: input.businessId,
		authorityId: createAuthorityId(pattern),
		pattern: pattern,
		patternFingerprint: createPatternFingerprint(pattern),
		sourceText: input.sourceText,
		sourceHash: createContentHash(input.sourceText),
		reference: createJsonSourceReference('package.json', input.pathSegments),
		output: createManifestKeyOutputReference(input.key),
	};
}

function resolveSource(value: string, englishNls: Record<string, string>): ResolvedSource {
	const tokenMatch = /^%([^%]+)%$/.exec(value);
	if (tokenMatch == null) {
		return {
			sourceText: value,
		};
	}

	const tokenKey = tokenMatch[1];
	const englishText = englishNls[tokenKey];
	if (typeof englishText !== 'string') {
		return {
			sourceText: value,
			missingTokenKey: tokenKey,
		};
	}

	return {
		sourceText: englishText,
	};
}

function resolvePotentialToken(value: unknown, englishNls: Record<string, string>): unknown {
	if (typeof value !== 'string') return value;
	void englishNls;
	return value;
}

function createManifestKeyOutputReference(key: string): SourceOccurrence['output'] {
	return {
		kind: 'manifest-key',
		key: key,
	};
}

function getConditionalSegment(value: unknown, fallbackIndex: number): string {
	if (typeof value !== 'string' || value.length === 0) {
		return `slot-${fallbackIndex + 1}`;
	}

	return `when-${shortHash(value)}`;
}

function getPreferredId(...values: unknown[]): string {
	for (const value of values) {
		if (typeof value !== 'string' || value.length === 0) continue;

		return sanitizeKeySegment(value);
	}

	return 'item';
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): Record<string, unknown> {
	return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
