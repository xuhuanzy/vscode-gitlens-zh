## Why

当前 `commitDisplay` 的旧工作流只能防止部分 key churn，不能防止 semantic drift：同一条英文模板一旦变化，`src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json` 里已有的旧中文仍会被保留，而 `pending` 报告也不一定会立即把它判成待更新。这会让上游 merge 后的英文改词静默带着过期中文继续发布。

要让这条 i18n 分支具备持续合并上游的可靠性，manual zh-CN 不能再直接寄存在生成后的 runtime catalog 里。我们需要把“人工确认过的翻译”迁到单独的权威映射文件，并在每次更新时拿当前英文源码比对它；只要英文变了，就立刻让旧中文失效并进入待处理队列。

## What Changes

- 为 `commitDisplay` 引入 tooling-owned 的权威 zh-CN 翻译映射文件，直接按英文模板记录人工确认译文。
- 将 `zhCnProofreader` 当前硬编码在 TypeScript 常量中的权威内容迁移到 `./i18n` 下单独的 authority 目录，并区分通用 authority 内容与 branch-owned / surface-owned authority 内容。
- 将 `src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json` 改为纯生成产物，不再作为人工维护真源；生成时仅写入“当前英文仍匹配”的人工译文或 proofreader 可确定覆盖的输出。
- 当 authority file 中某条英文模板不再出现在当前源码导出的 English catalog 中时，更新流程 MUST 立即使该旧译文失效，并从生成的 zh-CN runtime catalog 中移除对应项。
- 扩展 commit-display update/report 工作流：对比当前英文源码、权威映射与 proofreader 覆盖结果，立即报告 stale / missing translations，而不是继续沿用旧中文。
- 重构 commit-display 的英文真源组织方式，删除 `commitDisplayLocalization.mts` 中那类仅为生成而维护的平行 English 目录，改为直接扫描源码边界上的英文模板调用。
- 将 `sharedZhCnPassthroughValues`、`sharedZhCnProtectedTerms` 与共享 glossary 内容收敛到统一 authority 词典模型；像 `"Blame": "Blame"` 这样的 identity mapping 应作为权威数据表达，而不是继续分散在多套常量集合里。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `commit-display-localization`: commit-display 的当前英文、zh-CN 生成、stale invalidation 与 pending report 语义将改为 authority-backed workflow。
- `i18n-tooling-workflow`: 共享 i18n tooling 将支持“权威翻译映射 + 生成产物 locale catalog”的双层模型，而不是继续把 runtime locale catalog 当作唯一人工维护入口。
- `zh-cn-proofreader-policy`: pending report 将复用与生成阶段一致的 proofreader 与 authority validation，准确区分 covered、stale 与 unresolved。

## Impact

- Affected tooling: [i18n/commitDisplay/commitDisplayLocalization.mts](/D:/Workspace/learn/js/vscode-gitlens/i18n/commitDisplay/commitDisplayLocalization.mts), [i18n/commitDisplay/generateCommitDisplayLocalizationAssets.mts](/D:/Workspace/learn/js/vscode-gitlens/i18n/commitDisplay/generateCommitDisplayLocalizationAssets.mts), [i18n/commitDisplay/reportPendingCommitDisplayNlsZhCn.mts](/D:/Workspace/learn/js/vscode-gitlens/i18n/commitDisplay/reportPendingCommitDisplayNlsZhCn.mts), [i18n/shared/catalog.mts](/D:/Workspace/learn/js/vscode-gitlens/i18n/shared/catalog.mts), [i18n/shared/zhCnProofreader.mts](/D:/Workspace/learn/js/vscode-gitlens/i18n/shared/zhCnProofreader.mts)
- Affected authority assets: 新增 `./i18n` 下的 authority 目录，用于承载 shared JSON authority 词典与 branch-/surface-owned authority 文件
- Affected runtime/assets: [src/i18n/commitDisplay/commitDisplay.nls.json](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplay.nls.json), [src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json), [src/i18n/commitDisplay/commitDisplayLocalization.ts](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplayLocalization.ts)
- Affected source touchpoints: commit-display 当前英文真源与边界 helper 的组织方式需要回到“源码边界上的英文模板即 key”，相关 formatter / quickpick tests 也要更新。
