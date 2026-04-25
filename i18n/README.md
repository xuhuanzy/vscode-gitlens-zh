# I18n Workflow

当前 i18n 结构已切为 `core + domain adapter`：

- `i18n/core` 负责通用 occurrence、reference、output reference、authority、workset、report 模型
- `i18n/domains/manifest` 负责 `package.json` / `package.nls*` 的提取、对账与生成
- `i18n/domains/webviews` 当前覆盖 `settings` 静态 HTML shell 的端到端提取/生成，以及 `welcome` / `rebase` / `home` / `commitDetails` / `timeline` / `graph` 的构建期本地化源码派生；本分支将本地化 webview 产物直接发布为 canonical `dist/webviews` 运行时产物，`patchDetails` 与其他 mixed-renderer 或后续页面族仍通过 deferred issues 显式保留在后续范围
- `i18n/domains/runtimeDynamic` 负责 formatter / quickpicks 这类扩展宿主动态 UI 文案的只读源码提取、对账、报告与 `.work` 本地化源码产物生成；webpack 构建期 loader 会在不修改 `src/**` 调用点的前提下将这些产物注入扩展 bundle

`i18n/authority/zh-cn/overrides.json` 统一承载 `occurrence` / `anchor` / `scope` / `output` 四类覆盖规则。

## 常用流程

### 首选聚合命令

普通人工介入流程优先使用顶层聚合命令，不再默认拆成 manifest / formatter / quickpicks / webviews 四组分别执行：

```bash
node ./i18n/cli.mts sync
node ./i18n/cli.mts report --base HEAD
node ./i18n/cli.mts promote
node ./i18n/cli.mts generate
```

- `sync` 刷新 catalog、reconciliation report 与 workset
- `report` 刷新各 domain 的 pending report，并在控制台输出聚合摘要；如需额外保存聚合摘要，可加 `--write aggregate-pending.json`
- `promote` 将已批准 workset 条目提升到 authority
- `generate` 基于既有 catalog 与 authority 生成运行时产物

`sync` / `report` 默认覆盖 manifest、formatter、quickpicks；如果 `dist/webviews/settings.html` 已存在，也会覆盖 webviews。缺少该 settings shell 时会跳过 webviews 并说明原因；如果本次需要刷新 webviews catalog/report，先运行 webview 构建生成 settings shell，或只在明确不需要 webviews 时加 `--skip-webviews`。

### 手动修改 authority 后

如果只修改了 `i18n/authority/zh-cn/messages.json`、`terms.json`、`aliases.json` 或 `overrides.json`，通常不需要分别运行 formatter、quickpicks、webviews 的分域生成命令。直接运行：

```bash
node ./i18n/cli.mts generate
```

这个聚合命令会基于既有 catalog 与 authority 生成：

- formatter runtime dynamic 本地化源码
- quickpicks runtime dynamic 本地化源码
- webviews 动态源码
- 已存在 `dist/webviews/settings.html` 时，顺手刷新 settings 静态壳页

如果手动修改的 authority 也影响 manifest / `package.nls*` staging，使用：

```bash
node ./i18n/cli.mts generate --with-manifest
```

如果随后需要把本地化源码编进 extension/webview bundle，运行：

```bash
pnpm run build:quick
```

`pnpm run build:quick` 本身也会触发 runtime dynamic 与 webviews 的生成步骤；如果 VS Code Extension Host 已启动，需要重新加载窗口才能看到新的 bundle。

分域 `generate` 命令仍保留给开发期定位问题或只刷新单一域时使用，不作为人工修改 authority 后的默认路径。

### 上游源码变更后

当上游英文源码、manifest 或 webview 文案发生变化时，先运行：

```bash
node ./i18n/cli.mts sync
node ./i18n/cli.mts report --base HEAD
```

确认并批准 workset 翻译后，再运行：

```bash
node ./i18n/cli.mts promote
node ./i18n/cli.mts generate
```

如果随后需要把本地化源码编进 extension/webview bundle，继续运行 `pnpm run build:quick`。

分域 `sync` / `report` / `promote` / `generate` 命令仍保留给开发期定位问题、只刷新单一 domain 或验证某个 extractor/generator 行为时使用，不作为常规人工流程入口。

## Manifest Domain

- `i18n/catalog/package.catalog.json` 保留 manifest domain 的 occurrence、source reference、output reference 与对账信息
- `i18n/worksets/package.zh-cn.json` 保留 manifest 翻译工作状态与 `occurrenceIds`
- `i18n/reports/package-pending.json` 是 manifest 域的派生进度视图
- `.work/i18n/extension-root/zh-cn/{package.json,package.nls.json,package.nls.zh-cn.json}` 是 manifest 域的可重放运行时/打包 staging 产物；根目录 `package.json` 保持上游英文源码, 不承载 `%key%` 本地化 token

常用命令：

1. 常规刷新使用顶层 `node ./i18n/cli.mts sync` / `report --base HEAD` / `promote`
2. `node ./i18n/cli.mts generate --with-manifest` 刷新 manifest staging；仅排查 manifest 时使用 `node ./i18n/cli.mts manifest generate`
3. `node ./i18n/cli.mts manifest package` 先从真实仓库根目录运行生产 bundle, 再生成 staged extension root, 并从该 root 运行不会再次触发 staged `vscode:prepublish` 的 `vsce package`

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

1. 常规刷新使用顶层 `node ./i18n/cli.mts sync` / `report --base HEAD` / `promote`
2. `node ./i18n/cli.mts generate` 刷新 webviews 动态源码与已存在的 settings shell；仅排查 webviews 时使用 `node ./i18n/cli.mts webviews generate`
3. `pnpm run build:webviews`

## Runtime Dynamic Domain

- `i18n/catalog/formatter.catalog.json` / `i18n/catalog/quickpicks.catalog.json` 保留 formatter 与 quickpicks runtime dynamic domain 的 occurrence、source reference、runtime output reference 与对账信息
- `i18n/worksets/formatter.zh-cn.json` / `i18n/worksets/quickpicks.zh-cn.json` 保留对应翻译工作状态与 `occurrenceIds`
- `i18n/reports/formatter-pending.json` / `i18n/reports/quickpicks-pending.json` 是对应域的派生进度视图
- `.work/i18n/runtime-dynamic-sources/zh-cn/{formatter,quickpicks}/**` 是由 workflow 基于上游英文源码 AST 派生的本地化源码产物；构建时通过 `i18n/domains/runtimeDynamic/localizedRuntimeDynamicSourceLoader.cjs` 以内存替换方式注入 extension bundle, 不直接修改或替代 `src/**`
- 任何需要改动应用源码以消费 runtime dynamic 产物的路径, 必须先通过 source-touchpoint review; 禁止为了本地化在上层 commands、picker flows、views、services 中大面积添加调用点
- `node ./i18n/cli.mts generate` / `pnpm run build:quick` / `pnpm run watch:quick` 会触发 runtime dynamic source generation；如果 VS Code Extension Host 已启动, 需要重新加载窗口才能看到新的 bundle

常用命令：

1. 常规刷新使用顶层 `node ./i18n/cli.mts sync` / `report --base HEAD` / `promote`
2. `node ./i18n/cli.mts generate` 或仅排查单一域时使用 `node ./i18n/cli.mts formatter generate` / `node ./i18n/cli.mts quickpicks generate`
3. `pnpm run build:quick` 或启动对应 watch 任务后重新加载 Extension Host

## Override Selector 语义

- `occurrence`：只覆盖一个具体 occurrence
- `anchor`：覆盖同一稳定锚点
- `scope`：覆盖某个 domain scope 下的 occurrence
- `output`：覆盖某个具体输出目标
