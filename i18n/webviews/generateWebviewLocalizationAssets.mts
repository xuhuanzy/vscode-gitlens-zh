import * as path from 'path';
import { generateManagedWebviewLocalizationArtifacts, rootDir } from './webviewLocalization.mts';

const result = generateManagedWebviewLocalizationArtifacts({ rootDir: rootDir, writeEnglishCatalog: true });

console.log(
	`已生成 webview HTML 本地化产物：${result.generated.length} 个 webview，英文目录共 ${Object.keys(result.englishCatalog).length} 项。`,
);

if (result.changedFiles.length === 0) {
	console.log('未检测到需要写回的 webview HTML 本地化文件。');
} else {
	for (const file of result.changedFiles) {
		console.log(`- ${path.relative(rootDir, file)}`);
	}
}
