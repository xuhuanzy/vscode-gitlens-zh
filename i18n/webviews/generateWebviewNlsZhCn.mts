import * as path from 'path';
import { pathToFileURL } from 'url';
import {
	diffWebviewNlsCatalog,
	hasWebviewNlsChanges,
	readWebviewNls,
	syncWebviewNlsZhCn,
	type WebviewNlsDiff,
	type WebviewNlsJson,
	webviewNlsPath,
	webviewNlsZhCnPath,
} from './webviewLocalization.mts';
import { webviewNlsZhCnValueOverrides } from './webviewNlsZhCnOverrides.mts';
import { writeStableJsonFile } from '../shared/files.mts';
import { applyZhCnProofreader } from '../shared/zhCnPolicy.mts';

export type GenerateWebviewNlsZhCnResult = {
	diff: WebviewNlsDiff;
	existingZhCn: WebviewNlsJson;
	nextZhCn: WebviewNlsJson;
	updated: boolean;
	webviewNls: WebviewNlsJson;
};

export function generateWebviewNlsZhCn(): GenerateWebviewNlsZhCnResult {
	const webviewNls = readWebviewNls(webviewNlsPath);
	const existingZhCn = readWebviewNls(webviewNlsZhCnPath);
	const { catalog: syncedZhCn } = syncWebviewNlsZhCn(webviewNls, existingZhCn);
	const nextZhCn = applyZhCnProofreader(syncedZhCn, webviewNls, { extraExceptions: webviewNlsZhCnValueOverrides });
	const diff = diffWebviewNlsCatalog(existingZhCn, nextZhCn);
	const updated = hasWebviewNlsChanges(diff);

	if (updated) {
		writeStableJsonFile(webviewNlsZhCnPath, nextZhCn);
	}

	return {
		diff: diff,
		existingZhCn: existingZhCn,
		nextZhCn: nextZhCn,
		updated: updated,
		webviewNls: webviewNls,
	};
}

function runCli(): void {
	const result = generateWebviewNlsZhCn();

	if (!result.updated) {
		console.log("已跳过 'src/i18n/webviews/webviews.nls.zh-cn.json'；内容已同步。");
	} else {
		console.log("已同步 'src/i18n/webviews/webviews.nls.zh-cn.json'。");
	}

	console.log(
		`webviews.nls.zh-cn.json 摘要：新增 ${result.diff.added.length} 项，更新 ${result.diff.updated.length} 项，移除 ${result.diff.removed.length} 项，未变更 ${result.diff.unchanged.length} 项。`,
	);
}

if (isEntrypoint(import.meta.url)) {
	runCli();
}

function isEntrypoint(moduleUrl: string): boolean {
	const entry = process.argv[1];
	if (entry == null) return false;

	return moduleUrl === pathToFileUrl(entry);
}

function pathToFileUrl(filePath: string): string {
	return pathToFileURL(path.resolve(filePath)).href;
}
