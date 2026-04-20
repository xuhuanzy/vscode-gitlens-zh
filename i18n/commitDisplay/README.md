# Commit Display 本地化

这个目录用于承接 commit 相关 host-side display copy 的 fork-local 本地化工作流。

## 当前范围

- 覆盖 `CommitFormatter` 的受控展示文案
- 覆盖由 `CommitFormatter.commands()` 暴露入口打开的 commit action QuickPick 文案
- 目标 surface 包括：
  - `commands()`
  - `message()` 的未提交标签
  - `link()` 的受控 tooltip / 标签
  - `pullRequest()` / `pullRequestState()`
  - `signature()` tooltip
  - author mail title
  - commit action QuickPick 的 action、separator、hint、远端资源标签与 stats
- 日期、relative time、revision formatting、commit message 正文、PR 标题、provider 名称、邮箱地址等动态值不在自动翻译范围内

## 产物与真源

- `[commitDisplay.nls.json](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplay.nls.json)`
- `[commitDisplay.nls.zh-cn.json](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json)`
- `[commitDisplayLocalization.ts](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplayLocalization.ts)`
- `[commit-display.translations.json](/D:/Workspace/learn/js/vscode-gitlens/i18n/authority/zh-cn/branch/commit-display.translations.json)`

其中：

- `commitDisplay.nls.json` 是 current English catalog，由 tooling 直接扫描 commit-display 源码中的本地化调用生成
- `commit-display.translations.json` 是唯一允许人工维护的 commit-display zh-CN authority 文件，格式为 `"English template": "中文"`
- `commitDisplay.nls.zh-cn.json` 是纯生成产物，不再允许直接手工编辑
- `commitDisplayLocalization.ts` 是 runtime adapter，直接消费 JSON catalog，未命中的 zh-CN key 自动回退 English

## 常用命令

```bash
pnpm run generate:commit-display-localization-assets
pnpm run generate:commit-display-nls:zh-cn
pnpm run report:commit-display-nls:zh-cn:pending -- --base HEAD
```

## 生成规则

- commit display catalog 直接把当前英文模板当作 key，同时把同一英文写回 value
- generator 不再维护单独的 source tree / rule family；它只扫描 commit-display 源码里的 `localizeCommitDisplayString(...)`、`getCommitQuickPickActionLabel(...)`、`getCommitQuickPickBranchActionLabel(...)` 与 `getCommitQuickPickSeparatorLabel(...)` 调用
- commit formatter command markdown 仍然走边界替换，但它消费的 key 也直接是英文模板本身
- zh-CN catalog 只由三层输入生成：
  - current English
  - authority file 中 English 仍匹配的人工译文
  - shared proofreader 可确定生成的输出
- authority entry 对应的英文 key 一旦不再出现在 current English catalog 中：
  - 对应 zh-CN runtime entry 会被移除
  - pending report 会立即把它报成 `authority 过期`
- 未被 authority 或 proofreader 覆盖的 key 不会写入 `commitDisplay.nls.zh-cn.json`
- runtime 通过缺失 locale key 自动回退 English，这属于预期行为，不表示运行时异常

## 维护约束

- 手工翻译只能改 `[commit-display.translations.json](/D:/Workspace/learn/js/vscode-gitlens/i18n/authority/zh-cn/branch/commit-display.translations.json)`
- 不要直接编辑 `[commitDisplay.nls.zh-cn.json](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json)`
- 如果上游改了英文文案，先运行 generate/report，再根据 stale 或 missing 项更新 authority file 中对应的英文 key
- shared authority 词典位于 `i18n/authority/zh-cn/shared/`，commit-display 不重复维护这些通用术语

## 运行时行为

- runtime helper 使用当前 `env.language` 选择 locale
- `en` / `en-*` 直接回退 English
- `zh` / `zh-*` 当前统一映射到 `zh-cn`
- commit display runtime adapter 位于 `src/i18n/commitDisplay`
- commit display 运行时查表必须保持同步，不在 getter 中执行异步文件读取
