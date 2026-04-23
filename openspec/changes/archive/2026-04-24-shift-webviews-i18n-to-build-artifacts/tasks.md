## 1. Dynamic Artifact Model

- [x] 1.1 Define the localized runtime script artifact layout, naming, and locale fallback rules for dynamic webview bundles
- [x] 1.2 Document how dynamic script artifact lookup integrates with existing localized HTML shell lookup in `WebviewController`

## 2. Generator And Workflow

- [x] 2.1 Build a supported AST/build-artifact generation path for dynamic bundles and remove any generator outputs that only serve the old runtime localization route
- [x] 2.2 Limit first-pass replacement support to currently extracted Lit text nodes, allowed attributes, and controlled imperative positions, with explicit unresolved reporting for out-of-scope patterns
- [x] 2.3 Add workflow fixtures and tests for generating localized `welcome` script artifacts from authority-approved translations
- [x] 2.4 Ensure watch builds regenerate localized dynamic sources before recompiling localized webview bundles

## 3. Controller Integration

- [x] 3.1 Teach `src/webviews/webviewController.ts` to resolve locale-specific script artifacts for supported dynamic pages and fall back to English bundles when unavailable
- [x] 3.2 Remove runtime localization payload injection and old runtime script installation from `src/webviews/webviewController.ts` without keeping compatibility branches

## 4. Multi-page Rollout

- [x] 4.1 Roll out localized script artifact loading for `welcome`, `rebase`, `home`, `commitDetails`, `timeline`, and `graph` without modifying upstream Lit template source files
- [x] 4.2 Add representative verification that supported dynamic pages render localized first paint content without the DOM localization runtime

## 5. Runtime Decommission Plan

- [x] 5.1 Delete shared runtime localization payload / DOM localization runtime code and any unused tests, schemas, or outputs that are not reused by the AST/build-artifact flow
- [x] 5.2 Delete `i18n/domains/webviews` runtime-bundle-oriented generation code unless it is directly reused by the AST/build-artifact pipeline, and document follow-up scope for `patchDetails` and mixed-renderer edges after the supported multi-page rollout
