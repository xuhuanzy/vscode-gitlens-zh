import type { PullRequestState } from '@gitlens/git/models/pullRequest.js';
import { localizeCommitDisplayString } from '../../system/-webview/commitDisplayLocalization.js';

const quoteRegex = /"/g;
const hashRegex = /#/g;

export function escapeMarkdownLinkTitle(title: string, options?: { escapeHashes?: boolean }): string {
	const escapedTitle = options?.escapeHashes ? title.replace(hashRegex, '\\#') : title;
	return escapedTitle.replace(quoteRegex, '\\"');
}

export function localizeCommitFormatterCommandMarkdown(commands: string): string {
	let localized = commands;

	localized = replaceMarkdownLinkTitle(
		localized,
		'Inspect Commit Details',
		getCommitFormatterInspectCommitDetailsTitle(),
	);
	localized = replaceMarkdownLinkTitle(localized, 'Copy SHA', getCommitFormatterCopyShaTitle());
	localized = replaceMarkdownLinkTitle(
		localized,
		'Open Changes with Previous Revision',
		getCommitFormatterOpenChangesWithPreviousRevisionTitle(),
	);
	localized = replaceMarkdownLinkTitle(
		localized,
		'Open Blame Prior to this Change',
		getCommitFormatterOpenBlamePriorToThisChangeTitle(),
	);
	localized = replaceMarkdownLinkTitle(localized, 'Reveal in Side Bar', getCommitFormatterRevealInSideBarTitle());
	localized = replaceMarkdownLinkTitle(localized, 'Open in Commit Graph', getCommitFormatterOpenInCommitGraphTitle());
	localized = replaceMarkdownLinkTitle(localized, 'Explain Changes', getCommitFormatterExplainChangesTitle());
	localized = replaceMarkdownLinkTitle(localized, 'Show Team Actions', getCommitFormatterShowTeamActionsTitle());
	localized = replaceMarkdownLinkTitle(localized, 'Show More Actions', getCommitFormatterShowMoreActionsTitle());
	localized = replaceMarkdownLinkTitle(
		localized,
		'Searching for a Pull Request (if any) that introduced this commit...',
		getCommitFormatterPullRequestPendingTitle(),
	);

	localized = localized.replace(
		/\$\(sparkle\) Explain(?=\])/g,
		() => `$(sparkle) ${getCommitFormatterExplainLabel()}`,
	);
	localized = localized.replace(/\$\(plug\) Connect to ([^\]\n]+?)(?:…|\.\.\.)(?=\])/g, (_, provider: string) => {
		return `$(plug) ${getCommitFormatterConnectToProviderLabel(provider)}`;
	});
	localized = localized.replace(/"Open Commit on ([^"\n]+)"/g, (_, provider: string) => {
		return `"${escapeMarkdownLinkTitle(getCommitFormatterOpenCommitOnProviderTitle(provider))}"`;
	});
	localized = localized.replace(
		/"Connect to ([^"\n]+) to enable the display of the Pull Request \(if any\) that introduced this commit"/g,
		(_, provider: string) => {
			return `"${escapeMarkdownLinkTitle(getCommitFormatterConnectToProviderTitle(provider))}"`;
		},
	);
	localized = localized.replace(
		/"Open Pull Request \\\#([^\n"]+?)(?: on ([^\n"]+)|\.\.\.)\n——\n([^\n]*)\n([^,\n]*), ([^"]*)"/g,
		(_, id: string, provider: string | undefined, title: string, state: string, date: string) => {
			const openTitle = getCommitFormatterOpenPullRequestTitle(id, provider);
			return `"${escapeMarkdownLinkTitle(openTitle, { escapeHashes: true })}\n——\n${title}\n${getCommitFormatterPullRequestStateLabel(
				state,
			)}, ${date}"`;
		},
	);

	return localized;
}

function replaceMarkdownLinkTitle(value: string, english: string, localized: string): string {
	return value.replaceAll(`"${english}"`, `"${escapeMarkdownLinkTitle(localized)}"`);
}

export function getAuthorEmailTitle(name: string, email: string): string {
	return localizeCommitDisplayString('commitFormatter.author.emailTitle', { email: email, name: name });
}

export function getCommitFormatterConnectToProviderLabel(provider: string): string {
	return localizeCommitDisplayString('commitFormatter.commands.connectToProviderEllipsis', { provider: provider });
}

export function getCommitFormatterConnectToProviderTitle(provider: string): string {
	return localizeCommitDisplayString('commitFormatter.commands.connectToProviderToEnablePullRequest', {
		provider: provider,
	});
}

export function getCommitFormatterCopyShaTitle(): string {
	return localizeCommitDisplayString('commitFormatter.commands.copySha');
}

export function getCommitFormatterExplainChangesTitle(): string {
	return localizeCommitDisplayString('commitFormatter.commands.explainChanges');
}

export function getCommitFormatterExplainLabel(): string {
	return localizeCommitDisplayString('commitFormatter.commands.explain');
}

export function getCommitFormatterInspectCommitDetailsTitle(): string {
	return localizeCommitDisplayString('commitFormatter.commands.inspectCommitDetails');
}

export function getCommitFormatterMessageLabel(conflicted: boolean, staged: boolean): string {
	if (conflicted) return localizeCommitDisplayString('commitFormatter.message.mergeChanges');
	if (staged) return localizeCommitDisplayString('commitFormatter.message.stagedChanges');

	return localizeCommitDisplayString('commitFormatter.message.uncommittedChanges');
}

export function getCommitFormatterOpenBlamePriorToThisChangeTitle(): string {
	return localizeCommitDisplayString('commitFormatter.commands.openBlamePriorToThisChange');
}

export function getCommitFormatterOpenChangesWithPreviousRevisionTitle(): string {
	return localizeCommitDisplayString('commitFormatter.commands.openChangesWithPreviousRevision');
}

export function getCommitFormatterOpenCommitOnProviderTitle(provider: string): string {
	return localizeCommitDisplayString('commitFormatter.commands.openCommitOnProvider', { provider: provider });
}

export function getCommitFormatterOpenInCommitGraphTitle(): string {
	return localizeCommitDisplayString('commitFormatter.commands.openInCommitGraph');
}

export function getCommitFormatterOpenPullRequestTitle(id: string, provider?: string): string {
	return provider != null
		? localizeCommitDisplayString('commitFormatter.commands.openPullRequestOnProvider', {
				id: id,
				provider: provider,
			})
		: localizeCommitDisplayString('commitFormatter.commands.openPullRequestEllipsis', { id: id });
}

export function getCommitFormatterPullRequestPendingTitle(): string {
	return localizeCommitDisplayString('commitFormatter.commands.searchingForPullRequest');
}

export function getCommitFormatterPullRequestStateLabel(state: PullRequestState | string | undefined): string {
	switch (state) {
		case 'closed':
			return localizeCommitDisplayString('commitFormatter.pullRequest.state.closed');
		case 'merged':
			return localizeCommitDisplayString('commitFormatter.pullRequest.state.merged');
		case 'opened':
			return localizeCommitDisplayString('commitFormatter.pullRequest.state.opened');
		default:
			return state ?? '';
	}
}

export function getCommitFormatterRemoteName(): string {
	return localizeCommitDisplayString('commitFormatter.commands.remote');
}

export function getCommitFormatterRevealInSideBarTitle(): string {
	return localizeCommitDisplayString('commitFormatter.commands.revealInSideBar');
}

export function getCommitFormatterShowMoreActionsTitle(): string {
	return localizeCommitDisplayString('commitFormatter.commands.showMoreActions');
}

export function getCommitFormatterShowTeamActionsTitle(): string {
	return localizeCommitDisplayString('commitFormatter.commands.showTeamActions');
}

export function getCommitFormatterSignatureTooltip(): string {
	return `${localizeCommitDisplayString('commitFormatter.signature.signed')}\n${localizeCommitDisplayString('commitFormatter.signature.clickToVerifyInCommitDetails')}`;
}

export function getCommitFormatterStashLabel(stashNumber?: string): string {
	return stashNumber != null
		? localizeCommitDisplayString('commitFormatter.link.stashNumber', { stashNumber: stashNumber })
		: localizeCommitDisplayString('commitFormatter.link.stash');
}

export function getCommitFormatterWorkingTreeLabel(): string {
	return localizeCommitDisplayString('commitFormatter.link.workingTree');
}
