## MODIFIED Requirements

### Requirement: Branch localization workflow does not depend on contributions generation

The branch localization workflow SHALL NOT rely on `contributions.json`, `generate:contributions`, `extract:contributions`, or related webpack-triggered contribution regeneration as i18n inputs or maintenance steps. The workflow MUST preserve upstream contribution generation behavior for normal package maintenance, provided those generators operate only on root upstream-owned `package.json` and never on staged localized manifest artifacts.

#### Scenario: Manifest localization pipeline runs

- **WHEN** the branch localization pipeline processes manifest messages
- **THEN** it uses package-derived catalog data and i18n authority data without requiring `contributions.json`

#### Scenario: Upstream contribution generator is present

- **WHEN** an existing build path regenerates contribution-related manifest fields
- **THEN** the branch workflow treats that generator as upstream package maintenance rather than as a translation maintenance step
- **AND** it does not disable the generator solely because manifest localization staging exists

#### Scenario: Contribution extraction is run

- **WHEN** contribution extraction runs from `package.json`
- **THEN** it reads the root upstream-owned package manifest
- **AND** it does not read tokenized staged manifest output as the source for `contributions.json`

### Requirement: Branch localization workflow guards generated manifest boundaries

The branch localization workflow SHALL provide guardrails so generated localized package manifest artifacts cannot be mistaken for upstream package sources, contribution extraction inputs, or valid hand-edited translation sources.

#### Scenario: Maintainer invokes contribution extraction during i18n maintenance

- **WHEN** `extract:contributions` or equivalent contribution extraction is invoked while maintaining branch-localized manifest outputs
- **THEN** the workflow ensures extraction uses root `package.json`
- **AND** tokenized staged manifest output is not accepted as input for `contributions.json`

#### Scenario: Root package manifest contains generated localization tokens

- **WHEN** validation checks root `package.json`
- **THEN** it fails if root translatable manifest fields contain generated `%key%` localization tokens
- **AND** it directs maintainers to regenerate staged manifest outputs instead of committing tokenized root manifest changes

#### Scenario: Generated manifest artifact mutates upstream-owned files

- **WHEN** manifest localization generation runs
- **THEN** validation detects any mutation to root `package.json` or `contributions.json`
- **AND** rejects the run until generation is constrained to the staging output

## ADDED Requirements

### Requirement: Branch localization commands are exposed through a dedicated i18n CLI

The branch localization workflow SHALL expose i18n sync, report, promote, generate, test, and review operations through a dedicated CLI entry point under `./i18n`, rather than through branch-local scripts in root `package.json`.

#### Scenario: Maintainer runs manifest i18n workflow

- **WHEN** a maintainer needs to sync, report, promote, or generate manifest localization data
- **THEN** they invoke the dedicated i18n CLI
- **AND** root `package.json` does not need branch-local i18n script entries for that operation

#### Scenario: Build tooling needs i18n generation

- **WHEN** build tooling needs to generate localized webview, runtime dynamic, or manifest artifacts
- **THEN** it calls the dedicated i18n CLI or the underlying i18n script directly
- **AND** it does not depend on i18n script aliases in root `package.json`
