## Context

GitLens 目前的 contributions 生成链路是：

`contributions.json -> scripts/generateContributions.mts -> package.json`

同时还存在反向抽取链路：

`package.json -> scripts/generateContributions.mts --extract -> contributions.json`

这条链路当前只认识英文原文，不认识 `%key%` 与 `package.nls.json`。因此，一旦 package contributions 改为 `%key%` 形式，现有反向抽取就会把 `%key%` 原样写回 `contributions.json`。`#5125` 的核心价值在于把这条双向链路变成 NLS-aware，但其草案把额外脚本也放进了 `scripts/`。本 change 需要保留它的闭环思路，同时把 fork 特有的迁移与中文生成工具收敛到 `i18n/package/`，降低与上游冲突。

## Goals / Non-Goals

**Goals:**

- 让 `contributions.json` 继续作为 package contributions 的英文唯一源
- 让 `generate:contributions` 正向生成 `%key%` 形式的 `package.json`，并同步生成 `package.nls.json`
- 让 `extract:contributions` 能通过 `package.nls.json` 将 `%key%` 解回英文，保持 `contributions.json` 可逆
- 为 package contributions 建立稳定 key 规则，参考 `#5125` 并补足重复文案、`viewsWelcome` 漂移等问题
- 将 package 中文文件生成拆到 `i18n/package/` 的独立脚本中，输出 `package.nls.zh-cn.json`

**Non-Goals:**

- 不处理运行时代码、webview、命令消息、QuickPick 等非 package i18n
- 不处理 `package.json` 中非 contributions 的其他本地化字段
- 不引入 `./i18n` 作为 package 英文翻译源，package 英文源仍以 `package.nls.json` 为准
- 不大幅重构现有 build/watch 机制，只做支撑 contributions 本地化所需的最小修改

## Decisions

### 1. 主闭环仍然复用现有 `generateContributions` 流程，只做最小修改

选择在 [`scripts/contributions/contributionsBuilder.mts`](d:/Workspace/learn/js/vscode-gitlens/scripts/contributions/contributionsBuilder.mts) 和 [`scripts/generateContributions.mts`](d:/Workspace/learn/js/vscode-gitlens/scripts/generateContributions.mts) 内补齐 NLS-aware 能力，而不是完全外置一个平行生成器。

原因：

- 现有开发流程已经围绕 `generate:contributions` / `extract:contributions` 建立
- 只有在主流程里修复 `%key% <-> english` 的双向可逆性，才能避免 `contributions.json` 被污染
- 相比整体外置复制，这两处最小改动更接近 `#5125`，也更容易长期 rebase

备选方案：

- 完全在 `i18n/` 下重写一套平行生成链
  - 放弃，因为会与现有 watch / extract 机制分叉，后续维护成本更高

### 2. Package key 不使用原文，运行时 key 仍保留原文方案

package contributions 的 key 采用稳定命名，不使用英文原文作为 key；非 package 运行时 i18n 继续保留“原文作 key”的总体方向，但不在本 change 中实现。

原因：

- package 文案存在大量重复字符串，不能依赖原文区分
- package key 需要在 `package.json` 中稳定存在，不能因为英文轻微调整导致整体漂移
- package 与 runtime 的约束不同，应分开治理

### 3. Key 命名规则参考 `#5125`，并补足 `viewsWelcome` 的稳定性

命名规则：

- command title: `commands.<normalized-command-id>.title`
- submenu label: `submenus.<normalized-submenu-id>.label`
- view name: `views.<normalized-view-id>.name`
- view contextual title: `views.<normalized-view-id>.contextualTitle`
- views welcome contents: `viewsWelcome.<normalized-view-id>.<content-hash>.contents`

其中：

- `normalized-*` 规则参考 `#5125`，以拥有者标识为主，而非原文
- 分隔符 `:`、`/`、空格等会被归一化为 `.`，连续分隔符折叠
- `viewsWelcome` 不采用位置索引，而采用稳定哈希，避免插入/重排内容导致 key 漂移
- `content-hash` 由英文 `contents` 与 `when` 组合计算，确保同一 view 下相似 welcome 文案可区分

备选方案：

- `viewsWelcome.<viewId>.<index>.contents`
  - 放弃，因为顺序变更会导致 key 大面积漂移
- 直接以原文作 key
  - 放弃，因为重复文案无法区分所有者

### 4. `package.nls.json` 是 package 英文真源，`package.nls.zh-cn.json` 由独立脚本同步

主生成链只负责：

- 生成 `%key%` 形式的 `package.json`
- 生成 `package.nls.json`
- 在 extract 时使用 `package.nls.json` 反解英文

中文链由 `i18n/package/` 下独立脚本负责：

- 输入：`package.nls.json` + 现有 `package.nls.zh-cn.json`
- 输出：新的 `package.nls.zh-cn.json`

同步规则：

- 保留已有中文翻译
- 缺失 key 用英文回填
- 已废弃 key 自动删除
- 输出稳定排序

原因：

- 中文维护与英文 canonical source 的职责应分离
- 把中文同步脚本放在 `i18n/package/`，可以避免把 fork 专属维护逻辑放进 `scripts/`

### 5. 一次性迁移脚本放在 `i18n/package/`

一次性迁移脚本仅负责初始化或补齐 `package.nls.json` 所需结构，不承担长期生成职责。长期职责仍由 `generateContributions` 主流程承担。

原因：

- migration 是 fork 特有、低频操作，最适合与上游主脚本隔离
- 这样可以降低未来同步 `scripts/` 目录时的冲突面

## Risks / Trade-offs

- `[Risk] 现有 extract 流程遗漏某个字段，导致 `%key%` 被写回 contributions.json` → Mitigation: 在 spec 中枚举所有 package contribution 字段，并在实现时对 command/submenu/view/viewsWelcome 全覆盖验证`
- `[Risk] key 归一化规则与上游未来实现不一致，增加 rebase 成本` → Mitigation: 尽量贴近 `#5125` 的 owner-based 规则，仅对 `viewsWelcome` 稳定性做最小增强`
- `[Risk] viewsWelcome 哈希规则过于敏感，英文微调导致 key 变化` → Mitigation: 只对 `contents + when` 求短哈希，并将其视为 welcome 文案语义变更的一部分`
- `[Risk] 中文同步脚本误删人工维护内容` → Mitigation: 让脚本只以 `package.nls.json` 为 key 集合来源，删除不再存在的 key，但保留所有有效 key 的现有中文值`

## Migration Plan

1. 在 `scripts/` 中引入最小 NLS-aware 修改，让主链能生成和反解 `package.nls.json`
2. 在 `i18n/package/` 中加入一次性迁移脚本，初始化 package NLS 状态
3. 在 `i18n/package/` 中加入中文同步脚本，生成 `package.nls.zh-cn.json`
4. 在本地化分支上改用新的 package NLS 流程维护 contributions

## Open Questions

- `viewsWelcome` 哈希长度与编码形式是沿用 `#5125` 的实现细节，还是单独定义更短的人类可读形式
- 是否需要在 package 中文同步脚本中支持“锁定某些 key 不自动回填”的例外配置
