import { nowIso, type MessagePattern, type TranslationWorksetEntry } from '../shared/model.mts';
import { createPackageI18nContext } from './context.mts';
import { loadCatalog, loadWorkset, saveWorkset } from './store.mts';

type Scope =
	| 'manifest.command'
	| 'manifest.configuration.property'
	| 'manifest.configuration.section'
	| 'manifest.extension'
	| 'manifest.submenu'
	| 'manifest.view'
	| 'manifest.viewsContainer'
	| 'mixed'
	| 'unknown';

const exactTranslations = new Map<string, string>([
	['Home', '主页'],
	['Patch', '补丁'],
	['Line History', '行历史'],
	['Welcome', '欢迎'],
	['Cloud Workspaces', '云工作区'],
	['Graph Details', '图谱详情'],
	['Pull Request', 'Pull Request'],
	['Cloud Patches', '云补丁'],
	['Graph', '图谱'],
	['Inspect', 'Inspect'],
	['Visual File History', '可视文件历史'],
	['GitLens Patch', 'GitLens 补丁'],
	['GitLens Inspect', 'GitLens Inspect'],
	['Open Changes with', '打开更改的方式'],
	['Tags (6)', '标签 (6)'],
	['Worktrees (2)', '工作树 (2)'],
	['Open on Remote (Web)', '在远程上打开 (Web)'],
	['Stashes (5)', '储藏 (5)'],
	['Remotes (4)', '远程 (4)'],
	['Sections', '分区'],
	['Show / Hide Views', '显示 / 隐藏视图'],
	['Browse', '浏览'],
	['Scroll Markers', '滚动条标记'],
	['View Options', '视图选项'],
	['File History (8)', '文件历史 (8)'],
	['Filter Files', '筛选文件'],
	['Share', '共享'],
	['Group / Detach Views', '编组 / 分离视图'],
	['Commit Graph Settings', '提交图谱设置'],
	['Sort Branches By', '分支排序方式'],
	['Contributors (7)', '贡献者 (7)'],
	['New Search or Compare', '新建搜索或比较'],
	['Commits (1)', '提交 (1)'],
	['Search & Compare (0)', '搜索与比较 (0)'],
	['Folder History', '文件夹历史'],
	['Commit', '提交'],
	['Branches (3)', '分支 (3)'],
	['Sort By', '排序方式'],
	['Launchpad (9)', 'Launchpad (9)'],
	['Copy As', '复制为'],
	['Branches View', '分支视图'],
	['Tags View', '标签视图'],
	['Launchpad View (ᴘʀᴏ)', 'Launchpad 视图 (ᴘʀᴏ)'],
	['General', '常规'],
	['Pull Request View', 'Pull Request 视图'],
	['Status Bar Blame', '状态栏 Blame'],
	['Sorting', '排序'],
	['GitKraken', 'GitKraken'],
	['Advanced', '高级'],
	['Views', '视图'],
	['Commit Signing', '提交签名'],
	['Launchpad (ᴘʀᴏ)', 'Launchpad (ᴘʀᴏ)'],
	['Cloud Workspaces View (ᴘʀᴇᴠɪᴇᴡ)', '云工作区视图 (ᴘʀᴇᴠɪᴇᴡ)'],
	['Commit Graph (ᴘʀᴏ)', '提交图谱 (ᴘʀᴏ)'],
	['Modes', '模式'],
	['Inspect View', 'Inspect 视图'],
	['Date & Times', '日期与时间'],
	['Git CodeLens', 'Git CodeLens'],
	['Remotes View', '远程视图'],
	['Line History View', '行历史视图'],
	['File History View', '文件历史视图'],
	['Hovers', '悬停'],
	['AI (ᴘʀᴇᴠɪᴇᴡ)', 'AI (ᴘʀᴇᴠɪᴇᴡ)'],
	['File Heatmap', '文件热度图'],
	['Cloud Patches (ᴘʀᴇᴠɪᴇᴡ)', '云补丁 (ᴘʀᴇᴠɪᴇᴡ)'],
	['Terminal', '终端'],
	['Repositories View', '仓库视图'],
	['Cloud Patches View (ᴘʀᴇᴠɪᴇᴡ)', '云补丁视图 (ᴘʀᴇᴠɪᴇᴡ)'],
	['Menus & Toolbars', '菜单和工具栏'],
	['Search & Compare View', '搜索与比较视图'],
	['Commits View', '提交视图'],
	['Interactive Rebase Editor', '交互式变基编辑器'],
	['Patch Details View (ᴘʀᴇᴠɪᴇᴡ)', '补丁详情视图 (ᴘʀᴇᴠɪᴇᴡ)'],
	['File Changes', '文件更改'],
	['Contributors View', '贡献者视图'],
	['Inline Blame', '行内 Blame'],
	['File Blame', '文件 Blame'],
	['Keyboard Shortcuts', '键盘快捷方式'],
	['Stashes View', '储藏视图'],
	['Visual File History (ᴘʀᴏ)', '可视文件历史 (ᴘʀᴏ)'],
	['Integrations', '集成'],
	['Worktrees View (ᴘʀᴏ)', '工作树视图 (ᴘʀᴏ)'],
	['Continue', '继续'],
	['Skip', '跳过'],
	['Refresh', '刷新'],
	['Push', '推送'],
	['Pull', '拉取'],
	['Get Started', '开始使用'],
	['Abort', '中止'],
	['Dismiss', '关闭'],
	['Maximize', '最大化'],
	['Expand', '展开'],
	['Fetch', '获取'],
	['Open URL', '打开 URL'],
	['Open Repository', '打开仓库'],
	['Open Patch...', '打开补丁...'],
	['Open Visual File History', '打开可视文件历史'],
	['Open Visual Folder History', '打开可视文件夹历史'],
	['Open Directory Comparison', '打开目录比较'],
	['Open Directory Compare (difftool)', '打开目录比较 (difftool)'],
	['Open Current Branch on Remote', '在远程上打开当前分支'],
	['Open Logs', '打开日志'],
	['Open All Changes', '打开所有更改'],
	['Open File at Revision', '打开修订中的文件'],
	['Open File at Revision...', '打开修订中的文件...'],
	['Open File at Revision from Remote', '打开远程上的修订文件'],
	['Open Worktrees in New Window', '在新窗口中打开工作树'],
	['Open in Integrated Terminal', '在集成终端中打开'],
	['Open in Commit Graph', '在提交图谱中打开'],
	['Open Commit Graph Settings', '打开提交图谱设置'],
	['Open Folder History', '打开文件夹历史'],
	['Open Folder History in Commit Graph', '在提交图谱中打开文件夹历史'],
	['Open All Changes Individually', '逐个打开所有更改'],
	['Open All Changes, Individually', '逐个打开所有更改'],
	['Open Changes (difftool)', '打开更改 (difftool)'],
	['Copy Link to Code', '复制代码链接'],
	['Copy Changes (Patch)', '复制更改（补丁）'],
	['Copy as Markdown', '以 Markdown 格式复制'],
	['Copy Remote Commit URL', '复制远程提交 URL'],
	['Copy Link to File at Revision...', '复制修订中文件的链接...'],
	['Copy Remote Branch URL', '复制远程分支 URL'],
	['Copy Remote Comparison URL', '复制远程比较 URL'],
	['Copy Remote URL', '复制远程 URL'],
	['Copy Message', '复制消息'],
	['Copy Pull Request URL', '复制 Pull Request URL'],
	['Copy URLs', '复制 URL'],
	['Copy Remote Branches URL', '复制远程分支 URL'],
	['Copy Link to Tag', '复制标签链接'],
	['Copy Remote Commit URLs', '复制远程提交 URL'],
	['Copy Link to Commit', '复制提交链接'],
	['Copy Current Branch Name', '复制当前分支名称'],
	['Create Pull Request...', '创建 Pull Request...'],
	['Create Pull Request on Remote', '在远程上创建 Pull Request'],
	['Create Cloud Workspace...', '创建云工作区...'],
	['Create Branch...', '创建分支...'],
	['Create Worktree...', '创建工作树...'],
	['Create Patch...', '创建补丁...'],
	['Create VS Code Workspace...', '创建 VS Code 工作区...'],
	['Create Tag...', '创建标签...'],
	['Create Cloud Patch...', '创建云补丁...'],
	['Delete Workspace...', '删除工作区...'],
	['Delete Branch...', '删除分支...'],
	['Delete Tags...', '删除标签...'],
	['Delete Cloud Patch...', '删除云补丁...'],
	['Delete Worktree...', '删除工作树...'],
	['Delete Worktrees...', '删除工作树...'],
	['Delete Branches...', '删除分支...'],
	['Delete Tag...', '删除标签...'],
	['Rename Branch...', '重命名分支...'],
	['Rename Stash...', '重命名储藏...'],
	['Switch AI Provider/Model...', '切换 AI 提供商/模型...'],
	['Switch GitLens AI Provider/Model...', '切换 GitLens AI 提供商/模型...'],
	['Switch Organization...', '切换组织...'],
	['Switch Mode', '切换模式'],
	['Change Base...', '更改基准...'],
	['Enable Interactive Rebase Editor', '启用交互式变基编辑器'],
	['Enable Interactive Editor', '启用交互式编辑器'],
	['Disable Interactive Editor', '禁用交互式编辑器'],
	['Disable Interactive Rebase Editor', '禁用交互式变基编辑器'],
	['Enable AI Features...', '启用 AI 功能...'],
	['Generate Changelog (Preview)...', '生成更改日志（预览）...'],
	['Generate Changelog (Preview)', '生成更改日志（预览）'],
	['Generate Commit Message', '生成提交消息'],
	['Generate Commit Message with GitLens', '使用 GitLens 生成提交消息'],
	['Quick Open File History', '快速打开文件历史'],
	['Quick Show Commit', '快速显示提交'],
	['Quick Show Line Commit', '快速显示行提交'],
	['Undo Commit', '撤销提交'],
	['Set Upstream...', '设置上游...'],
	['Show Account on Home', '显示主页中的账户'],
	['Clear Author Filter', '清除作者过滤器'],
	['Clear Comparison', '清除比较'],
	['Clear Filter', '清除过滤器'],
	['Show Statistics', '显示统计信息'],
	['Hide Statistics', '隐藏统计信息'],
	['Show Date Markers', '显示日期标记'],
	['Reactivate Pro Trial', '重新激活 Pro 试用'],
	['Revert Commit...', '回退提交...'],
	['Reset All Views', '重置所有视图'],
	['Reset Views Layout', '重置视图布局'],
	['Reset Stored Data...', '重置已存储的数据...'],
	['Connect Integrations...', '连接集成...'],
	['Manage Integrations...', '管理集成...'],
	['Share as Cloud Patch...', '作为云补丁共享...'],
	['Reinstall GitKraken MCP Server', '重新安装 GitKraken MCP 服务器'],
	['Refresh Repository Access', '刷新仓库访问权限'],
	['Search for Commits within Selection', '在所选内容中搜索提交'],
	['Search Commits', '搜索提交'],
	['Close Unchanged Files', '关闭未更改的文件'],
	['Copy Working Changes to Worktree...', '将工作区更改复制到工作树...'],
	['Add Remote...', '添加远程...'],
	['Remove Remote', '移除远程'],
	['Remove Remote...', '移除远程...'],
	['Invite to Live Share', '邀请加入 Live Share'],
	['Start Work', '开始工作'],
	['Follow Renames', '跟随重命名'],
	['Refer a friend', '推荐给朋友'],
	['Upgrade to Pro...', '升级到 Pro...'],
	['Sign Out of GitKraken', '退出 GitKraken'],
	['Sign In to GitKraken...', '登录 GitKraken...'],
	['Sign Up for GitKraken...', '注册 GitKraken...'],
	['Compare Pull Request', '比较 Pull Request'],
	['Compare References...', '比较引用...'],
	['Compare with Upstream', '与上游比较'],
	['Compare with HEAD', '与 HEAD 比较'],
	['Compare with Common Base', '与共同基点比较'],
	['Compare Working Tree to Here', '将工作区与此处比较'],
	['Compare with Working Tree', '与工作区比较'],
	['Compare Selected Commits', '比较所选提交'],
	['Compare with Selected', '与所选项比较'],
	['Explain Branch Changes (Preview)', '解释分支更改（预览）'],
	['Explain Branch Changes (Preview)...', '解释分支更改（预览）...'],
	['Explain Working Changes (Preview)', '解释工作区更改（预览）'],
	['Explain Working Changes (Preview)...', '解释工作区更改（预览）...'],
	['Explain Stash Changes (Preview)...', '解释储藏更改（预览）...'],
	['Explain Changes (Preview)', '解释更改（预览）'],
	['Explain Commit Changes (Preview)...', '解释提交更改（预览）...'],
	['Explain Unpushed Changes (Preview)', '解释未推送更改（预览）'],
	['Apply Copied Changes (Patch)', '应用已复制的更改（补丁）'],
	['Apply Changes', '应用更改'],
	['Apply Stash...', '应用储藏...'],
	['Apply a Stash...', '应用储藏...'],
	['Unstage Changes', '取消暂存更改'],
	['Unstage All Changes', '取消暂存所有更改'],
	['Stage All Changes', '暂存所有更改'],
	['Stage Changes', '暂存更改'],
	['Cherry Pick Commits...', '拣选提交...'],
	['Cherry Pick Commit...', '拣选提交...'],
	['Solo Branch', '单独显示分支'],
	['Solo Tag', '单独显示标签'],
	['Solo Branch in Commit Graph', '在提交图谱中单独显示分支'],
	['Solo Tag in Commit Graph', '在提交图谱中单独显示标签'],
	['Restore Pro Features', '恢复 Pro 功能'],
	['Edit...', '编辑...'],
	['Repositories View Options', '仓库视图选项'],
	['Remotes View Options', '远程视图选项'],
	['Branches View Options', '分支视图选项'],
	['Search & Compare View Options', '搜索与比较视图选项'],
	['Toggle Review Mode', '切换审阅模式'],
	['Use Compact Graph Column', '使用紧凑图谱列'],
	['Use Expanded Graph Column', '使用展开图谱列'],
	['Branches', '分支'],
	['File History', '文件历史'],
	['Remotes', '远程'],
	['Search & Compare', '搜索与比较'],
	['Commits', '提交'],
	['Open Changes', '打开更改'],
	['Git Command Palette', 'Git 命令面板'],
	['Repositories', '仓库'],
	['Tags', '标签'],
	['Contributors', '贡献者'],
	['GitLens', 'GitLens'],
	['Worktrees', '工作树'],
	['Stashes', '储藏'],
	['File Annotations', '文件注解'],
	['Launchpad', 'Launchpad'],
	['GitLens — Git supercharged', 'GitLens — 强化 Git 能力'],
	['Compose Commits (Preview)...', '编排提交（预览）...'],
	['Recompose Commits (Preview)...', '重新编排提交（预览）...'],
	['Recompose Commits (Preview)', '重新编排提交（预览）'],
	['Recompose Commits From Here (Preview)...', '从此处重新编排提交（预览）...'],
	['Recompose Selected Commits (Preview)', '重新编排所选提交（预览）'],
	['Recompose Selected Commits (Preview)...', '重新编排所选提交（预览）...'],
	['Convert to Cloud Workspace...', '转换为云工作区...'],
	['Compare HEAD with...', '将 HEAD 与...比较'],
	['Add Co-authors...', '添加共同作者...'],
	['Group into GitLens View', '编组到 GitLens 视图'],
	['View Current Branch Only', '仅查看当前分支'],
	['Toggle Launchpad Indicator', '切换 Launchpad 指示器'],
	['Search Commits...', '搜索提交...'],
	['Open View Settings', '打开视图设置'],
	['Inspect Commit Details', '查看提交详情'],
	['Open Pull Request on Remote', '在远程上打开 Pull Request'],
	['Switch to Commit...', '切换到提交...'],
	['Switch to Branch...', '切换到分支...'],
	['Open Settings', '打开设置'],
	['Hide Pro Features', '隐藏 Pro 功能'],
	['Manage Your Account...', '管理你的账户...'],
	['Help Center', '帮助中心'],
	["What's New (Release Notes)", '新内容（发行说明）'],
	['Specifies whether to provide the active GitLens mode in the status bar', '指定是否在状态栏中显示当前 GitLens 模式'],
	['Specifies when to trigger hovers when showing blame annotations', '指定在显示 Blame 注解时何时触发悬停'],
	['Specifies how branches are sorted in quick pick menus and views', '指定分支在快速选择菜单和视图中的排序方式'],
	['Specifies how repositories are sorted in quick pick menus and views', '指定仓库在快速选择菜单和视图中的排序方式'],
	['Specifies the length of abbreviated commit SHAs', '指定缩写提交 SHA 的长度'],
	['Specifies the Ollama URL to use for access', '指定用于访问的 Ollama URL'],
	['Always open the new worktree in a new window', '始终在新窗口中打开新工作树'],
	['Hides the label', '隐藏标签'],
	['Shows the Inspect', '显示 Inspect'],
	['A robot with different colors, faces, etc', '不同颜色、表情等的机器人'],
	['A monster with different colors, faces, etc', '不同颜色、表情等的怪物'],
	['A face with differing features and backgrounds', '具有不同特征和背景的头像'],
	['A geometric pattern', '几何图案'],
	['8-bit arcade-style pixelated faces', '8 位街机风像素头像'],
	['Always prompt to open the new worktree', '始终提示是否打开新工作树'],
	['Specifies when to trigger hovers for the current line', '指定当前行何时触发悬停'],
	['Specifies whether to provide any hovers for the current line', '指定是否为当前行提供任何悬停'],
	["Shows the file's type (theme icon) as the icon", '将文件类型（主题图标）显示为图标'],
	["Shows the file's status as the icon", '将文件状态显示为图标'],
	['Displays worktree relative path', '显示工作树相对路径'],
	['Displays worktree path', '显示工作树路径'],
	['Displays worktree name', '显示工作树名称'],
	['Contributors view', '贡献者视图'],
	['Commits view', '提交视图'],
	['Repositories view', '仓库视图'],
	['Remotes view', '远程视图'],
	['File History view', '文件历史视图'],
	['Launchpad view', 'Launchpad 视图'],
	['Search & Compare view', '搜索与比较视图'],
	['Worktrees view', '工作树视图'],
	['Branches view', '分支视图'],
	['Tags view', '标签视图'],
	['Compact layout with minimal spacing', '紧凑布局，间距最小'],
	['Comfortable layout with more space between rows', '舒适布局，行间距更大'],
	['Aligns to the right', '右对齐'],
	['Aligns to the left', '左对齐'],
	['Displays files as a tree', '以树形显示文件'],
	['Displays files as a list', '以列表显示文件'],
	['Displays branches as a list', '以列表显示分支'],
	['Displays tags as a list', '以列表显示标签'],
	['Displays worktree branches as a list', '以列表显示工作树分支'],
	['e.g. 1 day ago', '例如：1 天前'],
	['e.g. July 25th, 2018 7:18pm', '例如：2018 年 7 月 25 日下午 7:18'],
	['Deprecated. This setting is no longer used', '已弃用。此设置已不再使用'],
	['Deprecated. Use the pre-release edition of GitLens instead', '已弃用。请改用 GitLens 的预发布版本'],
	['Deprecated. Use the pre-release of GitLens instead', '已弃用。请改用 GitLens 的预发布版本'],
	["Specifies whether to enable GitLens' AI-powered features", '指定是否启用 GitLens 的 AI 驱动功能'],
	["Specifies the ID of the user's active GitKraken organization in GitLens", '指定用户在 GitLens 中的活动 GitKraken 组织 ID'],
	['Specifies whether to enable rich integrations with any supported remote services', '指定是否启用与受支持远程服务的丰富集成'],
	['Specifies whether to show stashes in the _Commits_ view', '指定是否在 _提交_ 视图中显示储藏'],
	['Specifies whether to show stashes in the _Branches_ view', '指定是否在 _分支_ 视图中显示储藏'],
	['Specifies whether to show stashes in the _Worktrees_ view', '指定是否在 _工作树_ 视图中显示储藏'],
	['Specifies whether to show avatar images in hovers', '指定是否在悬停中显示头像图像'],
	['Specifies whether to show avatar images in quick pick menus when applicable', '指定在适用时是否在快速选择菜单中显示头像图像'],
	['Specifies whether to provide blame information in the status bar', '指定是否在状态栏中提供 Blame 信息'],
	['Specifies whether file histories will follow renames', '指定文件历史是否跟随重命名'],
	['Specifies whether to enable integration with Visual Studio Live Share', '指定是否启用与 Visual Studio Live Share 的集成'],
	['Specifies whether to enable virtual repositories support', '指定是否启用虚拟仓库支持'],
	['Specifies whether to provide a _changes (diff)_ hover for the current line', '指定是否为当前行提供 _更改（diff）_ 悬停'],
	['Specifies whether to automatically link external resources in commit messages', '指定是否在提交消息中自动链接外部资源'],
	['Specifies whether to provide any hovers', '指定是否提供任何悬停'],
	['Abort Rebase', '中止变基'],
	['Add as Co-author', '添加为共同作者'],
	['Add as Co-authors', '添加为共同作者'],
	['Add Repositories from Linked Workspace...', '从已关联工作区添加仓库...'],
	['Add Repositories...', '添加仓库...'],
	['Add Repository to VS Code Workspace', '将仓库添加到 VS Code 工作区'],
	['Add to Favorites', '添加到收藏'],
	['Ascending', '升序'],
	['Associate Issue with Branch...', '将 Issue 与分支关联...'],
	['Browse Repository from Before Revision', '浏览修订前的仓库'],
	['Browse Repository from Before Revision in New Window', '在新窗口中浏览修订前的仓库'],
	['Browse Repository from Revision', '浏览修订中的仓库'],
	['Browse Repository from Revision in New Window', '在新窗口中浏览修订中的仓库'],
	['Change Linked Workspace Auto-Add Behavior...', '更改已关联工作区自动添加行为...'],
	['Change Upstream...', '更改上游...'],
	['Checkout Commit...', '检出提交...'],
	['Checkout Pull Request in Worktree (GitLens)...', '在工作树中检出 Pull Request（GitLens）...'],
	['Checkout Tag...', '检出标签...'],
	['Clear Reviewed Files', '清除已审阅文件'],
	['Close', '关闭'],
	['Close Patch', '关闭补丁'],
	['Close Repository', '关闭仓库'],
	['Close Welcome', '关闭欢迎页'],
	['Collapse', '折叠'],
	['Commit via Source Control...', '通过源代码管理提交...'],
	['Commits View Options', '提交视图选项'],
	['Compare to/from HEAD', '与/从 HEAD 比较'],
	['Compare with Branch (HEAD)', '与分支比较（HEAD）'],
	['Compare Working Tree to Common Base', '将工作区与共同基点比较'],
	['Compare Working Tree with...', '将工作区与...比较'],
	['Computing File Annotations...', '正在计算文件注解...'],
	['Configure Autolinks', '配置自动链接'],
	['Configure Inline Blame', '配置行内 Blame'],
	['Connect GitKraken MCP to More Agents...', '将 GitKraken MCP 连接到更多 Agent...'],
	['Connect Integration', '连接集成'],
	['Connect Remote Integration', '连接远程集成'],
	['Contributors View Options', '贡献者视图选项'],
	['Copy', '复制'],
	['Copy Link to Branch', '复制分支链接'],
	['Copy Link to Comparison', '复制比较链接'],
	['Copy Link to File', '复制文件链接'],
	['Copy Link to Repository', '复制仓库链接'],
	['Copy Link to Workspace', '复制工作区链接'],
	['Copy Relative Path', '复制相对路径'],
	['Copy Remote File URL From...', '复制来自...的远程文件 URL'],
	['Descending', '降序'],
	['Detach All Views', '分离所有视图'],
	['Directory Compare Working Tree to Here', '将工作区与此处进行目录比较'],
	['Disconnect Remote Integration', '断开远程集成'],
	["Don't Follow Renames", '不跟随重命名'],
	['Drop Stash...', '丢弃储藏...'],
	['Drop Stashes...', '丢弃储藏...'],
	['File History View Options', '文件历史视图选项'],
	['Filter Commits by Author...', '按作者筛选提交...'],
	['Filter Repositories...', '筛选仓库...'],
	['Git Add Remote...', 'Git 添加远程...'],
	['Git Branch...', 'Git 分支...'],
	['Git Change Branch Merge Target...', 'Git 更改分支合并目标...'],
	['Git Change Branch Upstream...', 'Git 更改分支上游...'],
	['Git Checkout...', 'Git 检出...'],
	['Git Cherry Pick...', 'Git 拣选...'],
	['Git Copy Working Changes to Worktree...', 'Git 将工作区更改复制到工作树...'],
	['Git Create Branch...', 'Git 创建分支...'],
	['Git Create Tag...', 'Git 创建标签...'],
	['Git Create Worktree...', 'Git 创建工作树...'],
	['Git Delete Branch...', 'Git 删除分支...'],
	['Git Delete Tag...', 'Git 删除标签...'],
	['Git Delete Worktree...', 'Git 删除工作树...'],
	['Git Drop Stash...', 'Git 丢弃储藏...'],
	['Git History (log)...', 'Git 历史（log）...'],
	['Git Merge...', 'Git 合并...'],
	['Git Open Worktree...', 'Git 打开工作树...'],
	['Git Pop Stash...', 'Git 弹出储藏...'],
	['Git Prune Branches...', 'Git 修剪分支...'],
	['Git Prune Remote...', 'Git 修剪远程...'],
	['Git Push Stash...', 'Git 推送储藏...'],
	['Git Rebase...', 'Git 变基...'],
	['Git Remote...', 'Git 远程...'],
	['Git Remove Remote...', 'Git 移除远程...'],
	['Git Rename Branch...', 'Git 重命名分支...'],
	['Git Rename Stash...', 'Git 重命名储藏...'],
	['Git Reset...', 'Git 重置...'],
	['Git Revert...', 'Git 回退...'],
	['Git Show...', 'Git Show...'],
	['Git Stash List...', 'Git 储藏列表...'],
	['Git Stash...', 'Git 储藏...'],
	['Git Status...', 'Git 状态...'],
	['Git Switch to...', 'Git 切换到...'],
	['Git Tag...', 'Git 标签...'],
	['Git Worktree...', 'Git 工作树...'],
	['GitHub Discussions', 'GitHub 讨论'],
	['GitHub Issues', 'GitHub Issue'],
	['Group All Views', '编组所有视图'],
	['Helpful', '有帮助'],
	['Hide', '隐藏'],
	['Hide Author Column', '隐藏作者列'],
	['Hide Branch Comparisons', '隐藏分支比较'],
	['Hide Graph Column', '隐藏图谱列'],
	['Hide Local Branch', '隐藏本地分支'],
	['Hide Merge Commits', '隐藏合并提交'],
	['Hide Section', '隐藏分区'],
	['Hide Stashes on Branches', '隐藏分支上的储藏'],
	['Highlight All Changes Since Before this Commit', '高亮此提交之前以来的所有更改'],
	['Highlight Changes from this Commit', '高亮此提交中的更改'],
	['Inspect Details', 'Inspect 详情'],
	['Inspect Line Commit Details', 'Inspect 行提交详情'],
	['Install GitKraken MCP Server', '安装 GitKraken MCP 服务器'],
	['Launchpad View Options', 'Launchpad 视图选项'],
	['Load All', '全部加载'],
	['Locate Repositories...', '定位仓库...'],
	['Locate Repository...', '定位仓库...'],
	['Merge Branch into Current Branch...', '将分支合并到当前分支...'],
	['Merge Changes (Manually)...', '合并更改（手动）...'],
	['Next Change', '下一个更改'],
	['Open', '打开'],
	['Open All Changes (difftool)', '打开所有更改（difftool）'],
	['Open All Changes with Common Base', '打开与共同基点比较的所有更改'],
	['Open All Changes with Working Tree', '打开与工作区比较的所有更改'],
	['Open All Changes with Working Tree Individually', '逐个打开与工作区比较的所有更改'],
	['Open All Changes with Working Tree, Individually', '逐个打开与工作区比较的所有更改'],
	['Open Associated Pull Request', '打开关联的 Pull Request'],
	['Open Blame Prior to Change', '打开更改前的 Blame'],
	['Open Branch on Remote', '在远程上打开分支'],
	['Open Branches on Remote', '在远程上打开分支'],
	['Open Changed & Close Unchanged Files', '打开已更改文件并关闭未更改文件'],
	['Open Changed Files', '打开已更改文件'],
	['Open Changes with Branch or Tag...', '打开与分支或标签比较的更改...'],
	['Open Changes with Common Base', '打开与共同基点比较的更改'],
	['Open Changes with Next Revision', '打开与下一个修订比较的更改'],
	['Open Changes with Previous Revision', '打开与上一个修订比较的更改'],
	['Open Changes with Revision...', '打开与指定修订比较的更改...'],
	['Open Changes with Working File', '打开与工作文件比较的更改'],
	['Open Commit on Remote', '在远程上打开提交'],
	['Open Commits on Remote', '在远程上打开提交'],
	['Open Comparison on Remote', '在远程上打开比较'],
	['Open Directory Compare (difftool) with...', '打开与...的目录比较（difftool）'],
	['Open File Annotation Settings', '打开文件注解设置'],
	['Open File at Revision from...', '从...打开修订中的文件'],
	['Open File from Remote', '从远程打开文件'],
	['Open File History in Commit Graph', '在提交图谱中打开文件历史'],
	['Open File on Remote', '在远程上打开文件'],
	['Open File on Remote From...', '从...在远程上打开文件'],
	['Open Files at Revision', '打开修订中的文件'],
	['Open Folder Changes with Branch or Tag...', '打开与分支或标签比较的文件夹更改...'],
	['Open Folder Changes with Revision...', '打开与指定修订比较的文件夹更改...'],
	['Open in Editor', '在编辑器中打开'],
	['Open in Rebase Editor', '在变基编辑器中打开'],
	['Open in Terminal', '在终端中打开'],
	['Open in Worktree', '在工作树中打开'],
	['Open Issue on Remote', '在远程上打开 Issue'],
	['Open Line Changes with Previous Revision', '打开与上一个修订比较的行更改'],
	['Open Line Changes with Working File', '打开与工作文件比较的行更改'],
	['Open on gitkraken.dev', '在 gitkraken.dev 上打开'],
	['Open on Remote', '在远程上打开'],
	['Open Previous Changes with Working File', '打开与工作文件比较的上一次更改'],
	['Open Repository in New Window', '在新窗口中打开仓库'],
	['Open Repository on Remote', '在远程上打开仓库'],
	['Open URLs', '打开 URL'],
	['Open VS Code Workspace in Current Window...', '在当前窗口中打开 VS Code 工作区...'],
	['Open VS Code Workspace in New Window...', '在新窗口中打开 VS Code 工作区...'],
	['Open Worktree in New Window', '在新窗口中打开工作树'],
	['Paste Copied Changes (Patch)', '粘贴已复制的更改（补丁）'],
	['Pin the Current History', '固定当前历史'],
	['Prefer Commit Graph in Editor', '优先在编辑器中显示提交图谱'],
	['Prefer Commit Graph in Panel', '优先在面板中显示提交图谱'],
	['Previous Change', '上一个更改'],
	['Prune', '修剪'],
	['Publish Branch', '发布分支'],
	['Publish Repository', '发布仓库'],
	['Push (force)', '强制推送'],
	['Push to Commit...', '推送到提交...'],
	['Rebase Current Branch onto Branch...', '将当前分支变基到分支...'],
	['Rebase Current Branch onto Commit...', '将当前分支变基到提交...'],
	['Rebase Current Branch onto Upstream...', '将当前分支变基到上游...'],
	['Recompose Commits From Here (Preview)', '从此处重新编排提交（预览）'],
	['Refresh Account', '刷新账户'],
	['Regenerate', '重新生成'],
	['Remove from Favorites', '从收藏中移除'],
	['Remove from Workspace...', '从工作区中移除...'],
	['Repository from Before Here', '浏览此处之前的仓库'],
	['Repository from Before Here in New Window', '在新窗口中浏览此处之前的仓库'],
	['Repository from Here', '浏览此处的仓库'],
	['Repository from Here in New Window', '在新窗口中浏览此处的仓库'],
	['Reset Columns to Compact Layout', '将列重置为紧凑布局'],
	['Reset Columns to Default Layout', '将列重置为默认布局'],
	['Reset Current Branch to Commit...', '将当前分支重置到提交...'],
	['Reset Current Branch to Previous Commit...', '将当前分支重置到上一个提交...'],
	['Reset Current Branch to Tag...', '将当前分支重置到标签...'],
	['Reset Current Branch to Tip...', '将当前分支重置到最新提交...'],
	['Restore Changes (Checkout)', '还原更改（Checkout）'],
	['Restore Previous Changes', '还原上一次更改'],
	['Reveal Commit in Side Bar', '在侧边栏中显示提交'],
	['Reveal in File Explorer', '在文件资源管理器中显示'],
	['Select for Compare', '选择用于比较'],
	['Set as Default', '设为默认'],
	['Set as Default View', '设为默认视图'],
	['Setup Commit Signing...', '设置提交签名...'],
	['Show Author Column', '显示作者列'],
	['Show Branch Comparisons', '显示分支比较'],
	['Show Commit Graph in Editor', '在编辑器中显示提交图谱'],
	['Show Graph Column', '显示图谱列'],
	['Show Last Opened Quick Pick', '显示最近打开的快速选择'],
	['Show Left-side Files Only', '仅显示左侧文件'],
	['Show Merge Commits', '显示合并提交'],
	['Show Patch Details', '显示补丁详情'],
	['Show Revision Commit', '显示修订提交'],
	['Show Right-side Files Only', '仅显示右侧文件'],
	['Show Stashes on Branches', '显示分支上的储藏'],
	['Show Visual History', '显示可视历史'],
	['Show Welcome View', '显示欢迎视图'],
	['Simulate Subscription (Debugging)', '模拟订阅（调试）'],
	['Split Commit Graph', '拆分提交图谱'],
	['Split Visual History', '拆分可视历史'],
	['Start Review', '开始审阅'],
	['Start/Continue Rebase', '开始 / 继续变基'],
	['Stash All Changes...', '储藏所有更改...'],
	['Stash Changes...', '储藏更改...'],
	['Stash Staged Changes...', '储藏已暂存更改...'],
	['Stash Unstaged Changes...', '储藏未暂存更改...'],
	['Stashes View Options', '储藏视图选项'],
	['Swap Comparison', '交换比较对象'],
	['Switch Branch...', '切换分支...'],
	['Switch to Interactive Editor', '切换到交互式编辑器'],
	['Switch to Tag...', '切换到标签...'],
	['Switch to Text Editor', '切换到文本编辑器'],
	['Tags View Options', '标签视图选项'],
	['Toggle Line Blame', '切换行 Blame'],
	['Toggle Maximized Commit Graph', '切换最大化提交图谱'],
	['Toggle Zen Mode', '切换禅模式'],
	['Unhelpful', '没有帮助'],
	['Unpin the Current History', '取消固定当前历史'],
	['Unset as Default', '取消设为默认'],
	['View All Branches', '查看所有分支'],
	['Visualize Repository History', '可视化仓库历史'],
	['Worktrees View Options', '工作树视图选项'],
	['Continue', '继续'],
	['Skip', '跳过'],
	[
		'Specifies the format of stashes in the views. See [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs',
		'指定视图中储藏的格式。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)',
	],
	[
		'Specifies the format of commits in the views. See [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs',
		'指定视图中提交的格式。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)',
	],
	[
		'Specifies the description format of stashes in the views. See [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs',
		'指定视图中储藏描述的格式。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)',
	],
	[
		'Specifies the format of the file blame annotations. See [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs. Date formatting is controlled by the `#gitlens.blame.dateFormat#` setting',
		'指定文件 Blame 注解的格式。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)。日期格式由 `#gitlens.blame.dateFormat#` 设置控制',
	],
	[
		'Specifies the format (in markdown) of hover shown over the blame information in the status bar. See [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs',
		'指定状态栏中 Blame 信息悬停提示的格式（Markdown）。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)',
	],
	[
		'Specifies the tooltip format (in markdown) of "file" commits in the views. See [_Commit Tokens_](https://github.com/eamodio/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs',
		'指定视图中“文件”提交的工具提示格式（Markdown）。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/eamodio/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)',
	],
	[
		'Specifies the format of the blame information in the status bar. See [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs. Date formatting is controlled by the `#gitlens.statusBar.dateFormat#` setting',
		'指定状态栏中 Blame 信息的格式。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)。日期格式由 `#gitlens.statusBar.dateFormat#` 设置控制',
	],
	[
		'Specifies the format of the inline blame annotation. See [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs. Date formatting is controlled by the `#gitlens.currentLine.dateFormat#` setting',
		'指定行内 Blame 注解的格式。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)。日期格式由 `#gitlens.currentLine.dateFormat#` 设置控制',
	],
	[
		'Specifies the format (in markdown) of the _commit details_ hover. See [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs',
		'指定 _提交详情_ 悬停提示的格式（Markdown）。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)',
	],
	[
		'Specifies the description format of commits in the views. See [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs',
		'指定视图中提交描述的格式。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)',
	],
	[
		'Specifies the tooltip format (in markdown) of commits in the views. See [_Commit Tokens_](https://github.com/eamodio/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs',
		'指定视图中提交的工具提示格式（Markdown）。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/eamodio/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)',
	],
	[
		'Specifies the tooltip format (in markdown) of stashes in the views. See [_Commit Tokens_](https://github.com/eamodio/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs',
		'指定视图中储藏的工具提示格式（Markdown）。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/eamodio/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)',
	],
	[
		'This setting is deprecated. Use the **GitLens: Enable Debug Logging** and **GitLens: Disable Debug Logging** commands, or the **Developer: Set Log Level...** command to control logging.',
		'此设置已弃用。请改用 **GitLens: Enable Debug Logging** 和 **GitLens: Disable Debug Logging** 命令，或使用 **Developer: Set Log Level...** 命令来控制日志记录。',
	],
	['Only shown when hovering over the line annotation', '仅在悬停于行注解上时显示'],
	['Shows a branch history quick pick menu', '显示分支历史快速选择菜单'],
	['Shows the set of related changes', '显示相关更改集合'],
	['Shows only the current branch', '仅显示当前分支'],
	['Shows the status counts of items which need your attention', '显示需要你关注的项目状态计数'],
	['Shows only favorited branches', '仅显示已收藏的分支'],
	['Shows the highest priority item which needs your attention', '显示最需要你关注的最高优先级项目'],
	['Shows a commit file details quick pick menu', '显示提交文件详情快速选择菜单'],
	['Shows commits in reverse chronological order', '按时间倒序显示提交'],
	['Shows commits in reverse chronological order of the commit timestamp, but avoids intermixing multiple lines of history', '按提交时间戳倒序显示提交，但避免将多条历史线交错在一起'],
	['Shows commits in reverse chronological order of the author timestamp', '按作者时间戳倒序显示提交'],
	['Shows the number of lines changed per day in the minimap', '在迷你地图中显示每天的更改行数'],
	['Shows the Launchpad icon', '显示 Launchpad 图标'],
	['Shows an Inspect quick pick menu', '显示 Inspect 快速选择菜单'],
	['Shows the number of commits per day in the minimap', '在迷你地图中显示每天的提交次数'],
	['Shows the _Commit Details_ view automatically when selection changes in the _Commit Graph_', '在 _提交图谱_ 中的选择发生变化时，自动显示 _提交详情_ 视图'],
	['Shows the _Commit Details_ view automatically only when opening the _Commit Graph_', '仅在打开 _提交图谱_ 时自动显示 _提交详情_ 视图'],
	['Shows all branches', '显示所有分支'],
	['Shows only the changes to the line', '仅显示该行的更改'],
	['Shows newest commit first', '优先显示最新提交'],
	['Shows commits in reverse chronological order of the commit timestamp', '按提交时间戳倒序显示提交'],
	['Shows the icon of the highest priority group', '显示最高优先级分组的图标'],
	['Shows a menu to choose which file annotations to toggle', '显示用于选择切换哪些文件注解的菜单'],
	['Shows only relevant branches', '仅显示相关分支'],
	['Shows oldest commit first', '优先显示最早提交'],
	['Shows a file history quick pick menu', '显示文件历史快速选择菜单'],
	['Displays branches and tags as a tree when names contain slashes `/`', '当名称包含斜杠 `/` 时，以树形显示分支和标签'],
	['Displays worktree branches as a tree when names contain slashes `/`', '当名称包含斜杠 `/` 时，以树形显示工作树分支'],
	['Displays branches as a tree when names contain slashes `/`', '当名称包含斜杠 `/` 时，以树形显示分支'],
	['Displays "You" for the current user', '对当前用户显示“你”'],
	['Displays branches and tags as a list', '以列表显示分支和标签'],
	['Displays the user\'s name followed by "(you)", e.g. "Jane Doe (you)"', '显示用户名称并附加“(you)”，例如“Jane Doe (you)”'],
	['Displays the user\'s name from git config', '显示来自 git config 的用户名'],
	['Displays commits for the selected file or folder', '显示所选文件或文件夹的提交'],
	['Displays contributors for the selected file or folder', '显示所选文件或文件夹的贡献者'],
	['Displays tags as a tree when names contain slashes `/`', '当名称包含斜杠 `/` 时，以树形显示标签'],
	['Join us in the #gitlens channel', '加入 #gitlens 频道'],
	['GitKraken (bundled with GitLens)', 'GitKraken（随 GitLens 捆绑提供）'],
	[
		'Supercharge Git within VS Code — Visualize code authorship at a glance via Git blame annotations and CodeLens, seamlessly navigate and explore Git repositories, gain valuable insights via rich visualizations and powerful comparison commands, and so much more',
		'在 VS Code 中强化 Git 体验 - 通过 Git blame 注解和 CodeLens 一目了然地查看代码作者信息，无缝导航并探索 Git 仓库，借助丰富的可视化和强大的比较命令获得有价值的洞察，等等',
	],
	['Save up to 50% on GitLens Pro.', 'GitLens Pro 限时最高可省 50%。'],
	['Your Pro trial has ended. Please upgrade for full access to Launchpad and other Pro features.', '你的 Pro 试用已结束。请升级以完整访问 Launchpad 和其他 Pro 功能。'],
	['Launchpad — organizes your pull requests into actionable groups to help you focus and keep your team unblocked.', 'Launchpad - 将你的 Pull Request 组织为可执行的分组，帮助你聚焦工作并让团队保持畅通。'],
	['⚠ Worktrees are not supported by your version of Git. Please upgrade to a more recent version.', '⚠ 你的 Git 版本不支持工作树。请升级到较新的版本。'],
	['An account is required and may require [GitLens Pro](https://help.gitkraken.com/gitlens/gitlens-community-vs-gitlens-pro/) in the future.', '此功能需要账户，且未来可能需要 [GitLens Pro](https://help.gitkraken.com/gitlens/gitlens-community-vs-gitlens-pro/)。'],
	['Limited-time sale on GitLens Pro.', 'GitLens Pro 限时促销。'],
	['Worktrees are not available for virtual repositories.', '虚拟仓库不支持工作树。'],
	['Stay in Flow, Manage All Your Work in One Place', '保持专注，在一处管理全部工作'],
	['Get the most out of GitLens', '充分发挥 GitLens 的价值'],
	['Learn the Why Behind Every Line with Inline Blame', '借助行内 Blame 了解每一行背后的原因'],
	['Welcome to GitLens Pro', '欢迎使用 GitLens Pro'],
	['Get Started With GitLens', '开始使用 GitLens'],
	['Discover the Benefits of GitLens Pro', '了解 GitLens Pro 的优势'],
	['Commit smarter, not harder', '更聪明地提交，而不是更费力地提交'],
	['See Your Code\'s Story: Commit Graph', '查看代码的演进脉络：提交图谱'],
	['Get the most out of GitLens ', '充分发挥 GitLens 的价值'],
	['Welcome to GitLens: Unlock Your Repo’s Full Story', '欢迎使用 GitLens：解锁仓库的完整脉络'],
	['Supercharge Git and unlock untapped knowledge within your repo to better understand, write, and review code.', '强化 Git，并发掘仓库中尚未充分利用的信息，帮助你更好地理解、编写和审查代码。'],
	[
		`[Upgrade to Pro](command:gitlens.plus.upgrade?%7B%22source%22%3A%22launchpad-view%22%7D)`,
		`[升级到 Pro](command:gitlens.plus.upgrade?%7B%22source%22%3A%22launchpad-view%22%7D)`,
	],
	[
		`GitLens groups many related views—Commits, Branches, Stashes, etc—here for easier view management.

[Continue](command:gitlens.views.scm.grouped.welcome.dismiss)

Prefer them separate? [Restore views to previous locations](command:gitlens.views.scm.grouped.welcome.restore)

Use the tabs above to navigate, or detach the views you want to keep separated. You can regroup them anytime using the 'x' in the view header.`,
		`GitLens 会在这里将许多相关视图（提交、分支、储藏等）分组，以便更轻松地管理视图。

[继续](command:gitlens.views.scm.grouped.welcome.dismiss)

更喜欢分开展示？[将视图恢复到先前的位置](command:gitlens.views.scm.grouped.welcome.restore)

使用上方标签页进行导航，或分离你想保持独立的视图。你可以随时使用视图标题中的 “x” 重新编组它们。`,
	],
	[
		`[Launchpad](command:gitlens.views.launchpad.info "Learn about Launchpad") — organizes your pull requests into actionable groups to help you focus and keep your team unblocked.`,
		`[Launchpad](command:gitlens.views.launchpad.info "了解 Launchpad") - 将你的 Pull Request 组织为可执行的分组，帮助你聚焦工作并让团队保持畅通。`,
	],
	[
		`Compare a <branch, tag, or ref> with another <branch, tag, or ref>

[Compare References...](command:gitlens.views.searchAndCompare.selectForCompare)`,
		`将一个<branch、tag 或 ref>与另一个<branch、tag 或 ref>进行比较

[比较引用...](command:gitlens.views.searchAndCompare.selectForCompare)`,
	],
	[
		`[Try GitLens Pro](command:gitlens.plus.signUp?%7B%22source%22%3A%22workspaces%22%7D)

Get 14 days of GitLens Pro for free — no credit card required. Or [sign in](command:gitlens.plus.login?%7B%22source%22%3A%22workspaces%22%7D).`,
		`[试用 GitLens Pro](command:gitlens.plus.signUp?%7B%22source%22%3A%22workspaces%22%7D)

免费体验 GitLens Pro 14 天，无需信用卡。或[登录](command:gitlens.plus.login?%7B%22source%22%3A%22workspaces%22%7D)。`,
	],
	[
		`[Try GitLens Pro](command:gitlens.plus.signUp?%7B%22source%22%3A%22cloud-patches%22%7D)

Get 14 days of GitLens Pro for free — no credit card required. Or [sign in](command:gitlens.plus.login?%7B%22source%22%3A%22cloud-patches%22%7D).`,
		`[试用 GitLens Pro](command:gitlens.plus.signUp?%7B%22source%22%3A%22cloud-patches%22%7D)

免费体验 GitLens Pro 14 天，无需信用卡。或[登录](command:gitlens.plus.login?%7B%22source%22%3A%22cloud-patches%22%7D)。`,
	],
	[
		`[Worktrees](https://help.gitkraken.com/gitlens/side-bar/#worktrees-view-pro) ᴾᴿᴼ — minimize context switching by working on multiple branches simultaneously.`,
		`[工作树](https://help.gitkraken.com/gitlens/side-bar/#worktrees-view-pro) ᴾᴿᴼ - 允许你同时处理多个分支，从而减少上下文切换。`,
	],
	[
		`[Resend Verification Email](command:gitlens.plus.resendVerification?%7B%22source%22%3A%22launchpad-view%22%7D)

You must verify your email before you can continue or [recheck Status](command:gitlens.plus.validate?%7B%22source%22%3A%22launchpad-view%22%7D).`,
		`[重新发送验证邮件](command:gitlens.plus.resendVerification?%7B%22source%22%3A%22launchpad-view%22%7D)

在继续之前你必须先验证邮箱，或者[重新检查状态](command:gitlens.plus.validate?%7B%22source%22%3A%22launchpad-view%22%7D)。`,
	],
	[
		`[Create Cloud Patch](command:gitlens.views.drafts.create)`,
		`[创建云补丁](command:gitlens.views.drafts.create)`,
	],
	[
		`[Try GitLens Pro](command:gitlens.plus.signUp?%7B%22source%22%3A%22launchpad-view%22%7D)

Get 14 days of GitLens Pro for free — no credit card required. Or [sign in](command:gitlens.plus.login?%7B%22source%22%3A%22launchpad-view%22%7D).`,
		`[试用 GitLens Pro](command:gitlens.plus.signUp?%7B%22source%22%3A%22launchpad-view%22%7D)

免费体验 GitLens Pro 14 天，无需信用卡。或[登录](command:gitlens.plus.login?%7B%22source%22%3A%22launchpad-view%22%7D)。`,
	],
	[
		`[Create Worktree...](command:gitlens.views.createWorktree)`,
		`[创建工作树...](command:gitlens.views.createWorktree)`,
	],
	[
		`Unlock this feature for privately hosted repos with [GitLens Pro](https://help.gitkraken.com/gitlens/gitlens-community-vs-gitlens-pro/).`,
		`通过 [GitLens Pro](https://help.gitkraken.com/gitlens/gitlens-community-vs-gitlens-pro/) 为私有托管仓库解锁此功能。`,
	],
	[
		`[Resend Verification Email](command:gitlens.plus.resendVerification?%7B%22source%22%3A%22worktrees%22%7D)

You must verify your email before you can continue or [recheck Status](command:gitlens.plus.validate?%7B%22source%22%3A%22worktrees%22%7D).`,
		`[重新发送验证邮件](command:gitlens.plus.resendVerification?%7B%22source%22%3A%22worktrees%22%7D)

在继续之前你必须先验证邮箱，或者[重新检查状态](command:gitlens.plus.validate?%7B%22source%22%3A%22worktrees%22%7D)。`,
	],
	[
		`GitLens groups many related views—Commits, Branches, Stashes, etc—here for easier view management.

[Continue](command:gitlens.views.scm.grouped.welcome.dismiss)

Use the tabs above to navigate, or detach the views you want to keep separated. You can regroup them anytime using the 'x' in the view header.`,
		`GitLens 会在这里将许多相关视图（提交、分支、储藏等）分组，以便更轻松地管理视图。

[继续](command:gitlens.views.scm.grouped.welcome.dismiss)

使用上方标签页进行导航，或分离你想保持独立的视图。你可以随时使用视图标题中的 “x” 重新编组它们。`,
	],
	[
		`[Connect an Integration...](command:gitlens.showLaunchpad?%7B%22source%22%3A%22launchpad-view%22%7D)

Allows Launchpad to organize your pull requests into actionable groups and keep your team unblocked.`,
		`[连接集成...](command:gitlens.showLaunchpad?%7B%22source%22%3A%22launchpad-view%22%7D)

允许 Launchpad 将你的 Pull Request 组织为可执行的分组，并让团队保持畅通。`,
	],
	[
		`Search for commits by [message](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22message%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D), [author](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22author%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D), [SHA](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22commit%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D), [file](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22file%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D), or [changes](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22change%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D)

[Search Commits...](command:gitlens.views.searchAndCompare.searchCommits)`,
		`按[消息](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22message%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D)、[作者](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22author%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D)、[SHA](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22commit%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D)、[文件](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22file%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D)或[更改](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22change%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D)搜索提交

[搜索提交...](command:gitlens.views.searchAndCompare.searchCommits)`,
	],
	[`$(loading~spin) Loading...`, `$(loading~spin) 正在加载...`],
	[
		`Search for commits by [message](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22message%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D), [author](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22author%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D), or [SHA](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22commit%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D)

[Search Commits...](command:gitlens.views.searchAndCompare.searchCommits)`,
		`按[消息](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22message%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D)、[作者](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22author%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D)或[SHA](command:gitlens.views.searchAndCompare.searchCommits?%7B%22search%22%3A%7B%22query%22%3A%22commit%3A%22%7D%2C%22prefillOnly%22%3Atrue%7D)搜索提交

[搜索提交...](command:gitlens.views.searchAndCompare.searchCommits)`,
	],
	[
		`[Upgrade to Pro](command:gitlens.plus.upgrade?%7B%22source%22%3A%22worktrees%22%7D)`,
		`[升级到 Pro](command:gitlens.plus.upgrade?%7B%22source%22%3A%22worktrees%22%7D)`,
	],
	[
		`[Create Cloud Workspace](command:gitlens.views.workspaces.create)`,
		`[创建云工作区](command:gitlens.views.workspaces.create)`,
	],
	[
		`[Continue](command:gitlens.plus.reactivateProTrial?%7B%22source%22%3A%22launchpad-view%22%7D)

Reactivate your Pro trial and experience Launchpad and all the new Pro features — free for another 14 days!`,
		`[继续](command:gitlens.plus.reactivateProTrial?%7B%22source%22%3A%22launchpad-view%22%7D)

重新激活你的 Pro 试用，再免费体验 Launchpad 和所有新 Pro 功能 14 天！`,
	],
	[
		'Your Pro trial has ended. Please upgrade for full access to Worktrees and other Pro features.',
		'你的 Pro 试用已结束。请升级以完整访问 Worktrees 和其他 Pro 功能。',
	],
	[
		'Cloud Patches ᴘʀᴇᴠɪᴇᴡ — privately and securely share code with specific teammates and other developers, accessible from anywhere. Enhance collaboration without adding noise to your repositories.',
		'云补丁 ᴘʀᴇᴠɪᴇᴡ - 以私密且安全的方式与特定队友和其他开发者共享代码，可从任何地方访问。在不为仓库增加噪音的前提下增强协作。',
	],
	[
		`[Try GitLens Pro](command:gitlens.plus.signUp?%7B%22source%22%3A%22worktrees%22%7D)

Get 14 days of GitLens Pro for free — no credit card required. Or [sign in](command:gitlens.plus.login?%7B%22source%22%3A%22worktrees%22%7D).`,
		`[试用 GitLens Pro](command:gitlens.plus.signUp?%7B%22source%22%3A%22worktrees%22%7D)

免费体验 GitLens Pro 14 天，无需信用卡。或[登录](command:gitlens.plus.login?%7B%22source%22%3A%22worktrees%22%7D)。`,
	],
	[
		`Workspaces ᴘʀᴇᴠɪᴇᴡ — group and manage multiple repositories together, accessible from anywhere, streamlining your workflow.

Create workspaces just for yourself or share (coming soon in GitLens) them with your team for faster onboarding and better collaboration.`,
		`工作区 ᴘʀᴇᴠɪᴇᴡ - 将多个仓库分组并集中管理，可从任何地方访问，从而简化你的工作流。

你既可以只为自己创建工作区，也可以与团队共享（即将于 GitLens 推出），以加快上手并提升协作效率。`,
	],
	[
		`[Continue](command:gitlens.plus.reactivateProTrial?%7B%22source%22%3A%22worktrees%22%7D)

Reactivate your Pro trial and experience Worktrees and all the new Pro features — free for another 14 days!`,
		`[继续](command:gitlens.plus.reactivateProTrial?%7B%22source%22%3A%22worktrees%22%7D)

重新激活你的 Pro 试用，再免费体验 Worktrees 和所有新 Pro 功能 14 天！`,
	],
	[
		`[Worktrees](https://help.gitkraken.com/gitlens/side-bar/#worktrees-view-pro) ᴾᴿᴼ — minimize context switching by allowing you to work on multiple branches simultaneously.`,
		`[工作树](https://help.gitkraken.com/gitlens/side-bar/#worktrees-view-pro) ᴾᴿᴼ - 允许你同时处理多个分支，从而减少上下文切换。`,
	],
	[
		`Thanks for installing GitLens and trying out GitLens Pro.

You're using **GitLens Community** edition.
Track code changes and see who made them with features like in-editor blame annotations, hovers, CodeLens, and more—completely free.

**Unlock more powerful tools — Try GitLens Pro again** free for another 14 days.

[Reactivate GitLens Pro Trial](command:gitlens.walkthrough.plus.reactivate)

With GitLens Pro, you can accelerate PR reviews, visualize code history in-depth, and enhance collaboration across your team. It's the perfect upgrade to streamline your VS Code workflow.`,
		`感谢你安装 GitLens 并试用 GitLens Pro。

你当前使用的是 **GitLens Community** 版本。
借助编辑器内 Blame 注解、悬停、CodeLens 等功能来跟踪代码更改并查看修改者，而且完全免费。

**解锁更强大的工具 - 再次免费试用 GitLens Pro 14 天**

[重新激活 GitLens Pro 试用](command:gitlens.walkthrough.plus.reactivate)

通过 GitLens Pro，你可以加速 Pull Request 审查、更深入地可视化代码历史，并增强团队协作。它是精简 VS Code 工作流的理想升级。`,
	],
	[
		`Navigate complex repositories with a searchable, color-coded commit timeline. Instantly understand branch relationships, authorship patterns, and commit sequences.

Select multiple commits to batch operations like cherry-picking or generate AI changelogs with a single command.

[Discover your Commit Graph](command:gitlens.walkthrough.showGraph)`,
		`通过可搜索、带颜色编码的提交时间线导航复杂仓库，立即理解分支关系、作者模式和提交序列。

你可以选择多个提交来批量执行如 cherry-pick 之类的操作，或通过一条命令生成 AI 更改日志。

[探索你的提交图谱](command:gitlens.walkthrough.showGraph)`,
	],
	[
		`Let **GitKraken AI** turn your changes into clear, logical commits - making reviews efficient and keeping your commit history clean.

**- Auto-Compose Commits:** instantly generate a sequence of commits with descriptive summaries in an interactive editor
**- Explain Commits and Branches:** understand changes without wasting time diving into the diffs
**- Create PR Titles & Descriptions:** save reviewers 10+ minutes per review

Stay in control - review and edit before committing.
See how effortless documenting your work can be, all without leaving VS Code.

[Compose Commits with AI](command:gitlens.walkthrough.showComposer)`,
		`让 **GitKraken AI** 将你的更改整理为清晰、连贯的提交，从而让审查更高效，并保持提交历史整洁。

**- 自动编排提交：** 在交互式编辑器中即时生成一组带描述性摘要的提交
**- 解释提交和分支：** 无需花时间钻研 diff 也能理解更改
**- 创建 PR 标题和描述：** 每次审查可为审阅者节省 10 分钟以上

始终保持掌控，在提交前先审阅并编辑。
无需离开 VS Code，就能轻松完成工作说明。

[使用 AI 编排提交](command:gitlens.walkthrough.showComposer)`,
	],
	[
		`Keep everything at your fingertips with Launchpad & Worktrees.

**- Launchpad:** view and manage all your PRs and branches from one hub

**- Worktrees:** code, test, and review on multiple branches in parallel

**- Integrations:** connect PRs and issues from GitHub, GitLab, Jira, Azure DevOps & more

Stay in flow, ship faster, and never lose track of what matters.

[Open Launchpad](command:gitlens.walkthrough.showLaunchpad)`,
		`借助 Launchpad 和 Worktrees，将一切尽在掌握。

**- Launchpad：** 在一个中心查看并管理所有 PR 和分支

**- Worktrees：** 在多个分支上并行编码、测试和审查

**- 集成：** 连接来自 GitHub、GitLab、Jira、Azure DevOps 等平台的 PR 和 Issue

保持专注，更快交付，且绝不遗漏重要事项。

[打开 Launchpad](command:gitlens.walkthrough.showLaunchpad)`,
	],
	[
		`The Community Edition lets you:

- View blame annotations and commit details inline
- Explore file revision history for any repo

Upgrade to **GitLens Pro** (Free 14-Day Trial) to access everything above plus advanced visualization, collaboration, and built-in AI tools that work right inside VS Code.

$(sparkle) Pro gives you full access to:

**- Commit Graph:** visualize every branch and commit relationship
**- Visual File History:** see how a file has evolved with a graph of what changed and when
**- Launchpad & Worktrees:** manage PRs and branches in one hub
**- GitKraken AI: ** writes commits, PRs & changelogs for you.

[Get Started with GitLens Pro](command:gitlens.walkthrough.plus.signUp)

or [sign in](command:gitlens.walkthrough.plus.login)`,
		`Community 版本可让你：

- 直接在编辑器中查看 Blame 注解和提交详情
- 探索任意仓库的文件修订历史

升级到 **GitLens Pro**（免费试用 14 天），即可在上述功能之外，获得可直接在 VS Code 中使用的高级可视化、协作能力和内置 AI 工具。

$(sparkle) Pro 将让你完整访问：

**- 提交图谱：** 可视化每个分支与提交之间的关系
**- 可视文件历史：** 通过图谱查看文件何时、如何演进
**- Launchpad 和 Worktrees：** 在一个中心管理 PR 和分支
**- GitKraken AI：** 为你编写提交、PR 和更改日志

[开始使用 GitLens Pro](command:gitlens.walkthrough.plus.signUp)

或[登录](command:gitlens.walkthrough.plus.login)`,
	],
	[
		`Thanks for starting your **GitLens Pro** trial.

Complete this walkthrough to experience enhanced PR review tools, deeper code history visualizations, and streamlined collaboration to help boost your productivity.

[Continue the Walkthrough](command:gitlens.walkthrough.openWalkthrough)

Once your trial ends, you'll return to **GitLens Community** — where you can still leverage features like in-editor blame annotations, hovers, CodeLens, and more. [Upgrade to GitLens Pro](command:gitlens.walkthrough.plus.upgrade) today to continue enjoying the full experience.

[Upgrade to GitLens Pro](command:gitlens.walkthrough.plus.upgrade)`,
		`感谢你开始试用 **GitLens Pro**。

完成此引导后，你将体验到增强的 Pull Request 审查工具、更深入的代码历史可视化以及更流畅的协作方式，从而帮助提升工作效率。

[继续引导](command:gitlens.walkthrough.openWalkthrough)

试用结束后，你将回到 **GitLens Community**，但依然可以继续使用编辑器内 Blame 注解、悬停、CodeLens 等功能。[立即升级到 GitLens Pro](command:gitlens.walkthrough.plus.upgrade)，继续享受完整体验。

[升级到 GitLens Pro](command:gitlens.walkthrough.plus.upgrade)`,
	],
	[
		`Thanks for installing GitLens and trying out GitLens Pro.

You're now on the **GitLens Community** edition.
Track code changes and see who made them with features like in-editor blame annotations, hovers, CodeLens, and more—completely free.

Learn more about the [difference between GitLens Community vs. Pro](command:gitlens.walkthrough.openCommunityVsPro).

**Unlock more powerful tools with GitLens Pro**

[Upgrade to GitLens Pro](command:gitlens.walkthrough.plus.upgrade)

With GitLens Pro, you can accelerate PR reviews, visualize code history in-depth, and enhance collaboration across your team. It's the perfect upgrade to streamline your VS Code workflow.`,
		`感谢你安装 GitLens 并试用 GitLens Pro。

你现在使用的是 **GitLens Community** 版本。
借助编辑器内 Blame 注解、悬停、CodeLens 等功能来跟踪代码更改并查看修改者，而且完全免费。

进一步了解 [GitLens Community 与 Pro 的区别](command:gitlens.walkthrough.openCommunityVsPro)。

**通过 GitLens Pro 解锁更强大的工具**

[升级到 GitLens Pro](command:gitlens.walkthrough.plus.upgrade)

通过 GitLens Pro，你可以加速 Pull Request 审查、更深入地可视化代码历史，并增强团队协作。它是精简 VS Code 工作流的理想升级。`,
	],
	[
		`As a **GitLens Pro** user, you have access to powerful tools that accelerate PR reviews, provide deeper code history visualizations, and streamline collaboration across your team.

[Continue the Walkthrough](command:gitlens.walkthrough.openWalkthrough)

To get the most out of your **GitLens Pro** experience, complete the walkthrough and visit our Help Center for in-depth guides.

**[Learn more in the Help Center](command:gitlens.walkthrough.openHelpCenter)**`,
		`作为 **GitLens Pro** 用户，你可以使用强大的工具来加速 Pull Request 审查、获得更深入的代码历史可视化，并简化团队协作。

[继续引导](command:gitlens.walkthrough.openWalkthrough)

为了充分发挥 **GitLens Pro** 的价值，请完成引导并访问帮助中心以获取更深入的使用指南。

**[在帮助中心了解更多](command:gitlens.walkthrough.openHelpCenter)**`,
	],
	[
		`See who changed a line, when and why — without leaving your editor. Hover over blame annotations to:

- View previous file revisions

- Open related PRs

- Jump to commits in the Graph

- Compare with previous versions

[Configure Inline Blame](command:gitlens.showSettingsPage!current-line)`,
		`无需离开编辑器，即可查看是谁在何时、为何修改了某一行。将鼠标悬停在 Blame 注解上即可：

- 查看之前的文件修订

- 打开关联的 PR

- 跳转到图谱中的提交

- 与先前版本进行比较

[配置行内 Blame](command:gitlens.showSettingsPage!current-line)`,
	],
	['Sorts commands by name', '按名称排序命令'],
	['Sorts repositories by discovery or workspace order', '按发现顺序或工作区顺序排序仓库'],
	['Sorts commands by last used date', '按上次使用日期排序命令'],
	['Automatically open the editor when any paused rebase is detected', '当检测到任意已暂停的变基时自动打开编辑器'],
	['Automatically reveals commits when double-clicking on a row', '双击某一行时自动显示提交'],
	['Automatically reveals commits when selection changes or when double-clicking on a row', '选择变化或双击某一行时自动显示提交'],
	['Only automatically open the editor when an interactive rebase is detected', '仅在检测到交互式变基时自动打开编辑器'],
	['Only open the new worktree in the current window when no folder is opened', '仅当未打开任何文件夹时，才在当前窗口中打开新工作树'],
	['Copies the remote file URL to the clipboard (when available)', '将远程文件 URL 复制到剪贴板（可用时）'],
	['Copies the remote commit URL to the clipboard (when available)', '将远程提交 URL 复制到剪贴板（可用时）'],
	['Adds an alternate set of shortcut keys that start with `Alt` (⌥ on macOS)', '添加一组以 `Alt` 开头的替代快捷键（macOS 上为 `⌥`）'],
	['Adds a heatmap indicator on the right edge of the file blame annotations', '在文件 Blame 注解右侧边缘添加热度图指示器'],
	['Adds a heatmap indicator on the left edge of the file blame annotations', '在文件 Blame 注解左侧边缘添加热度图指示器'],
	[
		'Adds a chorded set of shortcut keys that start with `Ctrl+Shift+G` (`⌥⌘G` on macOS)',
		'添加一组以 `Ctrl+Shift+G` 开头的组合快捷键（macOS 上为 `⌥⌘G`）',
	],
	['Toggles the window, i.e. all files at once', '切换整个窗口，即一次切换所有文件'],
	['Toggles file changes since before the commit', '切换该提交之前以来的文件更改'],
	['Toggles each file individually', '逐个切换文件'],
	['Toggles file changes from the commit', '切换该提交中的文件更改'],
	['Toggles file heatmap annotations', '切换文件热度图注解'],
	['Toggles file heatmap', '切换文件热度图'],
	['Toggles file changes annotations', '切换文件更改注解'],
	['Toggles file blame', '切换文件 Blame'],
	['Toggles file blame annotations', '切换文件 Blame 注解'],
	['Toggles Git CodeLens', '切换 Git CodeLens'],
	['Compares the current line commit with the working tree', '将当前行提交与工作区进行比较'],
	['Compares the branch with a user-selected reference', '将分支与用户所选引用进行比较'],
	['Compares the current branch with a user-selected reference', '将当前分支与用户所选引用进行比较'],
	['Compares the current committed file with the previous commit', '将当前已提交文件与上一个提交进行比较'],
	['Compares the current line commit with the previous', '将当前行提交与上一个提交进行比较'],
	['Compares the working tree with a user-selected reference', '将工作区与用户所选引用进行比较'],
	['Compares the worktree branch with a user-selected reference', '将工作树分支与用户所选引用进行比较'],
	[
		'Specifies a custom URL to use for access to an OpenAI-compatible model.',
		'指定用于访问 OpenAI 兼容模型的自定义 URL。',
	],
	[
		'Specifies a custom URL to use for access to an OpenAI model.',
		'指定用于访问 OpenAI 模型的自定义 URL。',
	],
	[
		'Specifies a custom URL to use for access to an Azure OpenAI model. Azure URLs should be in the following format: https://{your-resource-name}.openai.azure.com/openai/deployments/{deployment-id}/chat/completions?api-version={api-version}',
		'指定用于访问 Azure OpenAI 模型的自定义 URL。Azure URL 应采用以下格式：https://{your-resource-name}.openai.azure.com/openai/deployments/{deployment-id}/chat/completions?api-version={api-version}',
	],
	[
		'Specifies the AI provider and model to use for GitLens\' AI features. Should be formatted as `provider:model` (e.g. `openai:gpt-4o` or `anthropic:claude-3-5-sonnet-latest`), `gitkraken` for GitKraken AI provided models, or `vscode` for models provided by the VS Code extension API (e.g. Copilot)',
		'指定 GitLens AI 功能使用的 AI 提供商和模型。格式应为 `provider:model`（例如 `openai:gpt-4o` 或 `anthropic:claude-3-5-sonnet-latest`）；`gitkraken` 表示 GitKraken AI 提供的模型，`vscode` 表示由 VS Code 扩展 API 提供的模型（例如 Copilot）',
	],
	[
		'Specifies the format of a file in the views. See [_File Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#file-tokens) in the GitLens docs',
		'指定视图中文件的格式。请参阅 GitLens 文档中的 [_File Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#file-tokens)',
	],
	[
		'Specifies the description format of a file in the views. See [_File Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#file-tokens) in the GitLens docs',
		'指定视图中文件描述的格式。请参阅 GitLens 文档中的 [_File Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#file-tokens)',
	],
	[
		'Specifies how absolute dates will be formatted by default. See the [Moment.js docs](https://momentjs.com/docs/#/displaying/format/) for supported formats',
		'指定绝对日期的默认格式。支持的格式请参阅 [Moment.js 文档](https://momentjs.com/docs/#/displaying/format/)',
	],
	[
		'Specifies how short absolute dates will be formatted by default. See the [Moment.js docs](https://momentjs.com/docs/#/displaying/format/) for supported formats',
		'指定短格式绝对日期的默认格式。支持的格式请参阅 [Moment.js 文档](https://momentjs.com/docs/#/displaying/format/)',
	],
	[
		'Specifies how times will be formatted by default. See the [Moment.js docs](https://momentjs.com/docs/#/displaying/format/) for supported formats',
		'指定时间的默认格式。支持的格式请参阅 [Moment.js 文档](https://momentjs.com/docs/#/displaying/format/)',
	],
	[
		'Specifies how to format absolute dates in the Git CodeLens, when not specified `#gitlens.defaultDateFormat#` is used. Use `full`, `long`, `medium`, `short`, or a custom format, e.g. `MMMM Do, YYYY h:mma`, similar to [Moment.js formats](https://momentjs.com/docs/#/displaying/format/)',
		'指定 Git CodeLens 中绝对日期的格式；未指定时使用 `#gitlens.defaultDateFormat#`。可使用 `full`、`long`、`medium`、`short` 或自定义格式，例如 `MMMM Do, YYYY h:mma`，其写法类似于 [Moment.js 格式](https://momentjs.com/docs/#/displaying/format/)',
	],
	[
		'Specifies how to format absolute dates (e.g. using the `${date}` token) in the blame information in the status bar, when not specified `#gitlens.defaultDateFormat#` is used. Use `full`, `long`, `medium`, `short`, or a custom format, e.g. `MMMM Do, YYYY h:mma`, similar to [Moment.js formats](https://momentjs.com/docs/#/displaying/format/)',
		'指定状态栏 Blame 信息中绝对日期（例如使用 `${date}` token）的格式；未指定时使用 `#gitlens.defaultDateFormat#`。可使用 `full`、`long`、`medium`、`short` 或自定义格式，例如 `MMMM Do, YYYY h:mma`，其写法类似于 [Moment.js 格式](https://momentjs.com/docs/#/displaying/format/)',
	],
	[
		'Specifies how to format absolute dates (e.g. using the `${date}` token) in file blame annotations, when not specified `#gitlens.defaultDateFormat#` is used. Use `full`, `long`, `medium`, `short`, or a custom format, e.g. `MMMM Do, YYYY h:mma`, similar to [Moment.js formats](https://momentjs.com/docs/#/displaying/format/)',
		'指定文件 Blame 注解中绝对日期（例如使用 `${date}` token）的格式；未指定时使用 `#gitlens.defaultDateFormat#`。可使用 `full`、`long`、`medium`、`short` 或自定义格式，例如 `MMMM Do, YYYY h:mma`，其写法类似于 [Moment.js 格式](https://momentjs.com/docs/#/displaying/format/)',
	],
	[
		'Specifies how to format absolute dates (e.g. using the `${date}` token) for the inline blame annotation, when not specified `#gitlens.defaultDateFormat#` is used. Use `full`, `long`, `medium`, `short`, or a custom format, e.g. `MMMM Do, YYYY h:mma`, similar to [Moment.js formats](https://momentjs.com/docs/#/displaying/format/)',
		'指定行内 Blame 注解中绝对日期（例如使用 `${date}` token）的格式；未指定时使用 `#gitlens.defaultDateFormat#`。可使用 `full`、`long`、`medium`、`short` 或自定义格式，例如 `MMMM Do, YYYY h:mma`，其写法类似于 [Moment.js 格式](https://momentjs.com/docs/#/displaying/format/)',
	],
	[
		'Specifies how absolute dates will be formatted in the _Commit Graph_, when not specified `#gitlens.defaultDateFormat#` is used. Use `full`, `long`, `medium`, `short`, or a custom format, e.g. `MMMM Do, YYYY h:mma`, similar to [Moment.js formats](https://momentjs.com/docs/#/displaying/format/). Only applies when `#gitlens.graph.dateFormat#` is set to `absolute`',
		'指定 _提交图谱_ 中绝对日期的格式；未指定时使用 `#gitlens.defaultDateFormat#`。可使用 `full`、`long`、`medium`、`short` 或自定义格式，例如 `MMMM Do, YYYY h:mma`，其写法类似于 [Moment.js 格式](https://momentjs.com/docs/#/displaying/format/)。仅当 `#gitlens.graph.dateFormat#` 设置为 `absolute` 时适用',
	],
	['Specifies the font weight of the file blame annotations', '指定文件 Blame 注解的字体粗细'],
	['Specifies the font style of the file blame annotations', '指定文件 Blame 注解的字体样式'],
	['Specifies the font family of the file blame annotations', '指定文件 Blame 注解的字体族'],
	['Specifies the font size of the file blame annotations', '指定文件 Blame 注解的字体大小'],
	['Specifies the font size of the inline blame annotation', '指定行内 Blame 注解的字体大小'],
	['Specifies the font weight of the inline blame annotation', '指定行内 Blame 注解的字体粗细'],
	['Specifies the font family of the inline blame annotation', '指定行内 Blame 注解的字体族'],
	['Specifies the font style of the inline blame annotation', '指定行内 Blame 注解的字体样式'],
	[
		'Specifies whether to provide a _recent change_ CodeLens, showing the author and date of the most recent commit for the file or code block',
		'指定是否提供 _recent change_ CodeLens，用于显示文件或代码块最近一次提交的作者和日期',
	],
	[
		'Specifies whether to provide an inline blame annotation for the current line, by default. Use the `Toggle Line Blame Annotations` command (`gitlens.toggleLineBlame`) to toggle the annotations on and off for the current window',
		'指定默认是否为当前行提供行内 Blame 注解。可使用 `Toggle Line Blame Annotations` 命令（`gitlens.toggleLineBlame`）在当前窗口中切换该注解的开关',
	],
	[
		'Specifies whether to provide a heatmap indicator in the file blame annotations',
		'指定是否在文件 Blame 注解中提供热度图指示器',
	],
	[
		'Specifies whether to provide an _authors_ CodeLens, showing number of authors of the file or code block and the most prominent author (if there is more than one)',
		'指定是否提供 _authors_ CodeLens，用于显示文件或代码块的作者数量以及最主要的作者（如果多于一位）',
	],
	['Specifies whether to provide any hovers when showing blame annotations', '指定在显示 Blame 注解时是否提供任何悬停提示'],
	['Specifies whether to provide any Git CodeLens on symbols that span only a single line', '指定是否在仅跨单行的符号上提供 Git CodeLens'],
	[
		'Specifies whether to provide any Git CodeLens, by default. Use the `Toggle Git CodeLens` command (`gitlens.toggleCodeLens`) to toggle the Git CodeLens on and off for the current window',
		'指定默认是否提供任何 Git CodeLens。可使用 `Toggle Git CodeLens` 命令（`gitlens.toggleCodeLens`）在当前窗口中切换 Git CodeLens 的开关',
	],
	['Specifies whether to provide a _changes (diff)_ hover for all lines when showing blame annotations', '指定在显示 Blame 注解时是否为所有行提供 _changes (diff)_ 悬停提示'],
	['Specifies whether to enable experimental integration with the GitKraken CLI', '指定是否启用与 GitKraken CLI 的实验性集成'],
	[
		'Specifies whether to enable the preview of _Cloud Patches_, which allow you to privately and securely share code with specific teammates and other developers',
		'指定是否启用 _Cloud Patches_ 预览版；该功能允许你以私密且安全的方式与特定队友和其他开发者共享代码',
	],
	['Specifies whether to enable the ability to generate signing keys from within GitLens', '指定是否启用在 GitLens 内生成签名密钥的能力'],
	[
		'Specifies whether to enable terminal links &mdash; autolinks in the integrated terminal to quickly jump to more details for commits, branches, tags, and more',
		'指定是否启用终端链接，即在集成终端中启用自动链接，以便快速跳转到提交、分支、标签等的更多详情',
	],
	['Specifies whether to enable experimental insiders version of the GitKraken CLI', '指定是否启用 GitKraken CLI 的实验性 insiders 版本'],
	['Specifies whether to enable the experimental version of the commit composer', '指定是否启用实验版提交编排器'],
	['Specifies whether to enable status bar indicator for _Launchpad_', '指定是否为 _Launchpad_ 启用状态栏指示器'],
	['Specifies where the associated line highlights will be shown', '指定关联的行高亮显示位置'],
	['Specifies where the heatmap indicators will be shown in the file blame annotations', '指定文件 Blame 注解中的热度图指示器显示位置'],
	['Specifies where the indicators of the file heatmap annotations will be shown', '指定文件热度图注解指示器的显示位置'],
	['Specifies where to reveal commits and references', '指定在何处显示提交和引用'],
	['Specifies where the indicators of the file changes annotations will be shown', '指定文件更改注解指示器的显示位置'],
	['Specifies where Git CodeLens will be shown in the document', '指定 Git CodeLens 在文档中的显示位置'],
	['Specifies which views will be hidden, when grouped into the _GitLens_ view on the Source Control side bar', '指定在源代码管理侧边栏中编组到 _GitLens_ 视图时哪些视图将被隐藏'],
	['Specifies which views will be grouped into the _GitLens_ view on the Source Control side bar', '指定哪些视图将编组到源代码管理侧边栏中的 _GitLens_ 视图'],
	[
		'Specifies which (and when) Git commands will skip the confirmation step, using the format: `git-command-name:(menu|command)`',
		'指定哪些 Git 命令会在何时跳过确认步骤，格式为：`git-command-name:(menu|command)`',
	],
	['Specifies which messages should be suppressed', '指定应抑制哪些消息'],
	['Specifies which commands will be added to which menus', '指定哪些命令将被添加到哪些菜单'],
	['Specifies the default mode for the _File History_ view', '指定 _文件历史_ 视图的默认模式'],
	['Specifies the default view to show when the _GitLens_ view is opened', '指定打开 _GitLens_ 视图时默认显示的视图'],
	['Specifies the default path in which new worktrees will be created', '指定创建新工作树时使用的默认路径'],
	['Specifies the preferred layout of the _Commit Graph_', '指定 _提交图谱_ 的首选布局'],
	['Specifies how the current git user\'s name is displayed in blame annotations, hovers, and other UI elements', '指定当前 git 用户名在 Blame 注解、悬停提示及其他 UI 元素中的显示方式'],
	['Specifies how and when to open a worktree after it is created', '指定工作树创建后如何以及何时打开'],
	['Specifies whether to show the What\'s New notification after upgrading to new feature releases', '指定升级到新功能版本后是否显示“新内容”通知'],
	['Specifies whether to show the _Commit Graph_ in the status bar', '指定是否在状态栏中显示 _提交图谱_'],
	[
		'Specifies whether to show the commit search results directly in the quick pick menu, in the Side Bar, or will be based on the context',
		'指定是直接在快速选择菜单中、在侧边栏中显示提交搜索结果，还是根据上下文决定',
	],
	['Specifies whether to show the _Commit Details_ view when clicking on a commit link in the integrated terminal', '指定在集成终端中点击提交链接时是否显示 _提交详情_ 视图'],
	[
		'Specifies whether to lookup additional details about automatically link external resources in commit messages. Requires a connection to a supported remote service (e.g. GitHub)',
		'指定是否查询提交消息中自动链接的外部资源的附加详情。需要连接到受支持的远程服务（例如 GitHub）',
	],
	[
		'Specifies whether to show relative date markers (_Less than a week ago_, _Over a week ago_, _Over a month ago_, etc) on revision (commit) histories in the views',
		'指定是否在视图中的修订（提交）历史上显示相对日期标记（如 _一周内_、_一周以上_、_一个月以上_ 等）',
	],
	[
		'Specifies the limit on the how many commits can be queried for statistics in the _Visual File History_, because of rate limits. Only applies to virtual workspaces.',
		'指定在 _可视文件历史_ 中可查询统计信息的提交数量上限，这是因为存在速率限制。仅适用于虚拟工作区。',
	],
	['Specifies whether to dim (deemphasize) merge commit rows in the _Commit Graph_', '指定是否在 _提交图谱_ 中弱化显示合并提交行'],
	[
		'Specifies whether to delay loading commit file details until required. This can improve performance when opening repositories with large histories, but causes more incremental Git calls',
		'指定是否延迟到需要时再加载提交文件详情。这可以提升打开大型历史仓库时的性能，但会带来更多渐进式 Git 调用',
	],
	[
		'Specifies whether to open multiple changes in the multi-diff editor (single tab) or in individual diff editors (multiple tabs)',
		'指定是将多个更改在多差异编辑器中打开（单个标签页），还是在单独的差异编辑器中打开（多个标签页）',
	],
	[
		'Specifies whether to show just the changes to the line or the set of related changes in the _changes (diff)_ hover',
		'指定在 _更改（diff）_ 悬停提示中，是仅显示该行的更改，还是显示一组相关更改',
	],
	[
		'Specifies the age of the most recent change (in days) after which the file heatmap annotations will be cold rather than hot (i.e. will use `#gitlens.heatmap.coldColor#` instead of `#gitlens.heatmap.hotColor#`)',
		'指定最近一次更改的年龄阈值（天），超过该阈值后，文件热度图注解将显示为冷色而不是热色（即使用 `#gitlens.heatmap.coldColor#` 而不是 `#gitlens.heatmap.hotColor#`）',
	],
	['Specifies the active GitLens mode, if any', '指定当前激活的 GitLens 模式（如果有）'],
	['(Experimental) Specifies the preferred layout of for _Cloud Patches_', '（实验性）指定 _Cloud Patches_ 的首选布局'],
	['Specifies whether to override the default deep link scheme (vscode://) with the environment value or a specified value', '指定是否使用环境值或指定值覆盖默认的深链接方案（vscode://）'],
	['Specifies the number of rows from the edge at which the graph will scroll when using keyboard or search to change the selected row', '指定使用键盘或搜索更改选中行时，图谱距离边缘多少行开始滚动'],
	['Specifies whether to automatically refresh the _Repositories_ view when the repository or the file system changes', '指定在仓库或文件系统发生变化时是否自动刷新 _Repositories_ 视图'],
	['Specifies how many folders deep to search for repositories. Defaults to `#git.repositoryScanMaxDepth#`', '指定搜索仓库时向下搜索的文件夹层级深度。默认为 `#git.repositoryScanMaxDepth#`'],
	['Specifies whether to query for associated pull requests. Requires a connection to a supported remote service (e.g. GitHub)', '指定是否查询关联的 Pull Request。需要连接到受支持的远程服务（例如 GitHub）'],
	['Specifies whether to automatically reveal repositories in the _Repositories_ view when opening files', '指定在打开文件时是否在 _Repositories_ 视图中自动定位对应仓库'],
	['Specifies whether to only follow the first parent when showing commits on the _Commit Graph_', '指定在 _提交图谱_ 中显示提交时是否仅沿第一父提交进行追踪'],
	['Specifies whether to select the "Work in progress" (WIP) row instead of HEAD if there are uncommitted changes in the _Commit Graph_', '指定当 _提交图谱_ 中存在未提交更改时，是否选择“进行中的工作”（WIP）行而不是 HEAD'],
	['Specifies the blame alignment in the status bar', '指定状态栏中 Blame 的对齐方式'],
	['Specifies whether to show a ghost branch / tag when hovering over or selecting a row in the _Commit Graph_', '指定在 _提交图谱_ 中悬停某行或选中某行时是否显示幽灵分支 / 标签'],
	['Specifies autolinks to external resources in commit messages. Use `<num>` as the variable for the reference number', '指定提交消息中到外部资源的自动链接。使用 `<num>` 作为引用编号变量'],
	['Specifies whether to use cloud-based integrations when authenticating with GitHub', '指定在通过 GitHub 进行身份验证时是否使用基于云的集成'],
	['Specifies whether to highlight lines associated with the current line', '指定是否高亮与当前行关联的行'],
	['Specifies whether to automatically install and enable the GitKraken MCP. This only applies to VS Code 1.101 and later.', '指定是否自动安装并启用 GitKraken MCP。仅适用于 VS Code 1.101 及更高版本。'],
	['Specifies whether to show remote names on remote branches in the _Commit Graph_', '指定是否在 _提交图谱_ 中的远程分支上显示远程名称'],
	['Specifies how Git commits are displayed in the _Interactive Rebase Editor_', '指定 _交互式变基编辑器_ 中 Git 提交的显示方式'],
	['Specifies the organizations to include in the _Launchpad_. If empty, all organizations are included', '指定 _Launchpad_ 中要包含的组织。如果为空，则包含所有组织'],
	['Specifies whether to attempt to detect nested repositories when opening files', '指定在打开文件时是否尝试检测嵌套仓库'],
	['Specifies whether to allow guest access to GitLens features when using Visual Studio Live Share', '指定在使用 Visual Studio Live Share 时是否允许访客访问 GitLens 功能'],
	['Specifies whether pressing the `ESC` key dismisses the active file annotations', '指定按下 `ESC` 键时是否关闭活动的文件注解'],
	['Specifies whether to allow selecting multiple items in the views', '指定是否允许在视图中选择多个项目'],
	[
		'Specifies whether to hide or show features that require a trial or GitLens Pro and are not accessible given the opened repositories and current trial or plan',
		'指定是否隐藏或显示那些需要试用或 GitLens Pro、且基于当前打开的仓库及当前试用或订阅计划无法访问的功能',
	],
	['(Experimental) Specifies a limit on the number of pull requests to be queried in the _Launchpad_', '（实验性）指定在 _Launchpad_ 中可查询的 Pull Request 数量上限'],
	['Specifies whether the status bar indicator will fetch and display pull request data for _Launchpad_', '指定状态栏指示器是否会为 _Launchpad_ 获取并显示 Pull Request 数据'],
	['Specifies whether to dismiss the _Git Command Palette_ when focus is lost (if not, press `ESC` to dismiss)', '指定在焦点丢失时是否关闭 _Git 命令面板_（否则按 `ESC` 关闭）'],
	['Specifies whether commit dates should use the authored or committed date', '指定提交日期应使用作者日期还是提交日期'],
	['Always open the new worktree in the current window', '始终在当前窗口中打开新工作树'],
	['Always selects the HEAD row', '始终选择 HEAD 行'],
	['Disallows selecting multiple commits', '不允许选择多个提交'],
	['Shown when hovering anywhere over the line', '在悬停于该行任意位置时显示'],
	['Never shows the _Commit Details_ view automatically', '绝不自动显示 _提交详情_ 视图'],
	['Searches for commits within the range', '在该范围内搜索提交'],
	['Never open the new worktree', '绝不打开新工作树'],
	['Uses the date when the changes were authored (i.e. originally written)', '使用更改的作者日期（即最初编写的时间）'],
	['Uses the date when the changes were committed', '使用更改的提交日期'],
	['Disables click interaction', '禁用点击交互'],
	['Hides the branch comparison', '隐藏分支比较'],
	['Never automatically open the editor', '绝不自动打开编辑器'],
	['Allows selecting multiple commits without restriction', '允许选择多个提交且不作限制'],
	['No shortcut keys will be added', '不会添加任何快捷键'],
	['Stashes view', '储藏视图'],
	['Specifies the organizations to ignore in the _Launchpad_', '指定 _Launchpad_ 中要忽略的组织'],
	['Specifies the style of the gravatar default (fallback) images', '指定 gravatar 默认（后备）图像的样式'],
	['Specifies the data to show on the minimap in the _Commit Graph_', '指定 _Commit Graph_ 中迷你地图上要显示的数据'],
	['Specifies whether file histories will show merge commits', '指定文件历史是否显示合并提交'],
	['Specifies when to automatically reveal commits in the `#gitlens.rebaseEditor.revealLocation#` location', '指定何时在 `#gitlens.rebaseEditor.revealLocation#` 指定的位置自动显示提交'],
	['Specifies whether to show associated issues on branches in the _Commit Graph_. Requires a connection to a supported issue service (e.g. GitHub)', '指定是否在 _Commit Graph_ 中显示分支上的关联 Issue。需要连接到受支持的 Issue 服务（例如 GitHub）'],
	['Specifies the layout density of the _Interactive Rebase Editor_', '指定 _交互式变基编辑器_ 的布局密度'],
	['Specifies the number of additional items to fetch when paginating in the _Commit Graph_. Use 0 to specify no limit', '指定在 _Commit Graph_ 中分页时要额外获取的项目数。使用 0 表示不设限制'],
	['Specifies whether to try to collapse the opened worktrees into a single (common) repository in the views when possible', '指定在可能时是否尝试将已打开的工作树折叠为视图中的单个（公共）仓库'],
	['Specifies the maximum amount of time (in seconds) to wait for all contributors to load. Use 0 to wait indefinitely (no timeout)', '指定等待所有贡献者加载完成的最长时间（秒）。使用 0 表示无限等待（无超时）'],
	['Specifies whether to show markers on the scrollbar in the _Commit Graph_', '指定是否在 _Commit Graph_ 的滚动条上显示标记'],
	['Specifies whether the file annotations button in the editor title shows a menu or immediately toggles the specified file annotations', '指定编辑器标题中的文件注解按钮是显示菜单，还是立即切换指定的文件注解'],
	['Specifies whether to use VS Code as Git\'s `core.editor` for Gitlens terminal commands', '指定是否将 VS Code 用作 Git 的 `core.editor` 以配合 GitLens 终端命令'],
	['Specifies how dates will be displayed in the _Commit Graph_, when not specified `#gitlens.defaultDateStyle#` is used', '指定 _Commit Graph_ 中日期的显示方式，未指定时使用 `#gitlens.defaultDateStyle#`'],
	['Specifies whether to show signature verification badges on commits in the Commit Graph and other views', '指定是否在提交图谱和其他视图中的提交上显示签名验证徽章'],
	['defaults to `gitlens.defaultDateStyle`', '默认为 `gitlens.defaultDateStyle`'],
	['Specifies the configuration of a partner integration', '指定合作伙伴集成的配置'],
	['Specifies whether to show a _Contributors_ section on comparison results in the views', '指定是否在视图中的比较结果上显示 _Contributors_ 分区'],
	['Specifies whether to dismiss quick pick menus when focus is lost (if not, press `ESC` to dismiss)', '指定在焦点丢失时是否关闭快速选择菜单（否则按 `ESC` 关闭）'],
	['Specifies when to show the _Commit Details_ view for the selected row in the _Commit Graph_', '指定何时为 _提交图谱_ 中选中的行显示 _提交详情_ 视图'],
	['Specifies the whether to fade out older lines', '指定是否淡化较旧的行'],
	['Specifies the time (in milliseconds) to wait before re-blaming an unsaved document after an edit but before it is saved. Use 0 to specify an infinite wait. Only applies if the file is under the `#gitlens.advanced.sizeThresholdAfterEdit#`', '指定未保存文档在编辑后、保存前重新执行 blame 前的等待时间（毫秒）。使用 0 表示无限等待。仅当文件大小低于 `#gitlens.advanced.sizeThresholdAfterEdit#` 时适用'],
	['Specifies the VS Code provided model to use for GitLens\' AI features, formatted as `provider:model`', '指定用于 GitLens AI 功能的 VS Code 提供模型，格式为 `provider:model`'],
	['Specifies the threshold (in tokens) for when to show a warning about the prompt being too large', '指定何时显示提示词过大的警告阈值（token 数）'],
	['Specifies whether to allow opening multiple instances of the _Launchpad_ as an editor tab', '指定是否允许将 _Launchpad_ 的多个实例作为编辑器标签页打开'],
	['Specifies the GitKraken AI provided model to use for GitLens\' AI features, formatted as `provider:model`', '指定用于 GitLens AI 功能的 GitKraken AI 提供模型，格式为 `provider:model`'],
	['Specifies how dates will be displayed by default', '指定日期的默认显示方式'],
	['Specifies the style of the  _Launchpad_ status bar indicator icon', '指定 _Launchpad_ 状态栏指示器图标的样式'],
	['Specifies the timeout (in seconds) for Git commands. Use 0 to disable the timeout. Some long-running operations like merge, rebase, and revert always have the timeout disabled', '指定 Git 命令的超时时间（秒）。使用 0 表示禁用超时。某些长时间运行的操作（如 merge、rebase 和 revert）始终禁用超时'],
	['Specifies the keymap to use for GitLens shortcut keys', '指定 GitLens 快捷键使用的键位映射'],
	['Specifies whether to show a local branch\'s upstream status in the _Commit Graph_', '指定是否在 _Commit Graph_ 中显示本地分支的上游状态'],
	['Specifies whether to highlight rows associated with the branch / tag when hovering over it in the _Commit Graph_', '指定在 _Commit Graph_ 中悬停分支 / 标签时是否高亮与其关联的行'],
	['Specifies the visibility of branches on the _Commit Graph_', '指定 _Commit Graph_ 上分支的可见性'],
	['Specifies the amount (percent) of similarity a deleted and added file pair must have to be considered a rename', '指定将已删除文件和已添加文件对视为重命名所需的相似度（百分比）'],
	['Specifies whether to show a sidebar on the _Commit Graph_', '指定是否在 _Commit Graph_ 上显示侧边栏'],
	['Allows selecting multiple commits topologically', '允许按拓扑关系选择多个提交'],
	['Specifies the size of the avatar images in hovers', '指定悬停提示中头像图像的大小'],
	['Specifies whether to show a sticky timeline header that remains visible at the top while scrolling in the _Commit Graph_', '指定是否在 _Commit Graph_ 中显示固定的时间线标题，使其在滚动时始终保持在顶部可见'],
	['Specifies the number of results to gather when searching in the _Commit Graph_. Use 0 to specify no limit', '指定在 _Commit Graph_ 中搜索时要收集的结果数。使用 0 表示不设限制'],
	['Specifies whether file blame annotations will be separated by a small gap', '指定文件 Blame 注解之间是否用小间隔分隔'],
	['Specifies a set of document symbols where Git CodeLens will or will not be shown in the document. Prefix with `!` to avoid providing a Git CodeLens for the symbol. Must be a member of `SymbolKind`', '指定文档中显示或不显示 Git CodeLens 的一组文档符号。使用 `!` 前缀可避免为该符号提供 Git CodeLens。必须是 `SymbolKind` 的成员'],
	['Specifies the active GitLens mode alignment in the status bar', '指定状态栏中活动 GitLens 模式的对齐方式'],
	['Specifies additional arguments to pass to the `git blame` command', '指定传递给 `git blame` 命令的附加参数'],
	['Reveals the commit in the Side Bar', '在侧边栏中显示该提交'],
	['Specifies an optional external diff tool to use when comparing directories. Must be a configured [Git difftool](https://git-scm.com/docs/git-config#Documentation/git-config.txt-difftool).', '指定比较目录时要使用的可选外部 diff 工具。必须是已配置的 [Git difftool](https://git-scm.com/docs/git-config#Documentation/git-config.txt-difftool)。'],
	['Specifies the locale, a [BCP 47 language tag](https://en.wikipedia.org/wiki/IETF_language_tag#List_of_major_primary_language_subtags), to use for date formatting, defaults to the VS Code locale. Use `system` to follow the current system locale, or choose a specific locale, e.g `en-US` — US English, `en-GB` — British English, `de-DE` — German, `ja-JP` = Japanese, etc.', '指定用于日期格式化的区域设置，即一个 [BCP 47 语言标签](https://en.wikipedia.org/wiki/IETF_language_tag#List_of_major_primary_language_subtags)，默认使用 VS Code 区域设置。使用 `system` 以跟随当前系统区域设置，或选择特定区域设置，例如 `en-US` — 美式英语、`en-GB` — 英式英语、`de-DE` — 德语、`ja-JP` — 日语等。'],
	['Specifies whether to automatically open the _Interactive Rebase Editor_ when a paused rebase is detected', '指定在检测到暂停的 rebase 时是否自动打开 _交互式变基编辑器_'],
	['Specifies how Git commands are sorted in the _Git Command Palette_', '指定 _Git 命令面板_ 中 Git 命令的排序方式'],
	['Specifies whether file histories will show commits from all branches', '指定文件历史是否显示来自所有分支的提交'],
	['Specifies the maximum document size (in lines) allowed to be re-blamed after an edit while still unsaved. Use 0 to specify no maximum', '指定文档在编辑后且仍未保存时允许重新执行 blame 的最大大小（行数）。使用 0 表示不设上限'],
	['Specifies whether to match commit search patterns using regular expressions', '指定是否使用正则表达式匹配提交搜索模式'],
	['Specifies debug mode', '指定调试模式'],
	['Specifies the repositories to ignore in the _Launchpad_', '指定 _Launchpad_ 中要忽略的仓库'],
	['Specifies whether to avoid clearing the previous blame information when changing lines to reduce status bar "flashing"', '指定在切换行时是否避免清除先前的 Blame 信息，以减少状态栏“闪烁”'],
	['Specifies whether to resolve symbolic links when determining file paths for Git operations', '指定在确定 Git 操作的文件路径时是否解析符号链接'],
	['Specifies the temperature, a measure of output randomness, to use for the AI model. Higher values result in more randomness, e.g. creativity, while lower values are more deterministic', '指定 AI 模型使用的 temperature，用于衡量输出随机性。值越高随机性越强，例如更具创造性；值越低则越具确定性'],
	['Specifies the rate (in minutes) at which the status bar indicator will fetch pull request data for _Launchpad_. Use 0 to disable automatic polling', '指定状态栏指示器为 _Launchpad_ 获取 Pull Request 数据的频率（分钟）。使用 0 可禁用自动轮询'],
	['Specifies whether to cache (per-workspace) the path to the Git executable to use for GitLens', '指定是否按工作区缓存 GitLens 要使用的 Git 可执行文件路径'],
	['Specifies whether to prompt for a path when creating new worktrees', '指定创建新工作树时是否提示输入路径'],
	['Specifies an optional external diff tool to use when comparing files. Must be a configured [Git difftool](https://git-scm.com/docs/git-config#Documentation/git-config.txt-difftool).', '指定比较文件时要使用的可选外部 diff 工具。必须是已配置的 [Git difftool](https://git-scm.com/docs/git-config#Documentation/git-config.txt-difftool)。'],
	['Specifies whether to copy full or abbreviated commit SHAs to the clipboard. Abbreviates to the length of `#gitlens.advanced.abbreviatedShaLength#`.', '指定复制到剪贴板的是完整还是缩写的提交 SHA。缩写长度由 `#gitlens.advanced.abbreviatedShaLength#` 决定。'],
	['Specifies the number of items to show in a each page when paginating a view list. Use 0 to specify no limit', '指定视图列表分页时每页显示的项目数。使用 0 表示不设限制'],
	['Specifies whether to match commit search patterns with or without regard to casing', '指定匹配提交搜索模式时是否区分大小写'],
	['Specifies the number of days after which a pull request is considered stale and moved to Other in the _Launchpad_', '指定 Pull Request 在 _Launchpad_ 中被视为陈旧并移动到 Other 所需的天数'],
	['Specifies whether file annotations will be preserved while editing. Use `#gitlens.advanced.blame.delayAfterEdit#` to control how long to wait before the annotation will update while the file is still dirty', '指定编辑时是否保留文件注解。使用 `#gitlens.advanced.blame.delayAfterEdit#` 控制文件仍处于脏状态时注解更新前的等待时长'],
	['A simple, cartoon-style silhouetted outline of a person (does not vary by email hash)', '一个简单的卡通风格人物剪影轮廓（不会随邮箱哈希变化）'],
	['Selects the working changes (WIP) row when there are uncommitted changes, otherwise selects the HEAD row', '存在未提交更改时选择工作区更改（WIP）行，否则选择 HEAD 行'],
	['Specifies the display of the  _Launchpad_ status bar indicator label', '指定 _Launchpad_ 状态栏指示器标签的显示方式'],
	['Specifies whether to match all or any commit message search patterns', '指定提交消息搜索模式需要全部匹配还是任意匹配'],
	['Specifies whether to use colors on the _Launchpad_ status bar indicator', '指定是否在 _Launchpad_ 状态栏指示器上使用颜色'],
	[
		`Specifies whether to allow GitLens to send product usage telemetry.

_**Note:** For GitLens to send any telemetry BOTH this setting and VS Code telemetry must be enabled. If either one is disabled no telemetry will be sent._`,
		`指定是否允许 GitLens 发送产品使用遥测数据。

_**注意：** GitLens 要发送任何遥测数据，必须同时启用此设置和 VS Code 遥测。如果任一项被禁用，则不会发送任何遥测数据。_`,
	],
	['Specifies whether to show a minimap of commit activity above the _Commit Graph_', '指定是否在 _Commit Graph_ 上方显示提交活动迷你地图'],
	['Specifies whether to show associated pull requests on remote branches in the _Commit Graph_. Requires a connection to a supported remote service (e.g. GitHub)', '指定是否在 _Commit Graph_ 中的远程分支上显示关联的 Pull Request。需要连接到受支持的远程服务（例如 GitHub）'],
	['Specifies whether to show commits from all branches in the _Contributors_ view', '指定是否在 _Contributors_ 视图中显示来自所有分支的提交'],
	['Specifies the groups of pull requests to show on the _Launchpad_ status bar indicator', '指定要在 _Launchpad_ 状态栏指示器中显示的 Pull Request 分组'],
	['Specifies whether to skip onboarding experiences, such as welcome views and walkthroughs. Useful for ephemeral environments like containers or sandboxes', '指定是否跳过引导体验，例如欢迎视图和演练。适用于容器或沙箱等临时环境'],
	[
		`Specifies the uncommitted changes format of the inline blame annotation. See [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens) in the GitLens docs. Date formatting is controlled by the \`#gitlens.currentLine.dateFormat#\` setting.

**NOTE**: Setting this to an empty string will disable inline blame annotations for uncommitted changes.`,
		`指定行内 Blame 注解中未提交更改的格式。请参阅 GitLens 文档中的 [_Commit Tokens_](https://github.com/gitkraken/vscode-gitlens/wiki/Custom-Formatting#commit-tokens)。日期格式由 \`#gitlens.currentLine.dateFormat#\` 设置控制。

**注意：** 将其设置为空字符串会禁用未提交更改的行内 Blame 注解。`,
	],
	['Specifies whether to show remote branches for the default remote in the _Branches_ view', '指定是否在 _Branches_ 视图中显示默认远程的远程分支'],
	['Specifies whether to allow selecting multiple commits and whether to restrict the selection topologically in the _Commit Graph_', '指定是否允许选择多个提交，以及是否在 _Commit Graph_ 中按拓扑关系限制选择'],
	['Specifies whether to always show the current branch at the top of the views', '指定是否始终在视图顶部显示当前分支'],
	['Specifies whether to ignore whitespace when comparing revisions during blame operations', '指定在 blame 操作中比较修订时是否忽略空白字符'],
	['Specifies glob patterns for files to exclude from AI prompts when generating commit messages, explaining changes, etc. Similar to `files.exclude`, use glob patterns as keys with `true` to exclude or `false` to include.', '指定在生成提交消息、解释更改等时，要从 AI 提示中排除的文件 glob 模式。类似于 `files.exclude`，使用 glob 模式作为键，并用 `true` 表示排除、`false` 表示包含。'],
	['Specifies the maximum number of background Git processes that can run concurrently. Reduce this value if you experience system slowdowns with large repositories', '指定可并发运行的后台 Git 进程最大数量。如果在大型仓库中遇到系统变慢，请降低此值'],
	['Specifies custom remote services to be matched with Git remotes to detect custom domains for built-in remote services or provide support for custom remote services', '指定与 Git 远程匹配的自定义远程服务，用于为内置远程服务检测自定义域名，或为自定义远程服务提供支持'],
	['Specifies whether the inline blame annotation can be scrolled into view when it is outside the viewport. **NOTE**: Setting this to `false` will inhibit the hovers from showing over the annotation; Set `#gitlens.hovers.currentLine.over#` to `line` to enable the hovers to show anywhere over the line.', '指定当行内 Blame 注解位于视口外时是否可滚动到视图中。**注意：** 将其设为 `false` 会阻止悬停提示在注解上显示；将 `#gitlens.hovers.currentLine.over#` 设为 `line` 可启用悬停提示在整行任意位置显示。'],
	['Specifies the user-defined GitLens modes', '指定用户自定义的 GitLens 模式'],
]);

const objectReplacements = new Map<string, string>([
	['Search & Compare View', '搜索与比较视图'],
	['Cloud Workspaces View', '云工作区视图'],
	['Cloud Patches View', '云补丁视图'],
	['Current Branch Pull Request', '当前分支 Pull Request'],
	['Pull Request Markers', 'Pull Request 标记'],
	['Commit Graph Settings', '提交图谱设置'],
	['Branch / Tag Column', '分支 / 标签列'],
	['Commit Message Column', '提交消息列'],
	['Changes Column', '更改列'],
	['Date Markers', '日期标记'],
	['Local Branch Markers', '本地分支标记'],
	['Remote Branch Markers', '远程分支标记'],
	['Tag Markers', '标签标记'],
	['Branch Pull Requests', '分支 Pull Request'],
	['Current Branch Status', '当前分支状态'],
	['Current Branch', '当前分支'],
	['Working Tree', '工作区'],
	['Common Base', '共同基点'],
	['Cloud Workspaces', '云工作区'],
	['Cloud Workspace', '云工作区'],
	['Cloud Patches', '云补丁'],
	['Cloud Patch', '云补丁'],
	['Visual File History', '可视文件历史'],
	['Visual Folder History', '可视文件夹历史'],
	['File History', '文件历史'],
	['Line History', '行历史'],
	['Folder History', '文件夹历史'],
	['Directory Comparison', '目录比较'],
	['Directory Compare', '目录比较'],
	['Search & Compare', '搜索与比较'],
	['Commit Details', '提交详情'],
	['Patch Details', '补丁详情'],
	['Commit Graph', '提交图谱'],
	['Branch History', '分支历史'],
	['Repository Status', '仓库状态'],
	['Author Filter', '作者过滤器'],
	['Branch Comparison', '分支比较'],
	['Repositories View', '仓库视图'],
	['Contributors View', '贡献者视图'],
	['Branches View', '分支视图'],
	['Tags View', '标签视图'],
	['Remotes View', '远程视图'],
	['Commits View', '提交视图'],
	['Stashes View', '储藏视图'],
	['Worktrees View', '工作树视图'],
	['Launchpad View', 'Launchpad 视图'],
	['File History View', '文件历史视图'],
	['Pull Request View', 'Pull Request 视图'],
	['Interactive Rebase Editor', '交互式变基编辑器'],
	['Interactive Editor', '交互式编辑器'],
	['Debug (Trace) Logging', '调试（跟踪）日志'],
	['Automatic Refresh', '自动刷新'],
	['GitLens AI Provider/Model', 'GitLens AI 提供商/模型'],
	['AI Provider/Model', 'AI 提供商/模型'],
	['Remote Comparison URL', '远程比较 URL'],
	['Remote Commit URLs', '远程提交 URL'],
	['Remote Commit URL', '远程提交 URL'],
	['Remote Branches URL', '远程分支 URL'],
	['Remote Branch URL', '远程分支 URL'],
	['Remote Repository URL', '远程仓库 URL'],
	['Remote File URL', '远程文件 URL'],
	['Remote URL', '远程 URL'],
	['Pull Request URL', 'Pull Request URL'],
	['Current Branch Name', '当前分支名称'],
	['Link to Code', '代码链接'],
	['Link to File at Revision', '修订中文件的链接'],
	['Link to Commit', '提交链接'],
	['Link to Tag', '标签链接'],
	['VS Code Workspace', 'VS Code 工作区'],
	['Integrated Terminal', '集成终端'],
	['New Window', '新窗口'],
	['GitKraken MCP Server', 'GitKraken MCP 服务器'],
	['Repository Access', '仓库访问权限'],
	['Pull Request', 'Pull Request'],
	['Launchpad', 'Launchpad'],
	['GitLens', 'GitLens'],
	['GitKraken', 'GitKraken'],
	['CodeLens', 'CodeLens'],
	['Live Share', 'Live Share'],
	['Markdown', 'Markdown'],
	['MCP', 'MCP'],
	['SHA', 'SHA'],
	['HEAD', 'HEAD'],
	['Home', '主页'],
	['Commits', '提交'],
	['Commit', '提交'],
	['Branches', '分支'],
	['Branch', '分支'],
	['Tags', '标签'],
	['Tag', '标签'],
	['Repositories', '仓库'],
	['Repository', '仓库'],
	['Remotes', '远程'],
	['Remote', '远程'],
	['Worktrees', '工作树'],
	['Worktree', '工作树'],
	['Stashes', '储藏'],
	['Stash', '储藏'],
	['Contributors', '贡献者'],
	['Statistics', '统计信息'],
	['Avatars', '头像'],
	['Views', '视图'],
	['View', '视图'],
	['History', '历史'],
	['Changes', '更改'],
	['Markers', '标记'],
	['Column', '列'],
	['Status', '状态'],
	['Name', '名称'],
	['Date', '日期'],
	['Score', '分数'],
	['Count', '计数'],
	['Files', '文件'],
	['File', '文件'],
	['Folder', '文件夹'],
	['Comparison', '比较'],
	['Filter', '过滤器'],
	['Results', '结果'],
	['Message', '消息'],
	['Workspace', '工作区'],
	['Tree', '树形'],
	['List', '列表'],
	['Auto', '自动'],
	['Organization', '组织'],
	['Integrations', '集成'],
	['Mode', '模式'],
]);

const allowedEnglishTokens = [
	'GitLens',
	'GitKraken',
	'Launchpad',
	'Inspect',
	'Pull Request',
	'VS Code',
	'Markdown',
	'CodeLens',
	'Live Share',
	'MCP',
	'URL',
	'URLs',
	'SHA',
	'HEAD',
	'AI',
	'Pro',
	'difftool',
	'Web',
];

const propertyDisplaySubjectTranslations = new Map<string, string>([
	['file icons', '文件图标'],
	['files', '文件'],
	['branches and tags', '分支和标签'],
	['branches', '分支'],
	['tags', '标签'],
	['worktrees', '工作树'],
	['worktree branches', '工作树分支'],
]);

const propertySortSubjectTranslations = new Map<string, string>([
	['branches', '分支'],
	['repositories', '仓库'],
	['tags', '标签'],
	['contributors', '贡献者'],
	['worktrees', '工作树'],
]);

const propertySortMetricTranslations = new Map<string, string>([
	['name', '名称'],
	['date', '日期'],
	['last fetched date', '上次获取日期'],
	['the most recent commit date', '最近提交日期'],
	['commit count', '提交次数'],
]);

const propertySortOrderTranslations = new Map<string, string>([
	['ascending', '升序'],
	['descending', '降序'],
]);

const propertyCompactionSubjectTranslations = new Map<string, string>([
	['branch', '分支'],
	['branch and tag', '分支和标签'],
	['file', '文件'],
	['tag', '标签'],
]);

const iconReplacementTranslations = new Map<string, string>([
	['commit (or status) icons', '提交（或状态）图标'],
	['status icons', '状态图标'],
	['author initials and remote icons', '作者缩写和远程图标'],
]);

const pullRequestDisplaySubjectTranslations = new Map<string, string>([
	['commits', '提交'],
	['the current branch', '当前分支'],
	['the worktree branch', '工作树分支'],
	['branches', '分支'],
	['each branch', '每个分支'],
]);

const pullRequestQuerySubjectTranslations = new Map<string, string>([
	['the worktree branch and commits', '工作树分支和提交'],
	['the current branch and commits', '当前分支和提交'],
	['commits', '提交'],
	['branches and commits', '分支和提交'],
	['each branch and commits', '每个分支和提交'],
]);

const comparisonSubjectTranslations = new Map<string, string>([
	['branch', '分支'],
	['worktree branch', '工作树分支'],
]);

const aiGenerationTargetTranslations = new Map<string, string>([
	['a pull request title and description', 'Pull Request 标题和描述'],
	['a commit message', '提交消息'],
	['a cloud patch title and description', '云补丁标题和描述'],
	['a summary of changes', '更改摘要'],
	['a stash message', '储藏消息'],
	['commits', '提交'],
	['a code suggest title and description', '代码建议标题和描述'],
	['a changelog from a set of changes', '一组更改的更改日志'],
]);

const repositoryChildItemTranslations = new Map<string, string>([
	['commits on the current branch', '当前分支上的提交'],
	['worktrees', '工作树'],
	['branches', '分支'],
	['contributors', '贡献者'],
	['remotes', '远程'],
	['stashes', '储藏'],
	['tags', '标签'],
	['experimental incoming activity', '实验性的传入活动'],
	['upstream status of the current branch', '当前分支的上游状态'],
]);

const pullRequestInfoLocationTranslations = new Map<string, string>([
	['inline blame annotation', '行内 Blame 注解'],
	['status bar', '状态栏'],
	['hovers', '悬停提示'],
]);

const unsavedCodeLensTargetTranslations = new Map<string, string>([
	['both the _recent change_ and _authors_ CodeLens', '_recent change_ 和 _authors_ CodeLens'],
	['the _authors_ CodeLens', '_authors_ CodeLens'],
	['the _recent change_ CodeLens', '_recent change_ CodeLens'],
]);

const maxItemsTargetTranslations = new Map<string, string>([
	['search', '搜索结果'],
	['list', '列表'],
]);

const revealViewItemTranslations = new Map<string, string>([
	['branches', '分支'],
	['commits', '提交'],
	['contributors', '贡献者'],
	['remotes', '远程'],
	['stashes', '储藏'],
	['tags', '标签'],
	['worktrees', '工作树'],
]);

const clickTargetTranslations = new Map<string, string>([
	['an _authors_ CodeLens', '_authors_ CodeLens'],
	['a _recent change_ CodeLens', '_recent change_ CodeLens'],
	['the blame status bar item', 'Blame 状态栏项'],
]);

const graphSurfaceTranslations = new Map<string, string>([
	['scrollbar', '滚动条'],
	['minimap', '迷你地图'],
]);

const contributorStatisticsTargetTranslations = new Map<string, string>([
	['_Contributors_ sections in the views', '视图中的 _Contributors_ 分区'],
	['the _Contributors_ view', '_Contributors_ 视图'],
]);

const remoteResourceTranslations = new Map<string, string>([
	['commit', '提交'],
	['file revision', '文件修订'],
]);

const commitRevealLocationTranslations = new Map<string, string>([
	['_Commit Graph_', '提交图谱'],
	['_Inspect_ view', 'Inspect 视图'],
]);

const preferredLocationTranslations = new Map<string, string>([
	['a view', '视图'],
	['the bottom panel', '底部面板'],
	['the editor area', '编辑器区域'],
]);

const preferredSurfaceTranslations = new Map<string, string>([
	['Cloud Patches', '云补丁'],
	['the Commit Graph', '提交图谱'],
]);

const annotationToggleTargetTranslations = new Map<string, string>([
	['the file blame annotations', '文件 Blame 注解'],
	['the file changes annotations', '文件更改注解'],
	['the file heatmap annotations', '文件热度图注解'],
]);

const sortedReplacements = [...objectReplacements.entries()].sort((left, right) => right[0].length - left[0].length);

const context = createPackageI18nContext(readOption('--root'));
const catalog = loadCatalog(context);
const scopeByKey = new Map(catalog.occurrences.map(occurrence => [occurrence.key, occurrence.scope]));
const workset = loadWorkset(context);

let updated = 0;
const entries = workset.entries.map(entry => {
	const next = translateEntry(entry, getScope(entry));
	if (next === entry) return entry;

	updated += 1;
	return next;
});

saveWorkset(context, {
	...workset,
	generatedAt: nowIso(),
	entries: entries,
});

console.log(`Seeded ${updated} approved zh-cn package entries`);

function translateEntry(entry: TranslationWorksetEntry, scope: Scope): TranslationWorksetEntry {
	if (entry.sourcePattern.kind !== 'literal' && entry.sourcePattern.kind !== 'rich') return entry;

	const translation = translateText(entry.sourcePattern.text, scope);
	if (translation == null) {
		if (
			entry.status === 'approved' &&
			(entry.candidateTranslation?.kind === 'literal' || entry.candidateTranslation?.kind === 'rich') &&
			hasUnexpectedEnglish(entry.candidateTranslation.text)
		) {
			return {
				...entry,
				candidateTranslation: undefined,
				status: 'pending',
			};
		}

		return entry;
	}

	if (entry.candidateTranslation?.kind === 'literal' && entry.candidateTranslation.text === translation && entry.status === 'approved') {
		return entry;
	}

	return {
		...entry,
		candidateTranslation: createTranslatedPattern(entry.sourcePattern, translation),
		status: 'approved',
	};
}

function createTranslatedPattern(
	sourcePattern: Extract<MessagePattern, { kind: 'literal' | 'rich' }>,
	text: string,
): MessagePattern {
	if (sourcePattern.kind === 'rich') {
		return {
			kind: 'rich',
			text: text,
			format: sourcePattern.format,
			slots: [...sourcePattern.slots],
		};
	}

	return {
		kind: 'literal',
		text: text,
	};
}

function translateText(text: string, scope: Scope): string | undefined {
	const exact = exactTranslations.get(text);
	if (exact != null) return exact;

	if (scope === 'manifest.command') {
		return translateCommand(text);
	}

	if (scope === 'manifest.configuration.property') {
		return translateProperty(text);
	}

	return undefined;
}

function translateCommand(text: string): string | undefined {
	return translateWithPattern(text, [
		[/^Show (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('显示', translated))],
		[/^Hide (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('隐藏', translated))],
		[/^Group (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('编组', translated))],
		[/^Detach (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('分离', translated))],
		[/^View as (.+)$/u, object => `以${object}显示`],
		[/^View Files as (.+)$/u, object => `以${object}显示文件`],
		[/^View Branches as (.+)$/u, object => `以${object}显示分支`],
		[/^View (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('查看', translated))],
		[/^Sort by (.+)$/u, object => `按${object}排序`],
		[/^Sort Branches by (.+)$/u, object => `按${object}排序分支`],
		[/^Clear (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('清除', translated))],
		[/^Toggle (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('切换', translated))],
		[/^Enable (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('启用', translated))],
		[/^Disable (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('禁用', translated))],
		[/^Open (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('打开', translated))],
		[/^Copy (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('复制', translated))],
		[/^Create (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('创建', translated))],
		[/^Delete (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('删除', translated))],
		[/^Learn about (.+)$/u, object => renderTranslatedObject(object, translated => joinVerbObject('了解', translated))],
	]);
}

function translateProperty(text: string): string | undefined {
	return translateWithPattern(text, [
		[
			/^Specifies whether to show the (commits on the current branch|worktrees|branches|contributors|remotes|stashes|tags|experimental incoming activity|upstream status of the current branch) for each repository in the _(.+?)_ view$/u,
			(subject, view) => {
				const translatedSubject = repositoryChildItemTranslations.get(subject);
				const translatedView = translateObject(view);
				if (translatedSubject == null || translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图中显示每个仓库的${translatedSubject}`;
			},
		],
		[
			/^Specifies whether to include working tree file status for each repository in the _(.+?)_ view$/u,
			view => {
				const translatedView = translateObject(view);
				if (translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图中包含每个仓库的工作区文件状态`;
			},
		],
		[
			/^Specifies whether to provide information about the Pull Request \(if any\) that introduced the commit in the (inline blame annotation|status bar|hovers)\. Requires a connection to a supported remote service \(e\.g\. GitHub\)$/u,
			location => {
				const translatedLocation = pullRequestInfoLocationTranslations.get(location);
				if (translatedLocation == null) return undefined;

				return `指定是否在${translatedLocation}中提供引入该提交的 Pull Request（如果有）信息。需要连接到受支持的远程服务（例如 GitHub）`;
			},
		],
		[
			/^Specifies the string to be shown in place of (both the _recent change_ and _authors_ CodeLens|the _authors_ CodeLens|the _recent change_ CodeLens) when there are unsaved changes$/u,
			target => {
				const translatedTarget = unsavedCodeLensTargetTranslations.get(target);
				if (translatedTarget == null) return undefined;

				return `指定在存在未保存更改时，用于替代 ${translatedTarget} 显示的字符串`;
			},
		],
		[
			/^Specifies the maximum number of items to show in a (search|list)\. Use 0 to specify no maximum$/u,
			target => {
				const translatedTarget = maxItemsTargetTranslations.get(target);
				if (translatedTarget == null) return undefined;

				return `指定在${translatedTarget}中显示的最大项目数。使用 0 表示不设上限`;
			},
		],
		[
			/^Specifies whether to reveal (branches|commits|contributors|remotes|stashes|tags|worktrees) in the _(.+?)_ view, otherwise they revealed in the _Repositories_ view$/u,
			(item, view) => {
				const translatedItem = revealViewItemTranslations.get(item);
				const translatedView = translateObject(view);
				if (translatedItem == null || translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图中显示${translatedItem}，否则会在 _仓库_ 视图中显示它们`;
			},
		],
		[
			/^Specifies how (branches|repositories|tags|contributors|worktrees) are sorted in quick pick menus and views$/u,
			subject => {
				const translatedSubject = propertySortSubjectTranslations.get(subject);
				if (translatedSubject == null) return undefined;

				return `指定${translatedSubject}在快速选择菜单和视图中的排序方式`;
			},
		],
		[
			/^Specifies the command to be executed when (an _authors_ CodeLens|a _recent change_ CodeLens|the blame status bar item) is clicked$/u,
			target => {
				const translatedTarget = clickTargetTranslations.get(target);
				if (translatedTarget == null) return undefined;

				return `指定点击${translatedTarget}时执行的命令`;
			},
		],
		[
			/^Specifies additional markers to show on the (scrollbar|minimap) in the _Commit Graph_$/u,
			surface => {
				const translatedSurface = graphSurfaceTranslations.get(surface);
				if (translatedSurface == null) return undefined;

				return `指定在 _提交图谱_ 的${translatedSurface}上显示的附加标记`;
			},
		],
		[
			/^Specifies whether to show contributor statistics in (_Contributors_ sections in the views|the _Contributors_ view)\. This can take a while to compute depending on the repository size$/u,
			target => {
				const translatedTarget = contributorStatisticsTargetTranslations.get(target);
				if (translatedTarget == null) return undefined;

				return `指定是否在${translatedTarget}中显示贡献者统计信息。根据仓库大小不同，计算过程可能需要一些时间`;
			},
		],
		[
			/^Opens the (commit|file revision) on the remote service \(when available\)$/u,
			resource => {
				const translatedResource = remoteResourceTranslations.get(resource);
				if (translatedResource == null) return undefined;

				return `在远程服务上打开${translatedResource}（如果可用）`;
			},
		],
		[
			/^Reveals commits in the (_Commit Graph_|_Inspect_ view)$/u,
			view => {
				const translatedView = commitRevealLocationTranslations.get(view);
				if (translatedView == null) return undefined;

				return `在 _${translatedView}_ 中显示提交`;
			},
		],
		[
			/^Prefer showing (Cloud Patches|the Commit Graph) in (a view|the bottom panel|the editor area)$/u,
			(feature, location) => {
				const translatedFeature = preferredSurfaceTranslations.get(feature);
				const translatedLocation = preferredLocationTranslations.get(location);
				if (translatedFeature == null || translatedLocation == null) return undefined;

				return `优先在${translatedLocation}中显示${translatedFeature}`;
			},
		],
		[
			/^Specifies how (the file blame annotations|the file changes annotations|the file heatmap annotations) will be toggled$/u,
			target => {
				const translatedTarget = annotationToggleTargetTranslations.get(target);
				if (translatedTarget == null) return undefined;

				return `指定如何切换${translatedTarget}`;
			},
		],
		[
			/^Specifies the default number of items to show in the _Commit Graph_\. Use 0 to specify no limit$/u,
			() => '指定 _提交图谱_ 中默认显示的项目数。使用 0 表示不设限制',
		],
		[
			/^Specifies the default number of items to show in a view list\. Use 0 to specify no limit$/u,
			() => '指定视图列表中默认显示的项目数。使用 0 表示不设限制',
		],
		[
			/^Specifies the order by which commits will be shown on the _Commit Graph_$/u,
			() => '指定 _提交图谱_ 中提交的显示顺序',
		],
		[
			/^Specifies the order by which commits will be shown\. If unspecified, commits will be shown in reverse chronological order$/u,
			() => '指定提交的显示顺序。如未指定，则按时间倒序显示提交',
		],
		[
			/^Specifies whether to provide a _commit details_ hover for all lines when showing blame annotations$/u,
			() => '指定是否在显示 Blame 注解时为所有行提供 _提交详情_ 悬停提示',
		],
		[
			/^Specifies whether to provide a _commit details_ hover for the current line$/u,
			() => '指定是否为当前行提供 _提交详情_ 悬停提示',
		],
		[
			/^Specifies whether to show stashes in the _Commits_ and _Branches_ sections of the _(.+?)_ view$/u,
			view => {
				const translatedView = translateObject(view);
				if (translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图的 _提交_ 和 _分支_ 分区中显示储藏`;
			},
		],
		[
			/^Specifies the base color of the file heatmap annotations when the most recent change is newer \(hot\) than the `#gitlens\.heatmap\.ageThreshold#` value$/u,
			() => '指定当最近一次更改比 `#gitlens.heatmap.ageThreshold#` 的值更新（hot）时，文件热度图注解的基础颜色',
		],
		[
			/^Specifies the base color of the file heatmap annotations when the most recent change is older \(cold\) than the `#gitlens\.heatmap\.ageThreshold#` value$/u,
			() => '指定当最近一次更改比 `#gitlens.heatmap.ageThreshold#` 的值更旧（cold）时，文件热度图注解的基础颜色',
		],
		[
			/^Specifies whether to compact \(flatten\) unnecessary (branch and tag|branch|file|tag) nesting in the _(.+?)_ view\. Only applies when `([^`]+)` is set to (.+)$/u,
			(subject, view, setting, mode) => {
				const translatedSubject = propertyCompactionSubjectTranslations.get(subject);
				const translatedView = translateObject(view);
				if (translatedSubject == null || translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图中压平不必要的${translatedSubject}嵌套。仅当 \`${setting}\` 设置为 ${mode} 时适用`;
			},
		],
		[
			/^Specifies whether to compact \(deduplicate\) matching adjacent file blame annotations$/u,
			() => '指定是否压缩（去重）相邻且匹配的文件 Blame 注解',
		],
		[
			/^Specifies when to switch between displaying files as a `tree` or `list` based on the number of files in a nesting level in the _(.+?)_ view\. Only applies when `([^`]+)` is set to `auto`$/u,
			(view, setting) => {
				const translatedView = translateObject(view);
				if (translatedView == null) return undefined;

				return `指定在 _${translatedView}_ 视图中，何时根据某一嵌套层级中的文件数量在 \`tree\` 或 \`list\` 之间切换文件显示方式。仅当 \`${setting}\` 设置为 \`auto\` 时适用`;
			},
		],
		[
			/^Automatically switches between displaying files as a `tree` or `list` based on the `([^`]+)` value and the number of files at each nesting level$/u,
			setting =>
				`根据 \`${setting}\` 的值以及各嵌套层级中的文件数量，在 \`tree\` 或 \`list\` 之间自动切换文件显示方式`,
		],
		[
			/^Specifies whether to show avatar images instead of (commit \(or status\) icons|status icons) in the _(.+?)_ view$/u,
			(target, view) => {
				const translatedTarget = iconReplacementTranslations.get(target);
				const translatedView = translateObject(view);
				if (translatedTarget == null || translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图中显示头像图像而不是${translatedTarget}`;
			},
		],
		[
			/^Specifies whether to show avatar images instead of author initials and remote icons in the _Commit Graph_$/u,
			() => '指定是否在 _提交图谱_ 中显示头像图像而不是作者缩写和远程图标',
		],
		[
			/^Specifies whether to show avatar images in the file blame annotations$/u,
			() => '指定是否在文件 Blame 注解中显示头像图像',
		],
		[
			/^Specifies whether to show pull requests \(if any\) associated with (commits|the current branch|the worktree branch|branches|each branch) in the _(.+?)_ view\. Requires a connection to a supported remote service \(e\.g\. GitHub\)$/u,
			(subject, view) => {
				const translatedSubject = pullRequestDisplaySubjectTranslations.get(subject);
				const translatedView = translateObject(view);
				if (translatedSubject == null || translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图中显示与${translatedSubject}关联的 Pull Request（如果有）。需要连接到受支持的远程服务（例如 GitHub）`;
			},
		],
		[
			/^Specifies whether to query for pull requests associated with (the worktree branch and commits|the current branch and commits|commits|branches and commits|each branch and commits) in the _(.+?)_ view\. Requires a connection to a supported remote service \(e\.g\. GitHub\)$/u,
			(subject, view) => {
				const translatedSubject = pullRequestQuerySubjectTranslations.get(subject);
				const translatedView = translateObject(view);
				if (translatedSubject == null || translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图中查询与${translatedSubject}关联的 Pull Request。需要连接到受支持的远程服务（例如 GitHub）`;
			},
		],
		[
			/^Specifies whether to show a comparison of the current branch or the working tree with a user-selected reference \(branch, tag, etc\) in the _(.+?)_ view$/u,
			view => {
				const translatedView = translateObject(view);
				if (translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图中显示当前分支或工作区与用户所选引用（分支、标签等）的比较`;
			},
		],
		[
			/^Specifies whether to show a comparison of the (branch|worktree branch) with a user-selected reference \(branch, tag, etc\) in the _(.+?)_ view$/u,
			(subject, view) => {
				const translatedSubject = comparisonSubjectTranslations.get(subject);
				const translatedView = translateObject(view);
				if (translatedSubject == null || translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图中显示${translatedSubject}与用户所选引用（分支、标签等）的比较`;
			},
		],
		[
			/^Specifies whether to show a comparison of the branch with a user-selected reference \(branch, tag, etc\) under each branch in the _(.+?)_ view$/u,
			view => {
				const translatedView = translateObject(view);
				if (translatedView == null) return undefined;

				return `指定是否在 _${translatedView}_ 视图的各分支下显示分支与用户所选引用（分支、标签等）的比较`;
			},
		],
		[
			/^Specifies custom instructions to provide to the AI provider when generating (.+)$/u,
			target => {
				const translatedTarget = aiGenerationTargetTranslations.get(target);
				if (translatedTarget == null) return undefined;

				return `指定在生成${translatedTarget}时提供给 AI 提供商的自定义指令`;
			},
		],
		[
			/^Specifies whether to allow opening multiple instances of the _(.+?)_ in the editor area$/u,
			object => {
				const translatedObject = translateObject(object);
				if (translatedObject == null) return undefined;

				return `指定是否允许在编辑器区域打开多个 _${translatedObject}_ 实例`;
			},
		],
		[
			/^Specifies whether to show the _(.+?)_ view in a compact display density$/u,
			view => {
				const translatedView = translateObject(view);
				if (translatedView == null) return undefined;

				return `指定是否以紧凑显示密度显示 _${translatedView}_ 视图`;
			},
		],
		[/^Deprecated\. Use (.+) instead$/u, replacement => `已弃用。请改用 ${replacement}`],
		[/^Deprecated\. This setting has been renamed to (.+)$/u, replacement => `已弃用。此设置已重命名为 ${replacement}`],
		[
			/^Specifies how the _(.+?)_ view will display (file icons|files|branches and tags|branches|tags|worktrees|worktree branches)$/u,
			(view, subject) => {
				const translatedView = translateObject(view);
				const translatedSubject = propertyDisplaySubjectTranslations.get(subject);
				if (translatedView == null || translatedSubject == null) return undefined;

				return `指定 _${translatedView}_ 视图如何显示${translatedSubject}`;
			},
		],
		[
			/^Sorts (branches|repositories|tags|contributors|worktrees) by (name|date|last fetched date|the most recent commit date|commit count) in (ascending|descending) order$/u,
			(subject, metric, order) => {
				const translatedSubject = propertySortSubjectTranslations.get(subject);
				const translatedMetric = propertySortMetricTranslations.get(metric);
				const translatedOrder = propertySortOrderTranslations.get(order);
				if (translatedSubject == null || translatedMetric == null || translatedOrder == null) return undefined;

				return `按${translatedMetric}${translatedOrder}排序${translatedSubject}`;
			},
		],
	]);
}

function translateWithPattern(
	text: string,
	patterns: ReadonlyArray<readonly [RegExp, (...captures: string[]) => string | undefined]>,
): string | undefined {
	for (const [pattern, render] of patterns) {
		const match = text.match(pattern);
		if (match == null) continue;

		const translated = render(...match.slice(1));
		if (translated == null) continue;

		return preserveTrailingPunctuation(text, translated);
	}

	return undefined;
}

function translateObject(text: string): string | undefined {
	const exact = exactTranslations.get(text);
	if (exact != null) return exact;

	let translated = text;
	for (const [source, target] of sortedReplacements) {
		translated = translated.replaceAll(source, target);
	}

	translated = translated
		.replaceAll('(Preview)', '（预览）')
		.replaceAll('...', '...')
		.replace(/\s+/gu, ' ')
		.trim();

	return hasUnexpectedEnglish(translated) ? undefined : translated;
}

function hasUnexpectedEnglish(text: string): boolean {
	let normalized = text;
	for (const token of allowedEnglishTokens) {
		normalized = normalized.replaceAll(token, '');
	}

	return /[A-Za-z]/u.test(normalized);
}

function preserveTrailingPunctuation(source: string, translation: string): string {
	if (source.endsWith('...') && !translation.endsWith('...')) {
		return `${translation}...`;
	}

	return translation;
}

function joinVerbObject(verb: string, object: string): string {
	return /^[A-Za-z]/u.test(object) ? `${verb} ${object}` : `${verb}${object}`;
}

function renderTranslatedObject(object: string, render: (translated: string) => string): string | undefined {
	const translated = translateObject(object);
	if (translated == null) return undefined;

	return render(translated);
}

function getScope(entry: TranslationWorksetEntry): Scope {
	const scopes = new Set(
		entry.keys.map(key => scopeByKey.get(key)).filter((scope): scope is Exclude<Scope, 'mixed' | 'unknown'> => scope != null),
	);

	if (scopes.size === 0) return 'unknown';
	if (scopes.size > 1) return 'mixed';

	return [...scopes][0];
}

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
