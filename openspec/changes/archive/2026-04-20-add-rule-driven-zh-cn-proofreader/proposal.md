## Why

当前 zh-CN 维护方式已经暴露出两个结构性问题：`webviewNlsZhCnOverrides.mts` 逐渐膨胀成巨大的整句覆盖表，而 `commitDisplayLocalizationEntries` 同时承担 English canonical text、受控输出白名单和 catalog source 的角色，导致规则缺位、短模板漂移、以及业务代码与 i18n 资产之间的重复真源。继续沿用“新增文案就补一条 exact override”的方式，会让这条 i18n 分支越来越难维护、校对和持续合并上游。

现在需要把 zh-CN 维护从“人工补洞”升级成“规则驱动的强校对器”：优先用共享规则统一保留词、短模板句式和常用术语，只把少量上下文特例留给 surface-specific exception 层。

## What Changes

- 在 `./i18n/shared` 下引入共享的 zh-CN rule-driven proofreader，用于集中维护保留原意词、短模板规则、固定术语和少量 exact exceptions。
- 将 proofreader 接入 webview 和 commitDisplay 的 zh-CN 生成/同步流程，使其成为 `sync` 之后、surface-specific exception 之前的强校对层。
- 将 proofreader 的判定结果接入 pending report，使“允许保留英文”“已由规则覆盖”“仍需人工翻译”三类状态使用同一套策略解释。
- 收缩 `i18n/webviews/webviewNlsZhCnOverrides.mts` 的职责，只保留无法由共享规则表达的 surface-specific exact exceptions。
- 重构 commit-display English canonical text 的组织方式：优先使用规则族生成稳定 key 与受控输出，仅对无法可靠规则化的 leaf copy 保留显式词典。
- 保持 runtime 侧仍然消费现有 catalog，不在 webview/client 或 commitDisplay/runtime 中引入新的智能翻译逻辑。

## Capabilities

### New Capabilities

- `zh-cn-proofreader-policy`: 定义共享 zh-CN 强校对器在 `./i18n` tooling 中的规则层级、覆盖顺序、report 语义和 surface hook。

### Modified Capabilities

- `i18n-governance`: 明确 rule-driven proofreader 属于 `./i18n` 的共享 tooling ownership，并继续禁止把复杂翻译判断下沉到 runtime。
- `commit-display-localization`: 将 commit-display 的 English canonical text 从巨大平铺 entry 表重构为规则族加少量 leaf lexicon，并接入共享 proofreader。
- `webview-html-localization`: 要求 webview HTML 所属 catalog 的 zh-CN 生成遵循共享 proofreader，并将 surface-specific override 限定为 exception 层。
- `webview-runtime-localization`: 要求 runtime webview catalog 的 zh-CN 生成与 pending report 复用共享 proofreader，而不是继续依赖不断膨胀的 exact override 表。

## Impact

- Affected tooling: `i18n/shared/`, `i18n/webviews/`, `i18n/commitDisplay/` 下的 catalog sync、report、policy 和 English canonical text 生成脚本。
- Affected runtime assets: `src/i18n/webviews/webviews.nls*.json` 与 `src/i18n/commitDisplay/commitDisplay.nls*.json` 的生成来源和维护方式。
- Affected source touchpoints: `src/git/formatters/commitFormatterText.ts`、`src/quickpicks/items/commitQuickPickText.ts` 等 commit-display 边界 helper 可能需要最小化改造，以适配规则族 key/输出模型。
- Out of scope: webview registration title、命令注册名、动态用户数据、provider 名称、branch/SHA/path/date/relative time 等现有动态值语义。
