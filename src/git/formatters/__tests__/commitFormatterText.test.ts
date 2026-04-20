import * as assert from 'assert';
import { setCommitDisplayLocaleOverrideForTesting } from '../../../i18n/commitDisplay/commitDisplayLocalization.js';
import {
	getAuthorEmailTitle,
	getCommitFormatterMessageLabel,
	getCommitFormatterPullRequestStateLabel,
	getCommitFormatterSignatureTooltip,
	getCommitFormatterStashLabel,
	getCommitFormatterWorkingTreeLabel,
	localizeCommitFormatterCommandMarkdown,
} from '../commitFormatterText.js';

suite('CommitFormatter Text Test Suite', () => {
	teardown(() => {
		setCommitDisplayLocaleOverrideForTesting(undefined);
	});

	test('falls back to English formatter display copy', () => {
		setCommitDisplayLocaleOverrideForTesting('en');

		assert.strictEqual(getCommitFormatterMessageLabel(false, false), 'Uncommitted changes');
		assert.strictEqual(getCommitFormatterMessageLabel(false, true), 'Staged changes');
		assert.strictEqual(getCommitFormatterMessageLabel(true, false), 'Merge changes');
		assert.strictEqual(getCommitFormatterPullRequestStateLabel('opened'), 'opened');
		assert.strictEqual(getCommitFormatterPullRequestStateLabel('draft'), 'draft');
		assert.strictEqual(getAuthorEmailTitle('Ada', 'ada@example.com'), 'Email Ada (ada@example.com)');
	});

	test('localizes zh-CN formatter display copy', () => {
		setCommitDisplayLocaleOverrideForTesting('zh-cn');

		assert.strictEqual(getCommitFormatterMessageLabel(false, false), '未提交更改');
		assert.strictEqual(getCommitFormatterMessageLabel(false, true), '已暂存更改');
		assert.strictEqual(getCommitFormatterMessageLabel(true, false), '合并更改');
		assert.strictEqual(getCommitFormatterPullRequestStateLabel('opened'), '已打开');
		assert.strictEqual(getCommitFormatterPullRequestStateLabel('closed'), '已关闭');
		assert.strictEqual(getCommitFormatterPullRequestStateLabel('merged'), '已合并');
		assert.strictEqual(getCommitFormatterPullRequestStateLabel('draft'), 'draft');
		assert.strictEqual(getCommitFormatterStashLabel('3'), '贮藏 #3');
		assert.strictEqual(getCommitFormatterWorkingTreeLabel(), '工作区');
		assert.strictEqual(getCommitFormatterSignatureTooltip(), '已签名\n点击在提交详情中验证签名');
		assert.strictEqual(getAuthorEmailTitle('Ada', 'ada@example.com'), '给 Ada 发送邮件 (ada@example.com)');
	});

	test('localizes command markdown without changing command links or dynamic values', () => {
		setCommitDisplayLocaleOverrideForTesting('zh-cn');

		const commands = [
			'[`$(git-commit) abc123`](command:gitlens.inspect?%7B%22sha%22%3A%22abc123%22%7D "Inspect Commit Details")',
			' &nbsp;[$(copy)](command:gitlens.copySha?abc123 "Copy SHA")',
			' &nbsp;[$(globe)](command:gitlens.openCommit?abc123 "Open Commit on GitHub")',
			' &nbsp;[$(plug) Connect to GitHub…](command:gitlens.connect?github "Connect to GitHub to enable the display of the Pull Request (if any) that introduced this commit")',
			' &nbsp;[$(sparkle) Explain](command:gitlens.explain?abc123 "Explain Changes")',
			' &nbsp;[$(git-pull-request) PR #42](command:gitlens.action?42 "Open Pull Request \\#42 on GitHub\n——\nFix \\"quoted\\" title\nopened, 2 days ago")',
		].join('');

		const localized = localizeCommitFormatterCommandMarkdown(commands);

		assert.ok(localized.includes('command:gitlens.inspect?%7B%22sha%22%3A%22abc123%22%7D'));
		assert.ok(localized.includes('command:gitlens.copySha?abc123'));
		assert.ok(localized.includes('command:gitlens.openCommit?abc123'));
		assert.ok(localized.includes('command:gitlens.connect?github'));
		assert.ok(localized.includes('command:gitlens.action?42'));
		assert.ok(localized.includes('"检查提交详情"'));
		assert.ok(localized.includes('"复制 SHA"'));
		assert.ok(localized.includes('"在 GitHub 上打开提交"'));
		assert.ok(localized.includes('[$(plug) 连接到 GitHub…]'));
		assert.ok(localized.includes('"连接到 GitHub 以显示引入此提交的 Pull Request（如果有）"'));
		assert.ok(localized.includes('[$(sparkle) 解释]'));
		assert.ok(localized.includes('"解释更改"'));
		assert.ok(
			localized.includes('"在 GitHub 上打开 Pull Request \\#42\n——\nFix \\"quoted\\" title\n已打开, 2 days ago"'),
		);
	});
});
