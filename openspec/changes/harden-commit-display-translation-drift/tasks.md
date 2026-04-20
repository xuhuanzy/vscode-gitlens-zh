## 1. Authority Model

- [x] 1.1 在 `./i18n` 下建立独立 authority 目录，并用 JSON 迁出 `zhCnProofreader` 当前硬编码的 shared authority 内容
- [x] 1.2 将 passthrough / protected / glossary 内容收敛为统一 authority 词典模型，并实现从同一词典派生 exact/segment/glossary 视图的 loader
- [x] 1.3 为 commit-display 定义 tooling-owned 的权威 zh-CN 翻译映射文件格式，并从现有 runtime zh-CN catalog 迁出首版数据
- [x] 1.4 扩展 `i18n/shared` catalog primitives，支持 authority validation、sparse locale output 与 stale/pending 分类

## 2. Commit-Display Refactor

- [x] 2.1 重构 commit-display 当前英文定义，删除平行 source tree，改为直接从源码边界上的英文模板调用推导 catalog，减少 `commitDisplayLocalization.mts` 中的平铺 `createEntries`
- [x] 2.2 更新 commit-display generate 流程，只从 current English + authority map + proofreader 生成 `commitDisplay.nls.zh-cn.json`，并在英文 drift 时移除 stale runtime entry
- [x] 2.3 更新 commit-display pending report，使其立即暴露 stale authority entries、missing manual translations 与 proofreader-covered values

## 3. Verification

- [x] 3.1 为 authority loader、identity mapping、segment protection、authority validation、stale invalidation、sparse runtime fallback 与 proofreader 优先级补充单元测试
- [x] 3.2 更新 `i18n/commitDisplay/README.md` 与相关脚本/文档，明确 authority file 是唯一人工翻译入口，并完成 build/report 验证
