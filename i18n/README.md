# GitLens 中文层

本目录只保存可重放的 i18n 逻辑与翻译真源, 不包含 GitLens 上游源码, 也不向上游 webpack 配置注入 loader 或 plugin.

## 目录职责

- `core`: occurrence、catalog、authority、workset、reconciliation 与通用存储逻辑.
- `domains/manifest`: 从上游 `package.json` 提取并生成本地化 manifest/NLS 文件.
- `domains/runtimeDynamic`: 从扩展宿主 TypeScript 源码提取动态 UI 文案并生成本地化源码镜像.
- `domains/webviews`: 从 webview TypeScript/HTML 源码提取文案并生成本地化源码镜像.
- `authority/zh-cn`: 已批准翻译、术语与覆盖规则.
- `catalog`: 与锁定上游版本对应的源码 occurrence 快照.
- `worksets`: 翻译工作状态.
- `schemas`: authority、catalog、workset 与报告的 JSON Schema.
- `reports`: 可再生的同步和待翻译报告, 不应被构建流程当作翻译真源.

## 三类根目录

所有 domain workflow 都接受 `I18nLayerOptions`:

```ts
interface I18nLayerOptions {
	controlRoot?: string;
	upstreamRoot?: string;
	workRoot?: string;
	locale?: "zh-cn";
}
```

- `controlRoot` 是本控制仓库. authority、catalog、workset、schema 和 report 均位于 `<controlRoot>/i18n`.
- `upstreamRoot` 是浅克隆的 GitLens 工作树, 默认 `<controlRoot>/.upstream`. 所有源码读取均从该目录进行.
- `workRoot` 是可清理的临时目录, 默认 `<controlRoot>/.work`. 本地化源码镜像位于 `<workRoot>/i18n/generated/<locale>`.

没有传参时, `createI18nLayerContext()` 会从当前模块位置确定控制仓库根目录. 相对的 `upstreamRoot` 与 `workRoot` 始终相对 `controlRoot` 解析.

## 重放顺序

1. pipeline 准备并校验 `.upstream`.
2. 独有 patch 在 extraction 之前应用到 `.upstream`.
3. `sync` 类 workflow 只读取 `.upstream`, 更新控制仓库中的 catalog/workset/report.
4. `generate` 类 workflow 从已提交的 catalog 与 authority 生成 `.work` 镜像.
5. pipeline 校验镜像后将其作为 overlay 应用到可丢弃的 `.upstream` 构建树.

普通 build/package 不应隐式刷新 catalog 或 workset. 上游升级后应显式执行同步并审查变更.

## 已移除的旧接线

以下旧实现不属于控制层, 不在本仓库维护:

- runtime dynamic webpack loader.
- webview webpack plugin 与 localized webpack config.
- 对上游 `scripts/build.mjs`、`webpack.config.mjs` 的 i18n 分流修改.

本地化生成结果由 pipeline 统一 overlay, 上游继续运行其原生构建脚本.
