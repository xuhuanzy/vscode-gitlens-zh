## 1. Message Record Model

- [x] 1.1 重写 `i18n/shared/model.mts`，定义 authority/workset 共用的双语消息记录类型，并移除持久化 `sourcePattern` / `translationPattern` / `candidateTranslation` 依赖
- [x] 1.2 更新 `i18n/schemas/authority.schema.json`、`i18n/schemas/translationWorkset.schema.json` 及相关 message schema，明确新的 entry 结构与文件级元数据
- [x] 1.3 迁移 `i18n/authority/zh-cn/messages.json` 与 `i18n/worksets/package.zh-cn.json` 到新 schema，并删除 item 级时间戳与持久化 `patternFingerprint`

## 2. Workflow Refactor

- [x] 2.1 重写 `i18n/package/authority.mts` 的解析、workset 同步与晋升逻辑，使其直接消费新的双语消息记录模型
- [x] 2.2 更新 `i18n/package/workflow.mts`、`i18n/package/store.mts`、`i18n/package/extractor.mts` 与生成路径，去掉对旧 `MessagePattern` 落盘模型的适配
- [x] 2.3 调整 report 与相关 CLI 输出，确保 pending report 继续以 workset 为唯一编辑面并适配新的 entry 结构

## 3. Translation Source Cleanup

- [x] 3.1 处理 `i18n/package/seedApprovedPackageNlsZhCn.mts`，移除其作为正式默认译法来源的角色，并把需要保留的默认译法迁入受控数据文件
- [x] 3.2 更新 `i18n/README.md`、相关目录说明和必要注释，明确 authority/workset 是唯一受控翻译数据路径

## 4. Verification

- [x] 4.1 更新 `i18n/package/__tests__/packageNlsWorkflow.test.mts` 与相关测试样例，覆盖新的 authority/workset entry 结构、晋升与生成流程
- [x] 4.2 运行最小验证命令，确认 sync/report/promote/generate/test 在新模型下全部通过
