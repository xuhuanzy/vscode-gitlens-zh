## 1. Shared Proofreader Foundation

- [x] 1.1 在 `i18n/shared` 中定义共享 zh-CN proofreader 模块、规则层级、分类结果和 surface hook 接口
- [x] 1.2 将现有 shared passthrough / glossary 能力迁移到 proofreader 模型，并补充 protected terms、short-template families 与 canonical glossary 的首批规则
- [x] 1.3 为 proofreader 增加单元测试，覆盖规则优先级、longest-match、protected term 保留和 unresolved fallback

## 2. Webview Integration

- [x] 2.1 重构 webview zh-CN 生成流程为 `sync -> proofreader -> webview exceptions -> write`
- [x] 2.2 重构 webview pending report 以复用 proofreader 结果，并区分 already covered 与 pending
- [x] 2.3 收缩 `webviewNlsZhCnOverrides`，把可由共享规则表达的条目移出，仅保留 exception-only 内容

## 3. Commit-Display Integration

- [x] 3.1 将 commit-display English canonical text 从 flat entry object 拆分为 rule families 与少量 leaf lexicon，并保持现有 key namespace 稳定
- [x] 3.2 将 commit-display zh-CN 生成流程接入 proofreader，并保留 runtime catalog 消费方式不变
- [x] 3.3 重构 commit-display pending report 以复用 proofreader 结果，并验证 commit formatter / quick pick 受控文案输出仍保持现有动态参数语义

## 4. Verification

- [x] 4.1 运行相关 generation 与 pending report 命令，确认 webview 和 commit-display catalog 输出稳定且摘要符合预期
- [x] 4.2 运行受影响的 commit formatter / commit quick pick / webview localization 测试，确认规则化改造未改变 runtime 行为边界
