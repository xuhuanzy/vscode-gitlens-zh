## 1. Commit Display Localization Workflow

- [x] 1.1 在 `./i18n` 下建立 commit-display localization 目录、README、English catalog 与 zh-CN 同步规则
- [x] 1.2 增加 commit-display localization 的生成、同步与待翻译报告脚本入口，并保持其 ownership 由 `./i18n` 主导
- [x] 1.3 生成供 runtime 使用的 commit-display localization 派生产物或查找表，并提供薄 adapter

## 2. CommitFormatter Minimal Integration

- [x] 2.1 以最小接入方式本地化 `commands()` 输出中的受控 label 与 tooltip/title
- [x] 2.2 以最小接入方式本地化 `message()` 未提交标签、`link()` 受控 tooltip / 标签，以及 `signature()` tooltip
- [x] 2.3 本地化 author mail title、`pullRequest()` 展示文案、pending 文案与 `pullRequestState()` 的 PR state 显示映射
- [x] 2.4 验证日期、relative time、revision formatting、markdown command 结构与动态用户数据保持不变
- [x] 2.5 补齐 `commands()` 后续 commit action QuickPick 的受控 action label、分组、hint、远端资源操作与顶部 stats 文案

## 3. Verification

- [x] 3.1 增加或更新测试，覆盖 English fallback 与 zh-CN 的 `CommitFormatter` display-copy 输出
- [x] 3.2 运行相关 build、test 与 commit-display localization 校验命令，并处理新增 workflow 暴露的问题
