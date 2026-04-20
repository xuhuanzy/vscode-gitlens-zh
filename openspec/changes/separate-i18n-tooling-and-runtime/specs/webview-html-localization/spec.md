## MODIFIED Requirements

### Requirement: Webview HTML localization catalogs SHALL be independent from package manifest catalogs

系统 SHALL 通过 `src/i18n/webviews` 下的 runtime catalog 与 `./i18n/webviews` 下的 tooling workflow 管理 webview HTML 本地化，并与 `package.nls.json`、`package.nls.zh-cn.json` 分离。

#### Scenario: 将运行时 HTML 字符串与 package 字符串分开管理

- **WHEN** 开发者生成或同步 webview HTML 本地化数据时
- **THEN** 该 tooling workflow MUST write the webview English and locale catalogs under `src/i18n/webviews`
- **AND** it MUST NOT 将这些运行时 HTML 字符串并入 package manifest 本地化 catalog
- **AND** package manifest catalogs MUST remain at the repository root

#### Scenario: Keeping generated webview HTML artifacts in dist

- **WHEN** tooling generates localized webview HTML templates or metadata derived from `dist/webviews/*.html`
- **THEN** generated template and metadata artifacts MUST remain under `dist/webviews`
- **AND** they MUST NOT be treated as source-of-truth catalogs under `src/i18n`

## ADDED Requirements

### Requirement: Webview HTML localization runtime MUST live under `src/i18n/webviews`

系统 SHALL 将 webview HTML localization 的 host runtime helper 集中在 `src/i18n/webviews` 下，避免新增 branch-local runtime helper 分散在 unrelated source folders。

#### Scenario: Localizing webview HTML from centralized runtime helper

- **WHEN** extension host applies webview HTML localization before runtime token replacement
- **THEN** it MUST call runtime helper code owned by `src/i18n/webviews`
- **AND** any existing integration point outside `src/i18n/webviews` MUST remain a thin display-boundary adapter or import update
