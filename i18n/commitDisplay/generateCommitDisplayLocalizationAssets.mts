import { readFileSync, writeFileSync } from 'fs';
import {
	buildCommitDisplayCatalog,
	commitDisplayLocalizationGeneratedAssetPath,
	commitDisplayNlsPath,
	commitDisplayNlsZhCnPath,
	diffCommitDisplayCatalog,
	generateCommitDisplayLocalizationRuntimeAsset,
	hasCommitDisplayCatalogChanges,
	readCommitDisplayCatalog,
	syncCommitDisplayZhCnCatalog,
} from './commitDisplayLocalization.mts';

const commitDisplayCatalog = buildCommitDisplayCatalog();
const existingCommitDisplayCatalog = readCommitDisplayCatalog(commitDisplayNlsPath);
const existingZhCn = readCommitDisplayCatalog(commitDisplayNlsZhCnPath);
const commitDisplayCatalogDiff = diffCommitDisplayCatalog(existingCommitDisplayCatalog, commitDisplayCatalog);
const { catalog: nextZhCn, diff: commitDisplayZhCnDiff } = syncCommitDisplayZhCnCatalog(
	commitDisplayCatalog,
	existingZhCn,
);
const generatedAsset = generateCommitDisplayLocalizationRuntimeAsset(commitDisplayCatalog, { 'zh-cn': nextZhCn });

if (writeStableJsonFile(commitDisplayNlsPath, commitDisplayCatalog)) {
	console.log("已生成 'commitDisplay.nls.json'。");
} else {
	console.log("已跳过 'commitDisplay.nls.json'；内容未变更。");
}

if (hasCommitDisplayCatalogChanges(commitDisplayZhCnDiff)) {
	writeStableJsonFile(commitDisplayNlsZhCnPath, nextZhCn);
	console.log("已生成 'commitDisplay.nls.zh-cn.json'。");
} else {
	console.log("已跳过 'commitDisplay.nls.zh-cn.json'；内容已同步。");
}

if (writeStableFile(commitDisplayLocalizationGeneratedAssetPath, generatedAsset)) {
	console.log("已生成 'src/system/-webview/commitDisplayLocalization.generated.ts'。");
} else {
	console.log("已跳过 'src/system/-webview/commitDisplayLocalization.generated.ts'；内容未变更。");
}

console.log(
	`commitDisplay.nls.json 摘要：新增 ${commitDisplayCatalogDiff.added.length} 项，更新 ${commitDisplayCatalogDiff.updated.length} 项，移除 ${commitDisplayCatalogDiff.removed.length} 项，未变更 ${commitDisplayCatalogDiff.unchanged.length} 项。`,
);
console.log(
	`commitDisplay.nls.zh-cn.json 摘要：新增 ${commitDisplayZhCnDiff.added.length} 项，更新 ${commitDisplayZhCnDiff.updated.length} 项，移除 ${commitDisplayZhCnDiff.removed.length} 项，未变更 ${commitDisplayZhCnDiff.unchanged.length} 项。`,
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
