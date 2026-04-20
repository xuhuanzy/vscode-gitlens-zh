## Context

当前 `commitDisplay` 工作流有两个核心缺陷：

- `syncLocaleCatalog()` 会保留已有 zh-CN 值，因此同一条英文模板如果改了，旧中文仍会留在生成后的 runtime catalog 里。
- manual zh-CN 直接寄存在 [src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json)，而 [i18n/commitDisplay/commitDisplayLocalization.mts](/D:/Workspace/learn/js/vscode-gitlens/i18n/commitDisplay/commitDisplayLocalization.mts) 又单独维护一份 current English catalog。这让“当前英文”“人工确认译文”“生成产物”混在一起，无法在上游文案变化时立即失效旧翻译。

同时，`commitDisplayLocalization.mts` 里仍有大量 `createEntries(...)`。这些代码本质上是在手工维护一份 English canonical catalog；它不适合作为长期唯一真源，因为它和 runtime 侧的受控展示边界之间仍存在一层重复维护。

`zhCnProofreader.mts` 也有类似问题：`sharedZhCnPassthroughValues`、`sharedZhCnProtectedTerms`、`sharedZhCnGlossaryOverrides` 把权威内容硬编码在 TypeScript 常量里，并且同一个术语会以不同集合语义重复出现。像 `Blame` 这样的 identity-preserved 词完全可以用 `"Blame": "Blame"` 这种 authority entry 表达，而不是继续拆成多套数据容器。

这次设计必须满足三个约束：

- 上游 merge 后，只要当前英文变了，就必须立刻看见需要更新译文的信号。
- manual zh-CN 必须迁到 tooling-owned 的权威映射文件，生成产物不再可手工编辑。
- `zhCnProofreader` 的共享 authority 内容也必须迁到 `./i18n` 下单独目录，并优先使用 JSON 作为权威配置格式。
- 对上游维护源码的接入仍要保持最小侵入，只允许在现有 commit-display 边界附近重构。

## Goals / Non-Goals

**Goals:**

- 为 `commitDisplay` 建立 source-validated 的权威翻译映射文件。
- 让生成流程从“保留旧 zh-CN”改为“只生成当前英文仍匹配的 manual translation 或 proofreader output”。
- 让英文 drift 直接导致对应 zh-CN runtime entry 被移除，并在 report 中被标成待更新。
- 将 commit-display 当前英文回归到源码边界上的英文模板本身，删除单独的 source tree / leaf lexicon 真源。
- 保持 runtime 继续通过缺失 locale key 回退 English，不在运行时引入 proofreader 或更复杂的翻译逻辑。
- 将 proofreader 的 shared authority 内容从 TypeScript 常量收敛到单独的 JSON authority 目录，并允许同目录承载 shared 与 branch-owned authority 资产。
- 用统一 authority 词典表达 identity mapping 与 translated mapping，减少 `passthrough/protected/glossary` 多套硬编码数据源。

**Non-Goals:**

- 不把这次 change 扩展到 `package.nls` 或 webview runtime 全面迁移。
- 不在 runtime 侧引入智能翻译、机器翻译或动态规则求值。
- 不改变日期、relative time、branch、SHA、provider 名称、PR 标题、commit message 正文等动态值语义。
- 不扩大 commit formatter / quick pick 调用点的侵入面到现有边界之外。
- 不把 proofreader 的所有算法语义都扁平化为单一“精确匹配”；identity 词典外置不等于放弃必要的 segment-level protection。

## Decisions

### 1. 将权威内容集中到 `./i18n` 下的单独 authority 目录

这次 change 不再把 authority 内容分散在 `i18n/shared/zhCnProofreader.mts` 常量和各 surface 自己的脚本里，而是统一迁到类似 `i18n/authority/zh-cn/` 的目录。该目录至少分两层：

- shared authority：跨 surface 复用的 canonical 词典与 identity mapping
- branch-owned / surface-owned authority：当前分支为具体 surface 维护的 manual translation 或 exception authority

优先使用 JSON 作为权威配置格式，以降低维护门槛并减少 TypeScript 常量与 loader 逻辑耦合。

Rationale:

- 这让 proofreader authority 与 commit-display manual authority 都回到 `./i18n` ownership，而不是散落在脚本实现里。
- JSON 更适合作为“可审计、可比对、可批量更新”的权威资产。

Alternative considered: 继续把 shared authority 硬编码在 `zhCnProofreader.mts` 中，只把 commit-display manual authority 单独迁出。这样仍会保留一半 authority 在代码里，后续 drift 与 review 成本没有本质下降，因此拒绝。

### 2. 引入单独的权威翻译映射文件，manual zh-CN 不再存放在 runtime catalog

`commitDisplay` 将新增一个 tooling-owned 的权威映射文件，例如 `i18n/authority/zh-cn/branch/commit-display.translations.json`。它直接以英文模板为 key，记录每条手工确认的中文译文。

生成后的 [src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json) 变成纯派生产物，不再允许直接人工维护。

Rationale:

- manual translation 与 generated runtime catalog 分离后，才能在英文 drift 时让生成产物安全失效，而不是继续复用旧中文。
- 权威映射保留“这条中文是针对哪条英文确认过的”这一层证据，便于 merge 后立即判断 stale。

Alternative considered: 继续直接编辑 runtime zh-CN catalog。该方案会让 stale translation 无法与 current English 建立显式绑定，因此拒绝。

### 3. shared authority 数据统一为词典模型，identity mapping 也进入同一真源

`sharedZhCnPassthroughValues`、`sharedZhCnProtectedTerms`、`sharedZhCnGlossaryOverrides` 的内容将收敛到统一 authority 词典。对 preserved 词，直接用 identity mapping 表达，例如：

```json
{
	"Blame": "Blame",
	"GitLens": "GitLens",
	"Commit": "提交"
}
```

proofreader loader 从同一词典中派生最小必要的视图：

- exact identity entries
- exact translated glossary entries
- 可参与 segment protection 的 identity terms

也就是说，数据真源合并，但算法仍保留“整句命中”和“词段保护”这两个最小语义层次。

Rationale:

- 数据合并后，`Blame` 这类词不再需要同时存在于 passthrough set 和 protected set。
- 词典模型更接近维护者真正关心的内容：源词到权威输出，而不是实现内部使用了几个 `Set`/`Map`。
- 仅仅把所有逻辑降为 exact-match 会丢掉 `Pull Request #{id}`、`GitLens settings` 这类现有能力，因此算法层必须保留最小语义推导。

Alternative considered: 彻底取消 protected term 语义，只保留单一 exact dictionary。该方案虽然更简单，但会直接削弱 proofreader 当前已覆盖的模式，因此拒绝。

### 4. 生成流程改为 authority-first、proofreader-second、sparse-output

新的 commit-display zh-CN 生成顺序如下：

1. 读取当前 English source catalog。
2. 读取权威翻译映射。
3. 对每条英文模板 key：
   - 如果 authority entry 存在，使用该人工译文。
   - 否则，如果共享 proofreader 能为 `currentEnglish` 产出确定结果，使用 proofreader 输出。
   - 否则，不向 runtime zh-CN catalog 写入该 key。

这意味着生成后的 locale catalog 将是 sparse catalog；缺失项由 runtime adapter 继续回退 English。[commitDisplayLocalization.ts:16](/D:/Workspace/learn/js/vscode-gitlens/src/i18n/commitDisplay/commitDisplayLocalization.ts#L16)

Rationale:

- sparse output 才能真正表达“当前没有有效 zh-CN”，而不是把英文复制一份塞进 zh-CN 文件制造假覆盖。
- manual authority 应优先于 proofreader，因为它代表人工确认过的译法。

Alternative considered: proofreader-first、authority-override。功能上可行，但会让 manual translation 的主导地位不清晰，也不利于 stale 分类，因此拒绝。

### 5. stale authority entry 不自动清空权威文件，只从 runtime output 中失效

当 `authority.english !== currentEnglish` 时：

- 该 key MUST 从生成的 runtime zh-CN catalog 中移除。
- 该 key MUST 在 report 中被标为 stale / pending updated。
- authority file 中的旧记录先保留，等待人工更新。

Rationale:

- 直接删除 authority entry 会丢失原有人工译文和上下文，不利于翻译者修订。
- 从 runtime output 中移除已经足以保证产品行为回退 English，不会继续使用过期中文。

Alternative considered: 自动同时删除 authority entry。该方案信息丢失太大，因此拒绝。

### 6. commit-display 当前英文真源回到源码边界上的英文模板

`commitDisplayLocalization.mts` 不再长期承担“一份平铺 English catalog 真源”。当前英文应直接来源于源码边界上的英文模板调用：

- `localizeCommitDisplayString('English template', ...)`
- `getCommitQuickPickActionLabel('English template')`
- `getCommitQuickPickBranchActionLabel('English template', ...)`
- `getCommitQuickPickSeparatorLabel('English template')`

tooling 直接扫描这些调用生成 English catalog；runtime 边界 helper 也直接消费同一组英文模板，而不是再手工维护第二份 source tree 或 `createEntries` 表。

Rationale:

- 这直接回应了 `createEntries` 大量膨胀的问题：问题不在 helper 本身，而在它长期承载了一份手工平铺英文目录。
- 英文模板即 key 的方式最贴近上游源码，merge 后更容易第一时间暴露 drift。

Alternative considered: 保留当前 `createEntries` 巨表，或把它替换成新的 source tree / rule family。这样虽然能解决 stale translation，但 English source 仍是第二份手工目录，因此拒绝。

### 7. shared tooling 扩展 authority validation，而不是复用旧的 “preserve existing locale” 语义

`i18n/shared/catalog.mts` 当前的 `syncLocaleCatalog()` 假设“已有 localized value 就保留”。这对 authority-backed workflow 不成立。新的 shared primitive 需要显式支持：

- 读取 current English catalog
- 应用 authority entry validation
- 组合 proofreader fallback
- 产出 sparse locale catalog
- 计算 `covered / stale / pending` 分类

`reportPendingCommitDisplayNlsZhCn.mts` 将直接消费这套分类，而不是再依赖“localized 是否等于 english”这种弱信号。

Rationale:

- 旧的 sync 语义是 locale-preserving；新的需求是 source-validating。
- stale invalidation 与 pending classification 如果继续分散实现，后续很容易再次漂移。

Alternative considered: 只在 commit-display 脚本里单独实现一套 authority validation。该方案短期可行，但会复制 catalog lifecycle 逻辑，因此拒绝。

## Risks / Trade-offs

- [迁移初期 diff 很大] → 先用现有 zh-CN runtime catalog 反向生成 authority file 种子，再切换生成逻辑，避免一次性重翻。
- [JSON authority 过于扁平导致语义丢失] → 数据层统一为词典，但 loader 明确派生 exact/segment 两类最小匹配视图，不把行为语义直接塞进多套手写常量。
- [sparse locale 输出让评审误以为“丢翻译”] → 在 README 和 report 中明确说明：缺失 key 表示 English fallback，不表示运行时异常。
- [当前英文 source 收敛方案选型不当] → 先限定在 commit-display 现有边界 helper 与 `src/i18n/commitDisplay` 内，不扩大到无关 formatter/quickpick 逻辑。
- [authority 与 proofreader 的优先级被误用] → 通过 shared tests 固定“authority-first, proofreader-second”的决策。
- [stale entry 太多导致 report 噪声大] → report 单独汇总 stale updated，并允许稳定写出完整报告文件供人工处理。

## Migration Plan

1. 建立 `./i18n` 下统一 authority 目录，并把 proofreader shared authority 常量迁出为 JSON 词典。
2. 从统一 authority 词典派生 proofreader 所需的 exact/segment/glossary 视图，并保持现有行为测试通过。
3. 从当前 `commitDisplay.nls.json` 与 `commitDisplay.nls.zh-cn.json` 生成首版 commit-display authority seed，保留英文模板 key 与现有人工中文。
4. 引入 authority validation/sparse locale generation 的 shared primitive，并让 commit-display 先接入。
5. 重构 commit-display 当前英文 source 定义，减少 `createEntries` 平铺目录的长期 ownership。
6. 更新 generate/report 脚本，使 stale authority entry 从 runtime zh-CN output 中移除，并在报告中立即暴露。
7. 更新 README、tests 与验证脚本，禁止再把 generated zh-CN catalog 当作人工翻译输入。

## Open Questions

- 当前英文 source 定义最终放在 `src/i18n/commitDisplay` 还是继续保留在 `./i18n/commitDisplay`，但以单一结构化模块暴露给 runtime/tooling 共享读取。
- stale authority entry 的报告是否需要带出“旧英文”和“现英文”，还是仅在导出报告中包含完整上下文即可。
- authority file 是否只覆盖 manual translation，还是允许显式记录“接受英文直通”的人工决策；第一阶段倾向于只收 manual translation，把 passthrough 继续留给 proofreader / accepted rules。
- shared authority JSON 第一阶段是否只用单一 `source -> localized` 词典，还是需要在极少数条目上额外标记“仅 exact、不参与 segment protection”的元数据；默认倾向先从纯词典开始，只有被测试证明不够时再加结构。
