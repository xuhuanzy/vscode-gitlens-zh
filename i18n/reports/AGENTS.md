# i18n/reports Agent Guide

本目录下的 JSON 文件是由 `./i18n/package` 工作流生成或刷新的派生报告, 不是翻译真源, 也不是人工维护的工作台。

## 核心规则

1. 允许读取本目录文件以了解当前 pending 数量、状态分布以及待处理条目的 workset 定位信息。
2. 禁止为了推进翻译而直接修改本目录下的 `*.json` 报告文件。
3. 真正需要编辑的文件位于 `../worksets/`, 例如 `i18n/worksets/package.zh-cn.json`。
4. 如果 report 的字段结构不满足消费需求, 应修改生成它的 workflow/schema/test, 然后重新运行报告命令, 而不是手工修补报告内容。

## Codex 处理方式

- 先读取 report, 用其中的 `items[].id` 或 `items[].keys` 定位待处理 workset 条目。
- 不要期待 report 提供 `sourceText`、`scope`、`occurrences` 之类的冗余上下文; 需要时回到 workset 或 catalog 查询。
- 再打开 `i18n/worksets` 下对应文件并修改条目的 `translation`、`status`、`note` 等字段。
- 完成一轮翻译后, 重新运行报告命令, 观察 counts/coverage 是否收敛。

## 禁止事项

- 不要把 `i18n/reports/*.json` 当作可提交的翻译输入源。
- 不要把 report 中出现的字段视为权威 schema, 以生成脚本与 schema 文件为准。
- 不要为了保留旧 report 字段而引入兼容层、双写或 fallback。
