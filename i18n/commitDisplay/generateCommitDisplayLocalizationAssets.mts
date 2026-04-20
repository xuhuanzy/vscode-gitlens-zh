import {
	buildCommitDisplayCatalog,
	commitDisplayNlsPath,
	commitDisplayNlsZhCnPath,
	diffCommitDisplayCatalog,
	hasCommitDisplayCatalogChanges,
	readCommitDisplayCatalog,
	syncCommitDisplayZhCnCatalog,
} from './commitDisplayLocalization.mts';
import { writeStableJsonFile } from '../shared/files.mts';
import { applyZhCnProofreader } from '../shared/zhCnPolicy.mts';

const commitDisplayCatalog = buildCommitDisplayCatalog();
const existingCommitDisplayCatalog = readCommitDisplayCatalog(commitDisplayNlsPath);
const existingZhCn = readCommitDisplayCatalog(commitDisplayNlsZhCnPath);
const commitDisplayCatalogDiff = diffCommitDisplayCatalog(existingCommitDisplayCatalog, commitDisplayCatalog);
const { catalog: syncedZhCn } = syncCommitDisplayZhCnCatalog(
	commitDisplayCatalog,
	existingZhCn,
);
const nextZhCn = applyZhCnProofreader(syncedZhCn, commitDisplayCatalog);
const commitDisplayZhCnDiff = diffCommitDisplayCatalog(existingZhCn, nextZhCn);

if (writeStableJsonFile(commitDisplayNlsPath, commitDisplayCatalog)) {
	console.log("已生成 'src/i18n/commitDisplay/commitDisplay.nls.json'。");
} else {
	console.log("已跳过 'src/i18n/commitDisplay/commitDisplay.nls.json'；内容未变更。");
}

if (hasCommitDisplayCatalogChanges(commitDisplayZhCnDiff)) {
	writeStableJsonFile(commitDisplayNlsZhCnPath, nextZhCn);
	console.log("已生成 'src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json'。");
} else {
	console.log("已跳过 'src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json'；内容已同步。");
}

console.log(
	`commitDisplay.nls.json 摘要：新增 ${commitDisplayCatalogDiff.added.length} 项，更新 ${commitDisplayCatalogDiff.updated.length} 项，移除 ${commitDisplayCatalogDiff.removed.length} 项，未变更 ${commitDisplayCatalogDiff.unchanged.length} 项。`,
);
console.log(
	`commitDisplay.nls.zh-cn.json 摘要：新增 ${commitDisplayZhCnDiff.added.length} 项，更新 ${commitDisplayZhCnDiff.updated.length} 项，移除 ${commitDisplayZhCnDiff.removed.length} 项，未变更 ${commitDisplayZhCnDiff.unchanged.length} 项。`,
);
