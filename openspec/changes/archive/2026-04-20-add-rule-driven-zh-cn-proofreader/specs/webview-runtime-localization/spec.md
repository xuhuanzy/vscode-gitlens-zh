## ADDED Requirements

### Requirement: Runtime webview zh-CN maintenance SHALL combine shared proofreader with webview hooks

系统 SHALL 在 runtime webview catalog 的 zh-CN 生成与报告阶段复用共享 proofreader，并保留 webview surface 必需的 value-level hook。

#### Scenario: Applying shared proofreader to runtime-extracted UI text

- **WHEN** runtime UI 文案被抽取进统一的 webview English catalog 并同步到 zh-CN locale catalog
- **THEN** tooling MUST 对这些值应用共享 proofreader
- **AND** 它 MUST 在 proofreader 之后继续保留 webview-specific exact exceptions 的执行点，以处理少量上下文差异

#### Scenario: Preserving webview-specific value grouping behavior in reports

- **WHEN** pending report 以英文值去重或处理 runtime value-level 统计
- **THEN** 它 MUST 在复用共享 proofreader 的同时保留现有 webview-specific grouping 与 implicit passthrough hook
- **AND** 它 MUST 仅把 proofreader 与 exception 都无法覆盖的值保留为 pending
