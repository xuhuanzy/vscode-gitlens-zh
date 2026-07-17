# i18n/authority

本目录是已批准译文的持久真源. Agent 在此直接审阅与改写 `zh-cn/` 下的权威数据, 不为审核进度维护旁路状态.

## 目录职责

| 路径                   | 作用                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `zh-cn/messages.json`  | 通用权威译文. 同一 `id` 可被多处 occurrence 复用.                      |
| `zh-cn/terms.json`     | 短术语 / 固定短语的全局替换. 仅适合语义稳定、不依赖整句语境的条目.     |
| `zh-cn/overrides.json` | 按 occurrence / output 的窄作用域覆盖. 通用译法无法兼顾多处用法时使用. |

解析优先级见 `i18n/core/authority.mts`: **output override > occurrence override > messages > terms**.

## 受众与翻译倾向

受众是 **熟悉 Git / VS Code 的程序员**. 译文优先:

1. **精确**: 术语与 Git 语义对齐, 不把不同概念揉成一词.
2. **高效**: 短、可扫读; 去掉礼貌套话与文言虚词; 按钮/tooltip 尤甚.
3. **可拼装**: template 译文必须在代入 `${slotN}` 后通顺; 槽位顺序由英文源码固定时, 用中文可接受的词序与分隔, 不强行英式介词直译.
4. **与库一致**: 新译文先对齐 `messages.json` 已有同类说法, 不为单句另造词.

### 倾向细则

- **去掉无效礼貌与虚词**: 英文祈使句不要硬加 "请"; 目的结构优先用 "以" 等短连接, 避免 "以便 / 为了能够" 等说明文腔.
- **UI 短标签优先动词短语**: `Stage` → `暂存`, `Unstage` → `取消暂存`, `Commit to` → `提交到`, 与既有 `Push to` → `推送到` 平行.
- **分支 / 引用名挂在句末时**: 源码常为 `${verbPhrase} ${branch}`. 中文用自然前缀 + 分隔承接, 例如 `提交到 main`, `修改上次提交 · main`. 避免文绉绉的 "于", 也避免语义错位的 "到" (amend 不是 commit destination).
- **禁用态 / 空状态文案**: 说明 "缺什么、做什么", 不写成客服口吻. 例: `输入提交消息以…`, `暂存上方更改以…`.
- **Remaining / All 等量词模板**: 与库内同类条目统一; 如 `${slot1} remaining` 已是 `${slot1} 剩余`, 则 `Remaining` 不要写成 `剩余项`.
- **Git 固定术语** (与全库保持一致, 下列为常见锚点):
    - `stage` / `unstage` → 暂存 / 取消暂存
    - `commit` (名词/动词按语境) → 提交
    - `commit message` → 提交消息
    - `Working Tree` / `working tree` → **工作树**
    - `workspace` → **工作区** (VS Code; 不得与 working tree 混用)
    - `amend` → 修改 (如 `修改上次提交`)
- **产品名、命令 id、配置键、URL、代码 token**: 不译或按域规则保留; 链接 URL 与 command id 必须原样.
- **中英混排**: 专有功能名若库内已保留英文 (如部分 Pro 能力名) 则跟随; 不要同一概念中英两套乱跳.

### 反模式

- 空字符串译文 (`""`): 生成链路会当有效翻译并删掉原文片段.
- 把英文语法碎片沉淀为通用 authority: `is` / `are` / `has` / `need` / `more` / `other` 等依赖整句, 应整句建模、抽取规则或 override.
- 无稳定 UI 语义的纯结构模板进入 `messages.json`: 如 `${slot1}, ${slot2}, ${slot3}`, `**${slot1}** (${slot2})`, `${slot1} of ${slot2} ${slot3}`.
- 用空译或碎片替换 "修掉" `pluralize` / 英文复数形态, 得到 `2 天days` 一类结果.
- 在通用 `messages.json` 里为某一处 occurrence 强行省略运行时数据槽 (用户数据、分支名、路径、SHA、配置键等). 多 occurrence 语义不一致时, 用 `overrides.json` 或回到抽取/建模层.

## 槽位与结构硬约束

1. `template` / `rich` 默认保留 `slots` 中每个 `${slotN}`, 且不改写占位符名、大小写与语法.
2. 仅当槽位是英文语法胶水、重复含义、英文形态后缀, 且在中文中确实应省略时, 才可省略; 省略须确认不是运行时语义数据, 并在本次改动说明中写明理由.
3. 同一 authority 覆盖多处且槽位语义不一时: **优先 `overrides.json`**, 不要污染通用条目.
4. Markdown / HTML 结构、命令 URI、配置键、代码片段不得随意改写.

## 何时改哪份文件

- **多处可共用的稳定说法** → `messages.json`
- **极短、全局同义、不依赖句式** → `terms.json` (慎用; 语法词不要进 terms)
- **仅某 occurrence/output 需要不同译法或不同槽位取舍** → `overrides.json`, 并写清 `note`

修改 authority 后, 若任务涉及生成或质量门禁, 运行相关结构化检查 / 域测试; 至少确认: 无空译文、关键术语未回退、省略槽位有理由.

## 工作边界

- 允许直接编辑 `zh-cn/messages.json`、`terms.json`、`overrides.json`.
- 禁止向 authority entry 注入 `reviewed` / `status` / `needsReview` 等审核字段.
- 禁止把本目录当临时 workset 或批量审核流水线入口.
- 上游源码只读 `.upstream/`; 生成物在 `.work/`, 二者都不是翻译真源.
- 无必要不改 `i18n/core/` 的 schema 与解析逻辑; 改模型须任务明确要求.

## 改译文时的最小检查

1. 看 `source` 与 `kind` (literal / template / rich), 搜库内同 source 或近义条目.
2. 对 template: 脑内代入典型槽位 (分支名、动词、数量) 读一遍完整中文.
3. 对按钮/tooltip/disabled 文案: 是否短、是否可扫读、是否像程序员工具而不是客服文案.
4. 术语是否与 Git / 本库锚点一致 (`工作树` vs `工作区` 等).
5. 需要窄覆盖时写 `overrides.json`, 而不是把特例写进通用 messages.
