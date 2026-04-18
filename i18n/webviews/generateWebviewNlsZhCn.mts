import { writeFileSync } from 'fs';
import {
	diffWebviewNlsCatalog,
	hasWebviewNlsChanges,
	readWebviewNls,
	syncWebviewNlsZhCn,
	webviewNlsPath,
	webviewNlsZhCnPath,
} from './webviewLocalization.mts';
import { webviewNlsZhCnValueOverrides } from './webviewNlsZhCnOverrides.mts';

const webviewNls = readWebviewNls(webviewNlsPath);
const existingZhCn = readWebviewNls(webviewNlsZhCnPath);
const { catalog: nextZhCn } = syncWebviewNlsZhCn(webviewNls, existingZhCn);
for (const [key, english] of Object.entries(webviewNls)) {
	const override = webviewNlsZhCnValueOverrides.get(english);
	if (override != null) {
		nextZhCn[key] = override;
	}
}
const diff = diffWebviewNlsCatalog(existingZhCn, nextZhCn);

if (!hasWebviewNlsChanges(diff)) {
	console.log("已跳过 'webviews.nls.zh-cn.json'；内容已同步。");
} else {
	writeFileSync(webviewNlsZhCnPath, `${JSON.stringify(nextZhCn, undefined, '\t')}\n`, 'utf8');
	console.log("已同步 'webviews.nls.zh-cn.json'。");
}

console.log(
	`webviews.nls.zh-cn.json 摘要：新增 ${diff.added.length} 项，更新 ${diff.updated.length} 项，移除 ${diff.removed.length} 项，未变更 ${diff.unchanged.length} 项。`,
);
