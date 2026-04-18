import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import * as path from 'path';
import {
	diffPackageNlsCatalog,
	ensurePackageNlsExists,
	findPendingPackageNlsZhCnTranslations,
	packageNlsPath,
	packageNlsZhCnPath,
	readPackageNls,
	rootDir,
	type PackageNlsJson,
	type PackageNlsPendingTranslation,
} from './packageLocalization.mts';

type CliOptions = {
	baseRef: string;
	failOnPending: boolean;
	helpRequested: boolean;
	writePath?: string;
};

type GitPackageNlsReadResult = {
	catalog: PackageNlsJson;
	exists: boolean;
};

type PendingTranslationsReport = {
	baseRef: string;
	pending: PackageNlsPendingTranslation[];
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
const acceptedPassthroughValues = new Set([
	'Git CodeLens',
	'GitKraken',
	'GitLens',
	'GitLens Community',
	'GitLens Pro',
	'GitKraken AI',
	'Launchpad',
	'Live Share',
	'Visual Studio Live Share',
]);
ensurePackageNlsExists();

const options = parseArgs(process.argv.slice(2));
if (!options.helpRequested) {
	const currentPackageNls = readPackageNls(packageNlsPath);
	const currentPackageNlsZhCn = readPackageNls(packageNlsZhCnPath);
	const basePackageNls = readPackageNlsFromGit(options.baseRef, 'package.nls.json');
	const basePackageNlsZhCn = readPackageNlsFromGit(options.baseRef, 'package.nls.zh-cn.json');
	const acceptedEqualValues = collectAcceptedEqualValues(basePackageNls.catalog, basePackageNlsZhCn.catalog);
	for (const value of acceptedPassthroughValues) {
		acceptedEqualValues.add(value);
	}
	const diff = diffPackageNlsCatalog(basePackageNls.catalog, currentPackageNls);
	const pending = findPendingPackageNlsZhCnTranslations(basePackageNls.catalog, currentPackageNls, currentPackageNlsZhCn, {
		acceptedEqualValues: acceptedEqualValues,
	});
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
		basePackageNlsExists: basePackageNls.exists,
		basePackageNlsZhCnExists: basePackageNlsZhCn.exists,
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
	console.log(`用法：node ./i18n/package/reportPendingPackageNlsZhCn.mts [options]

选项：
  --base <ref>          与指定 git ref 对比（默认：HEAD）
  --write <path>        将稳定 JSON 报告写入指定路径
  --fail-on-pending     发现待翻译项时以退出码 1 结束
  --help, -h            显示此帮助信息
`);
}

function readPackageNlsFromGit(ref: string, relativePath: string): GitPackageNlsReadResult {
	try {
		const contents = execFileSync('git', ['show', `${ref}:${toGitPath(relativePath)}`], {
			cwd: rootDir,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		return { catalog: JSON.parse(contents) as PackageNlsJson, exists: true };
	} catch (ex) {
		const message = getGitErrorMessage(ex);
		if (isMissingPathAtGitRef(message)) {
			return { catalog: Object.create(null) as PackageNlsJson, exists: false };
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

function collectAcceptedEqualValues(packageNls: PackageNlsJson, packageNlsZhCn: PackageNlsJson): Set<string> {
	const accepted = new Set<string>();

	for (const [key, english] of Object.entries(packageNls)) {
		if (packageNlsZhCn[key] !== english) continue;
		accepted.add(english);
	}

	return accepted;
}

function printReport(
	report: PendingTranslationsReport,
	options: { basePackageNlsExists: boolean; basePackageNlsZhCnExists: boolean },
): void {
	console.log(`已将当前 package 目录与 git ref '${report.baseRef}' 进行对比。`);
	console.log(
		`英文目录变更：新增 ${report.summary.added} 项，更新 ${report.summary.updated} 项，移除 ${report.summary.removed} 项。`,
	);
	console.log(
		`待处理的 zh-cn 翻译：共 ${report.summary.pending} 项（新增 ${report.summary.pendingAdded} 项，更新 ${report.summary.pendingUpdated} 项）。`,
	);
	console.log(`已由现有翻译或允许保留英文的值覆盖：${report.summary.alreadyCovered} 项。`);

	if (!options.basePackageNlsExists) {
		console.log(`基线 ref '${report.baseRef}' 不包含 'package.nls.json'；将其视为空目录。`);
	}

	if (!options.basePackageNlsZhCnExists) {
		console.log(`基线 ref '${report.baseRef}' 不包含 'package.nls.zh-cn.json'；不会继承可直接保留英文的值。`);
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

function formatPendingReason(reason: PackageNlsPendingTranslation['reason']): string {
	return reason === 'added' ? '新增' : '更新';
}
