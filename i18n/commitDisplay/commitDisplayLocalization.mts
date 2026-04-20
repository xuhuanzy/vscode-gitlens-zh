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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, '..', '..');
export const commitDisplayCatalogDir = path.join(rootDir, 'src', 'i18n', 'commitDisplay');
export const commitDisplayNlsPath = path.join(commitDisplayCatalogDir, 'commitDisplay.nls.json');
export const commitDisplayNlsZhCnPath = path.join(commitDisplayCatalogDir, 'commitDisplay.nls.zh-cn.json');

export const commitDisplayLocalizationEntries = {
	'commitFormatter.author.emailTitle': 'Email {name} ({email})',
	'commitFormatter.commands.connectToProviderEllipsis': 'Connect to {provider}…',
	'commitFormatter.commands.connectToProviderToEnablePullRequest':
		'Connect to {provider} to enable the display of the Pull Request (if any) that introduced this commit',
	'commitFormatter.commands.copySha': 'Copy SHA',
	'commitFormatter.commands.explain': 'Explain',
	'commitFormatter.commands.explainChanges': 'Explain Changes',
	'commitFormatter.commands.inspectCommitDetails': 'Inspect Commit Details',
	'commitFormatter.commands.openBlamePriorToThisChange': 'Open Blame Prior to this Change',
	'commitFormatter.commands.openChangesWithPreviousRevision': 'Open Changes with Previous Revision',
	'commitFormatter.commands.openCommitOnProvider': 'Open Commit on {provider}',
	'commitFormatter.commands.openInCommitGraph': 'Open in Commit Graph',
	'commitFormatter.commands.openPullRequestEllipsis': 'Open Pull Request #{id}...',
	'commitFormatter.commands.openPullRequestOnProvider': 'Open Pull Request #{id} on {provider}',
	'commitFormatter.commands.remote': 'Remote',
	'commitFormatter.commands.revealInSideBar': 'Reveal in Side Bar',
	'commitFormatter.commands.searchingForPullRequest':
		'Searching for a Pull Request (if any) that introduced this commit...',
	'commitFormatter.commands.showMoreActions': 'Show More Actions',
	'commitFormatter.commands.showTeamActions': 'Show Team Actions',
	'commitFormatter.link.stash': 'Stash',
	'commitFormatter.link.stashNumber': 'Stash #{stashNumber}',
	'commitFormatter.link.workingTree': 'Working Tree',
	'commitFormatter.message.mergeChanges': 'Merge changes',
	'commitFormatter.message.stagedChanges': 'Staged changes',
	'commitFormatter.message.uncommittedChanges': 'Uncommitted changes',
	'commitFormatter.pullRequest.state.closed': 'closed',
	'commitFormatter.pullRequest.state.merged': 'merged',
	'commitFormatter.pullRequest.state.opened': 'opened',
	'commitFormatter.signature.clickToVerifyInCommitDetails': 'Click to verify signature in Commit Details',
	'commitFormatter.signature.signed': 'Signed',
	'commitQuickPick.action.applyChanges': 'Apply Changes',
	'commitQuickPick.action.applyStash': 'Apply Stash...',
	'commitQuickPick.action.browseRepositoryFromBeforeHere': 'Browse Repository from Before Here',
	'commitQuickPick.action.browseRepositoryFromBeforeHereInNewWindow':
		'Browse Repository from Before Here in New Window',
	'commitQuickPick.action.browseRepositoryFromHere': 'Browse Repository from Here',
	'commitQuickPick.action.browseRepositoryFromHereInNewWindow': 'Browse Repository from Here in New Window',
	'commitQuickPick.action.cherryPickCommit': 'Cherry Pick Commit...',
	'commitQuickPick.action.compareWithHead': 'Compare with HEAD',
	'commitQuickPick.action.compareWithWorkingTree': 'Compare with Working Tree',
	'commitQuickPick.action.copyMessage': 'Copy Message',
	'commitQuickPick.action.copyRemoteResourceForProvider': 'Copy Link to {resource} for {provider}{ellipsis}',
	'commitQuickPick.action.copySha': 'Copy SHA',
	'commitQuickPick.action.createBranchAtCommit': 'Create Branch at Commit...',
	'commitQuickPick.action.createTagAtCommit': 'Create Tag at Commit...',
	'commitQuickPick.action.dropStash': 'Drop Stash...',
	'commitQuickPick.action.explainChanges': 'Explain Changes',
	'commitQuickPick.action.openAllChangedFiles': 'Open All Changed Files',
	'commitQuickPick.action.openAllChanges': 'Open All Changes',
	'commitQuickPick.action.openAllChangesDifftool': 'Open All Changes (difftool)',
	'commitQuickPick.action.openAllChangesWithWorkingTree': 'Open All Changes with Working Tree',
	'commitQuickPick.action.openChangedAndCloseUnchangedFiles': 'Open Changed & Close Unchanged Files',
	'commitQuickPick.action.openChanges': 'Open Changes',
	'commitQuickPick.action.openChangesDifftool': 'Open Changes (difftool)',
	'commitQuickPick.action.openChangesWithWorkingFile': 'Open Changes with Working File',
	'commitQuickPick.action.openDirectoryCompare': 'Open Directory Compare',
	'commitQuickPick.action.openDirectoryCompareWithWorkingTree': 'Open Directory Compare with Working Tree',
	'commitQuickPick.action.openFile': 'Open File',
	'commitQuickPick.action.openFileAtRevision': 'Open File at Revision',
	'commitQuickPick.action.openFiles': 'Open Files',
	'commitQuickPick.action.openFilesAtRevision': 'Open Files at Revision',
	'commitQuickPick.action.openInCommitGraph': 'Open in Commit Graph',
	'commitQuickPick.action.openInspectCommitDetails': 'Inspect Commit Details',
	'commitQuickPick.action.openRemoteResourceOnProvider': 'Open {resource} on {provider}{ellipsis}',
	'commitQuickPick.action.pushToCommit': 'Push to Commit...',
	'commitQuickPick.action.rebaseBranchOntoCommit': 'Rebase {branch} onto Commit...',
	'commitQuickPick.action.renameStash': 'Rename Stash...',
	'commitQuickPick.action.resetBranchToCommit': 'Reset {branch} to Commit...',
	'commitQuickPick.action.resetBranchToPreviousCommit': 'Reset {branch} to Previous Commit...',
	'commitQuickPick.action.restore': 'Restore',
	'commitQuickPick.action.revertCommit': 'Revert Commit...',
	'commitQuickPick.action.switchToCommit': 'Switch to Commit...',
	'commitQuickPick.branch.current': 'Current Branch',
	'commitQuickPick.description.akaCheckout': 'aka checkout',
	'commitQuickPick.description.commitMessageCopied': 'Commit Message copied to the clipboard',
	'commitQuickPick.description.commitShaCopied': 'Commit SHA copied to the clipboard',
	'commitQuickPick.description.stashMessageCopied': 'Stash Message copied to the clipboard',
	'commitQuickPick.description.urlCopied': 'URL copied to the clipboard',
	'commitQuickPick.hint.clickToSeeAllChangedFiles': 'Click to see all changed files',
	'commitQuickPick.hint.clickToSeeCommitActions': 'Click to see commit actions',
	'commitQuickPick.hint.clickToSeeStashActions': 'Click to see stash actions',
	'commitQuickPick.remoteResource.branch': 'Branch',
	'commitQuickPick.remoteResource.branches': 'Branches',
	'commitQuickPick.remoteResource.commit': 'Commit',
	'commitQuickPick.remoteResource.comparison': 'Comparison',
	'commitQuickPick.remoteResource.createPullRequest': 'Create Pull Request',
	'commitQuickPick.remoteResource.file': 'File',
	'commitQuickPick.remoteResource.repository': 'Repository',
	'commitQuickPick.separator.actions': 'Actions',
	'commitQuickPick.separator.browse': 'Browse',
	'commitQuickPick.separator.compare': 'Compare',
	'commitQuickPick.separator.copy': 'Copy',
	'commitQuickPick.separator.files': 'Files',
	'commitQuickPick.separator.open': 'Open',
	'commitQuickPick.stats.addition': '{count} addition',
	'commitQuickPick.stats.additions': '{count} additions',
	'commitQuickPick.stats.deletion': '{count} deletion',
	'commitQuickPick.stats.deletions': '{count} deletions',
	'commitQuickPick.stats.fileAdded': '{count} file added',
	'commitQuickPick.stats.fileChanged': '{count} file changed',
	'commitQuickPick.stats.fileDeleted': '{count} file deleted',
	'commitQuickPick.stats.filesAdded': '{count} files added',
	'commitQuickPick.stats.filesChanged': '{count} files changed',
	'commitQuickPick.stats.filesDeleted': '{count} files deleted',
	'commitQuickPick.stats.lineAdded': '{count} line added',
	'commitQuickPick.stats.lineDeleted': '{count} line deleted',
	'commitQuickPick.stats.linesAdded': '{count} lines added',
	'commitQuickPick.stats.linesDeleted': '{count} lines deleted',
	'commitQuickPick.stats.noFilesChanged': 'No files changed',
} as const satisfies CommitDisplayCatalog;

export function buildCommitDisplayCatalog(): CommitDisplayCatalog {
	return Object.fromEntries(Object.entries(commitDisplayLocalizationEntries).sort(([a], [b]) => a.localeCompare(b)));
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
