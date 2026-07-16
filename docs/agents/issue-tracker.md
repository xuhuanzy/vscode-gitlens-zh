# Issue tracker: Local Markdown

本仓库的临时 issues 与 PRD 存放在 `.scratch/`。

## Conventions

- 每项工作使用一个目录：`.scratch/<feature-slug>/`。
- PRD 路径为 `.scratch/<feature-slug>/PRD.md`。
- 实施 issue 路径为 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号。
- issue 文件顶部使用 `Status:` 记录状态，状态词汇见 `triage-labels.md`。
- 讨论记录追加到文件末尾的 `## Comments`。

## Skill operations

- 当技能要求发布到 issue tracker 时，在 `.scratch/<feature-slug>/` 下创建对应文件。
- 当技能要求读取 ticket 时，读取用户提供的路径或编号对应的 issue 文件。

## Wayfinding operations

- 工作地图为 `.scratch/<effort>/map.md`。
- 子 ticket 为 `.scratch/<effort>/issues/<NN>-<slug>.md`。
- `Type:` 记录 `research`、`prototype`、`grilling` 或 `task`。
- `Status:` 记录 `claimed` 或 `resolved`。
- `Blocked by:` 记录阻塞该 ticket 的编号列表。
- 领取 ticket 时先将状态改为 `claimed`；完成时追加 `## Answer`，将状态改为 `resolved`，并同步更新工作地图。
