# i18n Tooling Boundary

`./i18n` 只承载本分支的本地化 tooling。

- 负责 extract、catalog sync、pending report、glossary / passthrough policy、merge-assist 以及各 surface 的 CLI 入口
- 可以读写 runtime catalog，但 runtime 代码不得反向依赖 `./i18n`

`src/i18n` 只承载 runtime 代码与 runtime catalog。

- `src/i18n/commitDisplay` 保存 commit display runtime adapter 与它消费的 JSON catalog
- `src/i18n/webviews` 保存 webview host/client runtime helper 与它们消费的 JSON catalog
- `package.nls*.json` 是唯一例外；它们必须保留在仓库根目录以满足 VS Code manifest localization 约束

当前目录结构的约束是：

- `./i18n/package`、`./i18n/commitDisplay`、`./i18n/webviews` 负责 surface-specific tooling
- `./i18n/shared` 负责跨 surface 复用的 catalog / report / zh-CN policy 基础设施
- `src/i18n/**` 负责运行时消费
