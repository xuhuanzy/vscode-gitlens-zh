## Context

当前 `i18n` 工作流已经具备 authority、catalog、workset、pending report 这些基础分层，但其核心实现仍然以 manifest 一阶段交付为中心：

- `i18n/shared/model.mts` 中的 `ManifestOccurrence`、`ManifestCatalogFile`、`pathPointer`、`pathSegments`、`keys` 等命名直接泄露 manifest 语义；
- `i18n/package/store.mts` 同时承担了 core store、authority bundle 与 manifest domain 的路径组织；
- override 结构默认分为 `scopeOverrides`、`anchorOverrides`、`keyOverrides` 三份文件，隐含假设“最终覆盖目标是 manifest key”；
- `PackageI18nContext` 将 workspace 目录、authority/report 目录与 manifest 输入输出文件耦合在同一个上下文对象中。

这些结构在只处理 `package.json` 时还能工作，但接入 `src/webviews/apps/**` 时会立刻出现概念错位：

- webviews 需要源码级引用，而不是 `pathPointer`；
- webviews 运行时输出更接近 locale bundle key，而不是 manifest key；
- webviews 页面由 HTML、Lit template、JSX、attribute 文案混合组成，需要统一的 source reference，而不是再为每种来源重造一套 occurrence 字段；
- 如果沿用现有 `package` 目录当 core，会继续让后续域的工作流挂靠在 manifest 实现上。

用户已经明确允许对 `i18n` 区域进行破坏性更新且不保留任何兼容性代码，因此本设计采用硬切方案：先重整 `i18n` core，再让 manifest 成为第一个 domain adapter，为 webviews 铺路。

## Goals / Non-Goals

**Goals:**

- 建立不带 manifest 特化命名的 i18n core 模型，统一表达 occurrence、reference、output reference、catalog、authority、workset、report。
- 建立 `core + domains` 的目录边界，使 manifest 成为一个 domain adapter，而不是事实上的核心实现。
- 用统一 selector 结构表达 override，避免未来为 webviews 或其他域继续扩散更多特化 override 文件。
- 在不保留兼容层的前提下，重写 schema、store、workflow、测试和文档，使 manifest 流程重新落在新的 core 之上。
- 为后续 webviews 接入保留明确的数据位：源码 reference、runtime/output key、domain-specific bundle generation。

**Non-Goals:**

- 本设计不直接实现 webviews 提取器、webview locale bundle 生成或 runtime 注入逻辑。
- 本设计不修改 `src/webviews/**` 或 `src/i18n/**` 业务代码。
- 本设计不要求同时完成 quickpicks、formatter 等后续域适配器。
- 本设计不保留旧 schema、旧 JSON 数据结构、旧 store API 或旧 context API 的兼容行为。

## Decisions

### 1. 将 `i18n` 重组为 `core` 与 `domains` 两层

目录将从当前的“共享模型 + package 流程”组织方式，重组为：

```text
i18n/
  core/
    model.mts
    context.mts
    store.mts
    authority.mts
    reconcile.mts
  domains/
    manifest/
      context.mts
      extractor.mts
      generator.mts
      workflow.mts
      __tests__/
```

`core` 只承载跨域通用的概念与工具，不直接知道 `package.json`、`package.nls.json` 或 webview HTML。manifest 相关的输入输出路径、提取器与生成器全部下沉到 `domains/manifest`。

选择这种重组方式，是为了避免 `package` 目录继续承担事实上的 core 角色。相比仅在原目录下改类型名，这种方式能更明确地阻止 future domain 继续依赖 manifest 实现细节。

备选方案：

- 保留 `i18n/package/**`，仅把 `shared/model.mts` 改名：结构上仍会让 manifest 成为默认中心，后续还需要再次拆目录。
- 只新增 `webviews` 目录并复用现有 `package/store.mts`：会把 manifest 的路径假设继续扩散到 webviews。

### 2. 用 domain-neutral 的 `SourceOccurrence` + `SourceReference` + `OutputReference` 替代 manifest occurrence 结构

核心 occurrence 模型将至少包含：

- `id`
- `domain`
- `scope`
- `anchor`
- `slot`
- `businessId?`
- `authorityId`
- `pattern`
- `patternFingerprint`
- `sourceText`
- `sourceHash`
- `reference`
- `output?`

其中：

- `reference` 表示消息在源码中的位置或结构来源；
- `output` 表示该 occurrence 最终生成到哪个运行时或产物键。

`reference` 至少需要支持两类：

- `json`: 用于 manifest 等结构化输入；
- `source`: 用于 HTML / Lit / JSX 等源码输入。

`output` 至少需要支持两类：

- `manifest-key`
- `runtime-key`

选择将“源码定位”和“输出定位”拆成两层，是因为 manifest 的 `%key%` 只是某个域的一种输出形式，不应该继续作为 occurrence 的一级字段。这样 manifest 仍能表达 `package.nls` key，而 webviews 可以表达 future locale bundle key。

备选方案：

- 延续 `pathPointer + keys`，只为 webviews 另加字段：会快速变成一组互相重叠且命名混乱的特化字段。
- 完全不记录 `output`：对 manifest 不利于生成，对 future runtime bundle 也无法稳定定位最终输出。

### 3. 将 workset 的 `keys` 改为 `occurrenceIds`

当前 workset entry 中的 `keys` 本质是 manifest 输出引用，而不是翻译核心语义。新结构将改为：

- `occurrenceIds: string[]`

workset 仍按 authority message identity 聚合，但回查依赖 catalog 中的 occurrence。manifest 需要生成时，再通过 `occurrenceIds -> catalog occurrence -> output.manifest-key` 解析目标；webviews 以后也可通过同一机制回到源码引用和 runtime key。

这样设计可以避免 workset 继续把 manifest key 当成跨域通用字段。

备选方案：

- 保留 `keys`，并为 future domain 再加 `runtimeKeys`、`references`：会使 workset 继续向多个域泄露实现细节。

### 4. 将 override 合并为统一 `overrides.json`，以 selector 表达覆盖目标

override 结构将统一为一份文件，entry 使用 selector：

- `occurrence`
- `anchor`
- `scope`
- `output`

统一 entry 形态后，authority 解析顺序仍可保持“更具体 selector 覆盖更宽 selector”的语义，但数据文件不再按 manifest 专用维度拆成三份。

这样设计的原因是：

- `keyOverride` 本质上只是某种 output-level override；
- webviews 以后可能需要 occurrence-level 或 runtime output-level override；
- 统一 selector 能减少文件数量，也更利于 future domain 使用同一解析流程。

备选方案：

- 继续保留三份 override 文件，并在 future domain 再新增更多文件：结构会越来越碎，且 selector 优先级会变得难以维护。

### 5. 将上下文拆为 workspace context 与 domain context

当前 `PackageI18nContext` 同时承担：

- workspace/i18n 目录定位；
- authority/catalog/workset/report 文件定位；
- manifest 输入输出文件定位。

新结构中：

- `I18nWorkspaceContext` 负责工作区与通用目录；
- `DomainContext` 负责 domain 的 catalog/workset/report 路径；
- `ManifestDomainContext` 在此基础上扩展 manifest 输入输出路径。

这样可以让 future `webviews` domain 在不继承 manifest 路径假设的前提下复用 core store。

### 6. 不保留旧 schema、旧 JSON 结构或迁移 fallback

由于用户已明确允许对 `i18n` 区域做破坏性更新且禁止保留兼容性代码，本次设计不做：

- 旧 schema 兼容读取；
- 旧字段双写；
- 旧 context API fallback；
- 旧 override 文件并行支持。

所有 `i18n` 下受影响的数据文件、schema、测试和 workflow 文档都直接切换到新结构。必要时只提供一次性的受控重建路径，而不是运行时代码兼容。

这样可以避免 core 被兼容层永久污染，也符合当前分支“只面向本分支维护”的前提。

## Risks / Trade-offs

- [重组范围较大，manifest 流程短期内会全部失效] → 先完成 core 落地，再立即重接 manifest adapter 和测试，确保在同一 change 内恢复工作流。
- [统一 selector 可能让 override 解析看起来更抽象] → 在 design 与 schema 中明确 selector kind 与优先级，并通过测试覆盖常见冲突场景。
- [删掉旧结构后，历史 workset/authority 文件无法直接复用] → 将该代价视为本次硬切的一部分，采用重建或一次性数据重写，而不是在代码里保留兼容读取。
- [manifest 先适配、webviews 后适配，短期内看不到 webviews 成果] → 明确本 change 的目标是为 webviews 清障，webviews 提案在此之后再单独实现。
- [core 过度抽象] → 只抽象已经明确需要跨域复用的概念：reference、output、selector、catalog/workset/report；不提前设计 webviews runtime 细节。

## Migration Plan

1. 创建 `i18n/core` 与 `i18n/domains/manifest` 的新目录边界。
2. 重写 core model、schema、context、store、authority、reconcile 基础能力。
3. 将 manifest extractor/generator/workflow 迁移为 domain adapter，并恢复 package 流程。
4. 重写 authority、catalog、workset、report 的 JSON 文件结构与测试夹具。
5. 更新 `i18n/README.md` 与相关 workflow 文档，明确新的 core/domain 组织方式和 override/workset 规则。
6. 在 manifest 流程恢复后，再以新 core 为前提推进 webviews 提案。

## Open Questions

- 统一 `overrides.json` 是否需要按 locale 分卷，还是先保持单 locale 一份文件即可。
- `source` reference 的定位信息是否需要一开始就包含 byte offset，还是行列范围已足够支撑 extractor/report。
- future webviews runtime bundle key 的命名约束是否应在 core 中预留 schema，还是留到 webviews domain proposal 再定义。
