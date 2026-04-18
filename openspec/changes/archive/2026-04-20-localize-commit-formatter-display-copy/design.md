## Context

`CommitFormatter` 是多个 commit 展示面的共享拼装点。它负责输出 commit 相关的 markdown、plaintext 与部分 html 文案，其中包含 command title、WIP 标签、PR tooltip、签名提示、author mail title 等受控展示字符串。与 `package.nls.json` 覆盖的 manifest contributions 不同，这些字符串属于 extension host runtime 输出；与 `webviews.nls.json` 覆盖的 webview HTML / DOM 不同，它们不会经过 webview 的 host 注入与运行时 DOM 本地化路径。

当前分支已经建立了 `i18n/package` 与 `i18n/webviews` 两条 fork-local 工作流，用于隔离 package 与 webview 的本地化 ownership，并降低持续跟进上游时的 diff 面积。`CommitFormatter` 仍缺少对应的 `./i18n` ownership，导致这部分展示文案仍长期保留英文。此前尝试过直接引入 `l10n` 与在 `CommitFormatter` 中大面积插入本地化调用，但该方向与本分支“最小侵入上游源码、由 `./i18n` 主导本地化”的治理原则冲突，因此本次设计必须避免重复那条路径。

## Goals / Non-Goals

**Goals:**

- 在 `./i18n` 下建立一条服务于 commit display copy 的 branch-local 本地化工作流。
- 让 `commands()`、未提交 `message()` 标签、`link()` tooltip、`pullRequest()` 展示文案、`signature()` tooltip 与 author mail title 在支持 locale 下可翻译。
- 让由 `commands()` 的“更多操作”入口打开的 commit action QuickPick 中的受控 label、分组、远端资源操作与顶部 stats 文案在支持 locale 下可翻译。
- 为 `CommitFormatter` 展示层使用到的 `pr.state` 提供本地化映射，同时保持模型层原始值不变。
- 将 `CommitFormatter` 中的源码改动压缩到少数受控展示边界或最终返回值附近。
- 保持日期格式、relative time、revision formatting 与动态用户数据不变。

**Non-Goals:**

- 不引入 VS Code `l10n` manifest/catalog 方案，也不新增顶层 `l10n/` 目录。
- 不把这次 change 扩展成全仓库 extension host runtime 文案清扫。
- 不修改 `CommitFormatter` 的日期、相对时间、padding、truncation、token 解析或 markdown command link 结构。
- 不改变 `PullRequest.state`、`GitCommit` 或其他模型层共享字段的语义。

## Decisions

### 1. 由 `./i18n/commitDisplay` 主导 commit display copy 的 branch-local workflow

本次将新增一条与 `i18n/package`、`i18n/webviews` 对齐的 commit-display localization 工作流，落在 `./i18n/commitDisplay`。该目录负责维护 English catalog、zh-CN 同步、待翻译报告、以及供 runtime 使用的生成规则或派生产物。

Rationale:

- 这与当前 branch 已经确立的 i18n ownership 结构一致，避免把 branch-local 逻辑散落到 `src/`、`scripts/` 或新的顶层 `l10n/`。
- 与 package / webview 一样，本 change 需要一条可同步、可报告、可生成的 fork-local 流程，而不仅是一次性 ad hoc helper。
- 将 ownership 固定在 `./i18n` 有利于持续 rebase 上游，并避免再次污染 upstream-maintained runtime code。

Alternatives considered:

- 直接使用 VS Code `l10n` bundle/catalog。
  Rejected，因为这会重新引入一条不受 `./i18n` 主导的 branch-local ownership，并扩大对 manifest / runtime wiring 的侵入面。
- 仅在 `CommitFormatter` 内手写一组常量或 helper。
  Rejected，因为这样虽然能临时翻译，但没有形成 `./i18n` 下的生成、同步、报告规则，不符合 branch 治理要求。

### 2. 采用 owner-based commit display catalog，加一层薄 runtime adapter

`./i18n/commitDisplay` 将维护稳定的 commit display-copy key，例如按 surface / owner 命名 `commitFormatter.commands.inspectCommitDetails`、`commitFormatter.message.uncommittedChanges`、`commitQuickPick.action.openInspectCommitDetails` 等，而不是直接把英文原文当 key。生成规则可同步 zh-CN，并输出供 runtime 使用的派生产物或查找表。`CommitFormatter` 与 commit action QuickPick 只通过一层薄 adapter 读取这些条目，并支持必要的参数插值。

Rationale:

- owner-based key 比 value-based exact match 更适合包含动态参数的 title / tooltip，例如 author email title、PR tooltip、连接远端 provider 等。
- 与 package / webview 现有规则一致，稳定 owner 能降低英文原文调整时的 key 漂移。
- runtime adapter 可以把 catalog 读取、locale fallback、参数插值与边界替换逻辑封装起来，不把 `CommitFormatter` 变成 catalog 消费细节的宿主。

Alternatives considered:

- 纯英文 exact-match 替换最终字符串。
  Rejected，因为 `CommitFormatter` 的部分目标文案包含参数、markdown title 与动态 provider/name/email/id，单纯按最终整串替换不稳定。
- 在 `CommitFormatter` 每一处字符串旁边直接写 key lookup。
  Rejected，因为虽然可行，但会导致源文件散点式改动过多，不符合最小侵入原则。

### 3. `CommitFormatter` 只在少数受控展示边界接入转换

实现时应优先在最终返回值附近或受控 title 生成点引入本地化，而不是重构 `CommitFormatter` 的整段拼装过程。典型模式包括：

- `commands()` 在最终 markdown command 串返回前，对已知受控 label / title 应用 surface-aware 转换；
- `message()` 仅对未提交标签文本进行转换；
- `link()` 仅对受控 tooltip 或 stash / working-tree 标签进行转换，不动 revision/date 格式；
- `pullRequest()` / `pullRequestState()` 仅对受控 title、pending text 与 state label 做转换；
- `signature()` 与 author mail title 在生成 tooltip / title 的那一小段进行参数化转换。
- `commands()` 后续入口打开的 commit action QuickPick 只在 QuickPick item / separator / hint 构造边界接入转换，不改变执行 command、参数或动态 commit/provider/branch 数据。

Rationale:

- 用户已经明确指出，像 `commands()` 这类地方可以只修改最后返回值或最终 title，而不应把内部所有英文散着重写。
- 将改动压缩在 boundary 附近，可以最大程度保留上游源码结构，降低后续合并冲突。
- 该模式与本分支对 webview host boundary 的处理思路一致，强调集中式转换而不是逐点侵入。

Alternatives considered:

- 顺手抽大段 helper、重排 formatter 逻辑。
  Rejected，因为那会把本 change 从 i18n 收尾扩大成 formatter 重构。

### 4. PR state 仅在展示层本地化

`opened`、`closed`、`merged` 等 `PullRequest.state` 展示值只在 `CommitFormatter` 使用时做映射，本地化后的值不回写模型层。

Rationale:

- `PullRequest.state` 是共享模型语义，其他调用方可能依赖原始英文枚举值。
- 本次需求只关心展示层文案，映射放在 formatter display 层风险最低。

Alternatives considered:

- 改动 `PullRequest` 模型或通用 formatter。
  Rejected，因为会扩大影响面，并可能破坏共享语义。

## Risks / Trade-offs

- [Risk] 新增 `i18n/commitDisplay` 会引入第三条 branch-local i18n workflow。 → Mitigation: 保持它只服务于 commit / host display copy，复用 package / webview 已有的 English canonical + zh-CN sync + pending report 模式。
- [Risk] markdown tooltip 中混有动态参数、日期与受控文案，边界转换若做错可能误改结构。 → Mitigation: 只转换 catalog 中声明的受控片段或模板，保持 command link、markdown 结构与动态值原样。
- [Risk] 只做少数 boundary 接入点，可能遗漏某些 `CommitFormatter` 展示路径。 → Mitigation: 以 `commands()`、`message()`、`link()`、`pullRequest()`、`pullRequestState()`、`signature()`、author mail title 以及 `commands()` 后续 commit action QuickPick 为明确清单，逐项覆盖并补测试。
- [Risk] formatter copy 将来可能扩展到其他 host runtime surfaces。 → Mitigation: 本次 design 明确限制在 `CommitFormatter`，不提前设计成全仓库 host runtime i18n 框架。

## Migration Plan

1. 在 `./i18n` 下建立 commit-display localization 目录、catalog 与生成规则，并接入 English / zh-CN 同步与待翻译报告。
2. 生成供 runtime 使用的 commit-display localization 派生产物或查找表，并增加薄 adapter。
3. 在 `CommitFormatter` 中按最小接入原则补齐 `commands()`、`message()`、`link()`、`pullRequest()`、`pullRequestState()`、`signature()`、author title 的 display-copy 转换。
4. 在 commit action QuickPick 的 item / separator / hint 边界补齐同一入口暴露出的受控展示文案转换。
5. 增加 English fallback 与 zh-CN 输出测试，确认日期/relative time/revision/dynamic data 不受影响。
6. 运行构建与本地化检查命令，验证新增 `./i18n` 流程可持续维护。

## Open Questions

- commit-display localization 的 runtime 派生产物最终是生成 TypeScript 模块、静态 JSON，还是由构建阶段注入的轻量映射；实现时需要结合现有 bundling 约束选择最薄方案。
- 是否需要为 commit-display localization 增加单独的 `report:*:pending` 脚本命名约定，还是复用 package / webview 报告模式的命名风格即可。
