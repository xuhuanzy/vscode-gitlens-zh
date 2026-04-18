## ADDED Requirements

### Requirement: Contributions generation SHALL emit stable package NLS keys

The system SHALL treat `contributions.json` as the English source for generated package contributions and SHALL emit `%key%` references into `package.json` together with an English `package.nls.json`.

#### Scenario: Generating command contribution titles

- **WHEN** `generate:contributions` processes a command label from `contributions.json`
- **THEN** the generated `package.json` command title MUST use a `%key%` reference
- **AND** `package.nls.json` MUST contain the referenced key mapped to the original English label

#### Scenario: Generating submenu, view, and welcome content strings

- **WHEN** `generate:contributions` processes submenu labels, view names, contextual titles, or view welcome contents
- **THEN** each generated package contribution string MUST use a `%key%` reference
- **AND** `package.nls.json` MUST contain the corresponding English source text for each generated key

### Requirement: Contributions extraction SHALL resolve NLS keys back to English

The system SHALL resolve `%key%` values in generated package contributions through `package.nls.json` before writing data back into `contributions.json`.

#### Scenario: Extracting command titles from a localized package manifest

- **WHEN** `extract:contributions` reads a command title in `package.json` that is stored as `%some.key%`
- **THEN** it MUST resolve `%some.key%` through `package.nls.json`
- **AND** it MUST write the resolved English string into `contributions.json` instead of the raw `%some.key%`

#### Scenario: Extracting other contribution fields from a localized package manifest

- **WHEN** `extract:contributions` reads submenu labels, view names, contextual titles, or view welcome contents stored as `%key%`
- **THEN** it MUST resolve each `%key%` through `package.nls.json`
- **AND** it MUST preserve English source strings in `contributions.json`

### Requirement: Package contribution NLS keys SHALL follow owner-based naming rules

The system SHALL generate package contribution NLS keys from the owning contribution field rather than from the English source string.

#### Scenario: Generating command and submenu keys

- **WHEN** a key is generated for a command title or submenu label
- **THEN** the key MUST include the normalized command ID or submenu ID and the target field name
- **AND** identical English labels under different owners MUST produce different keys

#### Scenario: Generating view keys

- **WHEN** a key is generated for a view name or contextual title
- **THEN** the key MUST include the normalized view ID and the target field name
- **AND** `name` and `contextualTitle` for the same view MUST produce distinct keys

#### Scenario: Generating welcome content keys

- **WHEN** a key is generated for `viewsWelcome.contents`
- **THEN** the key MUST include the normalized view ID
- **AND** it MUST use stable content-derived identity instead of positional index ordering
- **AND** reordering unrelated welcome entries MUST NOT rename unchanged keys

### Requirement: Package Chinese catalog SHALL be derived from the English package catalog

The system SHALL generate `package.nls.zh-cn.json` from `package.nls.json` by preserving existing translations and synchronizing the key set.

#### Scenario: Preserving existing Chinese translations

- **WHEN** the Chinese package catalog generator runs and an existing `package.nls.zh-cn.json` already contains translations for current keys
- **THEN** the generator MUST preserve those translated values

#### Scenario: Adding missing Chinese entries

- **WHEN** `package.nls.json` contains keys that do not exist in `package.nls.zh-cn.json`
- **THEN** the generator MUST add those keys to `package.nls.zh-cn.json`
- **AND** the initial value MUST default to the English source string

#### Scenario: Removing obsolete Chinese entries

- **WHEN** `package.nls.zh-cn.json` contains keys that no longer exist in `package.nls.json`
- **THEN** the generator MUST remove those obsolete keys from the generated Chinese catalog
