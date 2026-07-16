# GitLens 中文

GitLens 中文分支，使用可重放覆盖层的方式处理 Gitlens 源码生成中文版 Gitlens。

> [!WARNING]
> 不对翻译精确性负责，目前 99% 翻译由 `gpt-5.5 xhigh` 根据上下文翻译与自校对。

## 目录

```text
.
├─ .upstream/              # 浅克隆的 GitLens 上游源码，不提交
├─ .work/                  # overlay、报告、日志等可再生输出，不提交
├─ artifacts/              # VSIX 等最终产物，不提交
├─ i18n/
│  ├─ authority/           # 翻译权威数据
│  ├─ catalog/             # 从锁定上游提取的消息目录
│  ├─ worksets/            # 待翻译工作集
│  ├─ schemas/             # i18n 数据结构约束
│  └─ reports/             # 可再生报告，默认不提交
└─ gitlens-zh.config.json  # 上游版本配置
```

`.upstream/` 只由项目编排器管理。不要在其中保存需要长期维护的修改；翻译应写入 i18n 真源。

## 常用命令

```powershell
pnpm glzh upstream status
pnpm glzh upstream refresh
pnpm glzh upstream build
pnpm glzh upstream build:quick
pnpm glzh i18n sync
pnpm glzh i18n report
pnpm glzh i18n promote
pnpm glzh i18n overlay
pnpm build
pnpm package
pnpm check
pnpm test
pnpm test:quick
pnpm test:full
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

- `glzh upstream refresh`：通过 Git 重置 `.upstream/` 为配置锁定的 tag/commit。
- `glzh upstream build`：在当前 `.upstream/` 上执行上游完整 development build。
- `glzh upstream build:quick`：在当前 `.upstream/` 上执行上游 quick development build。
- `glzh i18n sync`：从锁定上游显式刷新 catalog/workset；普通构建不会改写翻译真源。
- `glzh i18n overlay`：快速准备上游并应用源码与 manifest overlay，但不执行上游构建。
- `build`：构建中文 Gitlens。
- `package`：生成中文 VSIX 到 `artifacts/`。
- `check`：检查控制仓库 TypeScript。
- `test`：运行完整测试。
- `test:quick`：运行默认快速测试。
- `lint` / `lint:fix`：使用 Oxlint 检查控制仓库脚本与 i18n 代码，或应用安全自动修复。
- `format` / `format:check`：使用 Oxfmt 写入格式化结果或只检查格式。

## 工作流

### 更新上游版本

1. 更新 `gitlens-zh.config.json` 中的 tag 与完整 commit。
2. 执行 `pnpm glzh upstream refresh`。
3. 执行 `pnpm glzh i18n sync`，审阅并提交 catalog/workset 变化。
4. 执行 `pnpm check`、`pnpm test` 和 `pnpm package`。

### 更新翻译

编辑 `i18n/authority/` 或工作流产生的待翻译数据，随后运行 `i18n report`、`check` 与 `build`。
构建生成物仅存在于 `.work/`、`.upstream/` 和 `artifacts/`，不应提交。
