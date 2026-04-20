import { collectAcceptedEqualValues, type StringCatalog } from './catalog.mts';

export type ZhCnProofreaderCatalogOptions = {
	extraExceptions?: ReadonlyMap<string, string>;
	extraGlossaryOverrides?: ReadonlyMap<string, string>;
	extraPassthroughValues?: Iterable<string>;
	extraProtectedTerms?: Iterable<string>;
	extraTemplateRules?: readonly ZhCnTemplateRule[];
	isImplicitPassthroughValue?: (value: string) => boolean;
};

export type ZhCnProofreaderDecision = {
	localized: string;
	reason:
		| 'extraGlossary'
		| 'extraPassthrough'
		| 'extraProtectedTerm'
		| 'extraTemplate'
		| 'implicitPassthrough'
		| 'sharedGlossary'
		| 'sharedPassthrough'
		| 'sharedProtectedTerm'
		| 'sharedTemplate'
		| 'unresolved';
};

export type ZhCnTemplateRule = {
	apply: (value: string, helpers: ZhCnTemplateHelpers) => string | undefined;
	id: string;
	specificity: number;
};

type ZhCnTemplateHelpers = {
	translateLooseSegment: (value: string) => string;
	translateStrictSegment: (value: string) => string | undefined;
};

const maxRecursionDepth = 6;
const placeholderOrPunctuationPattern =
	/(?:(?:#?\{[^{}]+\}|<[^<>]+>|#?\d+)|[\s()[\]{}<>,.:;!?/&+="'`~|\\-]|\.{3}|…)+/g;

export const sharedZhCnPassthroughValues = new Set([
	'Git CodeLens',
	'Git Supercharged',
	'GitHub',
	'GitKraken',
	'GitKraken AI',
	'GitKraken AI:',
	'GitKraken DevEx platform',
	'GitKraken MCP',
	"GitKraken's DevEx platform",
	'GitLens',
	'GitLens Community',
	'GitLens Pro',
	'Jira',
	'Launchpad',
	'Live Share',
	'Visual Studio Live Share',
]);

export const sharedZhCnProtectedTerms = new Set([
	...sharedZhCnPassthroughValues,
	'Blame',
	'CodeLens',
	'HEAD',
	'PR',
	'Pull Request',
	'SHA',
	'URL',
	'Web',
]);

export const sharedZhCnGlossaryOverrides = new Map<string, string>([
	['Actions', '操作'],
	['All Changed Files', '所有已更改文件'],
	['All Changes', '所有更改'],
	['Autolinks', '自动链接'],
	['Branch', '分支'],
	['Branches', '分支'],
	['Browse', '浏览'],
	['CHANGELOG', '更新日志'],
	['Changes', '更改'],
	['Clipboard', '剪贴板'],
	['Commit', '提交'],
	['Commit Details', '提交详情'],
	['Commit Graph', '提交图'],
	['Commit Message', '提交消息'],
	['Commit SHA', '提交 SHA'],
	['Commits', '提交'],
	['Comparison', '比较'],
	['Contributors', '贡献者'],
	['Copy', '复制'],
	['Current Branch', '当前分支'],
	['Dates & Times', '日期和时间'],
	['Directory Compare', '目录比较'],
	['File', '文件'],
	['File Annotations', '文件注释'],
	['File Blame', '文件追责'],
	['File Changes', '文件变更'],
	['File Heatmap', '文件热力图'],
	['File History', '文件历史'],
	['Files', '文件'],
	['GitLens docs', 'GitLens 文档'],
	['Hide', '隐藏'],
	['Hovers', '悬停提示'],
	['Inline Blame', '行内追责'],
	['Inspect', '检查'],
	['Interactive Rebase Editor', '交互式变基编辑器'],
	['Keyboard Shortcuts', '键盘快捷键'],
	['Learn more', '了解更多'],
	['Line History', '行历史'],
	['Menus & Toolbars', '菜单和工具栏'],
	['Message', '消息'],
	['Modes', '模式'],
	['More Actions', '更多操作'],
	['New Window', '新窗口'],
	['No files changed', '没有文件更改'],
	['Open', '打开'],
	['Previous Commit', '上一提交'],
	['Previous Revision', '上一修订版'],
	['Release Notes', '发行说明'],
	['Release notes', '发行说明'],
	['Remote', '远程'],
	['Remotes', '远程'],
	['Repositories', '仓库'],
	['Repository', '仓库'],
	['Restore', '还原'],
	['Revision', '修订版'],
	['Run command', '运行命令'],
	['Search & Compare', '搜索和比较'],
	['Settings', '设置'],
	['Settings UI', '设置界面'],
	['Show', '显示'],
	['Side Bar', '侧边栏'],
	['Signed', '已签名'],
	['Sorting', '排序'],
	['Stash', '贮藏'],
	['Stash Message', '贮藏消息'],
	['Stashes', '贮藏'],
	['Status Bar Blame', '状态栏追责'],
	['Tag', '标签'],
	['Tags', '标签'],
	['Team Actions', '团队操作'],
	['Terminal Links', '终端链接'],
	['User Settings', '用户设置'],
	['Version', '版本'],
	['Working File', '工作文件'],
	['Working Tree', '工作区'],
	['Worktrees', '工作树'],
]);

const sharedZhCnTemplateRules: readonly ZhCnTemplateRule[] = [
	createTemplateRule('jump-to-settings', 500, /^Jump to (.+) settings$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `跳转到${target}设置`;
	}),
	createTemplateRule('jump-to-target', 490, /^Jump to (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `跳转到${target}`;
	}),
	createTemplateRule('open-resource-on-provider', 480, /^Open (.+) on (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const resource = helpers.translateLooseSegment(match[1]);
		const provider = helpers.translateLooseSegment(match[2]);
		return `在 ${provider} 上打开${resource}${match[3] ?? ''}`;
	}),
	createTemplateRule(
		'copy-link-resource-provider',
		470,
		/^Copy Link to (.+) for (.+?)(?:([.]{3}|…))?$/,
		(match, helpers) => {
			const resource = helpers.translateLooseSegment(match[1]);
			const provider = helpers.translateLooseSegment(match[2]);
			return `复制 ${provider} 的${resource}链接${match[3] ?? ''}`;
		},
	),
	createTemplateRule(
		'connect-to-provider-title',
		460,
		/^Connect to (.+) to enable the display of the Pull Request \(if any\) that introduced this commit$/,
		(match, helpers) => {
			return `连接到 ${helpers.translateLooseSegment(match[1])} 以显示引入此提交的 Pull Request（如果有）`;
		},
	),
	createTemplateRule('rebase-source-onto-target', 450, /^Rebase (.+) onto (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const source = helpers.translateLooseSegment(match[1]);
		const target = helpers.translateStrictSegment(match[2]);
		return target == null ? undefined : `将${source}变基到${target}${match[3] ?? ''}`;
	}),
	createTemplateRule('reset-source-to-target', 450, /^Reset (.+) to (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const source = helpers.translateLooseSegment(match[1]);
		const target = helpers.translateStrictSegment(match[2]);
		return target == null ? undefined : `将${source}重置到${target}${match[3] ?? ''}`;
	}),
	createTemplateRule('create-target-at-target', 450, /^Create (.+) at (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		const anchor = helpers.translateStrictSegment(match[2]);
		return target == null || anchor == null ? undefined : `基于${anchor}创建${target}${match[3] ?? ''}`;
	}),
	createTemplateRule('open-target-with-target', 440, /^Open (.+) with (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		const anchor = helpers.translateStrictSegment(match[2]);
		return target == null || anchor == null ? undefined : `打开与${anchor}的${target}`;
	}),
	createTemplateRule('open-target-at-target', 440, /^Open (.+) at (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		const location = helpers.translateStrictSegment(match[2]);
		return target == null || location == null ? undefined : `打开${location}中的${target}`;
	}),
	createTemplateRule('connect-to-provider', 430, /^Connect to (.+?)(?:([.]{3}|…))$/, (match, helpers) => {
		return `连接到 ${helpers.translateLooseSegment(match[1])}${match[2] ?? ''}`;
	}),
	createTemplateRule('compare-with-target', 420, /^Compare with (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `与${target}比较`;
	}),
	createTemplateRule('push-to-target', 410, /^Push to (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `推送到${target}${match[2] ?? ''}`;
	}),
	createTemplateRule('switch-to-target', 410, /^Switch to (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `切换到${target}${match[2] ?? ''}`;
	}),
	createTemplateRule('reveal-in-target', 410, /^Reveal in (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `在${target}中显示`;
	}),
	createTemplateRule('show-target', 400, /^Show (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `显示${target}`;
	}),
	createTemplateRule('hide-target', 400, /^Hide (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `隐藏${target}`;
	}),
	createTemplateRule('open-in-target', 390, /^Open in (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `在${target}中打开`;
	}),
	createTemplateRule('open-target', 380, /^Open (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `打开${target}${match[2] ?? ''}`;
	}),
	createTemplateRule('copy-target', 380, /^Copy (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `复制${target}${match[2] ?? ''}`;
	}),
	createTemplateRule('click-to-see-target', 370, /^Click to see (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `点击查看${target}`;
	}),
	createTemplateRule('clipboard-copy', 370, /^(.+) copied to the clipboard$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `${target}已复制到剪贴板`;
	}),
	createTemplateRule('rename-target', 360, /^Rename (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `重命名${target}${match[2] ?? ''}`;
	}),
	createTemplateRule('drop-target', 360, /^Drop (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `删除${target}${match[2] ?? ''}`;
	}),
	createTemplateRule('revert-target', 360, /^Revert (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `还原${target}${match[2] ?? ''}`;
	}),
	createTemplateRule('apply-target', 360, /^Apply (.+?)(?:([.]{3}|…))?$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `应用${target}${match[2] ?? ''}`;
	}),
	createTemplateRule('add-target', 350, /^Add (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `添加${target}`;
	}),
	createTemplateRule('use-target', 350, /^Use (.+)$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `使用${target}`;
	}),
	createTemplateRule('target-view', 340, /^(.+) view$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `${target}视图`;
	}),
	createTemplateRule('target-settings', 330, /^(.+) settings$/, (match, helpers) => {
		const target = helpers.translateStrictSegment(match[1]);
		return target == null ? undefined : `${target}设置`;
	}),
	createTemplateRule('count-additions', 320, /^\{count\} additions?$/, () => '{count} 处新增'),
	createTemplateRule('count-deletions', 320, /^\{count\} deletions?$/, () => '{count} 处删除'),
	createTemplateRule('count-files-added', 320, /^\{count\} files? added$/, () => '{count} 个文件已添加'),
	createTemplateRule('count-files-changed', 320, /^\{count\} files? changed$/, () => '{count} 个文件已更改'),
	createTemplateRule('count-files-deleted', 320, /^\{count\} files? deleted$/, () => '{count} 个文件已删除'),
	createTemplateRule('count-lines-added', 320, /^\{count\} lines? added$/, () => '{count} 行已添加'),
	createTemplateRule('count-lines-deleted', 320, /^\{count\} lines? deleted$/, () => '{count} 行已删除'),
];

export function proofreadZhCnValue(
	value: string,
	options?: Omit<ZhCnProofreaderCatalogOptions, 'extraExceptions'>,
): ZhCnProofreaderDecision {
	return proofreadZhCnValueCore(normalizeZhCnValue(value), options, 0);
}

export function applyZhCnProofreaderCatalog<T extends StringCatalog>(
	catalog: T,
	englishCatalog: T,
	options?: ZhCnProofreaderCatalogOptions,
): T {
	const nextCatalog = { ...catalog } as T;

	for (const [key, english] of Object.entries(englishCatalog)) {
		if (nextCatalog[key] === english) {
			const decision = proofreadZhCnValue(english, options);
			if (decision.reason !== 'unresolved') {
				nextCatalog[key] = decision.localized;
			}
		}

		const exception = options?.extraExceptions?.get(english);
		if (exception != null) {
			nextCatalog[key] = exception;
		}
	}

	return nextCatalog;
}

export function collectAcceptedZhCnProofreaderEqualValues<T extends StringCatalog>(options: {
	baseCatalog: T;
	baseZhCnCatalog: T;
	currentCatalog?: T;
	extraPassthroughValues?: Iterable<string>;
	extraProtectedTerms?: Iterable<string>;
	isImplicitPassthroughValue?: (value: string) => boolean;
}): Set<string> {
	const accepted = collectAcceptedEqualValues(options.baseCatalog, options.baseZhCnCatalog);

	for (const value of getPassthroughValues(options.extraPassthroughValues)) {
		accepted.add(value);
	}

	if (options.currentCatalog != null) {
		for (const english of Object.values(options.currentCatalog)) {
			const decision = proofreadZhCnValue(english, {
				extraPassthroughValues: options.extraPassthroughValues,
				extraProtectedTerms: options.extraProtectedTerms,
				isImplicitPassthroughValue: options.isImplicitPassthroughValue,
			});
			if (
				decision.reason === 'sharedPassthrough' ||
				decision.reason === 'extraPassthrough' ||
				decision.reason === 'sharedProtectedTerm' ||
				decision.reason === 'extraProtectedTerm' ||
				decision.reason === 'implicitPassthrough'
			) {
				accepted.add(english);
			}
		}
	}

	return accepted;
}

function proofreadZhCnValueCore(
	value: string,
	options: Omit<ZhCnProofreaderCatalogOptions, 'extraExceptions'> | undefined,
	depth: number,
): ZhCnProofreaderDecision {
	if (value.length === 0) {
		return { localized: value, reason: 'unresolved' };
	}

	if (sharedZhCnPassthroughValues.has(value)) {
		return { localized: value, reason: 'sharedPassthrough' };
	}

	if (hasExactValue(options?.extraPassthroughValues, value)) {
		return { localized: value, reason: 'extraPassthrough' };
	}

	if (options?.isImplicitPassthroughValue?.(value) === true) {
		return { localized: value, reason: 'implicitPassthrough' };
	}

	if (canPassthroughProtectedTerms(value, options?.extraProtectedTerms, false)) {
		return { localized: value, reason: 'extraProtectedTerm' };
	}

	if (canPassthroughProtectedTerms(value)) {
		return { localized: value, reason: 'sharedProtectedTerm' };
	}

	if (depth >= maxRecursionDepth) {
		return { localized: value, reason: 'unresolved' };
	}

	const helpers = createTemplateHelpers(options, depth);
	const templateDecision = matchTemplateRules(value, helpers, options?.extraTemplateRules);
	if (templateDecision != null) {
		return templateDecision;
	}

	const extraGlossaryOverride = options?.extraGlossaryOverrides?.get(value);
	if (extraGlossaryOverride != null) {
		return { localized: extraGlossaryOverride, reason: 'extraGlossary' };
	}

	const sharedGlossaryOverride = sharedZhCnGlossaryOverrides.get(value);
	if (sharedGlossaryOverride != null) {
		return { localized: sharedGlossaryOverride, reason: 'sharedGlossary' };
	}

	return { localized: value, reason: 'unresolved' };
}

function createTemplateHelpers(
	options: Omit<ZhCnProofreaderCatalogOptions, 'extraExceptions'> | undefined,
	depth: number,
): ZhCnTemplateHelpers {
	return {
		translateLooseSegment: (value: string) => {
			const normalized = normalizeZhCnValue(value);
			const decision = proofreadZhCnValueCore(normalized, options, depth + 1);
			return decision.reason === 'unresolved' ? normalized : decision.localized;
		},
		translateStrictSegment: (value: string) => {
			const normalized = normalizeZhCnValue(value);
			const decision = proofreadZhCnValueCore(normalized, options, depth + 1);
			return decision.reason === 'unresolved' ? undefined : decision.localized;
		},
	};
}

function matchTemplateRules(
	value: string,
	helpers: ZhCnTemplateHelpers,
	extraTemplateRules?: readonly ZhCnTemplateRule[],
): ZhCnProofreaderDecision | undefined {
	const candidates: ZhCnProofreaderDecision[] = [];
	let bestSpecificity = Number.NEGATIVE_INFINITY;

	for (const rule of [...(extraTemplateRules ?? []), ...sharedZhCnTemplateRules]) {
		const localized = rule.apply(value, helpers);
		if (localized == null) continue;

		if (rule.specificity > bestSpecificity) {
			bestSpecificity = rule.specificity;
			candidates.length = 0;
		}

		if (rule.specificity === bestSpecificity) {
			candidates.push({
				localized: localized,
				reason: extraTemplateRules?.includes(rule) === true ? 'extraTemplate' : 'sharedTemplate',
			});
		}
	}

	return candidates[0];
}

function createTemplateRule(
	id: string,
	specificity: number,
	pattern: RegExp,
	render: (match: RegExpExecArray, helpers: ZhCnTemplateHelpers) => string | undefined,
): ZhCnTemplateRule {
	return {
		apply: (value, helpers) => {
			const match = pattern.exec(value);
			if (match == null) return undefined;
			return render(match, helpers);
		},
		id: id,
		specificity: specificity,
	};
}

function getPassthroughValues(extraPassthroughValues?: Iterable<string>): Set<string> {
	const values = new Set(sharedZhCnPassthroughValues);
	for (const value of extraPassthroughValues ?? []) {
		values.add(value);
	}
	return values;
}

function getProtectedTerms(extraProtectedTerms?: Iterable<string>, includeShared = true): string[] {
	const protectedTerms = new Set<string>();
	if (includeShared) {
		for (const value of sharedZhCnProtectedTerms) {
			protectedTerms.add(value);
		}
	}
	for (const value of extraProtectedTerms ?? []) {
		protectedTerms.add(value);
	}

	return [...protectedTerms].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function canPassthroughProtectedTerms(
	value: string,
	extraProtectedTerms?: Iterable<string>,
	includeShared = true,
): boolean {
	let remaining = value;
	let matchedProtectedTerm = false;

	for (const protectedTerm of getProtectedTerms(extraProtectedTerms, includeShared)) {
		if (!remaining.includes(protectedTerm)) continue;

		matchedProtectedTerm = true;
		remaining = remaining.split(protectedTerm).join(' ');
	}

	if (!matchedProtectedTerm) return false;

	return remaining.replace(placeholderOrPunctuationPattern, '').length === 0;
}

function hasExactValue(values: Iterable<string> | undefined, target: string): boolean {
	for (const value of values ?? []) {
		if (value === target) return true;
	}
	return false;
}

function normalizeZhCnValue(value: string): string {
	return value.replace(/[ \t\r\n\f]+/g, ' ').trim();
}
