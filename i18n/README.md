# I18n Workflow

当前 i18n 结构已切为 `core + domain adapter`：

- `i18n/core` 负责通用 occurrence、reference、output reference、authority、workset、report 模型
- `i18n/domains/manifest` 负责 `package.json` / `package.nls*` 的提取、对账与生成
- `webviews`、`quickpicks`、`formatter` 后续将作为新的 domain adapter 接入

`i18n/catalog/package.catalog.json` 保留 manifest domain 的完整 occurrence、source reference、output reference 与对账信息。
`i18n/worksets/package.zh-cn.json` 只保留翻译工作状态、双语消息记录与 `occurrenceIds` 引用，不重复落盘 occurrence 元数据。
`i18n/reports/package-pending.json` 是派生的索引/进度视图，只提供 counts、coverage 与 workset 定位信息，不作为编辑入口。
`i18n/authority/zh-cn/overrides.json` 统一承载 `occurrence` / `anchor` / `scope` / `output` 四类覆盖规则。

## 日常流程

1. 运行 `pnpm run sync:package-nls`，从 `package.json` + `package.nls.json` 重建 manifest catalog 与 workset。
2. 运行 `pnpm run report:package-nls:zh-cn:pending`，它会先刷新 catalog/workset，再默认回写 `i18n/reports/package-pending.json`。
3. 如需额外副本，再使用 `pnpm run report:package-nls:zh-cn:pending -- --write package-pending.snapshot.json`。
4. 由 Codex 读取 report 中的 `id` / `occurrenceIds` 定位条目，再修改 `i18n/worksets/package.zh-cn.json`，补全或修订条目的 `translation` 字段，并将状态推进到 `translated` / `needsReview` / `approved`。
5. 翻译多轮推进时重复运行 `pnpm run report:package-nls:zh-cn:pending`，让 authority / override 已覆盖的条目自动从 workset 中收敛掉。
6. 运行 `pnpm run promote:package-nls:zh-cn`，把 `approved` 条目晋升到 authority。
7. 运行 `pnpm run generate:package-nls`，重建 `package.json`、`package.nls.json` 与 `package.nls.zh-cn.json`。

## Override selector 语义

- `occurrence`：只覆盖一个具体 occurrence
- `anchor`：覆盖同一稳定锚点
- `scope`：覆盖某个 domain scope 下的 occurrence
- `output`：覆盖某个具体输出目标，例如 manifest key

manifest 域当前的解析优先级为：`output -> occurrence -> anchor -> scope -> authority -> terms`。

## 上游合并后的标准流程

1. 先合并上游英文源码。
2. 重新运行 `pnpm run sync:package-nls`。
3. 查看 `i18n/catalog/package.catalog.json` 中的 added / changed / moved / removed / ambiguous。
4. 修订 workset，必要时重新翻译并晋升 authority。
5. 重新生成 manifest 本地化产物。

## 约束

- 不使用 `contributions.json` 作为 i18n 真源。
- 不保留旧的 manifest-only 模型、旧 override 分文件结构或兼容读取逻辑。
- `webviews`、`quickpicks`、`formatter` 的运行时本地化仍是后续阶段，本次只完成 core 泛化与 manifest adapter 重建。
