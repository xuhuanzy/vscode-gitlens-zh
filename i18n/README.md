# I18n Workflow

当前 i18n 结构已切为 `core + domain adapter`：

- `i18n/core` 负责通用 occurrence、reference、output reference、authority、workset、report 模型
- `i18n/domains/manifest` 负责 `package.json` / `package.nls*` 的提取、对账与生成
- `i18n/domains/webviews` 当前覆盖 `settings` 静态 HTML shell 的端到端提取/生成，以及 `welcome` / `rebase` / `home` / `commitDetails` / `timeline` / `graph` 的构建期本地化源码派生；本分支将本地化 webview 产物直接发布为 canonical `dist/webviews` 运行时产物，`patchDetails` 与其他 mixed-renderer 或后续页面族仍通过 deferred issues 显式保留在后续范围
- `i18n/domains/runtimeDynamic` 负责 formatter / quickpicks 这类扩展宿主动态 UI 文案的只读源码提取、对账、报告与 `.work` 本地化源码产物生成；webpack 构建期 loader 会在不修改 `src/**` 调用点的前提下将这些产物注入扩展 bundle

`i18n/authority/zh-cn/overrides.json` 统一承载 `occurrence` / `anchor` / `scope` / `output` 四类覆盖规则。

## Manifest Domain

- `i18n/catalog/package.catalog.json` 保留 manifest domain 的 occurrence、source reference、output reference 与对账信息
- `i18n/worksets/package.zh-cn.json` 保留 manifest 翻译工作状态与 `occurrenceIds`
- `i18n/reports/package-pending.json` 是 manifest 域的派生进度视图
- `.work/i18n/extension-root/zh-cn/{package.json,package.nls.json,package.nls.zh-cn.json}` 是 manifest 域的可重放运行时/打包 staging 产物；根目录 `package.json` 保持上游英文源码, 不承载 `%key%` 本地化 token

常用命令：

1. `node ./i18n/cli.mts manifest sync`
2. `node ./i18n/cli.mts manifest report --base HEAD`
3. `node ./i18n/cli.mts manifest promote`
4. `node ./i18n/cli.mts manifest generate`
5. `node ./i18n/cli.mts manifest package` 先从真实仓库根目录运行生产 bundle, 再生成 staged extension root, 并从该 root 运行不会再次触发 staged `vscode:prepublish` 的 `vsce package`

`.vscode/launch.json` 中的 `Run` 与 `Watch & Run` 会先运行 manifest staging 生成任务, 再使用 `.work/i18n/extension-root/zh-cn` 作为 `--extensionDevelopmentPath`。因此这两个桌面调试入口读取 staged `package.json`，而不是根目录英文 manifest。

## Webviews Domain

- `i18n/catalog/webviews.catalog.json` 保留 webviews domain 的 occurrence、source reference 与 runtime output reference
- `i18n/worksets/webviews.zh-cn.json` 保留 webviews 翻译工作状态与 `occurrenceIds`
- `i18n/reports/webviews-pending.json` 是 webviews 域的派生进度视图
- `dist/webviews/settings.html` 是构建后由 workflow 覆盖写入的本地化静态壳页运行时产物；构建流程会先产出英文 shell，再由本地化 workflow 覆盖同一个 canonical 运行时路径
- `--dynamic-sources-only` 与 `--settings-shell-only` 只根据既有 catalog / authority 生成对应运行时产物，不重跑全量 sync，避免构建过程刷新翻译根源数据
- `.work/i18n/webviews-sources/zh-cn/src/webviews/apps/welcome/**` 是由 workflow 基于上游英文源码 AST 派生的本地化动态源码中间产物，webpack 会再将其编译为 canonical `dist/webviews/welcome.js`
- `patchDetails` 与其余尚未接入的 mixed-renderer / follow-up 页面当前不会生成本地化脚本产物，而是通过 catalog reconciliation 中的 deferred issues 暴露后续范围

常用命令：

1. `node ./i18n/cli.mts webviews sync`
2. `node ./i18n/cli.mts webviews report --base HEAD`
3. `node ./i18n/cli.mts webviews promote`
4. `node ./i18n/cli.mts webviews generate`
5. `pnpm run build:webviews`

## Runtime Dynamic Domain

- `i18n/catalog/formatter.catalog.json` / `i18n/catalog/quickpicks.catalog.json` 保留 formatter 与 quickpicks runtime dynamic domain 的 occurrence、source reference、runtime output reference 与对账信息
- `i18n/worksets/formatter.zh-cn.json` / `i18n/worksets/quickpicks.zh-cn.json` 保留对应翻译工作状态与 `occurrenceIds`
- `i18n/reports/formatter-pending.json` / `i18n/reports/quickpicks-pending.json` 是对应域的派生进度视图
- `.work/i18n/runtime-dynamic-sources/zh-cn/{formatter,quickpicks}/**` 是由 workflow 基于上游英文源码 AST 派生的本地化源码产物；构建时通过 `i18n/domains/runtimeDynamic/localizedRuntimeDynamicSourceLoader.cjs` 以内存替换方式注入 extension bundle, 不直接修改或替代 `src/**`
- 任何需要改动应用源码以消费 runtime dynamic 产物的路径, 必须先通过 source-touchpoint review; 禁止为了本地化在上层 commands、picker flows、views、services 中大面积添加调用点
- `pnpm run build:quick` / `pnpm run watch:quick` 会触发 runtime dynamic source generation；如果 VS Code Extension Host 已启动, 需要重新加载窗口才能看到新的 bundle

常用命令：

1. `node ./i18n/cli.mts formatter sync` / `node ./i18n/cli.mts quickpicks sync`
2. `node ./i18n/cli.mts formatter report --base HEAD` / `node ./i18n/cli.mts quickpicks report --base HEAD`
3. `node ./i18n/cli.mts formatter promote` / `node ./i18n/cli.mts quickpicks promote`
4. `node ./i18n/cli.mts formatter generate` / `node ./i18n/cli.mts quickpicks generate`
5. `pnpm run build:quick` 或启动对应 watch 任务后重新加载 Extension Host

## Override Selector 语义

- `occurrence`：只覆盖一个具体 occurrence
- `anchor`：覆盖同一稳定锚点
- `scope`：覆盖某个 domain scope 下的 occurrence
- `output`：覆盖某个具体输出目标
