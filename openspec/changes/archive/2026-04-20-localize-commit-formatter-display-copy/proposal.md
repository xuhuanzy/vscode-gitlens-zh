## Why

当前 branch 已经通过 `i18n/package` 与 `i18n/webviews` 覆盖了 package manifest 和 webview 的大部分本地化，但 `CommitFormatter` 仍在 extension host 侧直接输出英文展示文案。这些文案集中出现在 hover markdown、tooltip、签名提示、未提交标签、PR 展示与作者 mail title 中，已经成为 commit 相关 UI 的主要英文残留。

这次补齐不能再走新增 `l10n` 目录或大范围改写 `CommitFormatter` 的方向。根据当前 branch 的 i18n 治理约束，这项能力应由 `./i18n` 下的脚本、catalog 与生成规则主导，并且只在 `CommitFormatter` 的少数展示边界放置最小接入点，以保持对上游源码的最小侵入。

## What Changes

- 在 `./i18n` 下新增面向 commit display / host-side display copy 的 branch-local 本地化工作流，用于管理 `CommitFormatter` 与 commit action QuickPick 所需的英文与 zh-CN catalog、同步与待翻译报告。
- 为 `CommitFormatter` 的受控展示文案建立最小侵入的本地化接入路径，覆盖 `commands()`、`message()` 的未提交标签、`link()` tooltip、`pullRequest()` 展示文案、`signature()` tooltip，以及 author mail title。
- 补齐由 `CommitFormatter.commands()` 的“更多操作”入口打开的 commit action QuickPick 文案，包括 action label、分组 label、远端资源操作 label 与该界面顶部的受控 stats 文案。
- 为 commit display 展示层使用到的 PR state 提供本地化映射，但保持 `PullRequest.state` 模型值不变。
- 保持日期格式、relative time、revision formatting、commit message 正文、PR 标题、provider 名称、邮箱地址等动态数据或通用格式内容不变。
- 明确禁止为本 change 引入 VS Code `l10n` manifest/catalog 路径，或在 `CommitFormatter` 中进行大范围逐字符串改写。

## Capabilities

### New Capabilities

- `commit-display-localization`: 定义 commit 相关 host-side 纯展示文案如何通过 `./i18n` 主导的 branch-local 工作流完成本地化，并要求实现保持对上游源码的最小侵入。

### Modified Capabilities

- None.

## Impact

- Affected code: `src/git/formatters/commitFormatter.ts`、`src/quickpicks/items/commits.ts`、`src/commands/quick-wizard/steps/commits.ts`、相关 formatter / quickpick tests，以及新增的 `./i18n` commit display 工具链与薄适配层。
- Affected artifacts: `./i18n/commitDisplay` 下新增的 catalog / 生成规则 / zh-CN 同步与待翻译报告产物，及其对应脚本入口。
- Affected workflow: commit display copy 的本地化 ownership 将由 `./i18n` 主导，而不是依赖 VS Code `l10n` 或 package/webview 既有 catalog。
