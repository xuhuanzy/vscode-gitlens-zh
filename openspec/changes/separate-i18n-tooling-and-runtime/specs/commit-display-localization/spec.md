## MODIFIED Requirements

### Requirement: Commit display copy SHALL be localized through an i18n-owned commit-display workflow

系统 SHALL 通过 `./i18n` 主导的 commit-display localization tooling 与 `src/i18n/commitDisplay` 下的 runtime catalog/adapter 本地化 `CommitFormatter` 与其后续 commit action QuickPick 发出的受控展示文案，而不是依赖 VS Code `l10n` manifest/catalog、`package.nls.json` 或 `webviews.nls.json`。

#### Scenario: Resolving commit display copy from runtime catalogs

- **WHEN** `CommitFormatter` 需要输出受控的 command label、tooltip、签名提示、PR 展示文案或 author mail title
- **THEN** 它 MUST 通过 `src/i18n/commitDisplay` 下 runtime adapter 解析这些文案
- **AND** 该 adapter MUST consume the English and locale commit-display JSON catalogs as the runtime source of truth
- **AND** 当当前 locale 没有可用翻译时，它 MUST 回退到现有英文文案

#### Scenario: Keeping commit display tooling ownership under `./i18n`

- **WHEN** 当前分支为 `CommitFormatter` 新增 extraction/generation、catalog 同步、待翻译报告、glossary 或 merge-assist 规则
- **THEN** 这些 tooling 能力 MUST 由 `./i18n/commitDisplay` 与 `./i18n/shared` 负责
- **AND** 它 MUST NOT 以新的顶层 `l10n/` 目录或平行于 `./i18n` 的 tooling ownership 模型作为默认路径

#### Scenario: Resolving commit action QuickPick copy from the commit-display workflow

- **WHEN** 用户通过 `CommitFormatter.commands()` 暴露的后续入口打开 commit action QuickPick
- **THEN** 该 QuickPick 的受控 action label、separator label、hint、远端资源操作 label 与顶部 stats 文案 MUST 通过同一 commit-display runtime adapter 解析
- **AND** 它 MUST 保留 commit summary、provider 名称、branch 名称、SHA、文件路径等动态值

## ADDED Requirements

### Requirement: Commit display runtime MUST NOT duplicate JSON catalogs into generated TypeScript catalogs

系统 SHALL 避免将 commit-display English/locale JSON catalogs 再生成一份等价 TypeScript catalog 作为运行时数据源。

#### Scenario: Consuming commit display JSON catalogs directly

- **WHEN** commit-display runtime 需要 English source strings 或 locale translations
- **THEN** 它 MUST consume the commit-display JSON catalogs under `src/i18n/commitDisplay`
- **AND** 它 MUST NOT rely on a generated TypeScript file that duplicates `commitDisplay.nls.json` and `commitDisplay.nls.zh-cn.json`

#### Scenario: Preserving key typing without catalog duplication

- **WHEN** TypeScript key typing is needed for commit-display localization keys
- **THEN** the implementation SHOULD derive key types from the English JSON catalog or another non-duplicating source
- **AND** it MUST NOT introduce a second generated catalog copy solely for typing
