## Context

上一阶段的静态 HTML 方案已经证明，host 边界是一个低侵入的本地化切入点。但除 `settings` 外，其他 webview 顶层 HTML 基本没有实际文案，主要只负责加载 webview bundle 和挂载自定义元素。继续扩展 `managedWebviews` 无法覆盖这些页面。

运行时页面的共同点是：多数 Lit 组件继承 `GlElement` / `GlWebviewApp` / `GlAppHost`，legacy 页面继承 `App`，Graph 中还有少量 React 内容挂载到 light DOM。相比逐个页面改字符串，最小破坏的路径是在 host 注入 catalog，然后在共享 DOM 边界做 exact-match 本地化。

## Goals / Non-Goals

**Goals:**

- 继续避免在各 webview 页面中大规模引入逐字符串本地化调用。
- 在 host HTML 阶段注入运行时 webview i18n payload，保持 provider 调用点不变。
- 在共享 webview 基类层自动本地化渲染后的文本节点和受控属性。
- 扩展 `i18n/webviews` 生成流程，保守抽取运行时 UI 文案并复用现有 `webviews.nls*.json`。
- 使用有界缓存和 exact-match 映射，降低重复 catalog 查找和误改风险。

**Non-Goals:**

- 不在本阶段重写所有 Lit/React 模板为显式 `t()` 调用。
- 不尝试翻译用户数据、路径、提交消息、分支名、远程名或动态服务返回内容。
- 不覆盖 Markdown/unsafeHTML 中所有深层文案语义；这类内容后续可以按组件显式处理。
- 不缓存最终 webview HTML。

## Decisions

### 1. Host injects a runtime i18n payload before token replacement

host 会读取 `webviews.nls.json` 和当前 locale 对应的 `webviews.nls.<locale>.json`，构造一个以英文文案为 key 的运行时翻译表，并以 CSP nonce 保护的 `<script>` 注入到 webview HTML 中。英文 locale 没有翻译需求时不注入空 payload，仅同步 `<html lang>`。

Rationale:

- provider 和页面入口不需要传递新的参数。
- webview bundle 可以在启动时读取同一份 payload；无 payload 时从 `<html lang>` 读取 locale，并使用空翻译表。
- payload 注入仍然发生在最终 token 替换前，不改变已有 bootstrap、nonce、URI 注入责任。

### 2. Runtime applies exact-match DOM localization

webview 运行时只对完整文本节点和受控属性做 exact-match 翻译，并保留首尾空白。

Rationale:

- 不解析复杂动态句式，降低误改用户数据的风险。
- 对 `Loading...`、按钮文本、标题、空状态、tooltip、aria-label 这类高频文案覆盖效果明显。
- 动态插值句式可以通过后续显式模板能力补充，而不是在 DOM 层猜测语法。

### 3. Shared base classes are the interception point

Lit 组件通过 `GlElement.connectedCallback()` 注册根节点本地化；webview app 通过 `GlWebviewApp` / legacy `App` 对 `document.body` 兜底。MutationObserver 负责后续追加节点。

Rationale:

- 绝大多数 webview UI 都会经过这些共享基类或 body。
- 对上层页面源码的改动最少。
- React graph 内容挂载在 light DOM 下，body observer 可以覆盖一部分 React 输出。

### 4. Runtime catalog extraction is conservative

生成器扫描 `src/webviews/apps/**/*.ts(x)`，只抽取 Lit 模板中 parse5 可识别的文本节点和受控属性，以及对象字面量里的 `title`、`label`、`placeholder`、`tooltip` 等 UI 字段。

Rationale:

- 避免误收 CSS class、事件绑定、属性绑定、路径、命令 ID。
- 生成结果可以进入现有 zh-CN 同步和 pending report 流程。
- exact-match runtime 映射允许多个 key 共享同一英文文案，但当同一英文文案存在不同译文冲突时会丢弃该值级映射，避免错误替换。

## Risks / Trade-offs

- [Risk] DOM exact-match 无法覆盖拆分在多个文本节点中的动态句式。→ Mitigation: 首阶段覆盖完整静态文案，复杂句式留给后续显式模板能力。
- [Risk] 值级映射把相同英文在不同上下文下翻成同一中文。→ Mitigation: 构造运行时翻译表时如果同一英文对应多个不同译文，则丢弃该英文映射。
- [Risk] MutationObserver 带来额外开销。→ Mitigation: 仅当 runtime 翻译表非空时启用，并在 requestAnimationFrame 批处理追加节点。
- [Risk] 抽取器误收非 UI 字符串。→ Mitigation: 使用 parse5 解析模板文本，并只抽取文本节点、受控属性和明确 UI property。

## Migration Plan

1. 在 host HTML 阶段注入 runtime i18n payload，并设置 `<html lang>`。
2. 在 webview 共享层增加 DOM exact-match 本地化和 observer。
3. 从 `src/webviews/apps` 保守抽取运行时文案，合并进 `webviews.nls.json`。
4. 同步 `webviews.nls.zh-cn.json` 并补充第一批常见页面翻译。
5. 增加 core 行为测试，运行生成命令和 build 验证。
