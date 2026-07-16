# 项目协作说明

## 核心约束

- 此项目处于原型开发阶段, 禁止一切兼容旧代码行为, 无需考虑任何兼容性与对外 API 稳定性

## 文件边界

- `.upstream/`、`.work/` 与 `artifacts/` 是可再生目录，不得将其中内容作为长期真源提交。
- i18n 持久数据只写入控制仓库的 `i18n/`；上游源码只从 `.upstream/` 读取。
- 禁止在项目根目录下引入 `.pnpm-store`。

## 测试

- 优先通过公共命令或导出接口验证可观察行为，不测试私有 helper。
- 文件系统测试必须使用测试临时目录，不能污染真实 `.upstream/` 或 `.work/`。
- 涉及构建与打包的测试应断言控制仓库受跟踪 i18n 数据保持不变。

## Agent skills

### Issue tracker

临时 issues 与 PRD 使用 `.scratch/<feature>/` 下的本地 Markdown 文件管理。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认的五种状态词汇。详见 `docs/agents/triage-labels.md`。

### Domain docs

采用单上下文布局：根目录 `CONTEXT.md` 与 `docs/adr/`。详见 `docs/agents/domain.md`。
