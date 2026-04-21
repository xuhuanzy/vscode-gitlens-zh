## Why

当前 `pending` report 会把 workset 再投影成一份较完整的 item 明细，这让 `i18n/reports` 看起来像另一份待编辑数据源，但 Codex 最终真正修改的始终是 workset。继续维持这份“胖 report”会增加理解负担，也容易让后续自动化误把 `reports` 当成翻译工作台。

## What Changes

- 将 pending report 明确收缩为“面向 workset 的机器可读索引视图”，保留进度统计与可靠的 workset 定位信息，而不是复制完整翻译上下文。
- 规范 Codex 在本地化循环中的读写边界：`i18n/reports/**` 只作为派生报告读取，`i18n/worksets/**` 才是待翻译条目的唯一编辑面。
- 为 `i18n/reports` 增加目录级代理说明，显式约束 Codex 不得把 report 当作翻译输入真源或人工维护文件。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `branch-localization-workflow`: pending translation report 的职责从“胖明细输出”调整为“面向 workset 的索引/进度视图”，并明确 reports 目录为只读派生物。

## Impact

- 影响 `./i18n/package/reportPendingPackageNlsZhCn.mts`、`./i18n/package/workflow.mts`、`./i18n/shared/model.mts` 与 `./i18n/schemas/pendingReport.schema.json` 的 report 结构定义与输出内容。
- 影响 `./i18n/README.md` 与 `./i18n/reports/AGENTS.md`，用于统一 Codex 与维护者对 reports/worksets 边界的理解。
- 需要同步更新覆盖 pending report 的测试，确保新的 report 结构仍能稳定支撑 Codex 翻译循环与剩余工作量判断。
