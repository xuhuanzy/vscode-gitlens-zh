import { execFileSync } from 'child_process';
import * as path from 'path';
import { writeStableJsonFile } from './files.mts';

export type PendingReportCliOptions = {
	baseRef: string;
	failOnPending: boolean;
	helpRequested: boolean;
	writePath?: string;
};

export type GitCatalogReadResult<T> = {
	catalog: T;
	exists: boolean;
};

export function parsePendingReportArgs(args: string[]): PendingReportCliOptions {
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
			helpRequested = true;
			break;
		}

		throw new Error(`未知参数 '${arg}'。可使用 '--help' 查看支持的选项。`);
	}

	return { baseRef: baseRef, failOnPending: failOnPending, helpRequested: helpRequested, writePath: writePath };
}

export function printPendingReportHelp(scriptPath: string): void {
	console.log(`用法：node ./${scriptPath.replace(/\\/g, '/')} [options]

选项：
  --base <ref>          与指定 git ref 对比（默认：HEAD）
  --write <path>        将稳定 JSON 报告写入指定路径
  --fail-on-pending     发现待翻译项时以退出码 1 结束
  --help, -h            显示此帮助信息
`);
}

export function readCatalogFromGit<T>(
	rootDir: string,
	ref: string,
	relativePath: string,
	createEmptyCatalog: () => T,
): GitCatalogReadResult<T> {
	try {
		const contents = execFileSync('git', ['show', `${ref}:${toGitPath(relativePath)}`], {
			cwd: rootDir,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		return { catalog: JSON.parse(contents) as T, exists: true };
	} catch (ex) {
		const message = getGitErrorMessage(ex);
		if (isMissingPathAtGitRef(message)) {
			return { catalog: createEmptyCatalog(), exists: false };
		}

		throw new Error(`无法从 git ref '${ref}' 读取 '${relativePath}'：${message}`);
	}
}

export function writePendingReport(rootDir: string, outputPath: string, report: unknown): string {
	const resolvedPath = path.isAbsolute(outputPath) ? outputPath : path.resolve(rootDir, outputPath);
	writeStableJsonFile(resolvedPath, report);
	return resolvedPath;
}

function readOptionValue(args: string[], index: number, optionName: string): string {
	const value = args[index];
	if (value == null || value.startsWith('--')) {
		throw new Error(`缺少选项 '${optionName}' 的值。`);
	}

	return value;
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
