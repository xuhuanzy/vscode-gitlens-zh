## ADDED Requirements

### Requirement: Manifest localization uses root package as read-only upstream input

The manifest localization workflow SHALL read root `package.json` as the canonical upstream package manifest and MUST NOT write generated localization tokens or branch-local i18n command entries back into that root file.

#### Scenario: Manifest localization is generated

- **WHEN** the manifest localization generation workflow runs
- **THEN** root `package.json` remains byte-for-byte unchanged by the generation step
- **AND** generated `%key%` manifest values are written only to the configured staging output

#### Scenario: Upstream package manifest is merged

- **WHEN** upstream changes to root `package.json` are merged into the branch
- **THEN** the workflow extracts and reconciles manifest messages from the merged root file
- **AND** localized manifest outputs are regenerated from i18n data rather than preserved as root-file edits

### Requirement: Manifest localization emits package manifest staging artifacts

The manifest localization workflow SHALL emit a tokenized `package.json`, an English `package.nls.json`, and a localized `package.nls.zh-cn.json` into a staging location that localized debug, build, or package flows can consume explicitly.

#### Scenario: Staged manifest output is requested

- **WHEN** the manifest localization generator runs with the staging output configuration
- **THEN** the staging location contains a tokenized package manifest with matching English package NLS keys
- **AND** it contains localized package NLS values for resolved translations

#### Scenario: Staging output is regenerated after source changes

- **WHEN** root `package.json` or i18n authority data changes
- **THEN** rerunning the generator updates the staged package manifest and package NLS files from the current source and authority state
- **AND** no hand-maintained staged translation edits are required

### Requirement: Localized consumers select staged manifests explicitly

Flows that need localized package manifest UI SHALL consume the staged manifest output explicitly rather than relying on mutation of root `package.json`.

#### Scenario: Localized extension package is built

- **WHEN** a packaging flow needs localized manifest strings
- **THEN** it generates the staged manifest output before invoking the packager
- **AND** it runs packaging against an extension root or manifest source that contains the staged `package.json` and package NLS files
- **AND** package runtime and manifest asset directories required by the packager are materialized as staged files rather than only exposed through symlinks

#### Scenario: Localized extension package runs a production build

- **WHEN** a localized packaging command needs to build production extension assets
- **THEN** it runs the build from the real repository root
- **AND** it prevents `vsce package` from invoking `vscode:prepublish` from the staged extension root

#### Scenario: Default upstream development build runs

- **WHEN** a normal upstream-oriented development build runs without localized manifest selection
- **THEN** it uses root `package.json`
- **AND** it does not generate tokenized manifest changes in the root workspace

### Requirement: Staged manifest artifacts are not translation sources

The manifest localization workflow SHALL treat staged package manifest artifacts as generated outputs. The authoritative translation inputs MUST remain the i18n catalog, workset, authority, and override files.

#### Scenario: Maintainer updates a translation

- **WHEN** a manifest translation needs to change
- **THEN** the maintainer updates the appropriate i18n authority, override, or workset data
- **AND** regenerates the staged package manifest artifacts from those data files

#### Scenario: Staged artifact conflicts or is deleted

- **WHEN** a staged package manifest artifact is missing, stale, or conflicts with current source state
- **THEN** the workflow regenerates it from root `package.json` and i18n data
- **AND** it does not require manual recovery of the generated artifact
