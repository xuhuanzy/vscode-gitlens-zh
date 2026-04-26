# GitLens 中文 i18n 分支

这是 GitLens 的中文本地化分支，目标是在尽量少改动上游源码的前提下，为 GitLens 提供中文界面与相关文案。本分支基于上游 [gitkraken/vscode-gitlens](https://github.com/gitkraken/vscode-gitlens) 持续同步，中文本地化维护源与工作流主要位于 `i18n/`；运行时与 VS Code 需要消费的本地化资源由编译/打包流程生成。

使用编译期生成方案，在git层面上对上游`./src`的更改为0，这允许我们能够持续合并上游更改。

## 环境要求

参考上游安装要求

## 拉取源码

首次拉取中文 i18n 分支：

```bash
git clone -b i18n https://github.com/xuhuanzy/vscode-gitlens-zh.git
cd vscode-gitlens-zh
```

如果你已经克隆过仓库，只需要切换并更新 `i18n` 分支：

```bash
git fetch origin
git switch i18n
git pull --ff-only origin i18n
```

## 安装依赖

```bash
pnpm install
```

依赖安装后，可以先运行一次快速编译确认开发构建正常：

```bash
pnpm run build:quick
```

注意：`pnpm run build:quick` 会生成并编译 runtime dynamic 与 webviews 的中文运行时产物，但不会生成 VS Code manifest 所需的 staged `package.json` / `package.nls*.json`，因此它不是完整中文安装包的打包步骤。

## 编译与打包

开发时快速编译，用于检查扩展代码、runtime dynamic 与 webviews 构建：

```bash
pnpm run build:quick
```

完整开发构建，用于更完整的本地校验：

```bash
pnpm run build
```

生成完整中文 VSIX 扩展包：

```bash
node ./i18n/cli.mts manifest package
```

这个命令会先运行生产构建，再生成 staged `package.json`、`package.nls.json`、`package.nls.zh-cn.json`，最后从 `.work/i18n/extension-root/zh-cn` 这个 staged extension root 打包 VSIX。

打包成功后，VSIX 默认位于 `.work/i18n/extension-root/zh-cn` 目录下，文件名类似 `gitlens-17.12.0.vsix`。

## 安装到 VS Code

如果你已经有打包好的 `.vsix` 文件，可以通过命令行安装：

```bash
code --install-extension ./.work/i18n/extension-root/zh-cn/gitlens-17.12.0.vsix
```

请将上面的文件名替换为实际生成或下载的 VSIX 文件名。

也可以在 VS Code 中安装：

1. 打开 Extensions 视图
2. 点击右上角 `...`
3. 选择 `Install from VSIX...`
4. 选择刚生成或下载的 `.vsix` 文件

安装后建议重新加载 VS Code 窗口，确保扩展使用最新构建。

## 自助翻译

使用`codex`喂给他`./i18n/README.md`，`codex`会指引你应该如何进行翻译，也可以自行查看`i18n`目录下的说明文件自行更新。

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm run build:quick  # 快速开发构建, 不生成完整中文 VSIX
pnpm run build        # 完整构建
node ./i18n/cli.mts manifest package  # 生成完整中文 VSIX
pnpm run test         # 运行单元测试
```
