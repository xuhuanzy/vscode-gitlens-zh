# Package Contributions 本地化

这个目录存放当前分支专用的 package manifest 本地化辅助脚本。

## 工作流

1. 先同步上游对 `contributions.json` 的修改。
2. 运行 `pnpm run generate:contributions`，更新以下文件：
   - `package.json`
   - `package.nls.json`
   - `package.nls.zh-cn.json`
3. 运行 `pnpm run generate:package-nls:zh-cn`，单独同步：
   - `package.nls.zh-cn.json`
4. 运行 `pnpm run report:package-nls:zh-cn:pending -- --base <ref>`，检查自某个基线 ref 以来新增或修改、但仍未完成中文翻译的英文条目。

## 辅助脚本

- `packageLocalization.mts`
  - 提供 `i18n/package` 目录共用的 package 本地化工具。
  - 负责 package catalog 读写辅助、差异计算、待翻译分析，以及共享路径与基础校验。
- `pnpm run generate:package-nls:zh-cn`
  - 根据 `package.nls.json` 同步中文目录。
  - 保留已有翻译。
  - 缺失的 key 默认回落为英文。
  - 自动删除过期 key。
- `pnpm run report:package-nls:zh-cn:pending -- --base <ref>`
  - 将当前 `package.nls.json` 与某个 git 基线 ref（例如 `HEAD`）进行对比。
  - 只报告自该 ref 以来新增或发生变化的 key。
  - 过滤出 `package.nls.zh-cn.json` 中仍然缺失，或仍与当前英文原文相同的条目。
  - 已在基线 zh-cn 目录中接受的英文直通值，以及约定保持英文的稳定品牌词，会被视为已覆盖。
  - 当控制台预览过长时，可通过 `--write <path>` 导出完整且稳定的 JSON 报告。

## 说明

- 当前分支中的 `contributions.json` 由上游维护，是输入文件，不能从 `package.json` 重新生成。
- 在当前分支中，`i18n/package` 是唯一允许写入 package manifest 本地化产物的目录。
- package contributions 与 configuration 元数据使用稳定的 owner-based key，而不是英文原文作为 key。
- 上游 `./scripts` 下的 contributions 工具链保持独立，便于将当前分支的本地化逻辑隔离在 `scripts/` 之外，并降低 rebase 成本。
- 当前分支有意禁用了 `extract:contributions`。
