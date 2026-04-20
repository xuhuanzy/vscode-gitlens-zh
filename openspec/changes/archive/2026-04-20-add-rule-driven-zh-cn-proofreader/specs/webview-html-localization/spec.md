## ADDED Requirements

### Requirement: Webview HTML zh-CN catalog maintenance SHALL use the shared proofreader

系统 SHALL 在维护 webview HTML 所属 zh-CN catalog 时优先应用共享 proofreader，并把 webview-specific exact override 限定为 exception 层。

#### Scenario: Applying proofreader before webview HTML exceptions

- **WHEN** tooling 为包含静态 HTML 文案的 webview catalog 同步 zh-CN locale 值
- **THEN** 它 MUST 先执行共享 proofreader，再执行 webview-specific exact exceptions
- **AND** 它 MUST NOT 继续把共享品牌词、短模板或通用术语长期堆积在 webview-specific overrides 中

#### Scenario: Keeping HTML-specific divergences as exceptions

- **WHEN** 某个静态 HTML 文案需要共享规则无法表达的上下文译法
- **THEN** tooling MUST 通过 webview-specific exact exception 覆盖该值
- **AND** 它 MUST 将这类覆盖限制为 exception-only 内容
