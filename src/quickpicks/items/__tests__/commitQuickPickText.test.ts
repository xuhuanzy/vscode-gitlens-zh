import * as assert from 'assert';
import { RemoteResourceType } from '@gitlens/git/models/remoteResource.js';
import { setCommitDisplayLocaleOverrideForTesting } from '../../../i18n/commitDisplay/commitDisplayLocalization.js';
import {
	getCommitQuickPickActionLabel,
	getCommitQuickPickBranchActionLabel,
	getCommitQuickPickCommitStats,
	getCommitQuickPickCopyRemoteResourceLabel,
	getCommitQuickPickFileChangeStats,
	getCommitQuickPickOpenRemoteResourceLabel,
	getCommitQuickPickSeparatorLabel,
} from '../commitQuickPickText.js';

suite('Commit QuickPick Text Test Suite', () => {
	teardown(() => {
		setCommitDisplayLocaleOverrideForTesting(undefined);
	});

	test('falls back to English commit action QuickPick copy', () => {
		setCommitDisplayLocaleOverrideForTesting('en');

		assert.strictEqual(getCommitQuickPickActionLabel('openInspectCommitDetails'), 'Inspect Commit Details');
		assert.strictEqual(getCommitQuickPickActionLabel('openInCommitGraph'), 'Open in Commit Graph');
		assert.strictEqual(getCommitQuickPickActionLabel('explainChanges'), 'Explain Changes');
		assert.strictEqual(
			getCommitQuickPickBranchActionLabel('resetBranchToCommit', 'main'),
			'Reset main to Commit...',
		);
		assert.strictEqual(getCommitQuickPickSeparatorLabel('actions'), 'Actions');
		assert.strictEqual(
			getCommitQuickPickCopyRemoteResourceLabel(
				{ type: RemoteResourceType.Commit, sha: 'abc123' },
				'GitHub',
				false,
			),
			'Copy Link to Commit for GitHub',
		);
	});

	test('localizes zh-CN commit action QuickPick copy and preserves dynamic values', () => {
		setCommitDisplayLocaleOverrideForTesting('zh-cn');

		assert.strictEqual(getCommitQuickPickActionLabel('openInspectCommitDetails'), '检查提交详情');
		assert.strictEqual(getCommitQuickPickActionLabel('openInCommitGraph'), '在提交图中打开');
		assert.strictEqual(getCommitQuickPickActionLabel('explainChanges'), '解释更改');
		assert.strictEqual(getCommitQuickPickBranchActionLabel('resetBranchToCommit', 'main'), '将 main 重置到提交...');
		assert.strictEqual(getCommitQuickPickSeparatorLabel('actions'), '操作');
		assert.strictEqual(
			getCommitQuickPickOpenRemoteResourceLabel(
				{ type: RemoteResourceType.Commit, sha: 'abc123' },
				'GitHub',
				false,
			),
			'在 GitHub 上打开提交',
		);
		assert.strictEqual(
			getCommitQuickPickCopyRemoteResourceLabel(
				{ type: RemoteResourceType.Commit, sha: 'abc123' },
				'GitHub',
				false,
			),
			'复制 GitHub 的提交链接',
		);
	});

	test('localizes commit QuickPick stats without changing counts', () => {
		setCommitDisplayLocaleOverrideForTesting('zh-cn');

		assert.strictEqual(
			getCommitQuickPickCommitStats(
				{ files: { added: 1, changed: 0, deleted: 0 }, additions: 136, deletions: 0 },
				{ separator: ', ' },
			),
			'1 个文件已添加, 136 处新增',
		);
		assert.strictEqual(
			getCommitQuickPickFileChangeStats({ additions: 3, deletions: 1, changes: 0 }, { separator: ', ' }),
			'3 行已添加, 1 行已删除',
		);
	});
});
