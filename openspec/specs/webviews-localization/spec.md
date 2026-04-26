# webviews-localization Specification

## Purpose

TBD - created by archiving change add-webviews-localization-domain. Update Purpose after archive.

## Requirements

### Requirement: Webviews domain extracts translatable UI text from supported source kinds

The system SHALL extract translatable webview UI text from supported webview source kinds using source-aware extraction rules rather than runtime DOM inspection.

#### Scenario: Static HTML and partial content is extracted

- **WHEN** a supported webview contains user-visible text in a static HTML shell or HTML partial
- **THEN** the webviews domain extracts the text into the shared i18n catalog
- **AND** it preserves enough source reference detail to regenerate the localized shell artifact later

#### Scenario: Lit template content is extracted

- **WHEN** a supported webview contains user-visible text in a Lit template
- **THEN** the webviews domain extracts the text and allowed translatable attributes into the shared i18n workflow
- **AND** it does not require the page to be rewritten around manual per-call-site translation plumbing just to become extractable

#### Scenario: JSX/TSX and mixed-renderer positions remain explicitly deferred

- **WHEN** a webview source position falls inside a JSX/TSX subtree or other mixed-renderer boundary that is not yet supported by the current rollout
- **THEN** the workflow reports that position as deferred for follow-up instead of silently treating it as localized
- **AND** the current change does not require widening page-level i18n plumbing just to force coverage of that unsupported position

#### Scenario: Unsupported webview source remains deferred

- **WHEN** a webview source position is not yet covered by a supported extractor
- **THEN** the workflow leaves that source deferred instead of silently pretending it is localized
- **AND** the deferred position can be reported for later follow-up

### Requirement: Webviews localized outputs are emitted as derived runtime artifacts keyed by supported webview targets

The system SHALL generate localized runtime artifacts for supported webview targets as this branch's canonical `dist/webviews` output. Dynamic pages SHALL consume localized per-app entry bundles from the standard webview artifact tree, while static HTML shells SHALL be published through the same standard webview artifact tree rather than requiring runtime locale-specific script selection or maintained `src/i18n` helpers.

#### Scenario: Two dynamic webview apps generate separate canonical bundles

- **WHEN** two supported dynamic webview apps such as `welcome` and `timeline` are generated
- **THEN** each app receives its own localized bundle at the standard `dist/webviews/<bundle>.js` path
- **AND** loading one app does not require injecting the full message set for unrelated webviews

#### Scenario: Dynamic webview artifacts are emitted to the standard tree

- **WHEN** a supported dynamic webview emits runtime artifacts during the localized build
- **THEN** those artifacts are emitted under `dist/webviews`
- **AND** no supported dynamic webview requires a second dynamic bundle tree under `dist/webviews/i18n/<locale>`

#### Scenario: Static shell emits a localized HTML artifact for the standard webview path

- **WHEN** a supported static HTML webview such as `settings` is generated for the branch locale
- **THEN** the workflow publishes its localized shell to the standard `dist/webviews/<bundle>.html` runtime path
- **AND** it does not require hand-maintained locale HTML files beside `src/webviews`

#### Scenario: Generated outputs resolve from the webview localization workflow

- **WHEN** a localized webview output is generated
- **THEN** the generator resolves its source translations and generated-source destinations from the webview localization workflow
- **AND** the workset does not need to duplicate a second hand-maintained output store outside the catalog-driven workflow

#### Scenario: Intermediate localized webview sources are needed for the build

- **WHEN** the webview localization workflow needs localized source material before bundling
- **THEN** it may materialize intermediate generated sources under the configured work area
- **AND** the final runtime output is still published through `dist/webviews`
- **AND** no maintained localized webview runtime files are created under `src/i18n`

### Requirement: Static webview shells can localize first-paint HTML content

The system SHALL localize supported static webview shell content, including `lang` and allowed text or attribute positions, before first paint. Supported static shells SHALL be delivered through the branch's canonical `dist/webviews` artifacts.

#### Scenario: Settings shell is localized before first paint

- **WHEN** a supported static HTML webview such as `settings` is rendered
- **THEN** its localized shell text is available in the delivered HTML output before initial paint
- **AND** the workflow does not depend on a later DOM sweep to replace already-rendered English text

#### Scenario: Shell language metadata follows the active branch locale

- **WHEN** a localized webview shell is emitted for the branch locale
- **THEN** the root HTML language metadata reflects that locale
- **AND** supported accessibility-facing attributes such as translated labels or titles are emitted consistently with the localized shell

#### Scenario: Generated shell artifacts publish to the standard webview output

- **WHEN** the workflow emits a localized static shell for runtime consumption
- **THEN** the generated artifact is published under `dist/webviews`
- **AND** `src/webviews/**` continues to hold the upstream-oriented English source template rather than locale-specific duplicates

### Requirement: Supported webviews load localized canonical artifacts without runtime script selection

The system SHALL deliver supported localized webviews through the standard `dist/webviews` artifact paths used by the extension runtime.

#### Scenario: Dynamic webview uses the standard script path

- **WHEN** a supported dynamic webview such as `graph` is rendered on this branch
- **THEN** its HTML references `#{root}/dist/webviews/graph.js`
- **AND** it does not require `WebviewController` to rewrite that script reference to `dist/webviews/i18n/<locale>/graph.js`

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
