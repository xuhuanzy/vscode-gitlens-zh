## Why

当前 `i18n` 内核仍然带有明显的 manifest 一阶段痕迹，核心类型、schema、context 与 override 结构都默认围绕 `package.json` / `package.nls*` 建模。这已经开始阻碍 `src/webviews` 的接入；如果继续在现有模型上追加 webviews、quickpicks、formatter 适配器，后续只会重复引入领域特化字段、重复维护近似 schema，并加重持续 rebase 上游时的结构债务。

现在需要先把 `i18n` 区域硬切为 domain-neutral 的核心模型和按域适配的工作流，再在此基础上承接 webviews。本次变更允许对 `i18n` 区域进行破坏性更新且不保留兼容性代码，因此应趁当前范围仍集中于 `i18n/**` 时一次性完成模型拉平，而不是继续叠加过渡层。

## What Changes

- **BREAKING** 将 `i18n/shared/model.mts` 从 manifest 特化模型重构为 domain-neutral 的核心 i18n 模型，统一抽象 occurrence、reference、output reference、catalog、workset、authority 与 report。
- **BREAKING** 用统一的 source reference / output reference 结构替代现有 `ManifestOccurrence`、`keys`、`pathPointer`、`pathSegments` 等 manifest 特化字段。
- **BREAKING** 将 `i18n/package/**` 里的共享 store/context/authority 能力提升为 core 层，再把 manifest 流程收敛为一个 domain adapter，而不是继续充当事实上的核心实现。
- **BREAKING** 统一 override 数据模型与存储入口，替代当前 `scopeOverrides` / `anchorOverrides` / `keyOverrides` 的分裂结构，使 future domain 可以通过同一 selector 体系表达覆盖。
- **BREAKING** 重写相关 schema、测试数据与 workflow 文档，不保留旧文件结构兼容、旧 schema 兼容、旧数据迁移 fallback 或双写逻辑。
- 为后续 `webviews` 域建立明确前置条件：catalog/workset/authority/report 必须先能承载源码引用类 reference 与 runtime/output key 类 output reference。
- 保持运行时业务代码不在本提案中直接实现 webview 本地化；本提案只完成 `i18n` 内核与 manifest adapter 的泛化与重整。

## Capabilities

### New Capabilities

- `domain-localization-core`: 定义跨 manifest、webviews、quickpicks、formatter 共享的 domain-neutral i18n core 模型、reference/output reference 语义、统一 override 结构与 core 目录边界。

### Modified Capabilities

- `message-catalog-sync`: 将 catalog sync 从 manifest 特化 occurrence 模型调整为支持多域 source reference 与 output reference 的通用模型。
- `message-authority`: 将 authority、workset 与 override 解析从 manifest 特化字段调整为基于统一 selector 与 domain-neutral message identity 的结构。
- `branch-localization-workflow`: 将分支本地化工作流从 `package` 驱动的单域组织方式调整为 core + domain adapter 组织方式，并允许在 `i18n` 区域进行破坏性重整而不保留兼容层。

## Impact

- 直接影响 `i18n/shared/model.mts` 以及其在 `i18n/package/**` 中的全部消费者。
- 直接影响 `i18n/schemas/*.json`、`i18n/catalog/package.catalog.json`、`i18n/worksets/package.zh-cn.json`、`i18n/authority/zh-cn/*.json` 与 `i18n/README.md` 的结构定义和维护方式。
- 直接影响 `i18n/package/context.mts`、`i18n/package/store.mts`、`i18n/package/authority.mts`、`i18n/package/reconcile.mts`、`i18n/package/workflow.mts` 及相关测试。
- 间接影响后续 `webviews` 提案的可实现性，因为它将依赖这里定义好的 core 模型与 domain adapter 边界。
- 本次变更不直接修改 `src/webviews/**`、`src/i18n/**` 或业务运行时逻辑，但会为后续 webviews 本地化实现提供新的数据模型前提。
