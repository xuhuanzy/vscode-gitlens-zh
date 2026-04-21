# GitLens Development Guide

This workspace contains **GitLens** - a powerful VS Code extension that supercharges Git functionality. It provides blame annotations, commit history visualization, repository exploration, and many advanced Git workflows. The codebase supports both desktop VS Code (Node.js) and VS Code for Web (browser/webworker) environments.

## Working Style Expectations

1. **Accuracy over speed** — Read the actual code before proposing changes. Do not guess at method names, decorator behaviors, or class interfaces. Verify they exist first by searching the codebase.
2. **Simplicity over abstraction** — Prefer the simplest correct solution. Do not introduce new types, enums, marker interfaces, migration flags, or wrapper abstractions unless they serve multiple consumers. When the user simplifies your approach, adopt it immediately.
3. **Completeness over iteration** — Before presenting a multi-file change as complete, audit ALL affected locations: call sites, subclass overrides, both Node.js and browser code paths, and sub-providers.
4. **Fixing over disabling** — When asked to fix a feature, fix the root cause. Do not disable, remove, or work around it unless explicitly asked. "Fix" and "disable" are different instructions.
5. **Confirming over assuming** — When debugging, present your hypothesis with evidence before implementing. If a request is ambiguous, ask for clarification. Do not silently start editing on non-trivial changes without stating your approach.
6. **Purposeful changes** — Refactoring and renaming to improve clarity, maintainability, and codebase health are encouraged. Explain what you're changing and why. Do not make silent drive-by changes unrelated to the task at hand.
7. **Branch ownership** — The current branch owns ALL of its issues, not just those from your current task. Do not dismiss build errors, type errors, or test failures as "pre-existing" without verifying against the base branch (`git diff main --stat` or similar). If an issue exists on this branch but not on the base branch, it is the branch's responsibility regardless of when it was introduced. After completing your current task, address any remaining branch issues. If the scope of remaining issues is too large to handle, ask the user how to proceed.

## Issue Accountability During Work

### Branch vs. Repository Issues

- **Branch issues**: Errors that exist on the current branch but NOT on the base branch. These are the branch's responsibility regardless of which task or session introduced them.
- **Repository issues**: Errors that also exist on the base branch. These are truly pre-existing and can be noted but not prioritized.
- **When in doubt**: Run `git stash && pnpm run build && git stash pop` or `git diff main --name-only` to verify. Do NOT assume an issue is pre-existing — verify it.

### Workflow

1. **Focus first** — Complete your current task
2. **Then fix** — After your task is done, address any remaining build errors, type errors, or test failures on the branch
3. **Ask if too large** — If the remaining issues are extensive or unclear, inform the user and ask how to proceed rather than ignoring them

### Completion Criteria

A task is not complete until:

- The code compiles cleanly (`pnpm run build` or relevant build command succeeds)
- Related tests pass
- Any remaining branch issues have been either fixed or raised to the user

## Development Environment

- **Node.js** ≥ 22.12.0, **pnpm** ≥ 10.x (install via corepack: `corepack enable`), **Corepack** ≥ 0.31.0, **Git** ≥ 2.7.2
- GitLens supports **Node.js** (desktop) and **Web Worker** (browser/vscode.dev) environments — shared code with abstractions in `src/env/`
- Test both environments during development

### Performance Considerations

- Use lazy loading for heavy services
- Leverage caching layers (GitCache, PromiseCache, @memoize)
- Debounce expensive operations
- Consider webview refresh performance
- Monitor telemetry for performance regressions

## Development Commands

```bash
pnpm install              # Install dependencies
```

### Build & Development

```bash
pnpm run rebuild          # Complete rebuild from scratch
pnpm run build            # Full development build (everything including e2e and unit tests)
pnpm run build:quick      # Fast build (no linting)
pnpm run build:extension  # Build only the extension (no webviews)
pnpm run build:webviews   # Build only webviews
pnpm run bundle           # Production bundle
pnpm run bundle:e2e       # E2E tests production bundle (with DEBUG for account simulation)
```

### Watch Mode

```bash
pnpm run watch            # Watch mode for development (everything including e2e and unit tests)
pnpm run watch:quick      # Fast watch mode (no linting)
pnpm run watch:extension  # Watch extension only
pnpm run watch:tests      # Watch unit tests only
pnpm run watch:webviews   # Watch webviews only
```

### Testing

```bash
pnpm run test             # Run unit tests (VS Code extension tests)
pnpm run test:e2e         # Run Playwright E2E tests
```

> For detailed test running patterns, output interpretation, and debugging: see `docs/testing.md`

### Quality

```bash
pnpm run lint             # Run ESLint with TypeScript rules
pnpm run lint:fix         # Auto-fix linting issues
pnpm run pretty           # Format code with Prettier
pnpm run pretty:check     # Check formatting
```

### Specialized Commands (typically not needed during normal development as they are part of build/watch)

```bash
pnpm run generate:contributions  # Generate package.json contributions from contributions.json
pnpm run extract:contributions   # Extract contributions from package.json to contributions.json
pnpm run generate:commandTypes   # Generate command types from contributions
pnpm run build:icons             # Build icon font from SVG sources
```

## Git & Repository Guidelines

For commit message format and workflow, use `/commit`. For CHANGELOG format and entry guidelines, use `/audit-commits`. For code reviewing, use `/review` or `/deep-review`. For debugging methodology and common misdiagnosis patterns, use `/investigate`.

### Branching Guidelines

- Feature branches from `main` or from another feature branch if stacking
- Prefix with an appropriate type: `feature/`, `bug/`, `debt/`
- Use descriptive names: `feature/search-natural-language`, `bug/graph-performance`
- If there is a related issue, reference it in the branch name: `feature/#1234-search-natural-language`

## High-Level Architecture

### Directory Structure

```
src/
├── extension.ts              # Extension entry point, activation logic
├── container.ts              # Service Locator - manages all services (singleton)
├── @types/                   # TypeScript type definitions
├── annotations/              # Editor decoration providers
├── autolinks/                # Auto-linking issues/PRs in commit messages & branch names
├── codelens/                 # Editor CodeLens providers
├── commands/                 # 100+ command implementations
│   ├── git/                  # Git-wizard sub-commands
│   └── *.ts                  # Individual command files
├── env/                             # Environment-specific implementations
│   ├── node/                        # Node.js (desktop) implementations
│   │   └── git/
│   │       ├── git.ts               # Git command execution
│   │       ├── localGitProvider.ts  # Local Git provider (child_process)
│   │       ├── vslsGitProvider.ts   # Local Live Share Git provider
│   │       └── sub-providers/       # Local sub-providers for specific Git operations
│   │           ├── branches.ts
│   │           ├── commits.ts
│   │           └── ... (15 total)
│   └── browser/              # Browser/webworker implementations
├── git/                      # Git abstraction layer
│   ├── gitProvider.ts        # Git provider interface
│   ├── gitProviderService.ts # Manages multiple Git providers
│   ├── models/               # Git model types (Branch, Commit, etc.)
│   ├── parsers/              # Output parsers for Git command results
│   ├── remotes/              # Remote provider and integration management
│   └── sub-providers/        # Shared sub-providers for specific Git operations
├── hovers/                   # Editor hover providers
├── plus/                     # Pro features (non-OSS, see LICENSE.plus)
│   ├── ai/                   # AI features (commit messages, explanations, changelogs)
│   ├── gk/                   # GitKraken-specific features (account, subscription, etc.)
│   └── integrations/         # Rich Git host & issue tracker integrations (GitHub, GitLab, Jira, etc.)
│       └── providers/
│           └── github/
│               ├── githubGitProvider.ts
│               └── sub-providers/  # 11 GitHub-specific sub-providers
├── quickpicks/               # Quick pick/input (quick menus) implementations
├── statusbar/                # Status bar item management
├── system/                   # Utility libraries
│   ├── utils/                # Utilities usable in both host and webviews
│   └── utils/-webview/       # Extension host-specific utilities
├── telemetry/                # Usage analytics and error reporting
├── terminal/                 # Terminal integration providers
├── trackers/                 # Tracks document state and blames
├── uris/                     # Deep link uri handling
├── views/                    # Tree view providers (sidebar views)
│   ├── commitsView.ts
│   ├── branchesView.ts
│   └── ...
├── vsls/                     # Live Share support
└── webviews/                 # Webview implementations
    ├── apps/                 # Webview UI apps (Lit only)
    │   ├── shared/           # Common UI components using Lit
    │   ├── commitDetails/
    │   ├── rebase/
    │   ├── settings/
    │   └── plus/             # Pro webview apps
    │       ├── home/
    │       ├── graph/
    │       ├── timeline/
    │       ├── patchDetails/
    │       └── composer/
    ├── protocol.ts           # IPC protocol for webview communication
    └── webviewController.ts  # Base controller for all webviews
tests/                        # E2E and Unit tests
walkthroughs/                 # Welcome and tips walkthroughs
```

> For detailed architecture (patterns, services, environment abstraction, webviews, build config): see `docs/architecture.md`

## Coding Standards & Style Rules

- **Strict TypeScript** with `strictTypeChecked` ESLint config — no `any` usage (exceptions only for external APIs)
- **Explicit return types** for public methods; **prefer `type` over `interface`** for unions
- **Use path aliases**: `@env/` for environment-specific code
- **Import order**: node built-ins → external → internal → relative
- **No default exports** (ESLint enforced); use `import type` for type-only imports
- **Always use `.js` extension** in imports (ESM requirement)
- **Naming**: Classes PascalCase (no `I` prefix), methods/variables camelCase, constants camelCase (not SCREAMING_SNAKE_CASE), files camelCase.ts
- **Folders**: Models under `models/`, utilities under `utils/` (both host + webview), host-specific in `utils/-webview/`, webview apps under `webviews/apps/`

> For error handling patterns, implementation quality rules, and completeness checklist: see `docs/coding-standards.md`
>
> For webview accessibility requirements: see `docs/accessibility.md`

### Decorator System

The codebase uses method decorators (`src/system/decorators/`) that significantly alter runtime behavior:

| Decorator                           | Purpose                                              | Key Gotcha                                                                 |
| ----------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `@info()` / `@debug()` / `@trace()` | Logging with scope tracking                          | `getScopedLogger()` must be called BEFORE any `await` (browser limitation) |
| `@gate()`                           | Deduplicates concurrent calls (returns same promise) | 5-min timeout; most common cause of method hangs                           |
| `@memoize()`                        | Caches return value permanently on instance          | Caches rejected Promises too; use `invalidateMemoized()` to clear          |
| `@sequentialize()`                  | Queues calls to execute one at a time                | Different from `@gate()` — queues instead of deduplicating                 |
| `@debounce()`                       | Debounces method calls per-instance                  |                                                                            |
| `@command()`                        | Registers VS Code command class                      | Class decorator, not method decorator                                      |

Stacking executes bottom-up (outermost runs first). When debugging: check `@gate()` first for hangs, `@memoize()` for stale data, logging decorators last.

For detailed decorator behavior and investigation methodology, use `/investigate`.

## Quick Lookup

Reference examples and critical rules for common tasks.

### Available Skills

Skills provide detailed, step-by-step workflows for common tasks. Invoke with `/{skill-name}`.

| Skill              | Purpose                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `/triage`          | Triage GitHub issues — verdicts, confidence levels, recommended actions     |
| `/investigate`     | Structured bug investigation with root cause analysis                       |
| `/prioritize`      | Prioritize triaged issues — shortlist, backlog, won't fix, community        |
| `/update-issues`   | Update GitHub issues from triage/investigation/prioritization reports       |
| `/dev-scope`       | Scope work into a goals doc — defines what and why, not how                 |
| `/deep-planning`   | Design implementation approach — investigates codebase, presents trade-offs |
| `/challenge-plan`  | Stress-test a proposed plan or architecture decision                        |
| `/analyze`         | Deep design/implementation analysis, devil's advocate                       |
| `/review`          | Code review against standards + impact completeness audit                   |
| `/deep-review`     | Deep merge-blocking review — traces code paths for correctness              |
| `/ux-review`       | UX review — traces user flows against goals doc                             |
| `/commit`          | Git commit with GitLens conventions                                         |
| `/create-issue`    | Create GitHub issues from code changes                                      |
| `/audit-commits`   | Audit commit range for issues and CHANGELOG entries                         |
| `/worktree`        | Create isolated git worktrees for feature work                              |
| `/add-command`     | Scaffold a new VS Code command                                              |
| `/add-webview`     | Scaffold a new webview with IPC, Lit app, registration                      |
| `/add-test`        | Generate unit or E2E test files                                             |
| `/add-icon`        | Add icon to GL Icons font                                                   |
| `/add-ai-provider` | Add a new AI provider integration                                           |
| `/live-inspect`    | Launch VS Code with GitLens via Playwright inspect UI/logs                  |
| `/live-exercise`   | Live operation + audit + fix loop for UI-bearing work                       |
| `/live-perf`       | Live performance measurement + improvement with three-tier discipline       |
| `/live-pair`       | Interactive pair-programming with a live instance (user-driven feedback)    |

### Canonical Examples

When implementing something new, look at these files first:

| Task                            | Example File                                   |
| ------------------------------- | ---------------------------------------------- |
| Simple command                  | `src/commands/copyCurrentBranch.ts`            |
| Complex command (multi-command) | `src/commands/gitWizard.ts`                    |
| IPC protocol                    | `src/webviews/rebase/protocol.ts`              |
| Webview provider                | `src/webviews/rebase/rebaseWebviewProvider.ts` |
| Webview app (Lit)               | `src/webviews/apps/rebase/`                    |
| Unit test                       | `src/system/__tests__/iterable.test.ts`        |
| E2E test                        | `tests/e2e/specs/smoke.test.ts`                |
| E2E page object                 | `tests/e2e/pageObjects/gitLensPage.ts`         |

### Critical Rules

**contributions.json** (only applies to `contributes/commands`, `contributes/menus`, `contributes/submenus`, `contributes/keybindings`, and `contributes/views`)

- Never edit these sections in `package.json` directly — edit `contributions.json` instead
- Run `pnpm run generate:contributions` after editing (or let the watcher handle it)
- Run `pnpm run generate:commandTypes` after adding commands (or let the watcher handle it)

**Imports**

- Always use `.js` extension in imports (ESM requirement)
- Use named exports only (no `default` exports)

**IPC**

- `IpcCommand` = fire-and-forget (no response)
- `IpcRequest` = expects a response (use `await`)
- `IpcNotification` = extension → webview state updates

**Testing**

- When debugging test failures, DON'T simplify NOR change the intent of the tests just to get them to pass. Instead, INVESTIGATE and UNDERSTAND the root cause of the failure and address that directly, or raise an issue to the user if you can't resolve it.

# i18n 指南

## 核心

这是一个不会被上游合入的分支, 一切本地化翻译相关内容仅限于当前分支, 且我们需要持续合并上游源码.

因此我们必须遵守最小化侵入源码原则, i18n 切入点必须位于最底层而不是上层调用点, 这样我们才能轻松合并上游.

## 文件结构

1. 所有提取/非运行时翻译脚本都应位于`./i18n`下
2. 运行时脚本必须位于`./src/i18n`下
3. 禁止在非`./i18n`和`./src/i18n`目录下创建翻译相关脚本
4. 测试文件应位于对于目录的`__tests__`目录下
5. 我们应维护一份翻译校对根源于一份运行时翻译文件(一份并不是指一个文件, 他可以由多个文件多个层级组合成)

- 根源应位于`./i18n`下, 用于比对上游合并后原文是否发生更改/删除/新增, 这样方便报告是否需要修订翻译
- 运行时应位于`./src/i18n`下, 但`package.json`对应的可以位于根目录, 因为这是`vscode`的强制要求

6. 我们或许还要维护一份权威翻译词典用于固定翻译, 但这步可以与`翻译校对根源`合并, 我们需要进一步考虑.

## 禁止事项

1. 禁止以任何方式修改`./contributions.json`, 他必须由上游合并而来.
2. 禁止在高层调用点改写源码以适配`i18n`, 必须要将对源码的侵入限制在少数受控位置
3. 禁止保留任何 i18n 兼容性代码, 包括但不限于旧 schema 字段兼容、旧数据迁移 fallback、双写、条件分支兼容. 结构调整后应直接同步更新现有数据文件、测试与脚本, 不需要为历史格式保留任何兼容层.

## Codex 翻译环境声明

1. GitLens 是一个围绕 `git` 工作流构建的专业 VS Code UI 插件, 不是通用消费级应用. Codex 在翻译时必须始终以 `git` 专业语境理解原文, 优先保证语义准确而不是字面通顺.
2. 所有与 `git` 相关的术语都必须采用稳定、一致、专业的译法, 尤其包括但不限于: `commit`, `branch`, `tag`, `stash`, `rebase`, `cherry-pick`, `blame`, `worktree`, `remote`, `upstream`, `push`, `pull`, `fetch`, `merge`, `merge base`, `checkout`, `stage`, `unstage`, `working tree`, `HEAD`, `Pull Request`.
3. 如果同一英文词在不同语境下存在不同最佳译法, 必须根据当前 UI 语义选择最准确的表达, 但不得牺牲 `git` 领域含义. 禁止为了“更自然”而改写掉专业语义.
4. 按钮、菜单、命令标题、设置项标题、设置说明、提示文本、工具提示、欢迎页文案等都属于专业产品 UI 文案. 翻译必须克制、准确、简洁, 避免口语化、营销化、情绪化表达.
5. 对于 `git` 命令、占位符、模板 token、Markdown 结构、代码片段、配置键、命令 id、链接参数等非自然语言内容, 禁止擅自翻译、改写或破坏其语法结构.
6. 对于产品名、专有名词或社区已广泛接受的术语, 如果强行翻译会降低可理解性, 应优先保留原文或采用约定俗成的专业表达, 不得生造术语.
7. 如果译文存在专业歧义或缺少上下文, Codex 必须优先选择保守策略: 保留待复查状态、标记 `needsReview` 或继续依赖权威翻译源/覆盖层, 而不是贸然给出可能误导用户的最终译文.
8. 所有翻译结果都应默认面向熟悉 `git` 与 IDE 工作流的用户. 对新手友好可以体现在说明清晰, 但不能以牺牲术语准确性为代价.
