import {
	diffWebviewNlsCatalog,
	hasWebviewNlsChanges,
	readWebviewNls,
	syncWebviewNlsZhCn,
	webviewNlsPath,
	webviewNlsZhCnPath,
} from './webviewLocalization.mts';
import { webviewNlsZhCnValueOverrides } from './webviewNlsZhCnOverrides.mts';
import { writeStableJsonFile } from '../shared/files.mts';
import { applyZhCnValueOverrides } from '../shared/zhCnPolicy.mts';

const webviewNls = readWebviewNls(webviewNlsPath);
const existingZhCn = readWebviewNls(webviewNlsZhCnPath);
const { catalog: syncedZhCn } = syncWebviewNlsZhCn(webviewNls, existingZhCn);
const nextZhCn = applyZhCnValueOverrides(syncedZhCn, webviewNls, { extraOverrides: webviewNlsZhCnValueOverrides });
const diff = diffWebviewNlsCatalog(existingZhCn, nextZhCn);

if (!hasWebviewNlsChanges(diff)) {
	console.log("已跳过 'src/i18n/webviews/webviews.nls.zh-cn.json'；内容已同步。");
} else {
	writeStableJsonFile(webviewNlsZhCnPath, nextZhCn);
	console.log("已同步 'src/i18n/webviews/webviews.nls.zh-cn.json'。");
}

console.log(
	`webviews.nls.zh-cn.json 摘要：新增 ${diff.added.length} 项，更新 ${diff.updated.length} 项，移除 ${diff.removed.length} 项，未变更 ${diff.unchanged.length} 项。`,
);
