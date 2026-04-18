## Why

GitLens 目前没有可持续的 package manifest 本地化流程，`contributions.json` 中的英文文案无法稳定生成 `package.nls.json` / `package.nls.zh-cn.json`，也无法在反向抽取时安全还原为英文源。现在需要先把 `package.json` 的 contributions 本地化链路建立起来，作为后续运行时 i18n 的基础。

## What Changes

- 为 `contributions.json` 建立 package 级本地化生成链路，生成带 `%key%` 引用的 `package.json` 与英文源 `package.nls.json`
- 为 package manifest 本地化建立稳定 key 命名规则，参考 `#5125` 的规则并补足重复文案、`viewsWelcome`、反向抽取可逆性等细节
- 修改现有 contributions 生成与提取逻辑，使 `extract:contributions` 能通过 `package.nls.json` 将 `%key%` 还原为英文，避免污染 `contributions.json`
- 在 `i18n/package/` 下增加独立脚本，用于根据 `package.nls.json` 生成并同步 `package.nls.zh-cn.json`
- 将 package 本地化与非 package 运行时 i18n 明确分层，运行时原文 key 方案不纳入本次 change

## Capabilities

### New Capabilities

- `package-contribution-localization`: 定义 `contributions.json` 到 `package.json`、`package.nls.json`、`package.nls.zh-cn.json` 的生成、反解与 key 命名规则

### Modified Capabilities

None.

## Impact

- Affected code: [`scripts/contributions/contributionsBuilder.mts`](d:/Workspace/learn/js/vscode-gitlens/scripts/contributions/contributionsBuilder.mts), [`scripts/generateContributions.mts`](d:/Workspace/learn/js/vscode-gitlens/scripts/generateContributions.mts)
- New tooling: `i18n/package/*`
- Generated outputs: [`package.json`](d:/Workspace/learn/js/vscode-gitlens/package.json), `package.nls.json`, `package.nls.zh-cn.json`
- Developer workflow: `generate:contributions` / `extract:contributions` 将变为 NLS-aware，但 package 中文生成保持为独立脚本
