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

## 产物

- `[commitDisplay.nls.json](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplay.nls.json)`
- `[commitDisplay.nls.zh-cn.json](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json)`
- `[commitDisplayLocalization.ts](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplayLocalization.ts)`

其中：

- `commitDisplay.nls.json` 是 English canonical catalog
- `commitDisplay.nls.zh-cn.json` 由 English catalog 同步并保留已有翻译
- `commitDisplayLocalization.ts` 是 runtime adapter，直接消费 JSON catalog，不再生成平行的 TS catalog 副本

## 常用命令

```bash
pnpm run generate:commit-display-localization-assets
pnpm run generate:commit-display-nls:zh-cn
pnpm run report:commit-display-nls:zh-cn:pending -- --base HEAD
```

## 生成规则

- commit display catalog 使用稳定的 owner-based key，而不是把英文原文当 key
- 当前 key 前缀限定为 `commitFormatter.` 与 `commitQuickPick.`
- English canonical strings 由 `commitDisplayLocalization.mts` 中的受控 entry 集合生成
- zh-CN catalog 从 English catalog 同步：
  - 已有翻译保留
  - 缺失 key 默认回落为英文
  - 过期 key 自动移除
- runtime 直接从 `src/i18n/commitDisplay/commitDisplayLocalization.ts` 导入 JSON catalog，未命中的 locale/value 统一回退 English

## 运行时行为

- runtime helper 使用当前 `env.language` 选择 locale
- `en` / `en-*` 直接回退 English
- `zh` / `zh-*` 当前统一映射到 `zh-cn`
- commit display runtime adapter 位于 `src/i18n/commitDisplay`
- commit display 运行时查表必须保持同步，不在 getter 中执行异步文件读取
