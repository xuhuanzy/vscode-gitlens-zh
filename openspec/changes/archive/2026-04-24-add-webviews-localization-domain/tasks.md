## 1. Webviews Domain Foundation

- [x] 1.1 Create the `i18n/domains/webviews` workflow, store, CLI entry points, and controlled data files on top of the shared i18n core
- [x] 1.2 Define the dynamic webview `runtime-key` output naming scheme, the static localized HTML artifact layout under `src/i18n`, and the mapping from supported shells to those generated outputs
- [x] 1.3 Add initial workflow tests and fixtures for the webviews domain catalog, workset, and pending report pipeline

## 2. Source Extraction And Catalog Sync

- [x] 2.1 Implement the static HTML/partial extractor for supported webview shells such as `settings`
- [x] 2.2 Implement the Lit extractor for supported template text and allowed translatable attributes
- [x] 2.3 Keep the extractor scope limited to shipped HTML/Lit/current imperative paths, and report unsupported JSX/TSX plus remaining imperative positions as deferred follow-up instead of silently skipping them
- [x] 2.4 Generate webviews catalog/workset/report outputs from extracted occurrences and validate both runtime bundle generation and static localized HTML artifact generation from the resolved webview outputs

## 3. Shared Runtime Localization

- [x] 3.1 Add shared webview i18n runtime support under `src/i18n` for locale resolution, bundle access, static localized HTML artifact lookup, and runtime text lookup
- [x] 3.2 Teach `src/webviews/webviewController.ts` to resolve localized HTML artifacts from `src/i18n` and inject locale/bundle metadata without widening individual webview `State` or `protocol.ts` contracts
- [x] 3.3 Keep runtime localization consumption inside the shared controller/runtime boundary so `GlWebviewApp`, `GlAppHost`, and the legacy `App` base do not need page-level i18n plumbing
- [x] 3.4 Localize supported static shell metadata such as root HTML language and translated shell attributes by generating derived HTML artifacts under `src/i18n`, without relying on post-render DOM replacement

## 4. Page-Family Rollout And Verification

- [x] 4.1 Wire `welcome` end-to-end as the first dynamic-template pilot for extractor, bundle generation, and shared runtime consumption
- [x] 4.2 Wire `settings` end-to-end as the first static HTML/partial pilot for extractor, `src/i18n`-hosted localized shell artifact generation, and first-paint localized shell output
- [x] 4.3 Extend the shared webviews localization path to `rebase`, `home`, `commitDetails`, and `timeline`
- [x] 4.4 Mark `graph`, `patchDetails`, and remaining mixed-renderer or legacy edges as explicitly deferred, and document the follow-up implementation scope
- [x] 4.5 Add end-to-end verification for the supported `welcome` and `settings` runtime paths, and refresh workflow documentation for the staged webviews localization rollout
