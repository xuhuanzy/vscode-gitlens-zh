import {
	buildCommitDisplayZhCnCatalog,
	buildCommitDisplayCatalog,
	commitDisplayNlsPath,
	commitDisplayNlsZhCnPath,
	commitDisplayTranslationAuthorityPath,
	diffCommitDisplayCatalog,
	hasCommitDisplayCatalogChanges,
	readCommitDisplayCatalog,
	readCommitDisplayTranslationAuthority,
} from './commitDisplayLocalization.mts';
import { writeStableJsonFile } from '../shared/files.mts';

const commitDisplayCatalog = buildCommitDisplayCatalog();
const existingZhCn = readCommitDisplayCatalog(commitDisplayNlsZhCnPath);
const authority = readCommitDisplayTranslationAuthority(commitDisplayTranslationAuthorityPath);
const { catalog: nextZhCn, coverage } = buildCommitDisplayZhCnCatalog(commitDisplayCatalog, authority);
const diff = diffCommitDisplayCatalog(existingZhCn, nextZhCn);
const staleAuthorityEntries = Object.values(coverage).filter(entry => entry.source === 'stale').length;

writeStableJsonFile(commitDisplayNlsPath, commitDisplayCatalog);

if (!hasCommitDisplayCatalogChanges(diff)) {
	console.log("已跳过 'src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json'；内容已同步。");
} else {
	writeStableJsonFile(commitDisplayNlsZhCnPath, nextZhCn);
	console.log("已同步 'src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json'。");
}

console.log(
	`commitDisplay.nls.zh-cn.json 摘要：新增 ${diff.added.length} 项，更新 ${diff.updated.length} 项，移除 ${diff.removed.length} 项，未变更 ${diff.unchanged.length} 项。`,
);
console.log(`commitDisplay authority 摘要：过期 ${staleAuthorityEntries} 项。`);
