import { readFileSync, writeFileSync } from 'fs';
import {
	buildCommitDisplayCatalog,
	commitDisplayLocalizationGeneratedAssetPath,
	commitDisplayNlsPath,
	commitDisplayNlsZhCnPath,
	generateCommitDisplayLocalizationRuntimeAsset,
	hasCommitDisplayCatalogChanges,
	readCommitDisplayCatalog,
	syncCommitDisplayZhCnCatalog,
} from './commitDisplayLocalization.mts';

const commitDisplayCatalog = buildCommitDisplayCatalog();
const existingZhCn = readCommitDisplayCatalog(commitDisplayNlsZhCnPath);
const { catalog: nextZhCn, diff } = syncCommitDisplayZhCnCatalog(commitDisplayCatalog, existingZhCn);
const generatedAsset = generateCommitDisplayLocalizationRuntimeAsset(commitDisplayCatalog, { 'zh-cn': nextZhCn });

writeStableJsonFile(commitDisplayNlsPath, commitDisplayCatalog);

if (!hasCommitDisplayCatalogChanges(diff)) {
	console.log("已跳过 'commitDisplay.nls.zh-cn.json'；内容已同步。");
} else {
	writeStableJsonFile(commitDisplayNlsZhCnPath, nextZhCn);
	console.log("已同步 'commitDisplay.nls.zh-cn.json'。");
}

if (writeStableFile(commitDisplayLocalizationGeneratedAssetPath, generatedAsset)) {
	console.log("已生成 'src/system/-webview/commitDisplayLocalization.generated.ts'。");
} else {
	console.log("已跳过 'src/system/-webview/commitDisplayLocalization.generated.ts'；内容未变更。");
}

console.log(
	`commitDisplay.nls.zh-cn.json 摘要：新增 ${diff.added.length} 项，更新 ${diff.updated.length} 项，移除 ${diff.removed.length} 项，未变更 ${diff.unchanged.length} 项。`,
);

function writeStableJsonFile(filePath: string, value: unknown): boolean {
	return writeStableFile(filePath, `${JSON.stringify(value, undefined, '\t')}\n`);
}

function writeStableFile(filePath: string, contents: string): boolean {
	try {
		if (readFileSync(filePath, 'utf8') === contents) {
			return false;
		}
	} catch {}

	writeFileSync(filePath, contents, 'utf8');
	return true;
}
