## ADDED Requirements

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

The system SHALL generate localized runtime artifacts for supported webview targets. Dynamic pages SHALL consume per-app runtime bundles through a shared controller-injected runtime, while static HTML shells SHALL consume derived localized HTML artifacts generated under `src/i18n`, rather than maintaining locale-specific source pages beside `src/webviews`.

#### Scenario: Two dynamic webview apps generate separate bundles

- **WHEN** two supported dynamic webview apps such as `welcome` and `timeline` are generated
- **THEN** each app receives its own localized runtime bundle
- **AND** loading one app does not require injecting the full message set for unrelated webviews

#### Scenario: Static shell emits a localized HTML artifact under `src/i18n`

- **WHEN** a supported static HTML webview such as `settings` is generated for a locale
- **THEN** the workflow emits a derived localized HTML artifact under `src/i18n`
- **AND** it does not require hand-maintained locale HTML files beside `src/webviews`

#### Scenario: Generated outputs resolve from the webview localization workflow

- **WHEN** a localized webview output is generated
- **THEN** the generator resolves its destination from the webview localization workflow rather than from per-provider inline message blobs
- **AND** the workset does not need to duplicate a second hand-maintained output store outside the catalog-driven workflow

### Requirement: Webview runtime localization is injected through shared infrastructure

The system SHALL expose locale and localized bundle access through shared host→webview infrastructure so modern and legacy webviews consume the same runtime i18n contract without adding i18n payloads to each webview protocol state or page-level i18n plumbing.

#### Scenario: Modern webview app receives shared runtime localization without page-level plumbing

- **WHEN** a webview built on `GlWebviewApp` or `GlAppHost` is shown
- **THEN** `WebviewController` injects the shared webview runtime and locale/bundle payload for that page
- **AND** its page-specific `State` shape remains focused on domain state rather than carrying i18n payload fields

#### Scenario: Legacy app receives the same injected localization contract

- **WHEN** a legacy webview built on the older `App` base is shown
- **THEN** it receives the same locale and bundle contract from the shared injection boundary
- **AND** the workflow does not require a second incompatible i18n bootstrap path just for legacy pages

#### Scenario: Static shell selection goes through the same shared controller path

- **WHEN** a supported localized static shell is shown
- **THEN** `WebviewController` resolves the locale-specific HTML artifact from `src/i18n` before applying the existing HTML token injection
- **AND** the webview provider does not need to widen its `State` or `protocol.ts` contract just to select the localized shell

### Requirement: Static webview shells can localize first-paint HTML content

The system SHALL localize supported static webview shell content, including `lang` and allowed text or attribute positions, before first paint. Dynamic pages MAY use the shared injected DOM runtime for key-node localization so long as that logic remains concentrated in `src/i18n` and `WebviewController`.

#### Scenario: Settings shell is localized before first paint

- **WHEN** a supported static HTML webview such as `settings` is rendered
- **THEN** its localized shell text is available in the delivered HTML output before initial paint
- **AND** the workflow does not depend on a later DOM sweep to replace already-rendered English text

#### Scenario: Shell language metadata follows the active locale

- **WHEN** a localized webview shell is emitted for a non-English locale
- **THEN** the root HTML language metadata reflects that locale
- **AND** supported accessibility-facing attributes such as translated labels or titles are emitted consistently with the localized shell

#### Scenario: Generated shell artifacts stay under `src/i18n`

- **WHEN** the workflow emits a localized static shell
- **THEN** the generated artifact is stored under `src/i18n`
- **AND** `src/webviews/**` continues to hold the upstream-oriented English source template rather than locale-specific duplicates
