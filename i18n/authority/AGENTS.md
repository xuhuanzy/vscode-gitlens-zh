# i18n/authority Agent Guide

本目录承载 `authority` 真源与其审核辅助文件。`zh-cn/messages.json` 是权威翻译源；审核进度必须通过旁路 state 文件维护，不能直接向 authority entry 注入审核字段。

## 核心规则

1. 允许读取 `zh-cn/messages.json`、`zh-cn/messages.review-state.json`、本目录 schema 与脚本来理解当前审核进度。
2. 禁止修改 `zh-cn/messages.json` 的 schema 结构以增加 `reviewed`、`status`、`needsReview` 等审核字段。
3. 审核状态只允许写入 `zh-cn/messages.review-state.json`，且必须通过 `messagesReview.mts` 脚本维护，避免手工改坏指纹或排序。
4. `messages.review-state.json` 中的记录基于消息内容指纹；如果 `messages.json` 中同一 `id` 的内容发生变化，旧审核记录会自动失效，必须重新审核。
5. 本目录下所有新增辅助脚本都应服务于 authority 真源，禁止把本目录当作临时翻译 workset 使用。

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
