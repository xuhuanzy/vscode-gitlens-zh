import * as path from 'path';
import {
	diffWebviewNlsCatalog,
	findPendingWebviewNlsZhCnTranslations,
	readWebviewNls,
	rootDir,
	type WebviewNlsJson,
	type WebviewNlsPendingTranslation,
	webviewNlsPath,
	webviewNlsZhCnPath,
} from './webviewLocalization.mts';
import {
	parsePendingReportArgs,
	printPendingReportHelp,
	readCatalogFromGit,
	writePendingReport,
} from '../shared/report.mts';
import { collectAcceptedZhCnEqualValues } from '../shared/zhCnPolicy.mts';

type PendingTranslationsReport = {
	baseRef: string;
	pending: WebviewNlsPendingTranslation[];
	pendingValues: {
		count: number;
		english: string;
		keys: string[];
		reasons: WebviewNlsPendingTranslation['reason'][];
	}[];
	summary: {
		added: number;
		alreadyCovered: number;
		pending: number;
		pendingValues: number;
		pendingAdded: number;
		pendingUpdated: number;
		removed: number;
		updated: number;
	};
};

const extraAcceptedPassthroughValues = new Set(['GitLens docs']);
const options = parsePendingReportArgs(process.argv.slice(2));

if (options.helpRequested) {
	printPendingReportHelp('i18n/webviews/reportPendingWebviewNlsZhCn.mts');
} else {
	const currentWebviewNls = readWebviewNls(webviewNlsPath);
	const currentWebviewNlsZhCn = readWebviewNls(webviewNlsZhCnPath);
	const baseWebviewNls = readCatalogFromGit<WebviewNlsJson>(
		rootDir,
		options.baseRef,
		'src/i18n/webviews/webviews.nls.json',
		() => Object.create(null) as WebviewNlsJson,
	);
	const baseWebviewNlsZhCn = readCatalogFromGit<WebviewNlsJson>(
		rootDir,
		options.baseRef,
		'src/i18n/webviews/webviews.nls.zh-cn.json',
		() => Object.create(null) as WebviewNlsJson,
	);
	const acceptedEqualValues = collectAcceptedZhCnEqualValues({
		baseCatalog: baseWebviewNls.catalog,
		baseZhCnCatalog: baseWebviewNlsZhCn.catalog,
		currentCatalog: currentWebviewNls,
		extraPassthroughValues: extraAcceptedPassthroughValues,
		isImplicitPassthroughValue: isImplicitPassthroughValue,
	});
	const diff = diffWebviewNlsCatalog(baseWebviewNls.catalog, currentWebviewNls);
	const pending = findPendingWebviewNlsZhCnTranslations(
		baseWebviewNls.catalog,
		currentWebviewNls,
		currentWebviewNlsZhCn,
		{
			acceptedEqualValues: acceptedEqualValues,
		},
	);
	const pendingValues = collectPendingValues(pending);

	const report: PendingTranslationsReport = {
		baseRef: options.baseRef,
		pending: pending,
		pendingValues: pendingValues,
		summary: {
			added: diff.added.length,
			alreadyCovered: diff.added.length + diff.updated.length - pending.length,
			pending: pending.length,
			pendingValues: pendingValues.length,
			pendingAdded: pending.filter(entry => entry.reason === 'added').length,
			pendingUpdated: pending.filter(entry => entry.reason === 'updated').length,
			removed: diff.removed.length,
			updated: diff.updated.length,
		},
	};

	printReport(report, {
		baseWebviewNlsExists: baseWebviewNls.exists,
		baseWebviewNlsZhCnExists: baseWebviewNlsZhCn.exists,
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
	options: { baseWebviewNlsExists: boolean; baseWebviewNlsZhCnExists: boolean },
): void {
	console.log(`已将当前 webview HTML 目录与 git ref '${report.baseRef}' 进行对比。`);
	console.log(
		`英文目录变更：新增 ${report.summary.added} 项，更新 ${report.summary.updated} 项，移除 ${report.summary.removed} 项。`,
	);
	console.log(
		`待处理的 zh-cn 翻译：共 ${report.summary.pending} 项（新增 ${report.summary.pendingAdded} 项，更新 ${report.summary.pendingUpdated} 项）。`,
	);
	console.log(`按英文去重后待处理值：共 ${report.summary.pendingValues} 项。`);
	console.log(`已由现有翻译或允许保留英文的值覆盖：${report.summary.alreadyCovered} 项。`);

	if (!options.baseWebviewNlsExists) {
		console.log(`基线 ref '${report.baseRef}' 不包含 'src/i18n/webviews/webviews.nls.json'；将其视为空目录。`);
	}

	if (!options.baseWebviewNlsZhCnExists) {
		console.log(
			`基线 ref '${report.baseRef}' 不包含 'src/i18n/webviews/webviews.nls.zh-cn.json'；不会继承可直接保留英文的值。`,
		);
	}

	if (report.pending.length === 0) {
		console.log('未发现待处理的 zh-cn 翻译。');
		return;
	}

	console.log('');
	console.log('待翻译值（按英文去重）：');
	for (const entry of report.pendingValues) {
		console.log(`- ${JSON.stringify(entry.english)} × ${entry.count}`);
	}
}

function collectPendingValues(pending: WebviewNlsPendingTranslation[]): PendingTranslationsReport['pendingValues'] {
	const grouped = new Map<string, PendingTranslationsReport['pendingValues'][number]>();

	for (const entry of pending) {
		let group = grouped.get(entry.english);
		if (group == null) {
			group = {
				count: 0,
				english: entry.english,
				keys: [],
				reasons: [],
			};
			grouped.set(entry.english, group);
		}

		group.count++;
		group.keys.push(entry.key);
		if (!group.reasons.includes(entry.reason)) {
			group.reasons.push(entry.reason);
		}
	}

	return [...grouped.values()].sort((a, b) => a.english.localeCompare(b.english));
}

function isImplicitPassthroughValue(value: string): boolean {
	return (
		/^(?:\d+|[\d+~\- ]+)$/.test(value) ||
		/^(?:[@#~^=:?].+)$/.test(value) ||
		/^[()]+$/.test(value) ||
		/^(?:true|false)$/.test(value) ||
		/^(?:after|before|author|change|commit|file|message|ref):/.test(value) ||
		/^\$\{.+\}$/.test(value) ||
		/^gitlens(?:\.|$)/i.test(value) ||
		/^gitkraken(?:\.|$)/i.test(value) ||
		/^(?:pullRequest|pullRequestState|agoOrDate(?:Short)?|author(?:Ago(?:OrDate(?:Short)?)?|Date|First|Last|NotYou)?|committer(?:Ago(?:OrDate(?:Short)?)?|Date)?|changesShort|date|id|message|tips)$/.test(
			value,
		) ||
		/^[⌥⌘⇧^]+(?:[⌥⌘⇧^A-Za-z0-9+]+)?$/.test(value) ||
		/^(?:Ctrl|Alt|Shift|Enter|Esc)(?:\+[A-Za-z]+)*$/.test(value)
	);
}
