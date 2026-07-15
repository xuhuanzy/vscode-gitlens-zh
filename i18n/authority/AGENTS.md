# i18n/authority Agent Guide

本目录承载 `authority` 真源与其审核辅助文件。`zh-cn/messages.json` 是权威翻译源；审核进度必须通过旁路 state 文件维护，不能直接向 authority entry 注入审核字段。

## 核心规则

1. 允许读取 `zh-cn/messages.json`、`zh-cn/messages.review-state.json`、本目录 schema 与脚本来理解当前审核进度。
2. 禁止修改 `zh-cn/messages.json` 的 schema 结构以增加 `reviewed`、`status`、`needsReview` 等审核字段。
3. 审核状态只允许写入 `zh-cn/messages.review-state.json`，且必须通过 `messagesReview.mts` 脚本维护，避免手工改坏指纹或排序。
4. `messages.review-state.json` 中的记录基于消息内容指纹；如果 `messages.json` 中同一 `id` 的内容发生变化，旧审核记录会自动失效，必须重新审核。
5. 本目录下所有新增辅助脚本都应服务于 authority 真源，禁止把本目录当作临时翻译 workset 使用。

## 翻译质量硬约束

1. `zh-cn/messages.json` 中的普通 authority entry 禁止使用空字符串译文。空译文会被生成链路视为有效翻译并删除原文片段；如果某个片段暂时不能安全翻译，应保持待处理状态或从抽取/建模层处理，不能写入 `""`。
2. `template` 与 `rich` entry 的译文默认应保留 `slots` 中声明的 `${slotN}` 占位符，且不得改写占位符名称、大小写或语法。但这不是绝对语义规则：如果某个槽位只承载英文语法胶水、重复含义、英文复数形态，或在中文表达中确实应被省略，可以省略。
3. 省略槽位前必须确认该槽位不是用户数据、远程数据、仓库/分支/文件/提交信息、命令参数、配置键、token、Markdown/HTML 结构或其它运行时语义数据。若同一个 authority message 覆盖多个 occurrence，或槽位语义不完全确定，应优先使用 `zh-cn/overrides.json` 的窄作用域 override，或回到抽取/生成建模层处理，而不是把省略写进通用 `messages.json`。
4. 单独的英文语法词或短语，例如 `is`、`are`、`was`、`were`、`has`、`have`、`need`、`needs`、`require`、`requires`、`more`、`other`，不得作为通用 authority 翻译沉淀到 `messages.json` 或 `terms.json`。这类词在中文里通常依赖整句语义，应由完整模板、pluralization 建模、抽取规则或窄作用域 override 处理。
5. 只有槽位加标点、Markdown 包装或弱连接词的结构模板不得进入通用 authority，例如 `${slot1}, ${slot2}, ${slot3}`、`**${slot1}** (${slot2})`、`${slot1} of ${slot2} ${slot3}`。这类模板没有稳定的可翻译 UI 语义，容易把任意动态数据重排；应从抽取层排除，或在具体 occurrence 上建模。
6. `pluralize(...)`、`infix`、英文复数后缀等会产生英语形态的动态表达时，不得通过空译文或简单片段替换来“修掉”英文；应保守保留、标记待建模，或使用明确的 occurrence override，避免生成 `2 天days`、`7 days` 混入中文句子的结果。
7. Markdown、命令 URI、配置键、代码片段、token、HTML 属性结构等语法承载内容不得随意改写。链接 URL 和命令 id 必须保持不变；链接标题是否翻译应服从对应域的生成/校验规则。
8. `Working Tree`、`working tree` 在 Git 语境中统一译为“工作树”；`workspace` 才译为“工作区”。不得把 Git working tree 和 VS Code workspace 混用。
9. 修改 authority 真源后，至少运行结构化质量检查或相关测试，确认 `messages.json` 中不存在空译文、关键术语回退；若译文省略了槽位，必须人工确认并在本次审查/修复说明中记录省略理由。

## Codex 审核流程

1. 先运行 `node ./i18n/authority/messagesReview.mts next` 获取下一批待审核内容；默认返回最多 `1000` 条。
2. 如需继续后续批次，使用 `--offset <nextOffset>`；如需更小批次，可传 `--limit <n>`。
3. Codex 审核时只检查翻译质量，不修改 state 文件中的指纹、时间戳或 schema。
4. 某批次确认审核通过后，使用 `node ./i18n/authority/messagesReview.mts approve --ids <id1,id2,...>` 写入审核状态；批量很多时改用 `--ids-file <file>`。
5. 如果需要撤销某些条目的审核状态，使用 `node ./i18n/authority/messagesReview.mts unapprove --ids <id1,id2,...>`；同样支持 `--ids-file <file>`。
6. 如果 `messages.json` 合并上游后发生变更，可用 `node ./i18n/authority/messagesReview.mts unapprove --all-stale` 清除所有已失效的旧审核记录。
7. 查看总体审核进度时，使用 `node ./i18n/authority/messagesReview.mts stats`。

## 输出约定

- `next` 输出 JSON，其中 `items` 为本批待审核消息，`pagination.nextOffset` 可直接用于下一批。
- `counts.reviewedCurrent` 表示当前内容仍然有效的审核记录数量。
- `counts.staleReviewed` 表示因 `messages.json` 内容变化而失效、需要重新审核的记录数量。
- `counts.unreviewed` 表示当前尚未通过审核的消息总数。

## 禁止事项

- 不要手工编辑 `messages.review-state.json` 以伪造审核完成。
- 不要为了审核流程去改动 `i18n/core/model.mts` 或 authority schema，除非任务明确要求扩展通用模型。
- 不要把“已看过”当作“已审核通过”；只有写入 state 的条目才算完成。
