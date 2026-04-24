## 1. Build Output Model

- [x] 1.1 Update webview i18n build configuration so supported localized dynamic entries compile to `dist/webviews`
- [x] 1.2 Ensure English webview builds and localized webview builds do not concurrently write overlapping runtime artifacts
- [x] 1.3 Stop emitting supported dynamic webview bundles under `dist/webviews/i18n/zh-cn`
- [x] 1.4 Keep shared assets such as media, fonts, and CSS available under the standard `dist/webviews` webroot

## 2. Runtime Simplification

- [x] 2.1 Remove dynamic localized script lookup helpers that only support `dist/webviews/i18n/<locale>/<bundle>.js`
- [x] 2.2 Remove `WebviewController` script-reference rewriting for supported localized dynamic webviews
- [x] 2.3 Keep standard webview HTML token replacement and `#{webroot}` behavior intact for canonical `dist/webviews` resources
- [x] 2.4 Remove or update tests that assert locale-specific dynamic script reference replacement

## 3. Static Shell Alignment

- [x] 3.1 Publish localized static shells directly to `dist/webviews/*.html` without a `src/i18n/webviews/<locale>` copied intermediate
- [x] 3.2 Update static shell lookup and tests to match the canonical `dist/webviews` runtime output contract
- [x] 3.3 Ensure generated shell `lang`, labels, titles, and first-paint text remain localized

## 4. Verification

- [x] 4.1 Add workflow/build tests asserting no supported dynamic webview requires `dist/webviews/i18n/zh-cn/*.js`
- [x] 4.2 Add or update tests proving supported webview HTML references standard `dist/webviews/<bundle>.js` paths
- [x] 4.3 Build representative dynamic webviews and confirm their runtime artifacts are emitted under the canonical `dist/webviews` output model
- [x] 4.4 Run relevant i18n workflow tests and webview build commands
- [x] 4.5 Verify packaged artifact rules include the localized `dist/webviews` output and do not rely on ignored source or work directories

## 5. Documentation And Cleanup

- [x] 5.1 Update i18n documentation to describe single-locale canonical webview artifacts
- [x] 5.2 Remove stale references to dynamic localized bundles under `dist/webviews/i18n/<locale>`
- [x] 5.3 Run OpenSpec validation for this change
- [x] 5.4 Remove obsolete `src/i18n` webview runtime helper modules and tests after canonical webview artifacts no longer consume them
- [x] 5.5 Remove old-layout compatibility branches and tests, including static-shell source-template fallback and localized-entry existence fallback
