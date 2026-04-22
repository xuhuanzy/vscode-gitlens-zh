## Context

`src/webviews` 当前并不是单一技术栈，而是三类运行时路径并存：

- 现代 RPC/Lit 路径，基于 `GlWebviewApp` / `SignalWatcherWebviewApp`
- `GlAppHost + StateProviderBase` 路径，仍通过 bootstrap/context 初始化状态
- legacy `App` 路径，直接消费 `window.bootstrap`

同时，用户可见文案也分散在多种 source kind：

- 静态 HTML shell 与 settings partial
- Lit 模板中的文本节点与属性
- TSX/JSX 子树
- 少量命令式 UI 字符串

现有 manifest i18n 已经把 core 泛化为 domain-neutral 的 catalog/workset/authority/report 模型，因此 webviews 不需要再复制一套工作流。真正的设计难点不在于“是否支持 webviews”，而在于如何在不污染每个 webview `protocol.ts` / `State` 的前提下，把多 source kind 的提取与多运行时路径的消费收敛到少数共享低层切入点。

主要约束：

- i18n 相关改动必须尽量收敛在 `./i18n` 与 `./src/i18n`
- 静态 HTML shell 的本地化替换页必须集中在 `./src/i18n`，不能散落在 `src/webviews/**` 旁形成第二套 locale 源码树
- 对上游维护源码的侵入要低，避免把 `t()` 改造撒满所有页面
- webview i18n 不能依赖高层页面源码分散接入；若需要运行时 DOM 本地化，也必须集中在 `src/i18n` 与 `WebviewController` 这一受控低层边界
- 现有 branch 主要维护 `zh-cn`，因此首版设计应允许单 locale 落地，但不把模型重新做回 locale-specialized

## Goals / Non-Goals

**Goals:**

- 把 `src/webviews` 作为正式 i18n domain 接入现有 core workflow
- 覆盖静态 HTML、Lit 与少量受控命令式字符串位的提取与对账，并对 JSX/TSX 与 mixed-renderer 边界提供显式 deferred reporting
- 通过共享 host→webview 注入点提供统一 runtime i18n 能力
- 让静态 HTML shell 的派生本地化输出集中在 `src/i18n` 下，而不是把 locale 页面散落在 `src/webviews/**`
- 避免把 locale/messages 混入每个 webview 的 `State` / `protocol.ts`
- 支持按页面族分阶段推进，而不是要求一次完成所有 webviews

**Non-Goals:**

- 首版不追求自动提取所有任意字符串字面量
- 首版不要求 `graph` 等复杂 mixed-renderer 页面与简单页面同时完成
- 首版不要求在当前 change 中落地通用 JSX/TSX extractor
- 首版不把当前分支扩展成完整多 locale 维护体系
- 首版不在页面源码层铺开 `localize*()` 或 `t()` 调用，动态页面优先通过 controller 注入的共享 runtime 处理关键节点

## Decisions

### 1. Webviews 作为独立 domain adapter，继续复用现有 i18n core

`webviews` 将作为 `i18n/domains/webviews` 接入，而不是在 `src/webviews` 内部维护私有 catalog/workset 流程。提取、对账、report、authority、bundle 生成都依赖现有 core model。

原因：

- 新 core 已经支持 domain-neutral occurrence/source reference/output reference
- 复用统一 authority/workset/report 可以减少后续 `quickpicks`、`formatter` 再次分叉
- i18n 逻辑继续集中在 `./i18n`，符合当前分支的目录约束

备选方案：

- 在 `src/webviews` 内做私有 webview i18n 流程：实现快，但会重新引入平行 schema 和数据模型
- 继续扩展 manifest domain 表达 webviews：概念错位，后续维护会再次回到 manifest 中心

### 2. 提取器按 source kind 分层，而不是用单一扫描策略

`i18n/domains/webviews` 内部按 source kind 分层设计 extractor，但当前 rollout 只要求落地低侵入且已经证明可维护的部分：

- `html`：处理静态 HTML shell 与 settings partial
- `lit`：处理 Lit 模板里的文本节点与允许名单属性
- `jsx`：保留为独立后续层，等后续 change 再处理较纯 TSX 子树与 mixed-renderer 的边界
- `imperative`：只覆盖少量明确标注的命令式 UI 字符串位，并把剩余未支持位置报告为 deferred

原因：

- HTML、Lit、JSX 的 AST 结构和可翻译边界不同，混成一个 extractor 会导致命中率和准确性一起下降
- 高层或页面级 DOM 扫描无法可靠处理 Shadow DOM、React 子树、属性文本和首屏时机，因此运行时本地化只能收敛在 controller 注入的共享低层 runtime
- 将 imperative source 作为兜底而不是主路径，可以避免提取规则失控
- 在当前 change 内强行覆盖 JSX/TSX 会把复杂 mixed-renderer 问题提前引入主线，和低侵入目标冲突

备选方案：

- 全量字符串字面量扫描：误报太高，无法稳定区分业务字符串和 UI 文案
- 运行时 DOM 替换：对 Lit/React 更新机制过于脆弱
- 全量手写 `t()`：准确，但会把侵入扩散到整个 `src/webviews/apps`

### 3. Webview runtime i18n 与静态 shell 选择都通过共享注入边界进入页面，而不是进入 `State`

locale、动态 bundle 元信息以及静态 shell 对应的 localized HTML artifact 都通过 `WebviewController` 的统一 HTML 装配路径接入，并在 `src/i18n` 提供共享 webview runtime 与 artifact 读取层。各页面 `State` 和 `protocol.ts` 不新增 i18n 字段，页面源码也不需要显式消费 i18n context。

原因：

- `WebviewState` 当前只承担 webview 元数据职责，混入 i18n 会污染所有 provider 与协议类型
- 当前 `src/webviews` 存在三类运行时基线，共享注入比逐 provider 双写更稳定
- `WebviewController` 本来就统一负责读取 HTML 与注入 `#{state}` / `#{cspNonce}` 等 token，适合作为 localized shell artifact 的选择点
- 低层统一注入更符合最小侵入原则

备选方案：

- 每个 provider 在 `includeBootstrap()` 里自己塞 messages：会把 i18n 扩散到所有 provider 和状态类型
- 每页独立加载 bundle：重复样板过多，也会增加页面间分叉

### 4. 动态 runtime bundle 按 webview app 粒度生成，静态 shell artifact 集中输出到 `src/i18n`

动态模板消费的 webviews 本地化 bundle 将按 app/page family 生成，例如 `welcome`、`settings`、`rebase`、`home`、`commitDetails`、`timeline` 等。静态 HTML shell/partial 则生成派生的 localized HTML artifact，集中放在 `src/i18n` 下的受控目录中，而不是与 `src/webviews/apps/**` 源文件并列维护。共享组件的文本允许在 output 层分散到各自 bundle，但 authority/workset 仍通过 source identity 去重。

原因：

- webview 首屏 bootstrap 有轻量化需求，不能把整站 messages 一次塞进每个页面
- 按 app 粒度更容易和页面族分阶段推进对应
- 输出重复可以接受，因为上游翻译维护成本主要在 authority/workset 层，而不是 runtime bundle 层
- 静态 HTML artifact 集中在 `src/i18n` 能保持 `src/webviews/**` 继续贴近上游源码，减少 rebase 冲突面

备选方案：

- 单个全局 webviews bundle：实现简单，但首屏注入体积和无关页面耦合都会变大
- 组件级 bundle：边界过细，调度和依赖管理成本高于收益
- 在 `src/webviews/**` 旁边生成或维护 `*.zh-cn.html`：会把 locale 页面扩散到上游源码目录中，维护成本高

### 5. 静态 HTML 生成派生本地化页面，动态模板先生成 bundle 再收敛到 controller 层最终产物处理

静态 HTML shell 与 settings partial 保留英文源码在 `src/webviews/apps/**`，由 workflow 基于 catalog/workset/authority 生成派生的 localized HTML artifact 到 `src/i18n`。`WebviewController` 在读取页面时按 locale 优先选择这些 artifact，再继续执行现有的 token 注入。Lit/imperative 页面首阶段完成提取与 bundle 生成，最终运行时接入优先落在 `WebviewController` 注入的底层 DOM 本地化 runtime，而不是在页面源码层铺设 `localize*()` 调用或生成整份本地化 runtime `.js`。

原因：

- 静态 HTML 页面本来就不适合补一层 DOM 扫描器
- 保持英文 HTML 为唯一源码可以降低与上游合并时的冲突面
- 把派生产物集中在 `src/i18n` 能满足本分支对运行时本地化内容的目录约束
- 动态模板若在页面源码层逐点接入 helper，会显著放大 merge 冲突面，不符合当前分支的最小侵入原则
- 先完成提取/bundle，再把运行时消费压回 controller 层，有利于把侵入集中在少数低层文件

备选方案：

- 在 `src/webviews/**` 下维护手写 locale HTML：会形成第二套源码树，不利于 rebase
- 所有页面都做构建期模板转换：对 Lit/JSX 与复杂 mixed-renderer 过于激进
- 所有动态页面都在源码层手写 runtime helper：侵入点过多，后续 rebase 成本高

### 6. 采用“静态端到端 + 动态提取试点”的双样本推进

首个实现阶段同时覆盖：

- `settings`：验证静态 HTML/partial 到 `src/i18n` 壳页输出与 first paint 本地化
- `welcome`：验证 Lit 提取、bundle 生成与 controller 层动态产物接入

在 `welcome` 与 `settings` 路径成立后，再扩展到 `rebase`、`home`、`commitDetails`、`timeline`，最后把 `graph`、`patchDetails` 与其他 mixed-renderer 页面作为显式后续范围处理。

原因：

- 单独试点 `rebase` 或 `welcome` 只能证明动态提取问题，无法验证 settings 这类高密度 HTML 文案页
- “静态端到端 + 动态提取试点”能更早暴露 extractor、artifact layout 与 controller 注入边界是否成立

备选方案：

- 从 `graph` 开始：样本过重，不适合作为首个结构验证对象
- 只做 `welcome`：会推迟静态 HTML 问题暴露

## Risks / Trade-offs

- [多 extractor 维护成本上升] → 通过 source kind 明确边界，避免一个超大 extractor 同时承载所有规则
- [runtime bundle 按 app 分包会引入输出重复] → 接受 output 层重复，用 authority/workset 去重控制真实翻译维护成本
- [静态 shell 需要额外的派生 HTML artifact 管线] → 将 artifact 统一收敛到 `src/i18n`，避免 `src/webviews/**` 出现第二套 locale 源码树
- [legacy `App` 与现代 `GlWebviewApp` 运行时路径不同] → 统一通过共享底层注入 payload 与 DOM runtime 解决，而不是要求页面先全部迁移
- [推迟 JSX/TSX 会留下部分英文 UI] → 通过 deferred reporting 明确暴露缺口，而不是用高侵入改造掩盖范围边界
- [复杂页面如 `graph` 会拖慢整体落地] → 把 `graph` 放到最后一阶段，先证明 `welcome + settings` 的路径成立
- [首版只维护 `zh-cn` 可能让 runtime locale 选择能力看起来不完整] → 模型保持 locale-neutral，首版只约束受控数据与 bundle 输出为当前 branch 维护 locale

## Migration Plan

1. 在 `i18n/domains/webviews` 中建立 extractor、workflow、report 与测试骨架，但暂不改页面调用点。
2. 定义动态 webview runtime bundle 输出、静态 localized HTML artifact 目录布局与相应输出命名约束，产出初版 catalog/workset/report。
3. 在 `src/i18n` 建立共享 webview runtime 与 localized shell artifact 读取层，并从 `WebviewController` 注入 locale/bundle 元信息、底层 DOM runtime 与对应的 shell artifact。
4. 先接入 `settings` 与 `welcome` 端到端，并把动态运行时消费继续压回 `WebviewController` 的最终 HTML 装配路径，而不是扩散到页面源码层。
5. 随后扩展到 `rebase`、`home`、`commitDetails`、`timeline` 等页面族，并补齐共享路径验证与工作流文档。
6. 最后处理 `graph`、`patchDetails` 与其他 mixed-renderer / legacy 边界，必要时拆成后续 change。

回滚方式：

- 保持 webview i18n domain 与 runtime 注入在少数共享低层文件中集中实现
- 若某个页面族接入失败，可单独移除其 bundle 输出和 runtime 消费，而不需要回退整个 core workflow

## Open Questions

- 首版 runtime 是否只跟随当前 branch 维护的 `zh-cn`，还是同时预留 VS Code locale 到 bundle 的显式映射表。
- 后续 change 的 `jsx extractor` 是否应先限制为较纯的 TSX 子树，并继续把 `graph` 这类 mixed renderer 排除在首批范围之外。
