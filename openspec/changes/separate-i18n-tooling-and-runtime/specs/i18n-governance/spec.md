## REMOVED Requirements

### Requirement: Branch-local i18n ownership SHALL live under `./i18n`

**Reason**: The previous requirement conflated tooling ownership with runtime catalog/helper ownership. Non-package runtime catalogs and runtime helpers are used by application code and should live under `src/i18n`, while extraction/report tooling should remain under `./i18n`.

**Migration**: Use the new split ownership requirement: `./i18n` owns extraction, generation, sync, reporting, glossary and translation-maintenance tooling; `src/i18n` owns runtime-consumed catalogs, runtime adapters, and runtime helper code.

## ADDED Requirements

### Requirement: i18n tooling and runtime ownership SHALL remain separated

系统 SHALL 将 i18n 工具链与运行时资产分离：`./i18n` 只承载抽取、生成、同步、报告、词库与翻译维护策略，`src/i18n` 只承载 extension/webview runtime 需要 import、bundle 或读取的 catalog、adapter 与 helper。

#### Scenario: Adding tooling for a localization surface

- **WHEN** 当前分支为某个 localization surface 新增 extraction、catalog generation、locale sync、pending report、glossary 或 merge-assist 能力
- **THEN** 该 tooling MUST 放在 `./i18n` 下
- **AND** 它 MUST NOT 作为 runtime import path 被 `src/` 代码消费

#### Scenario: Adding runtime i18n code or runtime catalogs

- **WHEN** 当前分支新增 extension host、webview host 或 webview client 在运行时需要执行或读取的 i18n code/catalog
- **THEN** 这些资产 MUST 放在 `src/i18n` 下
- **AND** 它 MUST NOT 分散到 unrelated `src/system`, `src/webviews`, formatter, quickpick 或 provider 目录中，除非该位置只是最小必要的 display-boundary 接入点

#### Scenario: Enforcing dependency direction

- **WHEN** runtime code 需要本地化数据或 helper
- **THEN** runtime code MUST import from `src/i18n` or surface-local runtime adapters
- **AND** runtime code MUST NOT import modules from `./i18n`
- **AND** `./i18n` tooling MAY read or write `src/i18n` catalog/runtime assets as part of generation and reporting workflows

### Requirement: Non-package runtime catalogs SHALL live with runtime i18n assets

系统 SHALL 将不受 VS Code manifest NLS 目录约束的 runtime catalog 放在 `src/i18n/<surface>/` 下，并与对应运行时 adapter 保持相邻 ownership。

#### Scenario: Organizing non-package catalogs

- **WHEN** 某个 catalog 不属于 VS Code package manifest localization
- **THEN** 它 MUST be organized under `src/i18n/<surface>/`
- **AND** English source catalog and locale catalogs for that surface MUST live in the same runtime i18n surface directory

#### Scenario: Keeping package manifest NLS at root

- **WHEN** catalog is `package.nls.json` or `package.nls.<locale>.json`
- **THEN** it MUST remain at the repository root next to `package.json`
- **AND** this exception MUST NOT be generalized to non-package runtime catalogs
