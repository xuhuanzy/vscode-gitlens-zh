## Why

当前 `i18n` 消息存储已经出现两类结构债务：一是 `authority/messages.json` 与 `workset` 都围绕同一条消息重复保存割裂的 `sourcePattern` / `translationPattern` / `candidateTranslation` 结构，并额外落盘 item 级时间戳与 `patternFingerprint`；二是 `seedApprovedPackageNlsZhCn.mts` 继续以硬编码映射批量写入 `approved`，形成 authority 之外的影子真源。结果是 authority 虽然名义上是权威默认译法库，但实际既不适合人审阅，也不是唯一可审计的数据入口。

现在需要把消息记录模型重新收敛成单一、可读、可审计的双语消息结构，并把默认译法、待翻译状态、报告与晋升流程都建立在这套结构上，避免继续围绕旧模型叠加脚本和兼容层。

## What Changes

- **BREAKING** 将 `authority/messages` 从 `sourcePattern + translationPattern + patternFingerprint + promotedAt + updatedAt` 的 entry 结构重塑为统一的双语消息记录结构，去掉 item 级时间戳与持久化 `patternFingerprint`。
- **BREAKING** 将 `i18n/worksets/package.zh-cn.json` 的 entry 结构与 authority message entry 收敛到同一消息记录基底，只保留 workset 独有的 `status`、`keys`、`sourceHash`、`note` 等工作流字段。
- **BREAKING** 调整 `i18n` 内部类型、schema、解析、晋升与生成流程，使其直接消费新的消息记录模型，而不是继续围绕旧的 `MessagePattern` 落盘模型适配。
- 为 `authority/messages.json` 增加文件级元数据约束，例如顶层 `updatedAt`，并明确它是人工可审阅的权威默认译法源。
- 将硬编码批量灌种脚本从正式翻译数据路径中移除；任何可复用的默认译法都必须进入 authority/terms/overrides 等受控数据文件，而不是留在脚本常量里。
- 更新工作流文档、schema 与测试，确保新的消息记录模型仍然支撑 pending report、workset 编辑、authority 晋升与 `package.nls` 生成。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `message-authority`: authority message entry 与 translation workset entry 的规范改为统一的双语消息记录模型，并要求 authority 消息源保持可审阅、可直接维护。
- `branch-localization-workflow`: 分支本地化工作流改为只接受受控数据文件作为默认译法来源，禁止隐藏的脚本灌种路径充当影子真源。

## Impact

- 影响 `i18n/shared/model.mts`、`i18n/schemas/authority.schema.json`、`i18n/schemas/translationWorkset.schema.json` 与相关 message schema。
- 影响 `i18n/package/authority.mts`、`i18n/package/workflow.mts`、`i18n/package/store.mts`、`i18n/package/extractor.mts` 以及 `i18n/package/generatePackageNls.mts` 所依赖的消息解析与晋升逻辑。
- 影响现有 authority/workset JSON 数据文件和 `i18n/package/__tests__/packageNlsWorkflow.test.mts` 等测试覆盖。
- 影响 `i18n/package/seedApprovedPackageNlsZhCn.mts` 的角色，预计需要收缩、迁移或删除。
