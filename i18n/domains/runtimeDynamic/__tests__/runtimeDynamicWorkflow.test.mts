import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createRuntimeDynamicDomainContext } from '../context.mts';
import { extractRuntimeDynamicMatches } from '../extractor.mts';
import {
	loadLocalizedRuntimeDynamicSource,
	loadRuntimeDynamicCatalog,
	loadRuntimeDynamicReconciliationReport,
	loadRuntimeDynamicWorkset,
	saveRuntimeDynamicWorkset,
} from '../store.mts';
import {
	createPendingReport,
	generateRuntimeDynamicLocalizedOutputs,
	promoteRuntimeDynamicAuthority,
	syncRuntimeDynamicI18n,
} from '../workflow.mts';

run();

function run(): void {
	testQuickPickLowLevelStringsAreExtracted();
	testQuickPickNullishAssignmentStringsAreLocalized();
	testQuickPickTemplateLabelsAreLocalizedWithPlaceholders();
	testQuickPickPluralizedTemplateSlotsAreDeferred();
	testQuickWizardConstructorLabelsAreLocalizedWithPlaceholders();
	testQuickPickSeparatorLabelsAreExtracted();
	testQuickWizardFallbackAndHintStringsAreLocalized();
	testFormatterMarkdownTitlesAreLocalizedWithoutChangingCommandSyntax();
	testFormatterMarkdownLabelsAreLocalizedWithoutChangingCommandSyntax();
	testFormatterDynamicMarkdownTitlesAreLocalizedWithPlaceholders();
	testFormatterDynamicMarkdownLabelsAndMultilineTitlesAreLocalizedWithPlaceholders();
	testFormatterHtmlTitlesAreLocalizedWithoutChangingElementSyntax();
	testFormatterHtmlWrapperTemplatesAreNotExtracted();
	testDynamicMarkdownTitlesAreDeferred();
}

function testQuickPickLowLevelStringsAreExtracted(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-quickpicks-'));
	try {
		writeFile(
			rootDir,
			'src/quickpicks/items/directive.ts',
			[
				"import { QuickPickItemKind } from 'vscode';",
				'export function createDirectiveQuickPickItem(kind: string) {',
				'\tlet label;',
				'\tlet detail;',
				"\tif (kind === 'trial') {",
				"\t\tlabel = 'Try GitLens Pro';",
				"\t\tdetail = 'Get 7 days of GitLens Pro for free';",
				'\t} else {',
				"\t\tlabel = 'Back';",
				'\t}',
				'\treturn { label, detail, kind: QuickPickItemKind.Default };',
				'}',
				'',
			].join('\n'),
		);

		const result = syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(result.occurrenceCount, 3);

		const context = createRuntimeDynamicDomainContext('quickpicks', rootDir);
		const catalog = loadRuntimeDynamicCatalog(context);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(catalog.domain, 'quickpicks');
		assert.equal(
			workset.entries.some(entry => entry.source === 'Try GitLens Pro'),
			true,
		);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Get 7 days of GitLens Pro for free'),
			true,
		);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Back'),
			true,
		);

		const report = createPendingReport({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(report.domain, 'quickpicks');
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testQuickPickTemplateLabelsAreLocalizedWithPlaceholders(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-quickpicks-template-'));
	try {
		writeFile(
			rootDir,
			'src/quickpicks/remoteProviderPicker.ts',
			[
				'export function createCopyItem(resourceName: string, providerName: string) {',
				'\tconst label = `Copy Link to ${resourceName} for ${providerName}`;',
				'\treturn { label };',
				'}',
				'',
			].join('\n'),
		);

		const result = syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(result.occurrenceCount, 1);

		const context = createRuntimeDynamicDomainContext('quickpicks', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Copy Link to ${slot1} for ${slot2}'),
			true,
		);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.source === 'Copy Link to ${slot1} for ${slot2}'
					? { ...entry, status: 'approved', translation: '复制 ${slot2} 的${slot1}链接' }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(promoted.promoted.length, 1);

		const generated = generateRuntimeDynamicLocalizedOutputs({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(generated.translatedCount, 1);

		const localized = loadLocalizedRuntimeDynamicSource(context, 'src/quickpicks/remoteProviderPicker.ts');
		assert.notEqual(localized, undefined);
		assert.equal(localized!.includes('const label = `复制 ${providerName} 的${resourceName}链接`;'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testQuickPickNullishAssignmentStringsAreLocalized(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-quickpicks-nullish-'));
	try {
		writeFile(
			rootDir,
			'src/quickpicks/items/directive.ts',
			[
				'export function createDirectiveQuickPickItem(detail?: string) {',
				'\tlet description;',
				"\tdescription ??= 'GitLens Pro is required to use this feature';",
				'\treturn { description, detail };',
				'}',
				'',
			].join('\n'),
		);

		const result = syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(result.occurrenceCount, 1);

		const context = createRuntimeDynamicDomainContext('quickpicks', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(
			workset.entries.some(entry => entry.source === 'GitLens Pro is required to use this feature'),
			true,
		);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.source === 'GitLens Pro is required to use this feature'
					? { ...entry, status: 'approved', translation: '需要 GitLens Pro 才能使用此功能' }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(promoted.promoted.length, 1);

		const generated = generateRuntimeDynamicLocalizedOutputs({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(generated.translatedCount, 1);

		const localized = loadLocalizedRuntimeDynamicSource(context, 'src/quickpicks/items/directive.ts');
		assert.notEqual(localized, undefined);
		assert.equal(localized!.includes("description ??= '需要 GitLens Pro 才能使用此功能';"), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testQuickPickPluralizedTemplateSlotsAreDeferred(): void {
	const source = [
		"import { pluralize } from '@gitlens/utils/string';",
		'export function createDirectiveQuickPickItem(proTrialLengthInDays: number) {',
		"\tconst detail = `Get ${pluralize('day', proTrialLengthInDays)} of GitLens Pro for free — no credit card required.`;",
		'\treturn { detail };',
		'}',
		'',
	].join('\n');

	const extraction = extractRuntimeDynamicMatches({
		domain: 'quickpicks',
		group: 'items',
		file: 'src/quickpicks/items/directive.ts',
		source: source,
		syntax: 'ts',
	});
	assert.equal(extraction.matches.length, 0);
	assert.equal(extraction.issues.length, 1);
	assert.equal(extraction.issues[0].reason.includes('requires pluralization modeling'), true);

	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-quickpicks-pluralized-'));
	try {
		writeFile(rootDir, 'src/quickpicks/items/directive.ts', source);
		syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'quickpicks' });

		const context = createRuntimeDynamicDomainContext('quickpicks', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(workset.entries.length, 0);

		const reconciliation = loadRuntimeDynamicReconciliationReport(context);
		assert.equal(reconciliation.summary.ambiguous, 1);
		assert.equal(
			reconciliation.entries.some(entry => entry.reason?.includes('requires pluralization modeling')),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testQuickPickSeparatorLabelsAreExtracted(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-quickpick-separator-'));
	try {
		writeFile(
			rootDir,
			'src/commands/quick-wizard/steps/commits.ts',
			[
				'export function createQuickPickSeparator(label?: string) {',
				'\treturn { label };',
				'}',
				'export function getItems() {',
				"\treturn [createQuickPickSeparator('Actions')];",
				'}',
				'',
			].join('\n'),
		);

		const result = syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(result.occurrenceCount, 1);

		const context = createRuntimeDynamicDomainContext('quickpicks', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Actions'),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testQuickWizardConstructorLabelsAreLocalizedWithPlaceholders(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-quickwizard-'));
	try {
		writeFile(
			rootDir,
			'src/commands/quick-wizard/steps/commits.ts',
			[
				'export class GitWizardQuickPickItem {',
				'\tconstructor(readonly label: string, readonly options: object) {}',
				'}',
				'export function getItems(branchName: string) {',
				"\treturn [new GitWizardQuickPickItem(`Reset ${branchName ?? 'Current Branch'} to Commit...`, { command: 'reset' })];",
				'}',
				'',
			].join('\n'),
		);

		const result = syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(result.occurrenceCount, 1);

		const context = createRuntimeDynamicDomainContext('quickpicks', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Reset ${slot1} to Commit...'),
			true,
		);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.source === 'Reset ${slot1} to Commit...'
					? { ...entry, status: 'approved', translation: '将 ${slot1} 重置到提交...' }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(promoted.promoted.length, 1);

		const generated = generateRuntimeDynamicLocalizedOutputs({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(generated.translatedCount, 1);

		const localized = loadLocalizedRuntimeDynamicSource(context, 'src/commands/quick-wizard/steps/commits.ts');
		assert.notEqual(localized, undefined);
		assert.equal(
			localized!.includes("new GitWizardQuickPickItem(`将 ${branchName ?? 'Current Branch'} 重置到提交...`,"),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testQuickWizardFallbackAndHintStringsAreLocalized(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-quickwizard-fallbacks-'));
	try {
		writeFile(
			rootDir,
			'src/commands/quick-wizard/steps/commits.ts',
			[
				'export function createQuickPickSeparator(label?: string) {',
				'\treturn { label };',
				'}',
				'export class GitWizardQuickPickItem {',
				'\tconstructor(readonly label: string, readonly options: object) {}',
				'}',
				'export function getItems(branchName: string | undefined, providerName: string | undefined, isStash: boolean) {',
				'\treturn [',
				"\t\t{ hint: `Click to see ${isStash ? 'stash' : 'commit'} actions` },",
				"\t\t{ hint: 'Click to see all changed files' },",
				"\t\tcreateQuickPickSeparator(providerName ?? 'Remote'),",
				"\t\tnew GitWizardQuickPickItem(`Reset ${branchName ?? 'Current Branch'} to Commit...`, { command: 'reset' }),",
				'\t];',
				'}',
				'',
			].join('\n'),
		);
		writeFile(
			rootDir,
			'src/quickpicks/items/commits.ts',
			[
				'export class CommandQuickPickItem {',
				'\tconstructor(readonly label: string) {}',
				'}',
				'export class CommitBrowseRepositoryFromHereCommandQuickPickItem extends CommandQuickPickItem {',
				'\tconstructor(private readonly executeOptions?: { before?: boolean; openInNewWindow: boolean }) {',
				"\t\tsuper(`Browse Repository from${executeOptions?.before ? ' Before' : ''} Here${executeOptions?.openInNewWindow ? ' in New Window' : ''}`);",
				'\t}',
				'}',
				'',
			].join('\n'),
		);

		syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'quickpicks' });
		writeFile(
			rootDir,
			'i18n/authority/zh-cn/terms.json',
			JSON.stringify(
				{
					$schema: '../../schemas/authority.schema.json',
					version: 2,
					kind: 'terms',
					locale: 'zh-cn',
					updatedAt: new Date(0).toISOString(),
					entries: [
						{ source: ' Before', translation: '之前', updatedAt: new Date(0).toISOString() },
						{
							source: ' in New Window',
							translation: '（在新窗口中）',
							updatedAt: new Date(0).toISOString(),
						},
						{ source: 'commit', translation: '提交', updatedAt: new Date(0).toISOString() },
						{ source: 'Current Branch', translation: '当前分支', updatedAt: new Date(0).toISOString() },
						{ source: 'stash', translation: '贮藏', updatedAt: new Date(0).toISOString() },
					],
				},
				undefined,
				'\t',
			),
		);

		const context = createRuntimeDynamicDomainContext('quickpicks', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map(entry => {
				switch (entry.source) {
					case 'Browse Repository from${slot1} Here${slot2}':
						return { ...entry, status: 'approved', translation: '浏览此处${slot1}的仓库${slot2}' };
					case 'Click to see ${slot1} actions':
						return { ...entry, status: 'approved', translation: '点击查看 ${slot1} 操作' };
					case 'Click to see all changed files':
						return { ...entry, status: 'approved', translation: '点击查看所有更改的文件' };
					case 'Remote':
						return { ...entry, status: 'approved', translation: '远程' };
					case 'Reset ${slot1} to Commit...':
						return { ...entry, status: 'approved', translation: '将 ${slot1} 重置到提交...' };
					default:
						return entry;
				}
			}),
		});
		const promoted = promoteRuntimeDynamicAuthority({ rootDir: rootDir, domain: 'quickpicks' });
		assert.equal(promoted.promoted.length, 5);

		generateRuntimeDynamicLocalizedOutputs({ rootDir: rootDir, domain: 'quickpicks' });
		const localizedWizard = loadLocalizedRuntimeDynamicSource(
			context,
			'src/commands/quick-wizard/steps/commits.ts',
		);
		const localizedCommitItems = loadLocalizedRuntimeDynamicSource(context, 'src/quickpicks/items/commits.ts');
		assert.notEqual(localizedWizard, undefined);
		assert.notEqual(localizedCommitItems, undefined);
		assert.equal(localizedWizard!.includes("`点击查看 ${isStash ? '贮藏' : '提交'} 操作`"), true);
		assert.equal(localizedWizard!.includes("{ hint: '点击查看所有更改的文件' }"), true);
		assert.equal(localizedWizard!.includes("createQuickPickSeparator(providerName ?? '远程')"), true);
		assert.equal(localizedWizard!.includes("`将 ${branchName ?? '当前分支'} 重置到提交...`"), true);
		assert.equal(
			localizedCommitItems!.includes(
				"`浏览此处${executeOptions?.before ? '之前' : ''}的仓库${executeOptions?.openInNewWindow ? '（在新窗口中）' : ''}`",
			),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testFormatterMarkdownTitlesAreLocalizedWithoutChangingCommandSyntax(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-formatter-'));
	try {
		const fixture = [
			'export function commands(link: string) {',
			'\treturn `[$(eye)](${link} "Inspect Commit Details")`;',
			'}',
			'',
		].join('\n');
		writeFile(rootDir, 'src/git/formatters/commitFormatter.ts', fixture);

		syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'formatter' });

		const context = createRuntimeDynamicDomainContext('formatter', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Inspect Commit Details'),
			true,
		);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.source === 'Inspect Commit Details'
					? { ...entry, status: 'approved', translation: '检查提交详情' }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ rootDir: rootDir, domain: 'formatter' });
		assert.equal(promoted.promoted.length, 1);

		const generated = generateRuntimeDynamicLocalizedOutputs({ rootDir: rootDir, domain: 'formatter' });
		assert.equal(generated.translatedCount, 1);

		const localized = loadLocalizedRuntimeDynamicSource(context, 'src/git/formatters/commitFormatter.ts');
		assert.notEqual(localized, undefined);
		assert.equal(localized!.includes('[$(eye)](${link} "检查提交详情")'), true);
		assert.equal(localized!.includes('[$(eye)](${link}'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testFormatterDynamicMarkdownTitlesAreLocalizedWithPlaceholders(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-formatter-dynamic-'));
	try {
		const fixture = [
			'export function commands(link: string, provider: string) {',
			'\treturn `[$(globe)](${link} "Open Commit on ${provider}")`;',
			'}',
			'',
		].join('\n');
		writeFile(rootDir, 'src/git/formatters/commitFormatter.ts', fixture);

		syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'formatter' });

		const context = createRuntimeDynamicDomainContext('formatter', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Open Commit on ${slot1}'),
			true,
		);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.source === 'Open Commit on ${slot1}'
					? { ...entry, status: 'approved', translation: '在 ${slot1} 上打开提交' }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ rootDir: rootDir, domain: 'formatter' });
		assert.equal(promoted.promoted.length, 1);

		const generated = generateRuntimeDynamicLocalizedOutputs({ rootDir: rootDir, domain: 'formatter' });
		assert.equal(generated.translatedCount, 1);

		const localized = loadLocalizedRuntimeDynamicSource(context, 'src/git/formatters/commitFormatter.ts');
		assert.notEqual(localized, undefined);
		assert.equal(localized!.includes('[$(globe)](${link} "在 ${provider} 上打开提交")'), true);
		assert.equal(localized!.includes('${link}'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testFormatterMarkdownLabelsAreLocalizedWithoutChangingCommandSyntax(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-formatter-label-'));
	try {
		const fixture = [
			'export function commands(link: string) {',
			'\treturn `[$(sparkle) Explain](${link} "Explain Changes")`;',
			'}',
			'',
		].join('\n');
		writeFile(rootDir, 'src/git/formatters/commitFormatter.ts', fixture);

		syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'formatter' });

		const context = createRuntimeDynamicDomainContext('formatter', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Explain'),
			true,
		);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.source === 'Explain' ? { ...entry, status: 'approved', translation: '解释' } : entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ rootDir: rootDir, domain: 'formatter' });
		assert.equal(promoted.promoted.length, 1);

		const generated = generateRuntimeDynamicLocalizedOutputs({ rootDir: rootDir, domain: 'formatter' });
		assert.equal(generated.translatedCount, 1);

		const localized = loadLocalizedRuntimeDynamicSource(context, 'src/git/formatters/commitFormatter.ts');
		assert.notEqual(localized, undefined);
		assert.equal(localized!.includes('[$(sparkle) 解释](${link} "Explain Changes")'), true);
		assert.equal(localized!.includes('${link}'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testFormatterDynamicMarkdownLabelsAndMultilineTitlesAreLocalizedWithPlaceholders(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-formatter-dynamic-label-'));
	try {
		const fixture = [
			'export function commands(link: string, remote: { provider: { name: string } }) {',
			'\treturn `[$(plug) Connect to ${remote?.provider.name}${',
			'\t\tGlyphChars.Ellipsis',
			'\t}](${link} "Connect to ${',
			'\t\tremote.provider.name',
			'\t} to enable the display of the Pull Request (if any) that introduced this commit")`;',
			'}',
			'',
		].join('\n');
		writeFile(rootDir, 'src/git/formatters/commitFormatter.ts', fixture);

		syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'formatter' });

		const context = createRuntimeDynamicDomainContext('formatter', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Connect to ${slot1}${slot2}'),
			true,
		);
		assert.equal(
			workset.entries.some(
				entry =>
					entry.source ===
					'Connect to ${slot1} to enable the display of the Pull Request (if any) that introduced this commit',
			),
			true,
		);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map(entry => {
				switch (entry.source) {
					case 'Connect to ${slot1}${slot2}':
						return { ...entry, status: 'approved', translation: '连接到 ${slot1}${slot2}' };
					case 'Connect to ${slot1} to enable the display of the Pull Request (if any) that introduced this commit':
						return {
							...entry,
							status: 'approved',
							translation: '连接到 ${slot1} 以显示引入此提交的拉取请求（如果有）',
						};
					default:
						return entry;
				}
			}),
		});
		const promoted = promoteRuntimeDynamicAuthority({ rootDir: rootDir, domain: 'formatter' });
		assert.equal(promoted.promoted.length, 2);

		const generated = generateRuntimeDynamicLocalizedOutputs({ rootDir: rootDir, domain: 'formatter' });
		assert.equal(generated.translatedCount, 2);

		const localized = loadLocalizedRuntimeDynamicSource(context, 'src/git/formatters/commitFormatter.ts');
		assert.notEqual(localized, undefined);
		assert.equal(
			localized!.includes('[$(plug) 连接到 ${remote?.provider.name}${\n\t\tGlyphChars.Ellipsis\n\t}]'),
			true,
		);
		assert.equal(
			localized!.includes('"连接到 ${\n\t\tremote.provider.name\n\t} 以显示引入此提交的拉取请求（如果有）"'),
			true,
		);
		assert.equal(localized!.includes('${link}'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testFormatterHtmlTitlesAreLocalizedWithoutChangingElementSyntax(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-formatter-html-'));
	try {
		const fixture = [
			'export function commands(link: string, label: string) {',
			'\treturn `<a href="${link}" title="Inspect Commit Details" class="command">${label}</a>`;',
			'}',
			'',
		].join('\n');
		writeFile(rootDir, 'src/git/formatters/commitFormatter.ts', fixture);

		syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'formatter' });

		const context = createRuntimeDynamicDomainContext('formatter', rootDir);
		const workset = loadRuntimeDynamicWorkset(context);
		assert.equal(
			workset.entries.some(entry => entry.source === 'Inspect Commit Details'),
			true,
		);

		saveRuntimeDynamicWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.source === 'Inspect Commit Details'
					? { ...entry, status: 'approved', translation: '检查提交详情' }
					: entry,
			),
		});
		const promoted = promoteRuntimeDynamicAuthority({ rootDir: rootDir, domain: 'formatter' });
		assert.equal(promoted.promoted.length, 1);

		const generated = generateRuntimeDynamicLocalizedOutputs({ rootDir: rootDir, domain: 'formatter' });
		assert.equal(generated.translatedCount, 1);

		const localized = loadLocalizedRuntimeDynamicSource(context, 'src/git/formatters/commitFormatter.ts');
		assert.notEqual(localized, undefined);
		assert.equal(localized!.includes('href="${link}" title="检查提交详情" class="command"'), true);
		assert.equal(localized!.includes('${label}</a>'), true);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testFormatterHtmlWrapperTemplatesAreNotExtracted(): void {
	const source = [
		'export function formatMessage(message: string, classes?: string) {',
		'\tmessage = `<span ${classes}>${message}</span>`;',
		'\treturn message;',
		'}',
		'',
	].join('\n');

	const extraction = extractRuntimeDynamicMatches({
		domain: 'formatter',
		group: 'commitFormatter',
		file: 'src/git/formatters/commitFormatter.ts',
		source: source,
		syntax: 'ts',
	});
	assert.equal(extraction.matches.length, 0);
	assert.equal(extraction.issues.length, 0);
}

function testDynamicMarkdownTitlesAreDeferred(): void {
	const source = [
		'export function commands(link: string, provider: string, title: string) {',
		'\treturn `[$(git-pull-request)](${link} "Open Pull Request #${provider}\\n--\\n${title}")`;',
		'}',
		'',
	].join('\n');

	const extraction = extractRuntimeDynamicMatches({
		domain: 'formatter',
		group: 'commitFormatter',
		file: 'src/git/formatters/commitFormatter.ts',
		source: source,
		syntax: 'ts',
	});
	assert.equal(extraction.matches.length, 0);
	assert.equal(extraction.issues.length, 1);
	assert.equal(extraction.issues[0].reason.includes('dynamic markdown title'), true);

	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-runtime-formatter-deferred-'));
	try {
		writeFile(rootDir, 'src/git/formatters/commitFormatter.ts', source);
		syncRuntimeDynamicI18n({ rootDir: rootDir, domain: 'formatter' });

		const context = createRuntimeDynamicDomainContext('formatter', rootDir);
		const reconciliation = loadRuntimeDynamicReconciliationReport(context);
		assert.equal(reconciliation.summary.ambiguous, 1);
		assert.equal(
			reconciliation.entries.some(entry => entry.reason?.includes('dynamic markdown title')),
			true,
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function writeFile(rootDir: string, relativePath: string, contents: string): void {
	const filePath = path.join(rootDir, ...relativePath.split('/'));
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, contents, 'utf8');
}
