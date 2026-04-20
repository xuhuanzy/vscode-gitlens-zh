import {
	ensurePackageNlsExists,
	hasPackageNlsChanges,
	packageNlsPath,
	packageNlsZhCnPath,
	readPackageNls,
	syncPackageNlsZhCn,
} from './packageLocalization.mts';
import { writeStableJsonFile } from '../shared/files.mts';

ensurePackageNlsExists();

const packageNls = readPackageNls(packageNlsPath);
const existingZhCn = readPackageNls(packageNlsZhCnPath);
const { catalog: nextZhCn, diff } = syncPackageNlsZhCn(packageNls, existingZhCn);

if (!hasPackageNlsChanges(diff)) {
	console.log("已跳过 'package.nls.zh-cn.json'；内容已同步。");
} else {
	writeStableJsonFile(packageNlsZhCnPath, nextZhCn);
	console.log("已同步 'package.nls.zh-cn.json'。");
}

console.log(
	`package.nls.zh-cn.json 摘要：新增 ${diff.added.length} 项，更新 ${diff.updated.length} 项，移除 ${diff.removed.length} 项，未变更 ${diff.unchanged.length} 项。`,
);
