## Context

上一轮 webviews i18n change 已经证明了两件事：

1. 静态 shell 的本地化完全可以通过生成派生 HTML artifact 并由 `WebviewController` 统一选择来实现
2. 动态 Lit 页面如果坚持“不改页面源码”，当前最直接的办法就是向页面注入 runtime localization payload，再通过低层 DOM runtime 在页面加载后修补文本

第二点解决了侵入性问题，但代价是把复杂度转移到了运行时：

- 页面首屏渲染后仍需再做文本/属性替换
- 需要持续监听 DOM 变更与 Shadow DOM 创建
- controller 需要统一注入 runtime payload 与安装脚本
- 行为正确性依赖 DOM 结构、模板展开结果与观察时机

这与当前分支的长期目标并不完全一致。我们的真正目标不是“零成本实现动态页面 i18n”，而是“在不侵入上游源码的前提下，把本地化逻辑压回受控、可生成、可验证的低层边界”。

同时，本分支的约束已经明确禁止保留兼容性代码。因此这次 change 不采用“新旧双路径长期并存”的策略，而是明确允许破坏性更新：只要切换到 AST/build-artifact 路线所需，就应直接删除旧 runtime 注入、旧 bundle 输出、旧 payload schema 与相关生成/加载代码，不额外保留 fallback、双写或兼容分支。

因此，这次 change 的核心不是回退 webview UI 架构，而是把动态页面 i18n 的落点从 runtime 挪到 build artifact。

## Goals / Non-Goals

**Goals:**

- 保持 `src/webviews/apps/**` 上游源码不变，不引入分散的 `t()` / `localize()` 调用
- 为动态 Lit 页面生成 locale-specific JS artifact，并让页面首次 render 就输出目标语言
- 保持静态 shell 继续走 localized HTML artifact 路线
- 让 `WebviewController` 统一选择最终 HTML / JS 产物，而不是注入通用翻译 runtime
- 将 `welcome`、`rebase`、`home`、`commitDetails`、`timeline` 与 `graph` 作为本次 change 的正式动态页面 rollout 范围，并验证整条链路

**Non-Goals:**

- 当前 change 不纳入 `patchDetails` 或其他 mixed-renderer 边界仍未收敛的页面族
- 当前 change 不要求支持所有任意 JS/TS 字符串字面量
- 当前 change 不把 JSX/TSX mixed renderer 问题一并解决
- 当前 change 不修改 Lit 页面源码结构或引入页面级 i18n helper API
- 当前 change 不改变现有 authority/workset/catalog 数据模型的核心语义
- 当前 change 不为 runtime localization 旧路径保留兼容层、fallback 注入或双写输出

## Decisions

### 1. 动态页面从 runtime bundle 转向 localized script artifact

动态页面不再以“英文脚本 + runtime messages bundle + DOM runtime”方式本地化，而改为生成 locale-specific 的派生脚本产物，例如：

- `dist/webviews/welcome.js` 作为英文构建产物
- `dist/webviews/i18n/zh-cn/welcome.js` 作为本地化派生产物

`WebviewController` 按 locale 选择最终脚本引用，页面直接执行本地化后的脚本。

原因：

- 动态页面首次 render 即输出目标语言，不再依赖后置 DOM 修补
- 运行时去掉扫描、观察、Shadow DOM hook 等通用翻译引擎逻辑
- 侵入点仍收敛在构建/生成层与 controller，而不是页面源码层

备选方案：

- 保持 runtime bundle + DOM runtime：侵入低，但与本次 change 要求的“直接删除旧运行时路径、不保留兼容代码”冲突
- 页面源码手写 `t()`：运行时更轻，但不符合最小侵入与可持续 rebase 要求

### 2. 静态 shell 与动态脚本统一建模为 build artifact selection

静态页继续生成 localized HTML artifact，动态页新增 localized JS artifact。两者都由 controller 视为“最终产物选择”问题处理：

- HTML shell 选择 locale-specific html
- 页面脚本选择 locale-specific js

原因：

- controller 只做装配与产物选择，职责更清晰
- 静态与动态路径共享同一套 locale fallback 与 artifact lookup 语义
- 未来更容易按页面族扩展，而不需要为每个页面定义不同 runtime 注入逻辑

### 3. 生成阶段继续复用现有 extractor/catalog/authority，而不是重做第二套编译模型

动态 artifact 的生成继续基于现有 `i18n/domains/webviews` 提取与 authority 结果，而不是新建独立 schema。

原因：

- 现有 extractor 已经能识别受控 Lit 模板文本与部分 imperative 字符串位
- 现有 authority/workset 仍然是唯一翻译真源，不需要在 artifact 编译层再维护第二套映射
- 这样可以把 change 收敛在 generator/output 层，而不是动 core model

同时，`i18n/domains/webviews` 中只为 runtime bundle / DOM runtime 服务的生成逻辑应在本次 change 中直接删除；只有 extractor、template 片段建模、authority/workset 复用层等仍被 AST 派生编译使用的低层能力才允许继续存在。

### 4. 首轮只支持已被 extractor 明确定义的动态文本位

localized script artifact 只处理当前 extractor 已明确定义和验证过的文本位：

- Lit 模板文本节点
- 允许名单内的可翻译属性
- 少量已受控的 imperative 属性/字符串位

继续把 JSX/TSX、复杂 mixed-renderer 与不稳定命令式字符串位保留为 deferred follow-up。

原因：

- 构建期替换比 runtime 更依赖模式边界清晰，不能以误报换覆盖率
- 首轮目标是验证 artifact 路线，而不是在生成器里重新实现通用 JS 国际化编译器

### 5. 受支持动态页面在本次 change 中统一 rollout

本次 change 将 `welcome`、`rebase`、`home`、`commitDetails`、`timeline` 与 `graph` 一并切到 localized script artifact。

原因：

- 这些页面已经在当前实现中共享同一套 AST 派生与 controller artifact 选择路径，继续把它们视作“后续 rollout”只会让 OpenSpec 与代码状态脱节
- 它们共同覆盖了主视图、编辑器页、详情页与 Plus 视图，有利于验证动态 artifact 路线在多页面族上的稳定性
- `patchDetails` 与 mixed-renderer 边界仍保持 deferred，从而把本次 change 的边界收敛在已接入且已验证的页面族上

### 6. 本次 change 直接删除旧 runtime 路线，不保留兼容层

本次 change 明确允许破坏性更新，并要求删除旧 runtime 路线相关代码，包括但不限于：

- `src/i18n` 中 runtime localization payload 注入、DOM localization runtime 安装与查找逻辑
- `WebviewController` 中面向 runtime payload / runtime script 的注入路径
- `i18n/domains/webviews` 中只用于生成 runtime bundle 或旧 runtime 输出的生成逻辑
- 旧 runtime output 的 schema、命名约定、回退分支与兼容加载路径

仅当某些低层实现会被新的 AST/build-artifact 生成流程继续使用时，才允许保留这些代码。

原因：

- 当前分支明确禁止保留兼容性代码
- 旧路径与新路径并存会显著增加 controller、generator 与测试复杂度
- 既然方向已经明确，继续保留旧 runtime 路线只会放大后续 rebase 与维护成本

### 7. 动态 artifact 明确采用源码 AST 派生后再编译

本次 change 明确采用“源码 AST 派生后再编译”作为动态页面的生成路线，而不是“英文构建产物脚本二次派生”。

原因：

- AST 层仍保留 Lit 模板的静态片段、表达式插槽与 HTML 结构边界，更适合做可控的模板级本地化变换
- 构建产物二次派生过度依赖 bundler 输出结构，长期稳定性较差
- 既然本次 change 已经允许破坏性更新并直接删除旧 runtime 路线，就应同时选择更适合作为长期主线的生成方式，而不是先引入一条过渡式派生路径

约束：

- 不直接修改上游源码文件，而是基于源码 AST 生成 locale-specific 派生源码或等价虚拟模块，再参与构建
- `html\`...\`` 的变换必须保留表达式插槽，仅替换静态文本节点与允许名单属性
- 超出受控模式的复杂模板继续 deferred，而不是退回运行时修补

## Proposed Architecture

```text
静态页
source html
  -> i18n generator
  -> localized html artifact
  -> WebviewController 选择 html

动态页
source ts/lit
  -> normal build
  -> english js artifact
  -> i18n generator
  -> localized js artifact
  -> WebviewController 选择 script 引用
```

### Build Artifact Layout

建议动态本地化脚本产物输出到与静态 shell 相邻但职责明确的目录，例如：

- `dist/webviews/i18n/zh-cn/welcome.js`
- `dist/webviews/i18n/zh-cn/rebase.js`

静态壳页仍可保留现有布局：

- `src/i18n/webviews/zh-cn/settings.html`
- 或其最终发布时对应的 `dist` 镜像路径

动态脚本 artifact 的路径应满足：

- locale fallback 可枚举
- 与原页面 bundle 名存在稳定映射
- 不要求修改页面源码中的 import 结构

## Generation Strategy

生成流程分两层：

1. 正常构建产出英文 webview JS bundle
2. i18n workflow 基于英文脚本、catalog occurrences 与 authority 翻译结果生成 locale-specific 派生脚本

在 watch 构建中，localized dynamic source 的生成不能只在 webpack 启动前运行一次；一旦 `src/webviews/apps/**` 或 `i18n/**` 下的输入变化，localized config 必须在重新编译前刷新 `.work/i18n/webviews-sources/**`，否则增量构建会持续消费陈旧派生源码。

当前仓库中已有 `generateLocalizedRuntimeScript()` 雏形，可作为首轮实现基础，但需要从“实验性脚本替换”收敛为受控 artifact pipeline：

- 输入 bundle 名、英文脚本、occurrences、authority
- 输出 locale-specific script artifact
- 记录 translated / unresolved 统计
- 对超出支持边界的模式显式报 unresolved，而不是静默跳过

## Controller Responsibilities

`WebviewController` 迁移后的职责：

- 选择 localized html shell
- 选择 localized script artifact 或回退英文脚本
- 注入既有 bootstrap / CSP / token

`WebviewController` 不再负责：

- 注入 runtime localization payload
- 安装 DOM localization runtime
- 在页面运行时修补 DOM 文案

## Migration Plan

1. 为 `welcome` 定义 localized script artifact 输出布局与 lookup 规则
2. 将现有 script-level / template-level 生成能力收敛到 AST/build-artifact workflow，并删除仅服务于旧 runtime 路线的生成输出
3. 在 `WebviewController` 中增加动态 artifact 选择逻辑，同时删除 runtime payload 注入逻辑，让 `welcome` 直接加载 localized script artifact
4. 为受支持动态页面增加代表性验证，证明无需 runtime DOM localization 即可首屏本地化
5. 删除 `src/i18n` 与 `i18n/domains/webviews` 中不再被新流程使用的 runtime 相关代码、schema、输出与测试
6. 将 `patchDetails` 与 mixed-renderer 边界保留为后续扩展项，而不是继续把已接入页面族标记为 follow-up

## Risks / Trade-offs

- [构建后脚本结构稳定性] 如果基于构建产物做替换，bundler 输出变动可能影响替换锚点
  通过限制首轮支持范围、增加 fixture 测试与必要时转向源码级派生编译来控制风险
- [支持范围受限] 首轮只覆盖 extractor 已明确定义的文本位，仍会留下 deferred 边界
  这是有意取舍，优先保证低侵入与结果稳定
- [artifact 管理成本上升] 新增 locale-specific JS artifact 会引入输出布局与选择逻辑
  但这比长期维护运行时翻译引擎更容易验证和回归
- [破坏性更新带来一次性清理成本] 旧 runtime 路线不会保留 fallback，迁移期间必须同步清理对应 generator、controller 与测试
  这是有意取舍，以换取后续实现与维护边界更干净

## Open Questions

- 动态 artifact 路径是否直接放入 `dist/webviews/i18n/<locale>/`，还是需要保留 `src/i18n` 下的中间产物作为受控源
- 后续为 `patchDetails` 或其他 mixed-renderer 页面族扩展时，是否需要引入 bundle-level manifest 来声明每个 webview 页面应切换哪些 localized script 引用
