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
pnpm install --frozen-lockfile
pnpm glzh upstream status
pnpm glzh upstream refresh
pnpm glzh i18n sync
pnpm glzh i18n report
pnpm glzh i18n promote
pnpm glzh build
pnpm glzh dev prepare
pnpm glzh dev watch
pnpm glzh package
pnpm glzh verify
pnpm test
pnpm format
pnpm format:check
```

- `upstream refresh`：按配置重建或校验 `.upstream/`。
- `i18n sync`：从锁定上游显式刷新 catalog/workset；普通构建不会改写翻译真源。
- `build`：校验 i18n 基线，生成 overlay，并调用上游 `build:quick`。
- `dev prepare`：生成完整本地化 overlay 与 manifest/NLS；当 `.upstream/.git/gl-managed.json` 中记录的 tag/commit 未完成完整构建，或版本发生变化时执行上游完整 `build`，否则使用 `build:quick` 加快重复调试启动。
- `dev watch`：准备本地化上游后运行上游 `watch`；修改 `i18n/authority/` 时会重放 overlay，webpack 随后增量编译。
- `package`：先运行上游只读检查，再执行 production quick bundle，并生成 VSIX 到 `artifacts/`。
- `verify`：执行配置、i18n、TypeScript 版本和可重放性检查。
- `format` / `format:check`：使用 Oxfmt 写入格式化结果或只检查格式。

`build` 与 `package` 支持 `--offline`，要求 `.upstream/` 与依赖已经就绪；`--clean` 只允许清理由本项目管理且已确认位于仓库内的工作目录。

## 工作流

### 更新上游版本

1. 更新 `gitlens-zh.config.json` 中的 tag 与完整 commit。
2. 执行 `pnpm glzh upstream refresh --clean`。
3. 执行 `pnpm glzh i18n sync`，审阅并提交 catalog/workset 变化。
4. 执行 `pnpm glzh verify` 和 `pnpm glzh package`。

### 更新翻译

编辑 `i18n/authority/` 或工作流产生的待翻译数据，随后运行 `i18n report`、`verify` 与 `build`。
构建生成物仅存在于 `.work/`、`.upstream/` 和 `artifacts/`，不应提交。
