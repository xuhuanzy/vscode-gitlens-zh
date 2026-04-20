import * as path from 'path';
import {
	buildCommitDisplayCatalog,
	buildCommitDisplayZhCnCatalog,
	commitDisplayTranslationAuthorityPath,
	diffCommitDisplayCatalog,
	findPendingCommitDisplayZhCnTranslations,
	readCommitDisplayTranslationAuthority,
	rootDir,
	type CommitDisplayCatalog,
	type CommitDisplayPendingTranslation,
} from './commitDisplayLocalization.mts';
import {
	parsePendingReportArgs,
	printPendingReportHelp,
	readCatalogFromGit,
	writePendingReport,
} from '../shared/report.mts';

type PendingTranslationsReport = {
	baseRef: string;
	pending: CommitDisplayPendingTranslation[];
	summary: {
		added: number;
		authorityCovered: number;
		pending: number;
		pendingAdded: number;
		pendingStale: number;
		pendingUpdated: number;
		proofreaderCovered: number;
		removed: number;
		updated: number;
	};
};

const maxPendingPreviewEntries = 50;
const options = parsePendingReportArgs(process.argv.slice(2));

if (options.helpRequested) {
	printPendingReportHelp('i18n/commitDisplay/reportPendingCommitDisplayNlsZhCn.mts');
} else {
	const currentCommitDisplayCatalog = buildCommitDisplayCatalog();
	const authority = readCommitDisplayTranslationAuthority(commitDisplayTranslationAuthorityPath);
	const { coverage } = buildCommitDisplayZhCnCatalog(currentCommitDisplayCatalog, authority);
	const baseCommitDisplayCatalog = readCatalogFromGit<CommitDisplayCatalog>(
		rootDir,
		options.baseRef,
		'src/i18n/commitDisplay/commitDisplay.nls.json',
		() => Object.create(null) as CommitDisplayCatalog,
	);
	const diff = diffCommitDisplayCatalog(baseCommitDisplayCatalog.catalog, currentCommitDisplayCatalog);
	const pending = findPendingCommitDisplayZhCnTranslations(
		baseCommitDisplayCatalog.catalog,
		currentCommitDisplayCatalog,
		coverage,
	);
	const coveredSummary = collectChangedCoverageSummary([...diff.added, ...diff.updated], coverage);
	const report: PendingTranslationsReport = {
		baseRef: options.baseRef,
		pending: pending,
		summary: {
			added: diff.added.length,
			authorityCovered: coveredSummary.authorityCovered,
			pending: pending.length,
			pendingAdded: pending.filter(entry => entry.reason === 'added').length,
			pendingStale: pending.filter(entry => entry.reason === 'stale').length,
			pendingUpdated: pending.filter(entry => entry.reason === 'updated').length,
			proofreaderCovered: coveredSummary.proofreaderCovered,
			removed: diff.removed.length,
			updated: diff.updated.length,
		},
	};

	printReport(report, {
		baseCommitDisplayCatalogExists: baseCommitDisplayCatalog.exists,
	});

	if (options.writePath != null) {
		const outputPath = writePendingReport(rootDir, options.writePath, report);
		console.log(`已将待翻译报告写入 '${path.relative(rootDir, outputPath)}'。`);
	}

	if (options.failOnPending && pending.length > 0) {
		process.exitCode = 1;
	}
}

function printReport(report: PendingTranslationsReport, options: { baseCommitDisplayCatalogExists: boolean }): void {
	console.log(`已将当前 commit display 目录与 git ref '${report.baseRef}' 进行对比。`);
	console.log(
		`英文目录变更：新增 ${report.summary.added} 项，更新 ${report.summary.updated} 项，移除 ${report.summary.removed} 项。`,
	);
	console.log(
		`待处理的 zh-cn 翻译：共 ${report.summary.pending} 项（新增缺失 ${report.summary.pendingAdded} 项，更新缺失 ${report.summary.pendingUpdated} 项，authority 过期 ${report.summary.pendingStale} 项）。`,
	);
	console.log(`已由 authority 覆盖：${report.summary.authorityCovered} 项。`);
	console.log(`已由 proofreader 覆盖：${report.summary.proofreaderCovered} 项。`);

	if (!options.baseCommitDisplayCatalogExists) {
		console.log(
			`基线 ref '${report.baseRef}' 不包含 'src/i18n/commitDisplay/commitDisplay.nls.json'；将其视为空目录。`,
		);
	}

	if (report.pending.length === 0) {
		console.log('未发现待处理的 zh-cn 翻译。');
		return;
	}

	console.log('');
	console.log(
		`待翻译条目${report.pending.length > maxPendingPreviewEntries ? `（仅显示前 ${maxPendingPreviewEntries} 项）` : ''}：`,
	);
	for (const entry of report.pending.slice(0, maxPendingPreviewEntries)) {
		console.log(`- [${formatPendingReason(entry.reason)}] ${entry.key}`);
		console.log(`  当前英文：${JSON.stringify(entry.english)}`);
		if (entry.previousEnglish != null) {
			console.log(`  基线英文：${JSON.stringify(entry.previousEnglish)}`);
		}
		if (entry.authorityEnglish != null) {
			console.log(`  authority 英文：${JSON.stringify(entry.authorityEnglish)}`);
		}
		if (entry.chinese != null) {
			console.log(`  authority 中文：${JSON.stringify(entry.chinese)}`);
		}
	}

	if (report.pending.length > maxPendingPreviewEntries) {
		console.log(
			`...... 还有 ${report.pending.length - maxPendingPreviewEntries} 项未在控制台显示。可使用 '--write <path>' 导出完整稳定报告。`,
		);
	}
}

function collectChangedCoverageSummary(
	changedKeys: Iterable<string>,
	coverage: Readonly<Record<string, { source: 'authority' | 'missing' | 'proofreader' | 'stale' }>>,
): { authorityCovered: number; proofreaderCovered: number } {
	let authorityCovered = 0;
	let proofreaderCovered = 0;

	for (const key of changedKeys) {
		const entry = coverage[key];
		if (entry?.source === 'authority') {
			authorityCovered++;
			continue;
		}

		if (entry?.source === 'proofreader') {
			proofreaderCovered++;
		}
	}

	return { authorityCovered: authorityCovered, proofreaderCovered: proofreaderCovered };
}

function formatPendingReason(reason: CommitDisplayPendingTranslation['reason']): string {
	switch (reason) {
		case 'added':
			return '新增缺失';
		case 'stale':
			return 'authority 过期';
		case 'updated':
			return '更新缺失';
	}
}
