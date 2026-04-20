import type { GitCommitStats } from '@gitlens/git/models/commit.js';
import type { GitFileChangeStats } from '@gitlens/git/models/fileChange.js';
import type { RemoteResource } from '@gitlens/git/models/remoteResource.js';
import { RemoteResourceType } from '@gitlens/git/models/remoteResource.js';
import { getChangedFilesCount } from '@gitlens/git/utils/commit.utils.js';
import { GlyphChars } from '../../constants.js';
import { localizeCommitDisplayString } from '../../i18n/commitDisplay/commitDisplayLocalization.js';

export type CommitQuickPickSeparator = 'actions' | 'browse' | 'compare' | 'copy' | 'files' | 'open';

export function getCommitQuickPickActionLabel(
	action:
		| 'applyChanges'
		| 'applyStash'
		| 'browseRepositoryFromBeforeHereInNewWindow'
		| 'browseRepositoryFromBeforeHere'
		| 'browseRepositoryFromHereInNewWindow'
		| 'browseRepositoryFromHere'
		| 'cherryPickCommit'
		| 'compareWithHead'
		| 'compareWithWorkingTree'
		| 'copyMessage'
		| 'copySha'
		| 'createBranchAtCommit'
		| 'createTagAtCommit'
		| 'dropStash'
		| 'explainChanges'
		| 'openAllChangedFiles'
		| 'openAllChangesDifftool'
		| 'openAllChangesWithWorkingTree'
		| 'openAllChanges'
		| 'openChangedAndCloseUnchangedFiles'
		| 'openChangesDifftool'
		| 'openChangesWithWorkingFile'
		| 'openChanges'
		| 'openDirectoryCompareWithWorkingTree'
		| 'openDirectoryCompare'
		| 'openFileAtRevision'
		| 'openFile'
		| 'openFilesAtRevision'
		| 'openFiles'
		| 'openInCommitGraph'
		| 'openInspectCommitDetails'
		| 'pushToCommit'
		| 'renameStash'
		| 'restore'
		| 'revertCommit'
		| 'switchToCommit',
): string {
	return localizeCommitDisplayString(`commitQuickPick.action.${action}`);
}

export function getCommitQuickPickAkaCheckoutDescription(): string {
	return localizeCommitDisplayString('commitQuickPick.description.akaCheckout');
}

export function getCommitQuickPickCurrentBranchLabel(): string {
	return localizeCommitDisplayString('commitQuickPick.branch.current');
}

export function getCommitQuickPickBranchActionLabel(
	action: 'rebaseBranchOntoCommit' | 'resetBranchToCommit' | 'resetBranchToPreviousCommit',
	branch: string,
): string {
	return localizeCommitDisplayString(`commitQuickPick.action.${action}`, { branch: branch });
}

export function getCommitQuickPickBrowseRepositoryLabel(options?: {
	before?: boolean;
	openInNewWindow?: boolean;
}): string {
	if (options?.before && options.openInNewWindow) {
		return getCommitQuickPickActionLabel('browseRepositoryFromBeforeHereInNewWindow');
	}
	if (options?.before) return getCommitQuickPickActionLabel('browseRepositoryFromBeforeHere');
	if (options?.openInNewWindow) return getCommitQuickPickActionLabel('browseRepositoryFromHereInNewWindow');

	return getCommitQuickPickActionLabel('browseRepositoryFromHere');
}

export function getCommitQuickPickCopyRemoteResourceLabel(
	resource: RemoteResource,
	provider: string,
	multipleProviders: boolean,
): string {
	return localizeCommitDisplayString('commitQuickPick.action.copyRemoteResourceForProvider', {
		ellipsis: multipleProviders ? GlyphChars.Ellipsis : '',
		provider: provider,
		resource: getCommitQuickPickRemoteResourceName(resource),
	});
}

export function getCommitQuickPickMessageCopiedNotification(stash: boolean): string {
	return stash
		? localizeCommitDisplayString('commitQuickPick.description.stashMessageCopied')
		: localizeCommitDisplayString('commitQuickPick.description.commitMessageCopied');
}

export function getCommitQuickPickShaCopiedNotification(): string {
	return localizeCommitDisplayString('commitQuickPick.description.commitShaCopied');
}

export function getCommitQuickPickCommitStats(
	stats: GitCommitStats | undefined,
	options?: { separator?: string },
): string {
	if (stats == null) return getCommitQuickPickNoFilesChanged();

	const { files: changedFiles, additions, deletions } = stats;
	if (getChangedFilesCount(changedFiles) <= 0 && additions <= 0 && deletions <= 0) {
		return getCommitQuickPickNoFilesChanged();
	}

	const separator = options?.separator ?? ' ';
	const fileStats: string[] = [];
	if (typeof changedFiles === 'number') {
		if (changedFiles) {
			fileStats.push(getCommitQuickPickCountLabel('filesChanged', changedFiles));
		}
	} else {
		const { added, changed, deleted } = changedFiles;
		if (added) {
			fileStats.push(getCommitQuickPickCountLabel('filesAdded', added));
		}
		if (changed) {
			fileStats.push(getCommitQuickPickCountLabel('filesChanged', changed));
		}
		if (deleted) {
			fileStats.push(getCommitQuickPickCountLabel('filesDeleted', deleted));
		}
	}

	const lineStats: string[] = [];
	if (additions) {
		lineStats.push(getCommitQuickPickCountLabel('additions', additions));
	}
	if (deletions) {
		lineStats.push(getCommitQuickPickCountLabel('deletions', deletions));
	}

	return [...fileStats, ...lineStats].join(separator);
}

export function getCommitQuickPickFileChangeStats(
	stats: GitFileChangeStats | undefined,
	options?: { prefix?: string; separator?: string },
): string {
	if (stats == null) return '';

	const { additions, deletions } = stats;
	if (additions < 0 && deletions < 0) return '';

	const separator = options?.separator ?? ' ';
	const lineStats: string[] = [];
	if (additions) {
		lineStats.push(getCommitQuickPickCountLabel('linesAdded', additions));
	}
	if (deletions) {
		lineStats.push(getCommitQuickPickCountLabel('linesDeleted', deletions));
	}

	if (lineStats.length === 0) return '';

	return `${options?.prefix ?? ''}${lineStats.join(separator)}`;
}

export function getCommitQuickPickOpenRemoteResourceLabel(
	resource: RemoteResource,
	provider: string,
	multipleProviders: boolean,
): string {
	return localizeCommitDisplayString('commitQuickPick.action.openRemoteResourceOnProvider', {
		ellipsis: multipleProviders ? GlyphChars.Ellipsis : '',
		provider: provider,
		resource: getCommitQuickPickRemoteResourceName(resource),
	});
}

export function getCommitQuickPickSeparatorLabel(separator: CommitQuickPickSeparator): string {
	return localizeCommitDisplayString(`commitQuickPick.separator.${separator}`);
}

export function getCommitQuickPickSeeAllChangedFilesHint(): string {
	return localizeCommitDisplayString('commitQuickPick.hint.clickToSeeAllChangedFiles');
}

export function getCommitQuickPickSeeActionsHint(stash: boolean): string {
	return stash
		? localizeCommitDisplayString('commitQuickPick.hint.clickToSeeStashActions')
		: localizeCommitDisplayString('commitQuickPick.hint.clickToSeeCommitActions');
}

export function getCommitQuickPickUrlCopiedNotification(): string {
	return localizeCommitDisplayString('commitQuickPick.description.urlCopied');
}

function getCommitQuickPickRemoteResourceName(resource: RemoteResource): string {
	switch (resource.type) {
		case RemoteResourceType.Branch:
			return localizeCommitDisplayString('commitQuickPick.remoteResource.branch');
		case RemoteResourceType.Branches:
			return localizeCommitDisplayString('commitQuickPick.remoteResource.branches');
		case RemoteResourceType.Commit:
			return localizeCommitDisplayString('commitQuickPick.remoteResource.commit');
		case RemoteResourceType.Comparison:
			return localizeCommitDisplayString('commitQuickPick.remoteResource.comparison');
		case RemoteResourceType.CreatePullRequest:
			return localizeCommitDisplayString('commitQuickPick.remoteResource.createPullRequest');
		case RemoteResourceType.File:
		case RemoteResourceType.Revision:
			return localizeCommitDisplayString('commitQuickPick.remoteResource.file');
		case RemoteResourceType.Repo:
			return localizeCommitDisplayString('commitQuickPick.remoteResource.repository');
		default:
			return '';
	}
}

function getCommitQuickPickCountLabel(
	type: 'additions' | 'deletions' | 'filesAdded' | 'filesChanged' | 'filesDeleted' | 'linesAdded' | 'linesDeleted',
	count: number,
): string {
	switch (type) {
		case 'additions':
			return localizeCommitDisplayString(
				count === 1 ? 'commitQuickPick.stats.addition' : 'commitQuickPick.stats.additions',
				{ count: count },
			);
		case 'deletions':
			return localizeCommitDisplayString(
				count === 1 ? 'commitQuickPick.stats.deletion' : 'commitQuickPick.stats.deletions',
				{ count: count },
			);
		case 'filesAdded':
			return localizeCommitDisplayString(
				count === 1 ? 'commitQuickPick.stats.fileAdded' : 'commitQuickPick.stats.filesAdded',
				{ count: count },
			);
		case 'filesChanged':
			return localizeCommitDisplayString(
				count === 1 ? 'commitQuickPick.stats.fileChanged' : 'commitQuickPick.stats.filesChanged',
				{ count: count },
			);
		case 'filesDeleted':
			return localizeCommitDisplayString(
				count === 1 ? 'commitQuickPick.stats.fileDeleted' : 'commitQuickPick.stats.filesDeleted',
				{ count: count },
			);
		case 'linesAdded':
			return localizeCommitDisplayString(
				count === 1 ? 'commitQuickPick.stats.lineAdded' : 'commitQuickPick.stats.linesAdded',
				{ count: count },
			);
		case 'linesDeleted':
			return localizeCommitDisplayString(
				count === 1 ? 'commitQuickPick.stats.lineDeleted' : 'commitQuickPick.stats.linesDeleted',
				{ count: count },
			);
	}
}

function getCommitQuickPickNoFilesChanged(): string {
	return localizeCommitDisplayString('commitQuickPick.stats.noFilesChanged');
}
