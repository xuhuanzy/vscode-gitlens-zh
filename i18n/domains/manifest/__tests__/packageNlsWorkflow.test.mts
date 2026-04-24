import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createLiteralPattern, shortHash } from '../../../core/model.mts';
import { createManifestDomainContext } from '../context.mts';
import {
	loadAuthorityBundle,
	loadEnglishPackageNls,
	loadLocalizedPackageNls,
	loadManifest,
	loadManifestCatalog,
	loadManifestReconciliationReport,
	loadManifestWorkset,
	saveAuthorityBundle,
	saveManifestWorkset,
} from '../store.mts';
import {
	createPendingReport,
	generateManifestLocalizedOutputs,
	promoteManifestAuthority,
	syncManifestI18n,
} from '../workflow.mts';

run();

function run(): void {
	testPromotionWorkflow();
	testDuplicateViewsWelcomeKeys();
	testOverridesDoNotRemainPending();
	testReportWritePathUsesWorkspaceRoot();
}

function testPromotionWorkflow(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-package-nls-'));
	try {
		fs.writeFileSync(
			path.join(rootDir, 'package.json'),
			JSON.stringify(
				{
					name: 'fixture',
					displayName: 'Fixture Git UI',
					description: 'Review Git history quickly',
					contributes: {
						mcpServerDefinitionProviders: [{ id: 'fixture.provider', label: 'Fixture Provider' }],
						configuration: [
							{
								id: 'core',
								title: 'Core',
								properties: {
									'fixture.enabled': {
										type: 'boolean',
										markdownDescription: 'Show `${author}` in the panel',
										enumDescriptions: ['Enabled', 'Disabled'],
									},
								},
							},
						],
						commands: [{ command: 'fixture.open', title: 'Open Graph', category: 'GitLens' }],
						submenus: [{ id: 'fixture.submenu', label: 'Tools' }],
						viewsContainers: {
							activitybar: [{ id: 'fixture.container', title: 'GitLens' }],
						},
						views: {
							explorer: [{ id: 'fixture.view', name: 'History', contextualTitle: 'History' }],
						},
						viewsWelcome: [
							{ view: 'fixture.view', contents: '[Open](command:fixture.open)', when: 'view == fixture' },
						],
						walkthroughs: [
							{
								id: 'welcome',
								title: 'Get Started',
								description: 'Welcome to the extension',
								steps: [{ id: 'intro', title: 'Intro', description: 'See **Git** activity' }],
							},
						],
					},
				},
				undefined,
				'\t',
			),
			'utf8',
		);

		const syncResult = syncManifestI18n({ rootDir });
		assert.equal(syncResult.occurrenceCount > 0, true);

		const context = createManifestDomainContext(rootDir);
		const catalog = loadManifestCatalog(context);
		const workset = loadManifestWorkset(context);
		assert.equal(workset.entries.length > 0, true);
		assert.deepEqual('firstSeenAt' in workset.entries[0], false);
		assert.deepEqual('occurrences' in workset.entries[0], false);
		assert.deepEqual(Array.isArray(workset.entries[0].occurrenceIds), true);

		const commandTitleOccurrence = catalog.occurrences.find(
			occurrence =>
				occurrence.output?.kind === 'manifest-key' &&
				occurrence.output.key === 'contributes.commands.fixture.open.title',
		);
		const commandCategoryOccurrence = catalog.occurrences.find(
			occurrence =>
				occurrence.output?.kind === 'manifest-key' &&
				occurrence.output.key === 'contributes.commands.fixture.open.category',
		);
		assert.notEqual(commandTitleOccurrence, undefined);
		assert.notEqual(commandCategoryOccurrence, undefined);
		assert.equal(commandTitleOccurrence!.anchor, commandCategoryOccurrence!.anchor);
		assert.notEqual(commandTitleOccurrence!.id, commandCategoryOccurrence!.id);
		assert.equal(commandTitleOccurrence!.slot, 'title');
		assert.equal(commandCategoryOccurrence!.slot, 'category');
		assert.equal(commandTitleOccurrence!.reference.kind, 'json');
		assert.equal('extractedFrom' in commandTitleOccurrence!.reference, false);

		const targetEntry = workset.entries.find(entry => entry.source === 'GitLens');
		assert.notEqual(targetEntry, undefined);

		saveManifestWorkset(context, {
			...workset,
			entries: workset.entries.map(entry =>
				entry.id === targetEntry!.id
					? {
							...entry,
							status: 'approved',
							translation: 'GitLens 中文',
						}
					: entry,
			),
		});

		const promoteResult = promoteManifestAuthority({ rootDir });
		assert.deepEqual(promoteResult.promoted, [targetEntry!.id]);

		const generateResult = generateManifestLocalizedOutputs({ rootDir });
		assert.equal(generateResult.englishKeys > 0, true);
		assert.equal(generateResult.localizedKeys > 0, true);

		const manifest = loadManifest(context);
		assert.equal(manifest.displayName, '%extension.displayName%');

		const englishPackageNls = loadEnglishPackageNls(context);
		assert.equal(englishPackageNls['extension.displayName'], 'Fixture Git UI');

		const authority = loadAuthorityBundle(context);
		assert.equal(
			authority.messages.entries.some(entry => entry.translation === 'GitLens 中文'),
			true,
		);

		const resyncResult = syncManifestI18n({ rootDir });
		assert.equal(resyncResult.occurrenceCount, syncResult.occurrenceCount);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testDuplicateViewsWelcomeKeys(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-package-nls-'));
	try {
		fs.writeFileSync(
			path.join(rootDir, 'package.json'),
			JSON.stringify(
				{
					name: 'fixture',
					displayName: 'Fixture Git UI',
					description: 'Review Git history quickly',
					contributes: {
						viewsWelcome: [
							{
								view: 'fixture.view',
								contents: 'Open the fixture history',
								when: 'view == fixture',
							},
							{
								view: 'fixture.view',
								contents: 'Compare the fixture refs',
								when: 'view == fixture',
							},
						],
					},
				},
				undefined,
				'\t',
			),
			'utf8',
		);

		syncManifestI18n({ rootDir });
		const context = createManifestDomainContext(rootDir);
		const reconciliation = loadManifestReconciliationReport(context);
		assert.equal(reconciliation.summary.ambiguous, 0);

		generateManifestLocalizedOutputs({ rootDir });

		const manifest = loadManifest(context);
		const welcomes = (((manifest.contributes as Record<string, unknown>).viewsWelcome as unknown[]) ?? []) as Array<
			Record<string, unknown>
		>;
		const selector = `when-${shortHash('view == fixture')}`;
		assert.equal(welcomes[0].contents, `%contributes.viewsWelcome.fixture.view.${selector}.slot-1.contents%`);
		assert.equal(welcomes[1].contents, `%contributes.viewsWelcome.fixture.view.${selector}.slot-2.contents%`);

		const englishPackageNls = loadEnglishPackageNls(context);
		assert.equal(
			englishPackageNls[`contributes.viewsWelcome.fixture.view.${selector}.slot-1.contents`],
			'Open the fixture history',
		);
		assert.equal(
			englishPackageNls[`contributes.viewsWelcome.fixture.view.${selector}.slot-2.contents`],
			'Compare the fixture refs',
		);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testOverridesDoNotRemainPending(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-package-nls-'));
	try {
		fs.writeFileSync(
			path.join(rootDir, 'package.json'),
			JSON.stringify(
				{
					name: 'fixture',
					displayName: 'Fixture Git UI',
					description: 'Review Git history quickly',
					contributes: {
						commands: [{ command: 'fixture.open', title: 'Open Graph', category: 'GitLens' }],
					},
				},
				undefined,
				'\t',
			),
			'utf8',
		);

		syncManifestI18n({ rootDir });
		const context = createManifestDomainContext(rootDir);
		const initialWorkset = loadManifestWorkset(context);
		assert.equal(initialWorkset.entries.length, 4);
		const titleEntry = initialWorkset.entries.find(entry => entry.source === 'Open Graph');
		assert.notEqual(titleEntry, undefined);

		const bundle = loadAuthorityBundle(context);
		saveAuthorityBundle(context, {
			...bundle,
			overrides: {
				...bundle.overrides,
				updatedAt: new Date().toISOString(),
				entries: [
					{
						selector: {
							kind: 'output',
							output: {
								kind: 'manifest-key',
								key: 'contributes.commands.fixture.open.title',
							},
						},
						translationPattern: createLiteralPattern('打开图表'),
						updatedAt: new Date().toISOString(),
					},
				],
			},
		});

		const report = createPendingReport({ rootDir });
		assert.equal(
			report.items.some(item => item.occurrenceIds.some(id => titleEntry!.occurrenceIds.includes(id))),
			false,
		);
		assert.equal(
			report.items.every(item => 'sourceText' in item),
			false,
		);
		assert.equal(
			report.items.every(item => 'scope' in item),
			false,
		);
		assert.equal(
			report.items.every(item => 'occurrences' in item),
			false,
		);
		assert.equal(fs.existsSync(context.pendingReportFile), true);

		const reportedWorkset = loadManifestWorkset(context);
		assert.equal(
			reportedWorkset.entries.some(entry => entry.id === titleEntry!.id),
			false,
		);

		const generateResult = generateManifestLocalizedOutputs({ rootDir });
		assert.equal(generateResult.localizedKeys, 1);

		const localizedPackageNls = loadLocalizedPackageNls(context);
		assert.equal(localizedPackageNls['contributes.commands.fixture.open.title'], '打开图表');
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}

function testReportWritePathUsesWorkspaceRoot(): void {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlens-package-nls-'));
	try {
		fs.writeFileSync(
			path.join(rootDir, 'package.json'),
			JSON.stringify(
				{
					name: 'fixture',
					displayName: 'Fixture Git UI',
					description: 'Review Git history quickly',
				},
				undefined,
				'\t',
			),
			'utf8',
		);

		createPendingReport({
			rootDir,
			writeTo: 'i18n/reports/package-pending.snapshot.json',
		});

		assert.equal(fs.existsSync(path.join(rootDir, 'i18n', 'reports', 'package-pending.snapshot.json')), true);
		assert.equal(fs.existsSync(path.join(rootDir, 'i18n', 'reports', 'i18n', 'reports')), false);
	} finally {
		fs.rmSync(rootDir, { recursive: true, force: true });
	}
}
