## Context

当前 `i18n` 里的消息模型同时承担了三种职责：抽取阶段的英文消息结构、authority 的最终默认译法结构、workset 的待翻译工作结构。结果是 `MessagePattern` 被重复塞进 `ManifestOccurrence`、`AuthorityMessageEntry`、`TranslationWorksetEntry` 与 override 相关逻辑里，而 authority/workset 又分别在外层再包一层 `sourcePattern`、`translationPattern` 或 `candidateTranslation`。这让同一条消息的结构字段被声明两次，落盘后可读性差，也让解析与晋升逻辑不得不围绕旧模型做搬运。

与此同时，`authority/messages.json` 目前还保存 item 级 `promotedAt`、`updatedAt` 和 `patternFingerprint`。这些字段几乎不参与实际解析，只增加 diff 噪音。更严重的是，`seedApprovedPackageNlsZhCn.mts` 继续通过硬编码映射直接把 workset 条目标成 `approved`，使 authority 之外又出现了一条默认译法来源路径。

这次 change 允许在 `i18n/**` 范围内做破坏性重构，不保留兼容层。因此设计目标不是“兼容旧模型”，而是重新定义更适合长期维护的消息记录模型，并要求 authority/workset/report/promote/generate 全部围绕新模型运作。

## Goals / Non-Goals

**Goals:**

- 将 authority 与 workset 的持久化 entry 收敛到统一的双语消息记录模型，消除并行 `sourcePattern` / `translationPattern` / `candidateTranslation` 结构。
- 让 `authority/messages.json` 成为可直接审阅的默认译法源，减少与解析无关的冗余字段和噪音 diff。
- 保持现有翻译层级与工作流语义不变：`key > anchor > scope > authority.messages > authority.terms`、workset 状态独立、approved 晋升到 authority。
- 移除脚本型影子真源，要求可复用默认译法都落入受控数据文件。
- 在不扩散到 `i18n/**` 之外的前提下，统一 schema、类型、测试和文档，降低后续继续演化的结构成本。

**Non-Goals:**

- 本 change 不重新设计 occurrence/catalog/reconciliation 的总体职责边界。
- 本 change 不要求把 authority `id` 从当前哈希式身份改成人类可读 id。
- 本 change 不扩展新的消息来源域；仍以 manifest/package workflow 为第一阶段作用范围。
- 本 change 不保留旧版 authority/workset JSON 的兼容读写或迁移 fallback。

## Decisions

### 1. 将持久化消息模型拆成“源消息结构”和“双语消息记录”，不再让 `MessagePattern` 充当所有角色

`i18n` 内部将明确拆分两类模型：

- `SourceMessage`：用于 occurrence/extractor 等只持有英文源消息的路径；
- `BilingualMessageRecord`：用于 authority/workset 等同时需要源文与译文的持久化记录。

`BilingualMessageRecord` 直接按 kind 声明一次结构字段：

- `literal`: `id`, `kind`, `source`, `translation`
- `template`: `id`, `kind`, `source`, `translation`, `slots`
- `rich`: `id`, `kind`, `source`, `translation`, `format`, `slots`
- `select` / `plural`: `id`, `kind`, `selector`, `cases`, 其中每个 case 持有 `{ source, translation }`

这样 authority/workset 不再需要并行保存两份 `MessagePattern`。结构一致性由 entry schema 本身表达，而不是依赖“两个 pattern 恰好 kind 相同”这一隐含约束。

选择这一方案，是因为当前最大的复杂度不是消息类型本身，而是双语数据被拆成两份平行对象后产生的冗余。相比之下，让 occurrence 继续保留单语源消息结构，再把 authority/workset 统一到双语记录，边界更清晰。

备选方案：

- 保留 `MessagePattern`，仅把 `sourcePattern` / `translationPattern` 包成更薄的 wrapper：仍然保留双对象并行结构，问题没有根治。
- 让 authority 只存 `source -> translation` 文本对：无法安全表达 rich/template/select/plural 的结构约束。

### 2. authority 与 workset 共享同一消息记录基底；workset 只额外保存工作流字段

`authority/messages` 与 `worksets/package.zh-cn.json` 的 entry 都建立在 `BilingualMessageRecord` 之上：

- authority entry 只保留默认译法本体；
- workset entry = `BilingualMessageRecord` + `status` + `keys` + `sourceHash` + `note`

这意味着 workset 不再保存“源结构 + 候选译文”两个分裂对象，而是直接保存当前这条消息的双语记录；pending 状态下 translation 可为空或缺省，translated/needsReview/approved 则携带候选译文。

选择这一方案，是因为 workset 与 authority 的差别本来就不在消息结构，而只在 workflow 状态和定位信息。把两者基底统一后，晋升逻辑会变成“剥离 workset 独有字段并写入 authority”，而不是重新组装另一种 entry 形态。

备选方案：

- 继续让 workset 使用 `sourcePattern + candidateTranslation`：会把 authority 与 workset 的结构分裂长期固化下来。
- 让 authority 直接带 status：会污染最终默认译法源，违背原始 workflow 设计。

### 3. 以文件级元数据替代 authority message entry 的 item 级时间戳和持久化 fingerprint

`authority/messages.json` 顶层新增或保留文件级元数据，例如 `updatedAt`。entry 级 `promotedAt`、`updatedAt`、`patternFingerprint` 不再落盘。

原因：

- git 已经是更可靠的历史来源，item 级时间戳只会制造无意义 diff；
- 当前 `patternFingerprint` 与 `id` 高度重复，且不参与独立解析；
- authority 的真正维护目标是“默认译法是否正确”，不是“每一条是什么时间写入”。

如果后续逻辑仍需 fingerprint，可在内存中从源消息结构现算，或从 `id` 反推，而不是长期持久化。

备选方案：

- 保留 `updatedAt` 但删掉 `promotedAt`：仍然会在每次批量修订时产生大面积噪音 diff。
- 继续持久化 `patternFingerprint` 以便调试：调试收益不足以抵消长期存储冗余。

### 4. 受控数据文件是唯一默认译法来源；硬编码 seed 脚本退出正式工作流

正式 workflow 只接受以下几类数据源：

- authority messages / terms / aliases
- scope / anchor / key overrides
- translation worksets

任何脚本都可以做生成、迁移、报告或校验，但不得再通过内联常量维护一份“默认译法表”并直接把 workset 条目批量批准。若需要一次性 bootstrap，脚本也必须把结果显式物化到 authority/workset 数据文件，然后退出维护链。

选择这一方案，是因为隐藏在脚本里的大常量表无法通过正常 data review 被审计，也会让“authority 是否为真源”失去意义。

备选方案：

- 继续保留 seed 脚本但把它标记为辅助工具：仍然会形成维护者心智中的第二真源。
- 把脚本常量迁入代码内置词典：只是把问题换个位置，不符合最小侵入的数据化维护方向。

### 5. 解析、晋升和生成逻辑直接消费新记录模型，不保留旧 shape 适配层

`authority.mts`、`workflow.mts`、`store.mts`、schema 与测试会直接围绕新消息记录模型重写：

- occurrence 解析继续从源消息结构生成稳定 `id`
- workset 同步直接写入双语消息记录 entry
- promote 只复制 authority 所需字段，不再从 `candidateTranslation` 重新拼 `translationPattern`
- generate 直接从已解析的本地化消息值读取最终输出

由于本 change 不保留兼容层，所以不会引入旧 schema fallback、双写或旧字段保留。现有 JSON 数据与测试同时迁移。

备选方案：

- 先在内部引入新类型，再保留旧 JSON shape 一段时间：会让 `i18n` 再经历一次过渡债务，与当前分支规则冲突。

## Risks / Trade-offs

- [破坏性重构面较大，容易在 schema、类型、测试之间失配] → 以 schema 为中心先定 entry 结构，再同步改类型、store、workflow 与测试，避免边改边猜。
- [select/plural 的双语 case 结构比现状更显式，也更容易写错] → 为每种 kind 增加 round-trip schema/test 样例，确保 source/translation 成对存在。
- [删除 item 级时间信息后，单条消息的写入时间不再能直接从 JSON 读取] → 明确把 git 历史作为唯一审计渠道，避免把 JSON 当历史数据库使用。
- [移除 seed 脚本后，已有大批默认译法的初始整理会更显性] → 允许一次性迁移脚本把现有脚本知识转成 authority/terms 数据，但迁移完成后不再作为正式入口保留。
- [authority 依旧使用哈希式 `id`，可读性问题只解决了一半] → 本 change 先解决 entry 结构和真源边界；是否重塑 `id` 另行评估。

## Migration Plan

1. 设计并落地新的 authority/workset schema，定义统一的双语消息记录结构及文件级元数据。
2. 重写 `i18n/shared/model.mts` 与相关 store/authority/workflow 类型，移除旧的持久化 `MessagePattern` 依赖。
3. 迁移现有 `i18n/authority/zh-cn/messages.json` 和 `i18n/worksets/package.zh-cn.json` 到新结构。
4. 调整 report、promote、generate、tests 以直接消费新模型。
5. 清理或迁出 `seedApprovedPackageNlsZhCn.mts` 的正式工作流角色，保证默认译法只来自受控数据文件。
6. 重新运行 manifest i18n workflow 的最小验证，确认 sync/report/promote/generate/test 都建立在新模型之上。

回滚策略依赖 git；本分支不保留旧格式兼容读写。

## Open Questions

- `workset` 在 `pending` 状态下是使用 `translation` 缺省、空字符串，还是显式 `null` 更合适？需要在 schema 与人工编辑体验之间取平衡。
- `terms`、`aliases`、overrides 是否也要同步采用统一的文件级 `updatedAt` 元数据规范，还是本 change 先只约束 `authority/messages`？
- authority/workset 是否需要顺手改成分卷存储，还是先只改 entry 结构，避免一次 change 同时引入存储分片决策？
