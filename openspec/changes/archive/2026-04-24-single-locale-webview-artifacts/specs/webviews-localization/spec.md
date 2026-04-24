## ADDED Requirements

### Requirement: Supported webviews load localized canonical artifacts without runtime script selection

The system SHALL deliver supported localized webviews through the standard `dist/webviews` artifact paths used by the extension runtime.

#### Scenario: Dynamic webview uses the standard script path

- **WHEN** a supported dynamic webview such as `graph` is rendered on this branch
- **THEN** its HTML references `#{root}/dist/webviews/graph.js`
- **AND** it does not require `WebviewController` to rewrite that script reference to `dist/webviews/i18n/<locale>/graph.js`

## MODIFIED Requirements

### Requirement: Webviews localized outputs are emitted as derived runtime artifacts keyed by supported webview targets

The system SHALL generate localized runtime artifacts for supported webview targets as this branch's canonical `dist/webviews` output. Dynamic pages SHALL consume localized per-app entry bundles from the standard webview artifact tree, while static HTML shells SHALL be published through the same standard webview artifact tree rather than requiring runtime locale-specific script selection.

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

## REMOVED Requirements

### Requirement: Webview runtime localization is injected through shared infrastructure

**Reason**: Supported dynamic webviews are now localized at build time and published as canonical branch artifacts, so runtime localization bundle injection and locale-specific dynamic script selection are no longer part of the supported webview contract.

**Migration**: Use the generated localized `dist/webviews` artifacts. Keep translation authority and generated source overlays in the i18n workflow, but remove runtime paths that inject dynamic localization payloads or rewrite supported dynamic webview script references to `dist/webviews/i18n/<locale>`.
