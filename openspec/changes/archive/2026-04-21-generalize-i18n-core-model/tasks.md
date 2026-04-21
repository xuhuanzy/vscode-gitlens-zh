## 1. Core Model Restructure

- [x] 1.1 Create the new `i18n/core` and `i18n/domains/manifest` directory boundaries and move shared i18n infrastructure behind the new layout
- [x] 1.2 Replace manifest-specialized core types with a domain-neutral occurrence/reference/output reference model
- [x] 1.3 Replace manifest-specialized workset references with occurrence-based references and introduce the unified override selector model
- [x] 1.4 Rewrite the shared schema files to match the new core model and remove superseded i18n-only compatibility structures

## 2. Manifest Adapter Migration

- [x] 2.1 Rebuild the manifest domain context, store, extractor, reconcile, authority, and workflow code on top of the new core layer
- [x] 2.2 Update manifest catalog, workset, authority, and report generation to use the new occurrence/output reference model
- [x] 2.3 Rewrite any controlled i18n data files and fixtures under `i18n/**` that must change shape under the new model

## 3. Verification And Documentation

- [x] 3.1 Update the i18n workflow documentation to describe the new core/domain adapter organization and unified override semantics
- [x] 3.2 Update or rewrite the manifest workflow tests so they validate the new core model and hard-cut data structures
- [x] 3.3 Verify the manifest i18n workflow still completes end-to-end after the restructure and document any deferred follow-up needed for webviews
