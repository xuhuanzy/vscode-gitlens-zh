## Context

当前 manifest i18n 流程里，Codex 实际编辑的是 `i18n/worksets/package.zh-cn.json`，而 `i18n/reports/package-pending.json` 只是 `createPendingReport()` 从 workset 与 catalog 再派生出来的一层视图。现有 report item 同时携带 `status`、`scope`、`occurrences`、`sourceText`、`keys` 等字段，等于把 workset 已有信息和 catalog 可查信息又复制了一遍。

这带来两个问题：

- `i18n/reports` 容易被误读成另一份翻译工作台，而不是可随时重建的派生物；
- Codex 在自动化循环里看到胖 report 后，更容易直接围绕 report 思考，而不是围绕真正会被提交和晋升的 workset 思考。

这个分支的 i18n 结构强调最小侵入和可重建，因此更合适的做法是把 report 重新收窄为“索引 + 统计”，让它只负责告诉 Codex 还有哪些 workset 条目待处理，而不是复制完整条目上下文。

## Goals / Non-Goals

**Goals:**

- 将 pending report 收窄为面向 workset 的只读索引视图。
- 保留 Codex 翻译循环所需的稳定进度统计与 workset 定位信息。
- 明确 `i18n/reports/**` 与 `i18n/worksets/**` 的职责边界，避免误编辑 report。
- 用目录级 `AGENTS.md` 把这一规则直接放到 `i18n/reports` 目录下。

**Non-Goals:**

- 不改变 authority、catalog、workset 的核心模型。
- 不引入 report 与 workset 并存的兼容字段、双写逻辑或迁移 fallback。
- 不扩展到 manifest 以外的 domain。
- 不把 report 变成新的翻译输入真源。

## Decisions

### 1. Pending report 只保留统计和 workset 定位信息

pending report 继续保留 `counts`、`coverage`、`baseRef`、`sinceBase` 这些流程统计字段，但 entry 级 payload 收缩为最小集合，仅保留足以定位 workset 条目的字段。

推荐的最小集合为：

- `id`: workset entry id，作为首选稳定定位符
- `status`: 当前工作状态，便于按状态筛选
- `keys`: 该 workset entry 覆盖的 occurrence key 列表，作为二次定位与审计线索

不再在 report 中复制：

- `sourceText`
- `scope`
- `occurrences`
- 任何候选译文或 occurrence 元数据

之所以保留 `id` 而不是只保留 `keys`，是因为当前 workset 的真实编辑单元是 entry，而一个 entry 可以聚合多个 key。只保留 key 虽然也能回查 workset，但会迫使 Codex 在消费 report 时重新做一遍 grouping。

备选方案：

- 仅保留裸 key 列表：字段更少，但会弱化 workset entry 这一真实编辑单元。
- 维持现有胖 report：实现最省事，但继续模糊 report 与 workset 的边界。

### 2. `i18n/reports` 被定义为派生只读目录

`i18n/reports/**` 中的文件被视为由 workflow 生成或刷新出来的派生输出。Codex 读取这些文件时，应把它们当作进度视图与索引提示，而不是手工维护对象。

目录级 `AGENTS.md` 需要直接说明：

- 可以读取 report 来判断当前剩余工作量；
- 真正要改的是 `i18n/worksets/**`；
- 如需变更 report 内容，应修改 workflow/schema/test，再重新生成 report；
- 不允许为了推进翻译而直接手改 `i18n/reports/*.json`。

备选方案：

- 只在根级 `AGENTS.md` 或 `i18n/README.md` 里描述：可行，但离实际目录太远，进入 `i18n/reports` 时提示不够直接。

### 3. 用直接替换替代兼容层

因为本分支明确禁止保留 i18n 兼容代码，这次调整直接更新 report 类型、schema、CLI 输出、测试与文档，不保留旧字段兼容。

备选方案：

- 新旧 report 字段并存一段时间：会增加 schema、测试和消费者理解成本，不符合当前分支规则。

## Risks / Trade-offs

- [某些人工排查场景会失去 report 中的即时上下文] → 需要时改为从 workset 或 catalog 查询，不再依赖 report 冗余字段。
- [已有脚本若隐式依赖 `sourceText/scope/occurrences` 会被打破] → 在实现时搜索仓库内消费者，并同步更新测试与文档。
- [只强调 key 可能让 agent 忽略 workset entry 聚合关系] → 在 report 中保留 `id`，并在 `AGENTS.md` 中明确以 workset entry 为编辑单位。

## Migration Plan

1. 更新 OpenSpec requirement，明确 pending report 是 workset 派生索引视图。
2. 调整 pending report 类型、schema 与 CLI 输出，仅保留统计和最小 entry 定位信息。
3. 更新测试，验证 report 仍能驱动翻译循环，并且不会再暴露胖字段。
4. 新增 `i18n/reports/AGENTS.md`，把 reports/worksets 边界前移到目录级说明。
5. 更新 `i18n/README.md` 与 `i18n/reports/AGENTS.md`，统一描述新的消费方式。

## Open Questions

- entry 级数组是否继续沿用 `items` 命名，还是同步改成更贴近 workset 的 `entries`；这取决于是否要把 schema 一并收敛。
- 后续若增加按状态分组输出，是否保留单一数组再由消费者分组，还是直接输出 `pending/translated/...` 分组结构；当前阶段先不扩大范围。
