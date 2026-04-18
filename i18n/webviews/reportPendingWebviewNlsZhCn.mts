import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import * as path from 'path';
import {
	collectAcceptedEqualValues,
	diffWebviewNlsCatalog,
	findPendingWebviewNlsZhCnTranslations,
	readWebviewNls,
	rootDir,
	type WebviewNlsJson,
	type WebviewNlsPendingTranslation,
	webviewNlsPath,
	webviewNlsZhCnPath,
} from './webviewLocalization.mts';

type CliOptions = {
	baseRef: string;
	failOnPending: boolean;
	helpRequested: boolean;
	writePath?: string;
};

type GitWebviewNlsReadResult = {
	catalog: WebviewNlsJson;
	exists: boolean;
};

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

const acceptedPassthroughValues = new Set([
	'GitLens',
	'GitLens Community',
	'GitLens docs',
	'GitLens Pro',
	'Git CodeLens',
	'Git Supercharged',
	'GitHub',
	'GitKraken',
	'GitKraken AI:',
	'GitKraken DevEx platform',
	'GitKraken MCP',
	"GitKraken's DevEx platform",
	'Jira',
	'Launchpad',
]);
const options = parseArgs(process.argv.slice(2));

if (!options.helpRequested) {
	const currentWebviewNls = readWebviewNls(webviewNlsPath);
	const currentWebviewNlsZhCn = readWebviewNls(webviewNlsZhCnPath);
	const baseWebviewNls = readWebviewNlsFromGit(options.baseRef, 'webviews.nls.json');
	const baseWebviewNlsZhCn = readWebviewNlsFromGit(options.baseRef, 'webviews.nls.zh-cn.json');
	const acceptedEqualValues = collectAcceptedEqualValues(baseWebviewNls.catalog, baseWebviewNlsZhCn.catalog);
	for (const value of acceptedPassthroughValues) {
		acceptedEqualValues.add(value);
	}
	for (const english of Object.values(currentWebviewNls)) {
		if (isImplicitPassthroughValue(english)) {
			acceptedEqualValues.add(english);
		}
	}
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
		const outputPath = path.isAbsolute(options.writePath) ? options.writePath : path.resolve(rootDir, options.writePath);
		writeFileSync(outputPath, `${JSON.stringify(report, undefined, '\t')}\n`, 'utf8');
		console.log(`已将待翻译报告写入 '${path.relative(rootDir, outputPath)}'。`);
	}

	if (options.failOnPending && pending.length > 0) {
		process.exitCode = 1;
	}
}

function parseArgs(args: string[]): CliOptions {
	let baseRef = 'HEAD';
	let failOnPending = false;
	let helpRequested = false;
	let writePath: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === '--') {
			continue;
		}

		if (arg === '--base') {
			baseRef = readOptionValue(args, ++i, '--base');
			continue;
		}

		if (arg === '--write') {
			writePath = readOptionValue(args, ++i, '--write');
			continue;
		}

		if (arg === '--fail-on-pending') {
			failOnPending = true;
			continue;
		}

		if (arg === '--help' || arg === '-h') {
			printHelp();
			helpRequested = true;
			break;
		}

		throw new Error(`未知参数 '${arg}'。可使用 '--help' 查看支持的选项。`);
	}

	return { baseRef: baseRef, failOnPending: failOnPending, helpRequested: helpRequested, writePath: writePath };
}

function readOptionValue(args: string[], index: number, optionName: string): string {
	const value = args[index];
	if (value == null || value.startsWith('--')) {
		throw new Error(`缺少选项 '${optionName}' 的值。`);
	}

	return value;
}

function printHelp(): void {
	console.log(`用法：node ./i18n/webviews/reportPendingWebviewNlsZhCn.mts [options]

选项：
  --base <ref>          与指定 git ref 对比（默认：HEAD）
  --write <path>        将稳定 JSON 报告写入指定路径
  --fail-on-pending     发现待翻译项时以退出码 1 结束
  --help, -h            显示此帮助信息
`);
}

function readWebviewNlsFromGit(ref: string, relativePath: string): GitWebviewNlsReadResult {
	try {
		const contents = execFileSync('git', ['show', `${ref}:${toGitPath(relativePath)}`], {
			cwd: rootDir,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		return { catalog: JSON.parse(contents) as WebviewNlsJson, exists: true };
	} catch (ex) {
		const message = getGitErrorMessage(ex);
		if (isMissingPathAtGitRef(message)) {
			return { catalog: Object.create(null) as WebviewNlsJson, exists: false };
		}

		throw new Error(`无法从 git ref '${ref}' 读取 '${relativePath}'：${message}`);
	}
}

function toGitPath(filePath: string): string {
	return filePath.replaceAll(path.sep, '/');
}

function getGitErrorMessage(ex: unknown): string {
	if (typeof ex !== 'object' || ex == null) return String(ex);

	const stderr = 'stderr' in ex ? (ex as { stderr?: Buffer | string }).stderr : undefined;
	if (stderr != null) {
		const message = stderr.toString().trim();
		if (message.length > 0) return message;
	}

	return ex instanceof Error ? ex.message : String(ex);
}

function isMissingPathAtGitRef(message: string): boolean {
	return (
		message.includes('exists on disk, but not in') ||
		message.includes('does not exist in') ||
		message.includes('pathspec') ||
		message.includes('Path ')
	);
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
		console.log(`基线 ref '${report.baseRef}' 不包含 'webviews.nls.json'；将其视为空目录。`);
	}

	if (!options.baseWebviewNlsZhCnExists) {
		console.log(`基线 ref '${report.baseRef}' 不包含 'webviews.nls.zh-cn.json'；不会继承可直接保留英文的值。`);
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

function collectPendingValues(
	pending: WebviewNlsPendingTranslation[],
): PendingTranslationsReport['pendingValues'] {
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
