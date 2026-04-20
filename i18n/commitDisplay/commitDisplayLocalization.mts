import * as path from 'path';
import { fileURLToPath } from 'url';
import {
	diffStringCatalog,
	findPendingTranslations,
	hasCatalogChanges,
	readStringCatalog,
	syncLocaleCatalog,
	type PendingTranslation,
	type StringCatalog,
	type StringCatalogDiff,
} from '../shared/catalog.mts';

export type CommitDisplayCatalog = StringCatalog;
export type CommitDisplayCatalogDiff = StringCatalogDiff;
export type CommitDisplayPendingTranslation = PendingTranslation;

type CommitDisplayLeafEntries = Record<string, string>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, '..', '..');
export const commitDisplayCatalogDir = path.join(rootDir, 'src', 'i18n', 'commitDisplay');
export const commitDisplayNlsPath = path.join(commitDisplayCatalogDir, 'commitDisplay.nls.json');
export const commitDisplayNlsZhCnPath = path.join(commitDisplayCatalogDir, 'commitDisplay.nls.zh-cn.json');

export function buildCommitDisplayCatalog(): CommitDisplayCatalog {
	return sortCatalog(
		mergeCatalogs(
			createCommitFormatterCatalog(),
			createCommitQuickPickCatalog(),
		),
	);
}

export function readCommitDisplayCatalog(filePath: string): CommitDisplayCatalog {
	return readStringCatalog<CommitDisplayCatalog>(filePath);
}

export function syncCommitDisplayZhCnCatalog(
	commitDisplayCatalog: CommitDisplayCatalog,
	existingZhCn: CommitDisplayCatalog,
): { diff: CommitDisplayCatalogDiff; catalog: CommitDisplayCatalog } {
	return syncLocaleCatalog(commitDisplayCatalog, existingZhCn);
}

export function hasCommitDisplayCatalogChanges(
	diff: Pick<CommitDisplayCatalogDiff, 'added' | 'removed' | 'updated'>,
): boolean {
	return hasCatalogChanges(diff);
}

export function diffCommitDisplayCatalog(
	previous: CommitDisplayCatalog,
	next: CommitDisplayCatalog,
): CommitDisplayCatalogDiff {
	return diffStringCatalog(previous, next);
}

export function findPendingCommitDisplayZhCnTranslations(
	baseCommitDisplayCatalog: CommitDisplayCatalog,
	currentCommitDisplayCatalog: CommitDisplayCatalog,
	currentZhCn: CommitDisplayCatalog,
	options?: { acceptedEqualValues?: Iterable<string> },
): CommitDisplayPendingTranslation[] {
	return findPendingTranslations(baseCommitDisplayCatalog, currentCommitDisplayCatalog, currentZhCn, options);
}

function createCommitFormatterCatalog(): CommitDisplayCatalog {
	return mergeCatalogs(
		createEntries('commitFormatter.author', {
			emailTitle: 'Email {name} ({email})',
		}),
		createEntries('commitFormatter.commands', {
			connectToProviderEllipsis: 'Connect to {provider}…',
			connectToProviderToEnablePullRequest:
				'Connect to {provider} to enable the display of the Pull Request (if any) that introduced this commit',
			copySha: 'Copy SHA',
			explain: 'Explain',
			explainChanges: 'Explain Changes',
			inspectCommitDetails: 'Inspect Commit Details',
			openBlamePriorToThisChange: 'Open Blame Prior to this Change',
			openChangesWithPreviousRevision: 'Open Changes with Previous Revision',
			openCommitOnProvider: 'Open Commit on {provider}',
			openInCommitGraph: 'Open in Commit Graph',
			openPullRequestEllipsis: 'Open Pull Request #{id}...',
			openPullRequestOnProvider: 'Open Pull Request #{id} on {provider}',
			remote: 'Remote',
			revealInSideBar: 'Reveal in Side Bar',
			searchingForPullRequest: 'Searching for a Pull Request (if any) that introduced this commit...',
			showMoreActions: 'Show More Actions',
			showTeamActions: 'Show Team Actions',
		}),
		createEntries('commitFormatter.link', {
			stash: 'Stash',
			stashNumber: 'Stash #{stashNumber}',
			workingTree: 'Working Tree',
		}),
		createEntries('commitFormatter.message', {
			mergeChanges: 'Merge changes',
			stagedChanges: 'Staged changes',
			uncommittedChanges: 'Uncommitted changes',
		}),
		createEntries('commitFormatter.pullRequest.state', {
			closed: 'closed',
			merged: 'merged',
			opened: 'opened',
		}),
		createEntries('commitFormatter.signature', {
			clickToVerifyInCommitDetails: 'Click to verify signature in Commit Details',
			signed: 'Signed',
		}),
	);
}

function createCommitQuickPickCatalog(): CommitDisplayCatalog {
	return mergeCatalogs(
		createCommitQuickPickActionCatalog(),
		createEntries('commitQuickPick.branch', {
			current: 'Current Branch',
		}),
		createEntries('commitQuickPick.description', {
			akaCheckout: 'aka checkout',
			commitMessageCopied: 'Commit Message copied to the clipboard',
			commitShaCopied: 'Commit SHA copied to the clipboard',
			stashMessageCopied: 'Stash Message copied to the clipboard',
			urlCopied: 'URL copied to the clipboard',
		}),
		createEntries('commitQuickPick.hint', {
			clickToSeeAllChangedFiles: 'Click to see all changed files',
			clickToSeeCommitActions: 'Click to see commit actions',
			clickToSeeStashActions: 'Click to see stash actions',
		}),
		createEntries('commitQuickPick.remoteResource', {
			branch: 'Branch',
			branches: 'Branches',
			commit: 'Commit',
			comparison: 'Comparison',
			createPullRequest: 'Create Pull Request',
			file: 'File',
			repository: 'Repository',
		}),
		createEntries('commitQuickPick.separator', {
			actions: 'Actions',
			browse: 'Browse',
			compare: 'Compare',
			copy: 'Copy',
			files: 'Files',
			open: 'Open',
		}),
		createEntries('commitQuickPick.stats', {
			addition: '{count} addition',
			additions: '{count} additions',
			deletion: '{count} deletion',
			deletions: '{count} deletions',
			fileAdded: '{count} file added',
			fileChanged: '{count} file changed',
			fileDeleted: '{count} file deleted',
			filesAdded: '{count} files added',
			filesChanged: '{count} files changed',
			filesDeleted: '{count} files deleted',
			lineAdded: '{count} line added',
			lineDeleted: '{count} line deleted',
			linesAdded: '{count} lines added',
			linesDeleted: '{count} lines deleted',
			noFilesChanged: 'No files changed',
		}),
	);
}

function createCommitQuickPickActionCatalog(): CommitDisplayCatalog {
	return mergeCatalogs(
		createEntries('commitQuickPick.action', {
			applyChanges: 'Apply Changes',
			copyMessage: 'Copy Message',
			copySha: 'Copy SHA',
			explainChanges: 'Explain Changes',
			openInCommitGraph: 'Open in Commit Graph',
			openInspectCommitDetails: 'Inspect Commit Details',
			restore: 'Restore',
		}),
		createEntries('commitQuickPick.action', {
			browseRepositoryFromBeforeHere: 'Browse Repository from Before Here',
			browseRepositoryFromBeforeHereInNewWindow: 'Browse Repository from Before Here in New Window',
			browseRepositoryFromHere: 'Browse Repository from Here',
			browseRepositoryFromHereInNewWindow: 'Browse Repository from Here in New Window',
		}),
		createEntries('commitQuickPick.action', {
			compareWithHead: 'Compare with HEAD',
			compareWithWorkingTree: 'Compare with Working Tree',
			openChanges: 'Open Changes',
			openChangesDifftool: 'Open Changes (difftool)',
			openChangesWithWorkingFile: 'Open Changes with Working File',
			openDirectoryCompare: 'Open Directory Compare',
			openDirectoryCompareWithWorkingTree: 'Open Directory Compare with Working Tree',
		}),
		createEntries('commitQuickPick.action', {
			copyRemoteResourceForProvider: 'Copy Link to {resource} for {provider}{ellipsis}',
			openRemoteResourceOnProvider: 'Open {resource} on {provider}{ellipsis}',
		}),
		createEntries('commitQuickPick.action', {
			cherryPickCommit: 'Cherry Pick Commit...',
			createBranchAtCommit: 'Create Branch at Commit...',
			createTagAtCommit: 'Create Tag at Commit...',
			pushToCommit: 'Push to Commit...',
			rebaseBranchOntoCommit: 'Rebase {branch} onto Commit...',
			resetBranchToCommit: 'Reset {branch} to Commit...',
			resetBranchToPreviousCommit: 'Reset {branch} to Previous Commit...',
			revertCommit: 'Revert Commit...',
			switchToCommit: 'Switch to Commit...',
		}),
		createEntries('commitQuickPick.action', {
			openAllChangedFiles: 'Open All Changed Files',
			openAllChanges: 'Open All Changes',
			openAllChangesDifftool: 'Open All Changes (difftool)',
			openAllChangesWithWorkingTree: 'Open All Changes with Working Tree',
			openChangedAndCloseUnchangedFiles: 'Open Changed & Close Unchanged Files',
			openFile: 'Open File',
			openFileAtRevision: 'Open File at Revision',
			openFiles: 'Open Files',
			openFilesAtRevision: 'Open Files at Revision',
		}),
		createEntries('commitQuickPick.action', {
			applyStash: 'Apply Stash...',
			dropStash: 'Drop Stash...',
			renameStash: 'Rename Stash...',
		}),
	);
}

function createEntries(prefix: string, entries: CommitDisplayLeafEntries): CommitDisplayCatalog {
	return Object.fromEntries(Object.entries(entries).map(([key, value]) => [`${prefix}.${key}`, value]));
}

function mergeCatalogs(...catalogs: CommitDisplayCatalog[]): CommitDisplayCatalog {
	return Object.assign(Object.create(null) as CommitDisplayCatalog, ...catalogs);
}

function sortCatalog(catalog: CommitDisplayCatalog): CommitDisplayCatalog {
	return Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b))) as CommitDisplayCatalog;
}
