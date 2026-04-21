## Context

当前分支的第一阶段交付目标是 `package.json` 本地化，但后续已经明确仍会遇到 `src/webviews/apps/**`、`src/quickpicks/items/**`、`src/git/formatters/**` 以及部分 `src/git/utils/-webview/**` 的消息来源。这些来源的结构差异很大：

- `package.json` 与部分 settings partial 更接近结构稳定的静态资源；
- webviews 中同时存在 HTML partial、Lit 模板、对象常量中的富文本片段；
- quickpicks 中既有枚举型文案，也有由 formatter、stats、suffix 拼接出的组合文本；
- formatter 与 util 中存在模板、条件选择、复数、富文本标题等运行时生成消息。

这意味着即便第一阶段只落地 `package.json`，i18n 结构也不能围绕“文件路径 + 临时 key”建模，否则第二阶段扩展时会整体返工。同时，这个分支必须保持低侵入、易于持续 rebase，上游的 `contributions.json` 与 `./scripts` 生成链不能成为本分支 i18n 的核心依赖。

## Goals / Non-Goals

**Goals:**

- 建立独立于源码位置的统一消息模型，并在第一阶段先服务 `package.json` 本地化。
- 建立最低优先级的权威翻译源，使相同英文消息可以默认复用，并允许被更具体的语境覆盖。
- 把“消息实例出现位置”和“消息本体”分层管理，第一阶段先覆盖 package manifest，同时保证后续域可按同一模型接入。
- 为本分支定义可重建、可对账、可在上游合并后重新生成的维护流程。
- 为复杂翻译补全过程提供 pending 文件与统计机制，使 Codex 可以循环补全翻译并知道剩余工作量。
- 将 i18n 新增工具限制在 `./i18n` 与 `./src/i18n`，避免在 `./scripts` 下扩散新的分支特化逻辑。

**Non-Goals:**

- 本提案不定义完整中文译文内容，也不试图一次性覆盖仓库内所有英文字符串。
- 本提案第一阶段不要求接入 webviews、quickpicks、formatter 或相关 util 的详细抽取与运行时解析。
- 本提案不把 `contributions.json` 视为 i18n 输入真源，也不尝试为其设计长期维护模型。
- 本提案不要求第一阶段一次性完成全部中文翻译内容；当前重点是建立可迭代补全的翻译工作流。

## Decisions

### 1. 使用统一消息模型，而不是文件级 key 模型

系统将消息拆分为三层：

- `occurrence`: 某条消息在当前源码中的一次出现，属于可重建索引；
- `anchor`: 某类消息的稳定语义槽位，优先作为长期身份；
- `pattern`: 消息本体的抽象结构，是 authority 和默认翻译绑定的对象。

其中第一阶段最低实现集合至少支持以下类型：

- `literal`
- `template`
- `select`
- `plural`
- `rich`

`composed` 作为后续阶段的扩展类型预留，不纳入第一阶段最低实现要求。

选择该模型是因为第一阶段虽然只落地 manifest，但仅依赖文件路径或 JSON 路径会让后续扩展到 formatter、quickpick 组合消息和 Lit 富文本模板时整体失稳。相比之下，消息模型能把“文本长什么样”和“代码里怎么拼出来”分开。

备选方案：

- 仅基于文件路径/JSON 路径生成 key：实现简单，但对重构极不稳定。
- 仅基于运行结果采样字符串：容易发现遗漏，但无法稳定回溯到语义来源，也难以处理模板与复数。

### 2. 权威翻译源只存“默认译法”，且优先级最低

权威翻译源不直接决定最终输出，而是作为最低优先级的默认翻译层。解析优先级固定为：

`key override > anchor override > scope override > authority.messages > authority.terms`

权威层建议拆分为：

- `authority/messages`: 完整消息默认译法，按消息 AST 组织；
- `authority/terms`: 术语默认译法；
- `authority/aliases`: 经人工确认的等价源消息归并。

选择最低优先级 authority 的原因是相同英文在不同语境下可能有不同最佳译法；如果 authority 过强，会迫使具体实例绕过体系做特例硬编码。

备选方案：

- 直接以 `key -> translation` 作为唯一源：无法默认复用相同英文，长期会复制和分叉。
- 直接以 `english -> chinese` 作为最终输出：无法处理语境覆盖，也无法表达模板/富文本结构。

### 2.1 待翻译状态挂在独立 workset，再由 Codex 循环补全并晋升到 authority

第一阶段的抽取结果不要求立即变成最终可发布译文，而是先生成一份或多份位于 `./i18n` 下的、机器可读的待翻译 workset。状态字段挂在 workset 条目上，而不是挂在 authority 最终译文源上。

每个 workset 条目至少需要带有明确状态，例如：

- `pending`
- `translated`
- `needsReview`
- `approved`

建议每个 workset 条目至少保留：

- pattern 指纹或 authority 候选标识
- 当前英文快照与 hash
- 候选中文译文
- 状态字段
- 可选的 review note / context note
- 最近一次抽取与最近一次翻译更新时间

`authority/messages`、`authority/terms` 仅保存已经晋升的最终默认译法；`pending`、`translated`、`needsReview` 状态不得污染 authority 最终源。默认晋升规则为：只有 `approved` 条目写入 authority，其他状态继续停留在 workset 中等待 Codex 后续处理或少量人工介入。

manifest 正式生成流程应当能够区分“结构已建立但翻译未完成”和“authority 已具备可发布默认译文”这两个阶段。

这样设计的原因是翻译本身远比抽取复杂：同一句英文可能需要语境判断、术语统一、回读修订，不能假设一次生成即完成。先把缺口稳定落盘到 workset，再让 Codex 多轮补全并按状态晋升，会比把未完成状态混入 authority 更可控，也更利于上游合并后的再抽取与对账。

备选方案：

- 抽取时直接调用模型产出最终译文：短期省步骤，但难以审计、难以统计剩余工作量，也不利于逐轮修订。
- 全部依赖人工离线维护翻译表：可控但推进太慢，也无法和 Codex 自动循环很好衔接。

### 3. occurrence 与 authority 之间通过 anchor/pattern 绑定，而非直接绑定文件路径

每条 occurrence 至少需要保留：

- 所属域（manifest/webview/quickpick/formatter/...）
- 结构定位信息（path、id、slot、field 等）
- 对应 anchor
- 对应 pattern 指纹
- 当前英文快照与 hash

anchor 应尽量优先使用业务稳定标识，例如：

- manifest setting key / command id / view id
- manifest walkthrough step id
- manifest walkthrough 或 command 中的 markdown slot / title slot / description slot
- 后续阶段运行时消息中的显式语义槽位名称

没有天然稳定标识时，再退化为结构路径 + ordinal，并允许后续人工提升为显式 anchor。

这样做的原因是 occurrence 天生会随实现重排，authority 则必须长期稳定；两者之间需要 anchor/pattern 这一层缓冲。

### 4. 第一阶段仅实现 manifest 域适配器，但模型必须允许后续域适配器接入

提取采用混合策略：

- 静态提取器：第一阶段仅要求覆盖 `package.json`；
- 语义适配器：保留给 formatter、复杂 quickpick builder、富文本组件等后续阶段来源；
- runtime census：作为后续阶段的补充发现机制，不属于第一阶段实现范围。

选择该分阶段策略的原因是不同来源的稳定性完全不同。先把 manifest 做成可见成果，同时把抽象模型定稳，能避免第一阶段被跨域细节拖住，又不为后续扩展埋下结构债务。

### 5. 本分支的 i18n 工具仅位于 `./i18n` 与 `./src/i18n`

所有抽取、对账、报告、生成脚本放在 `./i18n`，运行时加载与解析逻辑放在 `./src/i18n`。`./scripts` 中的现有逻辑不扩展、不承载新的分支 i18n 流程。

这是为了遵守分支规则，并使 i18n 相关差异尽量收敛在单独目录，降低与上游持续冲突的概率。

### 5.1 提供面向 Codex 的 pending 统计入口

第一阶段需要一个位于 `./i18n` 下的报告脚本或等价入口，基于 workset 输出机器可读的 pending 统计结果，使 Codex 能知道：

- 总条目数
- 已翻译条目数
- 待翻译条目数
- 需要复查条目数
- 已批准可晋升条目数
- 可选的分组统计（例如按状态、按 scope、按文件来源）

推荐输出 JSON 报告，并允许写入固定路径，便于 Codex 在循环翻译时读取、比较、继续补全并决定何时执行 authority 晋升。

这样设计的原因是没有定量反馈的翻译循环很难自动推进；Codex 需要一个稳定、非自然语言的接口来判断“还差多少”以及“当前轮次是否有效减少 pending”。

### 6. 旧的 contributions 生成链在本分支 i18n 流程中被隔离

`generate:contributions` / `extract:contributions` 以及对应 webpack 插件不会作为本分支 i18n 的输入或维护流程一部分。对 `package.json` 等产物的本地化改写必须发生在独立 i18n 流程中，避免被旧链路覆盖或反写。

这并不意味着立刻移除所有旧逻辑；但在分支工作流上，必须明确它们不再是 authority 或 catalog 的来源，并提供 guardrail 明确阻止它们被当作本分支 i18n 维护入口使用。guardrail 可以是命令级失败、校验脚本失败或构建入口显式旁路，但必须满足“误执行旧链路不会被误认为一次有效的 i18n 更新”。

## Risks / Trade-offs

- [消息模型过强导致初期成本较高] → 先支持 `literal/template/select/plural/rich` 最小集合，`composed` 仅在确有必要时引入。
- [复杂运行时消息难以一次性静态识别] → 以域适配器优先，辅以 runtime census 做兜底发现，不要求第一阶段 100% 自动化。
- [authority 归并过度会污染默认译法] → 只允许“完全相同源消息”自动复用；近似文本合并必须经过人工 alias 确认。
- [anchor 不稳定会导致覆盖层漂移] → 优先使用业务 id；没有稳定 id 的位置允许保留结构 ordinal，并在报告中标记为高风险锚点。
- [旧生成链回写产物] → 在分支工作流和构建入口中显式隔离 `generate:contributions` / `extract:contributions`，避免误触发。
- [翻译循环没有可量化反馈，导致 Codex 无法持续推进] → 提供 pending 统计脚本与机器可读报告，作为每轮翻译后的必查入口。
- [待翻译状态混入 authority 最终源，导致默认译法库不稳定] → 将状态字段放在独立 workset，authority 仅保存已晋升的最终默认译文。

## Migration Plan

1. 建立 authority、catalog、report 的基础目录与 schema。
2. 接入 manifest 域，验证 authority / occurrence / override 解析链。
3. 先生成待翻译 workset 与 pending 统计入口，形成可循环补全的翻译工作台。
4. 使用 Codex 基于 pending 报告多轮补全 workset，并将 `approved` 条目晋升到 authority。
5. 基于 authority、override 与 catalog 生成并维护 `package.json` 相关本地化产物，形成第一阶段可见交付。
6. 定义上游合并后的标准流程：先合并英文源码，再重跑 i18n 抽取/对账/生成，避免在 `%key%` 产物上手工解冲突。
7. 在后续阶段再逐步接入 webviews、quickpicks、formatter 与 runtime census。

## Open Questions

- rich message AST 是否需要显式保留 HTML/Lit 标记节点，还是先限制为可控片段与占位符组合，可在第二阶段决定。
- runtime census 的落盘格式是否应直接复用 occurrence schema，还是采用单独的待归类队列，可在第二阶段决定。
- authority/messages 使用 JSONL、单个 JSON 数组，还是按 capability/domain 分卷存储，需结合后续审阅体验再定。
- workset 采用 JSONL、单个 JSON 数组，还是按 domain/scope 分卷存储，需结合增量对账与 Codex 批量写入体验再定。
