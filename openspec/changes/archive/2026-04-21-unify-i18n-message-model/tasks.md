## 1. Foundations

- [x] 1.1 在 `./i18n` 下建立 authority、catalog、reports 的基础目录与文件 schema
- [x] 1.2 定义统一消息 pattern 结构，至少覆盖 `literal`、`template`、`select`、`plural`、`rich`
- [x] 1.3 定义 occurrence、anchor、pattern 之间的索引格式与稳定指纹规则

## 2. Authority Resolution

- [x] 2.1 实现 authority messages、terms、aliases 的存储与读取
- [x] 2.2 实现 `key override > anchor override > scope override > authority.messages > authority.terms` 的解析优先级
- [x] 2.3 定义独立翻译 workset 的 schema，并为其条目定义 `pending`、`translated`、`needsReview`、`approved` 等状态字段
- [x] 2.4 为等价英文消息复用、术语回退、alias 归并补充校验与测试

## 3. Manifest Catalog Extraction And Reconciliation

- [x] 3.1 为 `package.json` 建立静态提取器，输出 occurrence 与 anchor 索引
- [x] 3.2 实现 manifest catalog 对账，标记 `added`、`changed`、`moved`、`removed`、`ambiguous`
- [x] 3.3 生成第一阶段待翻译输入文件，使抽取结果在无最终译文时也可稳定落盘
- [x] 3.4 验证 catalog 结构可以容纳未来 webviews、quickpicks、formatter 域而无需返工 schema

## 4. Pending Translation Loop

- [x] 4.1 设计并实现位于 `./i18n` 下的 pending 统计脚本，基于 workset 输出机器可读的剩余翻译数量与状态分布
- [x] 4.2 让待翻译 workset 与 pending 报告能够支持 Codex 多轮翻译后重复读取、继续补全与筛选可晋升条目
- [x] 4.3 定义 workset 到 authority 的晋升规则，默认仅允许 `approved` 条目写入 authority
- [x] 4.4 定义第一阶段的翻译完成判定条件，例如无 `pending` 条目且 authority 已覆盖 manifest 所需默认译文

## 5. Manifest Output Generation

- [x] 5.1 基于 catalog、authority 与 override 生成 manifest 域本地化产物，并将 `package.json` 视为可重建输出
- [x] 5.2 生成并校验第一阶段需要的 `package.nls*` 相关产物与回填后的 `package.json`
- [x] 5.3 验证生成产物不会被旧 contributions 生成链覆盖或反写

## 6. Branch Workflow Isolation

- [x] 6.1 将本分支新增的抽取、对账、报告、生成入口限制在 `./i18n` 与 `./src/i18n`
- [x] 6.2 为 `generate:contributions`、`extract:contributions` 及相关 webpack 触发器增加 guardrail，确保它们不能被当作本分支 i18n 维护入口使用
- [x] 6.3 验证旧 contributions 生成链即便被误执行，也不会被误判为一次有效的 i18n 更新
- [x] 6.4 定义并验证上游合并后的标准流程：重新抽取、对账、修订 workset、晋升 authority、重新生成产物

## 7. Deferred Future Domains

- [x] 7.1 记录 webviews、quickpicks、formatter、相关 util 为第二阶段范围，不纳入第一阶段实现验收
- [x] 7.2 为第二阶段保留域适配器与 runtime census 的设计接口，但不在当前阶段实现其详细逻辑
