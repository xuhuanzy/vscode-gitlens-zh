## Context

当前 zh-CN tooling 已经有共享策略雏形，但表达能力仍停留在 value-level：

- `i18n/shared/zhCnPolicy.mts` 目前只支持整句 passthrough 和整句 exact override。
- `i18n/webviews/webviewNlsZhCnOverrides.mts` 已膨胀成巨大的 surface-specific exact 覆盖表，承载了大量本应由共享规则处理的品牌词、短模板和常用术语。
- `i18n/commitDisplay/commitDisplayLocalization.mts` 中的 `commitDisplayLocalizationEntries` 同时承担 English canonical text、受控输出白名单和 catalog source 的角色，而且与业务边界代码中的英文锚点存在重复。
- pending report 目前只理解“允许英文直通”和“是否已有翻译”，并不知道某个值是否已经被共享规则可靠覆盖，因此它无法准确反映 proofreader 覆盖度。

这次 change 需要在不扩大 runtime 智能化、不扩展 extraction 范围、也不引入新的并行 ownership 模型的前提下，把 zh-CN 维护升级成规则驱动的强校对器。

## Goals / Non-Goals

**Goals:**

- 在 `./i18n/shared` 下定义共享的 zh-CN proofreader，并只在 tooling 阶段执行。
- 用统一的规则层级处理保留词、短模板句式和固定术语，让 webview 与 commit-display 复用同一套校对策略。
- 让生成/同步与 pending report 使用同一套 proofreader 判定，避免“已被规则覆盖的值”仍然被报成 pending。
- 将 `webviewNlsZhCnOverrides` 收缩为 exception-only 层。
- 将 commit-display English canonical text 重构为“规则族 + 少量 leaf lexicon”，减少巨大的平铺 entry 对象。
- 保持 runtime 继续消费现有 catalog，并将上游维护源码中的改动限制在少数边界 helper。

**Non-Goals:**

- 不把 proofreader 下沉到 webview runtime、commit-display runtime 或其它运行时代码。
- 不引入自由翻译、机器翻译或开放式句法重写；proofreader 只处理受控规则。
- 不把 webview registration title、命令注册名或其它未进入 catalog 的文本纳入本次范围。
- 不改变 provider 名称、branch、SHA、path、日期、relative time、用户消息、PR 标题等动态值语义。
- 不在本次 change 中扩展到 `package.nls` 流程。

## Decisions

### 1. 共享 proofreader 保持为 `./i18n` tooling-only 管线

proofreader 将作为 `./i18n/shared` 下的共享模块执行，只在以下阶段运行：

- locale catalog sync / generate
- pending translation report

runtime 继续使用现有 exact-match catalog lookup，不执行任何 proofreader 逻辑。

Rationale:

- 这符合现有 `./i18n` ownership 与最小侵入原则。
- runtime exact-match 方案已经足够稳定，加入规则解释器只会扩大行为面与调试面。
- proofreader 的目标是维护 catalog 质量，而不是在渲染时临时“猜测翻译”。

Alternative considered: 在 runtime 执行 proofreader。该方案会把规则求值带入渲染路径，增加不透明性和跨环境行为风险，因此拒绝。

### 2. proofreader 使用确定性的分层规则，而不是继续堆 exact overrides

proofreader 内部使用以下顺序：

1. value normalization
2. exact passthrough / accepted equal values
3. protected terms
4. short-template families
5. canonical glossary
6. unresolved fallback

surface-specific exact exceptions 不属于共享 proofreader 本体，而是在 proofreader 之后作为单独一层执行。

Rationale:

- 保护词必须先跑，否则品牌名、快捷键或命令 token 会被模板或 glossary 误伤。
- 短模板规则优先于单词级 glossary，避免 `Settings` 先被替换导致 `Jump to X settings` 之类模板失去整体控制。
- surface-specific exceptions 必须留到最后，确保它们是真正的例外，而不是共享规则缺位时的常规修补手段。

Alternative considered: 继续以 exact override map 为主、规则为辅。该方案无法从根本上控制漂移，只会继续扩大覆盖表，因此拒绝。

### 3. 生成与 pending report 复用同一 proofreader 引擎

proofreader 输出不仅要能给出 corrected value，还要能给出分类结果，例如：

- accepted passthrough
- corrected by template
- corrected by glossary
- unresolved

report 层将复用同一引擎和 surface hook，把“已由规则覆盖”的值从 pending 中排除，并在摘要中单独体现。

Rationale:

- 如果生成与报告使用不同规则，report 会系统性失真。
- 分类信息可以帮助维护者区分“规则问题”与“确实需要人工翻译的问题”。

Alternative considered: 只在 generate 阶段应用 proofreader，report 继续只看 equal-values。该方案会让 report 与真实维护状态分离，因此拒绝。

### 4. commit-display 改为“规则族 + 少量 leaf lexicon”，而不是单一巨表

commit-display English canonical text 将拆成两部分：

- rule families：为 action、separator、stats、resource-template、hint 等受控模式生成稳定 key 和 English canonical output
- leaf lexicon：只保留无法可靠规则化的受控文案

这样 `commitDisplayLocalizationEntries` 的长期形态不再是单一巨大平铺对象，而是可组合的构建结果。

Rationale:

- commit quick pick 已经在 key 侧部分表现为结构化族，例如 `commitQuickPick.action.${action}`、`commitQuickPick.separator.${separator}`；继续把 English canonical text 平铺抄回大表，只会制造重复真源。
- 规则族更适合承载动态参数模板，例如 `{provider}`、`{resource}`、`{count}`、`{branch}`。
- 少量 leaf lexicon 可以保留那些不值得再抽象的文案，而不迫使系统走向“所有东西都得规则化”的极端。

Alternative considered:

- 继续维护 flat entry object：维护成本高，且与边界代码英文锚点重复。
- 从运行时代码做通用抽取：会扩大对上游源码的依赖和脆弱性，不适合 commit-display 这类受控 host-side copy。

### 5. webview overrides 保留，但只作为 exception-only 层

`webviewNlsZhCnOverrides.mts` 不会被完全删除，但其职责将收缩为：

- 共享 proofreader 无法表达的上下文差异
- 明确要求与共享 canonical 译法不同的 webview-specific exact output

共享 proofreader 负责大多数保留词、短模板和通用术语。

Rationale:

- webview catalog 仍然需要一个 surface hook 来处理少量确实依赖上下文的精确译法。
- 彻底消灭 exception 层会迫使共享规则承担过多上下文责任，反而不稳定。

Alternative considered: 完全移除 webview exact overrides。该方案对第一阶段迁移风险过高，因此拒绝。

## Risks / Trade-offs

- [规则重叠导致误匹配] → 使用 longest-match 和明确的规则优先级，并为模板族、品牌词和短词冲突补测试。
- [proofreader 过强覆盖现有人工翻译] → 默认只对“仍等于英文”的值和明确声明为 canonical 的值做强校对；surface exceptions 保留最终兜底权。
- [commit-display 重构引入 key churn] → 复用现有 key namespace，只有在语义确实变化时才允许新增 key。
- [report 分类变复杂] → 共享 proofreader 直接产出分类结果，避免 report 自己复制判断逻辑。
- [shared rules 过于抽象，难以维护] → 将规则限制在保留词、短模板和 canonical glossary；复杂上下文继续留在 exception/leaf 层。

## Migration Plan

1. 在 `i18n/shared` 中引入 proofreader 模块，并定义规则层级、分类结果和 surface hook 接口。
2. 将 webview zh-CN 生成流程切到“sync -> proofreader -> webview exceptions -> write”。
3. 调整 webview pending report，使其复用 proofreader 结果统计 already-covered 与 unresolved。
4. 将 commit-display English canonical text 从 flat entry object 拆到 rule families 与 leaf lexicon，并用统一 builder 生成 catalog。
5. 将 commit-display zh-CN 生成与 pending report 接入 proofreader。
6. 回收 webview exact overrides 中已被共享规则覆盖的条目，只保留 exception-only 内容。
7. 运行 generation、pending report 和相关测试，确认 key 稳定性与输出一致性。

## Open Questions

- 第一批短模板族的覆盖面是否只包括现有 webview/commit-display 中已经高频出现的模式，还是允许顺手吸收少量明显重复的未来模式。
- report 是否需要显式输出“由哪个 proofreader rule 覆盖”的说明字段，还是仅在摘要统计中区分 covered / pending 即可。
