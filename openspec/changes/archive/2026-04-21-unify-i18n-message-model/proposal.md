## Why

当前分支的第一阶段目标是尽快让 `package.json` 本地化成为可见成果，但后续仍将面对 `src/webviews/apps`、`src/quickpicks/items`、`src/git/formatters/commitFormatter.ts` 以及相关 util 的消息来源差异。若第一阶段继续以文件路径、临时 key 或 `contributions.json` 为核心，后续扩展时将难以在持续 rebase 上游时稳定维护。

这个分支需要一套独立、低侵入、可重建的消息本地化模型。它必须把“权威翻译源”“源码中的消息实例”“最终输出覆盖”分层管理，并允许相同英文默认复用、又能在具体语境下被覆盖。

## What Changes

- 引入统一的 i18n 消息模型，以 `package.json` 本地化为第一阶段交付目标，同时为静态字符串、模板消息、条件选择消息、复数消息与富文本消息保留统一结构；`composed` 仅作为后续扩展类型预留，不纳入第一阶段最低实现要求。
- 定义独立的权威翻译源结构，以“英文消息默认译法”为底座，并显式区分 authority、scope override、anchor override、key override 的优先级；authority 仅承载已晋升的最终默认译文。
- 定义 occurrence、anchor、pattern 三层索引，第一阶段先服务 `package.json`，同时避免后续接入其他来源时依赖文件路径作为长期稳定标识。
- 规划仅位于 `./i18n` 与 `./src/i18n` 的本地化工作流，避免把新的翻译脚本放入 `./scripts`，并将旧的 `generate:contributions` / `extract:contributions` 生成链从本分支的 i18n 流程中隔离且显式阻断为本分支 i18n 维护入口。
- 定义上游合并后的维护流程，包括重新抽取、对账、标记新增/变更/移位/移除消息，以及重新生成本分支所需的 manifest 本地化产物。
- 强调翻译补全本身是复杂流程：第一阶段先生成独立的、机器可读的待翻译 workset，而不是要求一次性产出全部最终译文；随后通过 Codex 循环补全翻译，并将合格结果晋升到 authority。
- 为翻译循环定义机器可读的 pending 报告或统计脚本，使 Codex 能持续获知还剩多少待翻译项、哪些项需要复查、哪些项已可晋升到 authority，以及翻译是否已经完成到可生成产物的程度。

## Capabilities

### New Capabilities

- `message-authority`: 定义权威翻译源、术语库、别名归并和分层覆盖规则，作为所有消息默认翻译的底座。
- `message-catalog-sync`: 定义 occurrence、anchor、pattern 的统一索引与抽取/回填流程，第一阶段覆盖 package manifest，并为后续域扩展保留一致模型。
- `branch-localization-workflow`: 定义本分支专用的 i18n 维护流程，确保最小侵入、避免依赖 `contributions.json` 和 `./scripts` 下的旧生成链，并支持持续 rebase 上游。

### Modified Capabilities

- None.

## Impact

- 第一阶段直接受影响的目录与文件将以 [package.json](d:/Workspace/learn/js/vscode-gitlens/package.json)、[webpack.config.mjs](d:/Workspace/learn/js/vscode-gitlens/webpack.config.mjs)、`./i18n/**`、`./src/i18n/**` 为主。
- 需要为本分支新增消息抽取、索引、对账与生成的数据文件结构，但这些结构应保持可重建，避免高层业务代码大量侵入式改动。
- 需要新增至少一份机器可读的待翻译 workset 与一份 pending 统计输出，用于驱动 Codex 迭代翻译流程，而不是依赖人工目测判断剩余工作量。
- `src/webviews/apps/**`、`src/quickpicks/items/**`、`src/git/formatters/**`、`src/git/utils/-webview/**` 属于后续阶段扩展对象，本提案仅要求当前结构为它们预留兼容性边界。
- 需要明确本分支与现有 contributions 生成逻辑的边界，并提供可验证的 guardrail，防止旧流程覆盖、反写或伪造本分支 i18n 产物更新。
