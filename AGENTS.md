# 项目协作说明

## 文件边界

- `.upstream/`、`.work/` 与 `artifacts/` 是可再生目录，不得将其中内容作为长期真源提交。
- i18n 持久数据只写入控制仓库的 `i18n/`；上游源码只从 `.upstream/` 读取。
- 禁止在根目录下引入 `.pnpm-store` 文件夹, 项目已指定使用 `.work/pnpm-store`

## 测试

- 优先通过公共命令或导出接口验证可观察行为，不测试私有 helper。
- 文件系统测试必须使用测试临时目录，不能污染真实 `.upstream/` 或 `.work/`。
- 涉及构建与打包的测试应断言控制仓库受跟踪 i18n 数据保持不变。

## 设计约束

- 控制根与上游根必须显式分离；上游源码扫描不得回落到控制仓库。
- i18n extraction 发生在锁定上游准备完成之后，overlay 发生在上游构建之前。
- 普通 `build`、`package`、`verify` 不得修改受 Git 跟踪的 i18n 文件。
- overlay 只能写入 `.upstream/`，临时内容只能写入 `.work/`。
- pnpm store 只能写入 `.work/pnpm-store`；store 被清理后，编排器必须同步重建失效的上游 `node_modules`。
