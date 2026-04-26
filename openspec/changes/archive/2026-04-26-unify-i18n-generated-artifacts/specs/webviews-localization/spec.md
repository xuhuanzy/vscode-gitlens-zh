## ADDED Requirements

### Requirement: Webview generated intermediates use repository-relative source mirrors

The webviews localization workflow SHALL write rebuildable localized webview source intermediates under `.work/i18n/generated/<locale>/<repo-relative-path>`. The generated mirror MUST preserve the source file's repository-relative path and MUST NOT require a webview-domain-specific generated root such as `.work/i18n/webviews-sources`.

#### Scenario: Dynamic webview source is generated

- **WHEN** the webviews workflow generates a localized dynamic source file such as `src/webviews/apps/home/home.ts`
- **THEN** the generated source is written under `.work/i18n/generated/zh-cn/src/webviews/apps/home/home.ts`
- **AND** the final runtime bundle is still emitted through the standard `dist/webviews/home.js` path

#### Scenario: Webview generated paths are inspected

- **WHEN** a maintainer inspects generated webview intermediate files
- **THEN** each generated file path identifies the upstream source file by repository-relative path
- **AND** the workflow does not require a separate domain-shaped directory name to identify the source being mirrored

### Requirement: Settings static HTML localizes from source files without pre-aggregating partials

The webviews localization workflow SHALL treat `src/webviews/apps/settings/settings.html` and `src/webviews/apps/settings/partials/*.html` as source HTML targets. It MUST generate localized source mirrors for those files without merging partial files into `settings.html` before webpack processes the template.

#### Scenario: Settings HTML source and partials are generated

- **WHEN** localized settings HTML generation runs for `zh-cn`
- **THEN** the workflow writes `.work/i18n/generated/zh-cn/src/webviews/apps/settings/settings.html`
- **AND** it writes localized settings partials under `.work/i18n/generated/zh-cn/src/webviews/apps/settings/partials/`
- **AND** the generated `settings.html` preserves its relative partial include expressions

#### Scenario: Settings shell is built from localized source mirrors

- **WHEN** webpack builds the localized settings webview
- **THEN** HtmlWebpackPlugin uses the generated localized `settings.html` template
- **AND** html-loader resolves the generated localized partial files through their existing relative include paths
- **AND** the resulting localized HTML is emitted to the canonical `dist/webviews/settings.html` runtime path

#### Scenario: Settings source extraction does not require built dist HTML

- **WHEN** the webviews catalog is synchronized for settings HTML text
- **THEN** the workflow extracts from `src/webviews/apps/settings/settings.html` and its partial source files
- **AND** it does not require an English `dist/webviews/settings.html` artifact to exist before synchronization
- **AND** it does not maintain a dedicated English settings shell snapshot solely to avoid reading back localized dist output

### Requirement: Webview generated mirror paths have a single producer

The webviews localization workflow SHALL avoid writing multiple localized outputs to the same `.work/i18n/generated/<locale>/<repo-relative-path>` from different producers. A path collision MUST be reported as an implementation error instead of being resolved by last-writer-wins behavior.

#### Scenario: Two webview producers claim the same generated path

- **WHEN** two webview generation targets resolve to the same generated mirror path
- **THEN** the workflow reports the collision
- **AND** it does not silently overwrite one generated artifact with the other
