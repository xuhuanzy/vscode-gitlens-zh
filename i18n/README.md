# Package Manifest I18n Workflow

当前阶段仅覆盖 `package.json` / `package.nls*`。

`i18n/catalog/package.catalog.json` 保留完整 occurrence、scope 与对账信息。
`i18n/worksets/package.zh-cn.json` 只保留翻译工作状态、候选译文与 key 引用，不重复落盘 occurrence 元数据。
`i18n/reports/package-pending.json` 是派生的索引/进度视图，只保留 counts、coverage 与 workset 定位字段，不作为编辑入口。

## 日常流程

1. 运行 `pnpm run sync:package-nls`，从 `package.json` + `package.nls.json` 重建 catalog 与 workset。
2. 运行 `pnpm run report:package-nls:zh-cn:pending`，它会先刷新 catalog/workset，再默认回写 `i18n/reports/package-pending.json`。
3. 如需额外副本，再使用 `pnpm run report:package-nls:zh-cn:pending -- --write package-pending.snapshot.json`。
4. 由 Codex 读取 report 中的 `id` / `keys` 定位 workset 条目，再修改 `i18n/worksets/package.zh-cn.json`，将候选译文推进到 `translated` / `needsReview` / `approved`。
5. 翻译多轮推进时重复运行 `pnpm run report:package-nls:zh-cn:pending`，让 authority / override 已覆盖的条目自动从 workset 中收敛掉。
6. 运行 `pnpm run promote:package-nls:zh-cn`，把 `approved` 条目晋升到 authority。
7. 运行 `pnpm run generate:package-nls`，重建 `package.json`、`package.nls.json` 与 `package.nls.zh-cn.json`。

## 上游合并后的标准流程

1. 先合并上游英文源码。
2. 重新运行 `pnpm run sync:package-nls`。
3. 查看 `i18n/catalog/package.catalog.json` 中的 added / changed / moved / removed / ambiguous。
4. 修订 workset，必要时重新翻译并晋升 authority。
5. 重新生成 manifest 本地化产物。

## 约束

- 不使用 `contributions.json` 作为 i18n 真源。
- 不使用 `generate:contributions` / `extract:contributions` 维护本分支本地化。
- `webviews`、`quickpicks`、`formatter` 保留到后续阶段。
