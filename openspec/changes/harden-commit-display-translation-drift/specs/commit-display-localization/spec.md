## MODIFIED Requirements

### Requirement: Commit-display English canonical copy SHALL be derived from source-adjacent English templates

系统 SHALL 直接从 commit-display 源码边界附近出现的英文模板推导 current English catalog，并以“英文模板本身”作为最终 key，而不是长期维护一份平行的 source tree、rule family 或 stable key 命名体系。

#### Scenario: Deriving canonical English by scanning source-local localization calls

- **WHEN** commit-display 的 action、separator、stats、hint 或 resource-template 文案在 runtime/helper 源码中以英文模板直接调用本地化 helper
- **THEN** tooling MUST 直接从这些源码调用扫描出 canonical English 输出
- **AND** 它 MUST 以英文模板本身作为 runtime key
- **AND** 它 MUST 继续保留现有动态参数占位符语义，例如 `{provider}`、`{resource}`、`{count}` 与 `{branch}`

#### Scenario: Avoiding a parallel commit-display English source tree

- **WHEN** commit-display runtime 需要新增一条受控文案
- **THEN** 维护者 MUST 直接在源码边界处写入英文模板并调用本地化 helper
- **AND** tooling MUST 不要求在独立的 source tree、leaf lexicon 或 flat catalog 副本里重复登记这条英文

### Requirement: Commit-display zh-CN maintenance SHALL use the shared proofreader

系统 SHALL 在 commit-display 的 zh-CN catalog 生成与 pending report 中复用共享 proofreader，并结合 tooling-owned 的权威翻译映射维护 zh-CN 输出，而不是继续把生成后的 runtime zh-CN catalog 当作人工维护真源。

#### Scenario: Applying authority and proofreader during commit-display zh-CN sync

- **WHEN** commit-display zh-CN catalog 从当前 English source catalog 同步
- **THEN** tooling MUST 先读取位于 `./i18n` authority ownership 下、以英文模板为 key 的 authoritative translation map
- **AND** 对未被 authority 覆盖的值，它 MUST 复用共享 proofreader 生成可接受输出
- **AND** runtime MUST 继续通过英文模板 key 与参数模板回退 English

#### Scenario: Invalidating stale authority entries on English drift

- **WHEN** authority file 中的某个英文 key 不再出现在当前 commit-display English catalog 中
- **THEN** tooling MUST 不把旧 zh-CN 写入 `src/i18n/commitDisplay/commitDisplay.nls.zh-cn.json`
- **AND** 它 MUST 将该 key 视为需要人工更新的 stale translation，而不是沿用旧中文

#### Scenario: Reporting unresolved or stale commit-display copy

- **WHEN** report 命令比较 base ref 与当前 commit-display catalog
- **THEN** 它 MUST 使用当前 English、authoritative translation map 与 proofreader 共同判定 covered / pending
- **AND** 它 MUST 将 stale authority entry 报告为 pending updated
- **AND** 它 MUST 继续把 proofreader 已可靠覆盖的值视为 already covered
