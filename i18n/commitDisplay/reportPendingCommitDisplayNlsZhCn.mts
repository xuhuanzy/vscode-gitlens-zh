import * as path from 'path';
import {
	buildCommitDisplayCatalog,
	commitDisplayNlsZhCnPath,
	diffCommitDisplayCatalog,
	findPendingCommitDisplayZhCnTranslations,
	readCommitDisplayCatalog,
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
import { applyZhCnProofreader, collectAcceptedZhCnEqualValuesWithProofreader } from '../shared/zhCnPolicy.mts';

type PendingTranslationsReport = {
	baseRef: string;
	pending: CommitDisplayPendingTranslation[];
	summary: {
		added: number;
		alreadyCovered: number;
		pending: number;
		pendingAdded: number;
		pendingUpdated: number;
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
	const currentCommitDisplayZhCn = readCommitDisplayCatalog(commitDisplayNlsZhCnPath);
	const proofreadCurrentCommitDisplayZhCn = applyZhCnProofreader(currentCommitDisplayZhCn, currentCommitDisplayCatalog);
	const baseCommitDisplayCatalog = readCatalogFromGit<CommitDisplayCatalog>(
		rootDir,
		options.baseRef,
		'src/i18n/commitDisplay/commitDisplay.nls.json',
		() => Object.create(null) as CommitDisplayCatalog,
	);
	const baseCommitDisplayZhCn = readCatalogFromGit<CommitDisplayCatalog>(
		rootDir,
		options.baseRef,
		'src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json',
		() => Object.create(null) as CommitDisplayCatalog,
	);
	const acceptedEqualValues = collectAcceptedZhCnEqualValuesWithProofreader({
		baseCatalog: baseCommitDisplayCatalog.catalog,
		baseZhCnCatalog: baseCommitDisplayZhCn.catalog,
		currentCatalog: currentCommitDisplayCatalog,
	});
	const diff = diffCommitDisplayCatalog(baseCommitDisplayCatalog.catalog, currentCommitDisplayCatalog);
	const pending = findPendingCommitDisplayZhCnTranslations(
		baseCommitDisplayCatalog.catalog,
		currentCommitDisplayCatalog,
		proofreadCurrentCommitDisplayZhCn,
		{
			acceptedEqualValues: acceptedEqualValues,
		},
	);
	const report: PendingTranslationsReport = {
		baseRef: options.baseRef,
		pending: pending,
		summary: {
			added: diff.added.length,
			alreadyCovered: diff.added.length + diff.updated.length - pending.length,
			pending: pending.length,
			pendingAdded: pending.filter(entry => entry.reason === 'added').length,
			pendingUpdated: pending.filter(entry => entry.reason === 'updated').length,
			removed: diff.removed.length,
			updated: diff.updated.length,
		},
	};

	printReport(report, {
		baseCommitDisplayCatalogExists: baseCommitDisplayCatalog.exists,
		baseCommitDisplayZhCnExists: baseCommitDisplayZhCn.exists,
	});

	if (options.writePath != null) {
		const outputPath = writePendingReport(rootDir, options.writePath, report);
		console.log(`已将待翻译报告写入 '${path.relative(rootDir, outputPath)}'。`);
	}

	if (options.failOnPending && pending.length > 0) {
		process.exitCode = 1;
	}
}

function printReport(
	report: PendingTranslationsReport,
	options: { baseCommitDisplayCatalogExists: boolean; baseCommitDisplayZhCnExists: boolean },
): void {
	console.log(`已将当前 commit display 目录与 git ref '${report.baseRef}' 进行对比。`);
	console.log(
		`英文目录变更：新增 ${report.summary.added} 项，更新 ${report.summary.updated} 项，移除 ${report.summary.removed} 项。`,
	);
	console.log(
		`待处理的 zh-cn 翻译：共 ${report.summary.pending} 项（新增 ${report.summary.pendingAdded} 项，更新 ${report.summary.pendingUpdated} 项）。`,
	);
	console.log(`已由现有翻译、proofreader 或允许保留英文的值覆盖：${report.summary.alreadyCovered} 项。`);

	if (!options.baseCommitDisplayCatalogExists) {
		console.log(
			`基线 ref '${report.baseRef}' 不包含 'src/i18n/commitDisplay/commitDisplay.nls.json'；将其视为空目录。`,
		);
	}

	if (!options.baseCommitDisplayZhCnExists) {
		console.log(
			`基线 ref '${report.baseRef}' 不包含 'src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json'；不会继承已接受的英文直通值。`,
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
		console.log(`  英文：${JSON.stringify(entry.english)}`);
		if (entry.previousEnglish != null) {
			console.log(`  旧英文：${JSON.stringify(entry.previousEnglish)}`);
		}
	}

	if (report.pending.length > maxPendingPreviewEntries) {
		console.log(
			`...... 还有 ${report.pending.length - maxPendingPreviewEntries} 项未在控制台显示。可使用 '--write <path>' 导出完整稳定报告。`,
		);
	}
}

function formatPendingReason(reason: CommitDisplayPendingTranslation['reason']): string {
	return reason === 'added' ? '新增' : '更新';
}
