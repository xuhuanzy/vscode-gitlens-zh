## Why

`src/webviews` 仍然包含大量只存在于 webview 侧的英文 UI 文案，且这些文案分散在静态 HTML、Lit 模板、TSX/JSX 和 legacy webview 运行时里。既有 manifest i18n 流程已经完成 core 泛化，现在需要把 webviews 作为正式 domain 接入同一套 catalog/workset/authority 流程，同时保持对上游 GitLens 源码的侵入最小、便于持续 rebase。

## What Changes

- 新增 `i18n/domains/webviews`，把 `src/webviews` 作为独立 i18n domain 接入现有 catalog/workset/authority/pending report 流程。
- 为 webviews 增加多 source-kind 提取能力；当前 change 聚焦静态 HTML/partial、Lit 模板和少量受控命令式 UI 字符串位，而把 JSX/TSX 与复杂 mixed-renderer 边界显式标记为 deferred follow-up，而不是在首轮强行落地通用 extractor。
- 为动态模板 webviews 生成面向 runtime/controller 层本地化资产的 locale bundle；为静态 HTML shell/partial 生成集中存放在 `src/i18n` 下的派生本地化 HTML artifact，而不是在 `src/webviews/**` 旁边维护第二套 locale 页面源码。
- 在 `src/i18n` 增加 webview runtime 元数据与静态 shell artifact 输出/读取层，并让 `WebviewController` 在最终 HTML 装配阶段统一注入 locale、bundle 数据与底层 DOM 本地化 runtime，而不是把 i18n payload 混入各个 `protocol.ts` 的 `State` 或在页面源码里铺开 `localize*()` 调用。
- 允许分阶段落地：先打通 report/extractor 与低侵入 runtime，并完成 `welcome` 与 `settings` 的首批端到端接入；随后以 controller 层 HTML 装配与底层 DOM runtime 扩展到 `rebase`、`home`、`commitDetails`、`timeline`，最后在后续范围中处理 `graph`、`patchDetails` 与其他混合渲染边界。

## Capabilities

### New Capabilities

- `webviews-localization`: 为 `src/webviews` 提供端到端的提取、对账、bundle 生成与 runtime 解析能力。

### Modified Capabilities

- `branch-localization-workflow`: 分支本地化工作流从 manifest-only 扩展到包含 webviews domain，同时保持 i18n 目录边界、最小侵入和可持续合并上游的约束。
- `message-catalog-sync`: message catalog sync 需要支持 webview source kind（HTML/Lit/JSX/legacy webview source）以及动态 runtime bundle / 静态 HTML artifact 两类输出，而不再只面向 manifest 提取与生成。

## Impact

- 新增 `i18n/domains/webviews/**` 的 extractor、workflow、report、tests 与受控数据文件。
- 影响 `src/webviews/webviewController.ts` 上的统一 runtime 注入方式与本地化 HTML artifact 选择逻辑。
- 新增 `src/i18n/**` 中的 webview runtime 本地化支持、bundle 读取层与静态 HTML shell artifact 生成/存储结构。
- 影响 `src/webviews/apps/**` 中的代表性页面族，当前已以静态 HTML 的 `settings` 与动态试点 `welcome` 验证共享路径。动态页运行时接入将继续在 `WebviewController` 附近收敛，而不是在 `src/webviews/apps/**` 内扩散调用点；后续再推进 `rebase` / `home` / `commitDetails` / `timeline`，并把 `graph` / `patchDetails` / 其他 mixed-renderer 页面作为显式后续范围。
