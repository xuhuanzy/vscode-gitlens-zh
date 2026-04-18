## 1. Core Contributions NLS Flow

- [x] 1.1 Extend `scripts/contributions/contributionsBuilder.mts` to collect package NLS entries while generating command, submenu, view, and `viewsWelcome` contributions
- [x] 1.2 Update `scripts/generateContributions.mts` to write `package.nls.json` alongside localized `package.json`
- [x] 1.3 Update `scripts/generateContributions.mts --extract` to resolve `%key%` values through `package.nls.json` before writing back to `contributions.json`

## 2. Stable Key Rules

- [x] 2.1 Implement owner-based key generation for command titles, submenu labels, view names, and contextual titles using normalized contribution identifiers
- [x] 2.2 Implement stable `viewsWelcome` key generation using `viewId` plus content-derived identity rather than positional indexes
- [x] 2.3 Add focused verification for duplicate English labels to ensure different owners generate different keys and extract back to the same English source

## 3. Package Localization Tooling

- [x] 3.1 Add `i18n/package/` migration tooling that initializes or repairs package NLS state without becoming part of the long-term `scripts/` flow
- [x] 3.2 Add a dedicated `i18n/package/` script to generate `package.nls.zh-cn.json` from `package.nls.json` while preserving existing translations
- [x] 3.3 Ensure the Chinese catalog generator adds missing keys, removes obsolete keys, and defaults new entries to English

## 4. Validation and Workflow

- [x] 4.1 Run the contributions generation flow and verify `package.json`, `package.nls.json`, and `package.nls.zh-cn.json` are internally consistent
- [x] 4.2 Run the extraction flow and verify `contributions.json` remains English and is not polluted by `%key%`
- [x] 4.3 Document the package contributions localization workflow, including when to use the main generation flow versus the `i18n/package/` helper scripts
