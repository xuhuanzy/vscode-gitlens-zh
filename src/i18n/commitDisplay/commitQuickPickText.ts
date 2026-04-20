import type { GitCommitStats } from '@gitlens/git/models/commit.js';
import type { GitFileChangeStats } from '@gitlens/git/models/fileChange.js';
import type { RemoteResource } from '@gitlens/git/models/remoteResource.js';
import { RemoteResourceType } from '@gitlens/git/models/remoteResource.js';
import { getChangedFilesCount } from '@gitlens/git/utils/commit.utils.js';
import { GlyphChars } from '../../constants.js';
import { localizeCommitDisplayString, type CommitDisplayLocalizationKey } from './commitDisplayLocalization.js';

export function getCommitQuickPickActionLabel(action: CommitDisplayLocalizationKey): string {
	return localizeCommitDisplayString(action);
}

export function getCommitQuickPickAkaCheckoutDescription(): string {
	return localizeCommitDisplayString('aka checkout');
}

export function getCommitQuickPickCurrentBranchLabel(): string {
	return localizeCommitDisplayString('Current Branch');
}

export function getCommitQuickPickBranchActionLabel(action: CommitDisplayLocalizationKey, branch: string): string {
	return localizeCommitDisplayString(action, { branch: branch });
}

export function getCommitQuickPickBrowseRepositoryLabel(options?: {
	before?: boolean;
	openInNewWindow?: boolean;
}): string {
	if (options?.before && options.openInNewWindow) {
		return getCommitQuickPickActionLabel('Browse Repository from Before Here in New Window');
	}
	if (options?.before) return getCommitQuickPickActionLabel('Browse Repository from Before Here');
	if (options?.openInNewWindow) return getCommitQuickPickActionLabel('Browse Repository from Here in New Window');

	return getCommitQuickPickActionLabel('Browse Repository from Here');
}

export function getCommitQuickPickCopyRemoteResourceLabel(
	resource: RemoteResource,
	provider: string,
	multipleProviders: boolean,
): string {
	return localizeCommitDisplayString('Copy Link to {resource} for {provider}{ellipsis}', {
		ellipsis: multipleProviders ? GlyphChars.Ellipsis : '',
		provider: provider,
		resource: getCommitQuickPickRemoteResourceName(resource),
	});
}

export function getCommitQuickPickMessageCopiedNotification(stash: boolean): string {
	return stash
		? localizeCommitDisplayString('Stash Message copied to the clipboard')
		: localizeCommitDisplayString('Commit Message copied to the clipboard');
}

export function getCommitQuickPickShaCopiedNotification(): string {
	return localizeCommitDisplayString('Commit SHA copied to the clipboard');
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
	return localizeCommitDisplayString('Open {resource} on {provider}{ellipsis}', {
		ellipsis: multipleProviders ? GlyphChars.Ellipsis : '',
		provider: provider,
		resource: getCommitQuickPickRemoteResourceName(resource),
	});
}

export function getCommitQuickPickSeparatorLabel(separator: CommitDisplayLocalizationKey): string {
	return localizeCommitDisplayString(separator);
}

export function getCommitQuickPickSeeAllChangedFilesHint(): string {
	return localizeCommitDisplayString('Click to see all changed files');
}

export function getCommitQuickPickSeeActionsHint(stash: boolean): string {
	return stash
		? localizeCommitDisplayString('Click to see stash actions')
		: localizeCommitDisplayString('Click to see commit actions');
}

export function getCommitQuickPickUrlCopiedNotification(): string {
	return localizeCommitDisplayString('URL copied to the clipboard');
}

function getCommitQuickPickRemoteResourceName(resource: RemoteResource): string {
	switch (resource.type) {
		case RemoteResourceType.Branch:
			return localizeCommitDisplayString('Branch');
		case RemoteResourceType.Branches:
			return localizeCommitDisplayString('Branches');
		case RemoteResourceType.Commit:
			return localizeCommitDisplayString('Commit');
		case RemoteResourceType.Comparison:
			return localizeCommitDisplayString('Comparison');
		case RemoteResourceType.CreatePullRequest:
			return localizeCommitDisplayString('Create Pull Request');
		case RemoteResourceType.File:
		case RemoteResourceType.Revision:
			return localizeCommitDisplayString('File');
		case RemoteResourceType.Repo:
			return localizeCommitDisplayString('Repository');
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
			return localizeCommitDisplayString(count === 1 ? '{count} addition' : '{count} additions', {
				count: count,
			});
		case 'deletions':
			return localizeCommitDisplayString(count === 1 ? '{count} deletion' : '{count} deletions', {
				count: count,
			});
		case 'filesAdded':
			return localizeCommitDisplayString(count === 1 ? '{count} file added' : '{count} files added', {
				count: count,
			});
		case 'filesChanged':
			return localizeCommitDisplayString(count === 1 ? '{count} file changed' : '{count} files changed', {
				count: count,
			});
		case 'filesDeleted':
			return localizeCommitDisplayString(count === 1 ? '{count} file deleted' : '{count} files deleted', {
				count: count,
			});
		case 'linesAdded':
			return localizeCommitDisplayString(count === 1 ? '{count} line added' : '{count} lines added', {
				count: count,
			});
		case 'linesDeleted':
			return localizeCommitDisplayString(count === 1 ? '{count} line deleted' : '{count} lines deleted', {
				count: count,
			});
	}
}

function getCommitQuickPickNoFilesChanged(): string {
	return localizeCommitDisplayString('No files changed');
}
