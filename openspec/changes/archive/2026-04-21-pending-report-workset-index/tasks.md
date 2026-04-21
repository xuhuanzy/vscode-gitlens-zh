## 1. Pending Report Shape

- [x] 1.1 收缩 pending report 的类型与 schema，只保留统计字段和最小 workset 定位字段
- [x] 1.2 更新 pending report 生成逻辑与 CLI 输出，移除冗余的上下文字段

## 2. Workflow Guidance

- [x] 2.1 为 `i18n/reports` 新增目录级 `AGENTS.md`，明确 reports 只读、worksets 可编辑
- [x] 2.2 更新 `i18n/README.md` 与 `i18n/reports/AGENTS.md`，统一 reports/worksets 的消费边界

## 3. Verification

- [x] 3.1 更新或新增测试，覆盖新的 pending report 结构与基于 workset 的消费方式
- [x] 3.2 运行相关测试或最小验证命令，确认 report 仍能稳定支撑翻译循环
