# Webview HTML 本地化工作流

本目录用于承接 webview 的 fork-local 本地化，不复用 `package.nls.json`。

## 当前范围

- 静态 HTML 路径覆盖 `settings.html`
- 运行时 DOM 路径覆盖共享 webview 基类可触达的 Lit/legacy DOM 输出
- host 处理位置限定在 `WebviewController.getHtml()` 读取 `dist/webviews/*.html` 之后、`replaceWebviewHtmlTokens()` 之前
- 静态 HTML 路径处理文本节点和受控属性：`title`、`aria-label`、`placeholder`
- 运行时 DOM 路径处理完整匹配的文本节点和受控属性：`title`、`aria-label`、`placeholder`
- 动态插值句式、用户数据、提交消息、路径、分支名等不在自动改写范围内

## 产物

- `[webviews.nls.json](/D:/Workspace/learn/js/vscode-gitlens/webviews.nls.json)`
- `[webviews.nls.zh-cn.json](/D:/Workspace/learn/js/vscode-gitlens/webviews.nls.zh-cn.json)`
- `[settings.i18n.html](/D:/Workspace/learn/js/vscode-gitlens/dist/webviews/settings.i18n.html)`
- `[settings.i18n.json](/D:/Workspace/learn/js/vscode-gitlens/dist/webviews/settings.i18n.json)`

其中：

- `settings.html` 仍然是 webpack 生成的原始产物
- `settings.i18n.html` 是“已插入 i18n 占位符、但尚未替换运行时 token”的模板
- `settings.i18n.json` 保存 source/template identity，供 host 校验与缓存使用
- `runtime.*` catalog key 来自 `src/webviews/apps` 的保守运行时 UI 文案抽取

## 常用命令

```bash
pnpm run generate:webview-localization-assets
pnpm run generate:webview-nls:zh-cn
pnpm run report:webview-nls:zh-cn:pending -- --base HEAD
```

## 生成规则

### 静态 HTML

- 英文 catalog key 优先从结构性 owner 推导：
  - section `id`
  - 元素 `id`
  - `for`
  - `data-action`
  - `name`
  - `option[value]`
  - `command:` 链接
- 当不存在稳定 owner 时，回退到基于节点路径和原文的稳定短 hash
- 当同一结构 owner 下出现多个不同文案时，会自动附加稳定变体后缀，避免 key 冲突
- 文本值会先折叠普通空白字符再进入 catalog，但会保留 `&nbsp;` 等非普通空白实体，减少布局被破坏的风险

### 运行时 DOM

- 生成器扫描 `src/webviews/apps/**/*.ts(x)`
- Lit 模板会先按伪 HTML 解析，再抽取 parse5 可识别的文本节点和受控属性
- 对象字面量中只抽取明确 UI 用途的字段：`title`、`label`、`placeholder`、`tooltip`、`ariaLabel`、`emptyText`
- 生成器会过滤 CSS class、事件绑定、属性绑定、命令 ID、URL、路径和 placeholder token
- 运行时使用英文文案 exact-match 查表；同一英文文案如果存在多个不同译文，会从运行时值级映射中丢弃，避免误替换

## 运行时行为

- host 使用当前 `env.language` 选择 `webviews.nls.<locale>.json`
- 若 locale catalog 不存在，则回退到 `webviews.nls.json`
- 静态 HTML 路径的缓存单位是“token 替换前的已本地化模板”
- 静态 HTML 缓存 key 包含：
  - webview file
  - locale
  - source identity
  - catalog identity
- 运行时 DOM 路径在存在 locale 翻译表时由 host 注入 CSP nonce 保护的 `window.__GL_WEBVIEW_I18N__`
- 英文 locale 不注入空翻译表，仅同步 `<html lang>`
- `GlElement`、`GlWebviewApp` 和 legacy `App` 会在共享边界本地化 DOM，并用 MutationObserver 覆盖后续追加节点
- 禁止缓存最终 `webview.html`
  - 因为最终 HTML 含 CSP nonce、bootstrap、实例 ID 和解析后的 webview URI
