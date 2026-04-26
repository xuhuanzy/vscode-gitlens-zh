## Context

The current i18n workflow uses multiple `.work/i18n` generated roots:

- `.work/i18n/webviews-sources/<locale>` for localized webview TS sources
- `.work/i18n/runtime-dynamic-sources/<locale>/<domain>` for localized extension-host source injection
- `.work/i18n/webviews-settings-shell/en/settings.html` as an English snapshot of the built settings shell
- `.work/i18n/extension-root/<locale>` as a runnable/packageable localized extension root

The first three are rebuildable intermediate mappings from upstream source files. `extension-root` is different: it is a staging root consumed by launch/package flows. The settings webview is also currently special because i18n extracts from the post-build aggregated `dist/webviews/settings.html`, then writes localized HTML back over that same runtime path.

This branch should keep upstream source files English and easy to merge, so generated i18n artifacts should be deterministic, isolated, and easy to discard.

## Goals / Non-Goals

**Goals:**

- Use `.work/i18n/generated/<locale>/<repo-relative-path>` as the single generated source mirror for rebuildable i18n intermediates.
- Keep `.work/i18n/extension-root/<locale>` as the runnable/packageable extension staging root.
- Make webview and runtime dynamic generated source lookup resolve by repository-relative path.
- Treat settings HTML as source HTML files: `src/webviews/apps/settings/settings.html` plus `src/webviews/apps/settings/partials/*.html`.
- Let HtmlWebpackPlugin/html-loader aggregate localized settings partials during the build.
- Remove the dedicated settings shell English snapshot and post-build overwrite model.

**Non-Goals:**

- Do not introduce runtime locale selection or alternate `dist/webviews/i18n/<locale>` runtime paths.
- Do not move maintained translation authority, catalog, workset, or report files out of `i18n`.
- Do not localize every string in `src/webviews/apps/settings/settings.ts` unless it already fits supported webview source extraction rules.
- Do not change root `package.json`, `contributions.json`, or upstream-oriented `src/**` source files into localized maintained sources.

## Decisions

### Use a repository-relative generated mirror

Generated localized source files will be written under:

```text
.work/i18n/generated/<locale>/<repo-relative-path>
```

Examples:

```text
.work/i18n/generated/zh-cn/src/webviews/apps/home/home.ts
.work/i18n/generated/zh-cn/src/webviews/apps/settings/partials/current-line.html
.work/i18n/generated/zh-cn/src/git/formatters/commitFormatter.ts
.work/i18n/generated/zh-cn/packages/git/src/utils/remote.utils.ts
```

Rationale: the path itself identifies the upstream source file being mirrored. This avoids domain-shaped generated paths that duplicate information already tracked in catalogs/worksets and makes stale artifacts easier to inspect.

Alternative considered: keep domain-specific roots such as `webviews/sources` and `runtime-dynamic/sources`. That preserves producer identity in the path, but it keeps generated layout coupled to implementation domains rather than source ownership.

### Preserve `extension-root` as a staging root

`.work/i18n/extension-root/<locale>` remains separate because it is consumed as `--extensionDevelopmentPath` and by packaging flows. It contains a staged extension root, not only generated source mirrors.

Alternative considered: place all generated files directly under `extension-root`. That would blur build inputs with runtime/package staging and make it easier for webpack, launch, and packaging flows to consume the wrong artifact class.

### Treat settings HTML and partials as source targets

The webviews workflow will extract and generate `src/webviews/apps/settings/settings.html` and `src/webviews/apps/settings/partials/*.html` independently. The generated `settings.html` will retain its relative partial includes, so webpack can aggregate localized partials through the existing HtmlWebpackPlugin/html-loader pipeline.

Rationale: i18n should not need to build English `dist/webviews/settings.html` just to discover source strings, nor maintain an English snapshot to avoid reading back a localized dist artifact.

Alternative considered: continue extracting from aggregated `dist/webviews/settings.html`. This works, but it makes settings unlike other source-based webview extraction and requires extra snapshot/overwrite logic.

### Route localized settings build through webpack templates

Localized webview config should be able to use a generated template path for `settings` while keeping the standard final output path `dist/webviews/settings.html`. The build should not emit a second runtime HTML tree.

This likely requires extending the webview entry metadata or HtmlPlugin construction so a webview can override its template independently from its TS entry.

### Keep one producer per generated mirror path

The generated mirror relies on the invariant that a single repo-relative source path has one localized producer for a locale. If future domains need different localized versions of the same source file, the generator ownership must be reconciled before writing to the shared mirror path.

## Risks / Trade-offs

- Path collision between domains -> Add tests that enumerate webview and runtime dynamic targets and fail if two producers claim the same generated repo-relative path.
- Webpack watch loops from generated files -> Update watch ignored paths from domain-specific roots to `.work/i18n/generated` and keep source/authority/catalog paths as explicit dependencies.
- HtmlWebpackPlugin template override is more invasive than post-build overwrite -> Keep the change localized to webview webpack helper functions and avoid touching webview runtime controllers.
- Existing tests assert old `.work/i18n` paths -> Update tests to assert the source-mirror invariant rather than the old domain-specific directory names.
- `settings.ts` still has imperative English UI strings -> Keep this visible as remaining coverage; do not claim full settings webview localization until those strings are handled by supported extraction rules.

## Migration Plan

1. Introduce shared generated-root path helpers for `.work/i18n/generated/<locale>`.
2. Move webview localized dynamic source writes/reads to the generated mirror.
3. Move runtime dynamic source writes/loader reads to the generated mirror.
4. Change settings extraction/generation to source HTML targets for `settings.html` and `partials/*.html`.
5. Teach localized webview webpack config to use generated settings template/partials and emit the canonical `dist/webviews/settings.html`.
6. Remove settings shell snapshot/afterEmit overwrite plumbing.
7. Update tests and documentation.
8. Run focused i18n tests and relevant webview/build commands.
