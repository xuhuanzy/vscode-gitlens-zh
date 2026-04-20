import type { PullRequestState } from '@gitlens/git/models/pullRequest.js';
import { localizeCommitDisplayString } from './commitDisplayLocalization.js';

const quoteRegex = /"/g;
const hashRegex = /#/g;

export function escapeMarkdownLinkTitle(title: string, options?: { escapeHashes?: boolean }): string {
	const escapedTitle = options?.escapeHashes ? title.replace(hashRegex, '\\#') : title;
	return escapedTitle.replace(quoteRegex, '\\"');
}

export function localizeCommitFormatterCommandMarkdown(commands: string): string {
	let localized = commands;

	localized = localizeExactMarkdownLinkTitles(localized);

	localized = localized.replace(
		new RegExp(`\\$\\(sparkle\\) ${escapeRegExp('Explain')}(?=\\])`, 'g'),
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
		/"Open Pull Request \\#([^\n"]+?)(?: on ([^\n"]+)|\.\.\.)\n——\n([^\n]*)\n([^,\n]*), ([^"]*)"/g,
		(_, id: string, provider: string | undefined, title: string, state: string, date: string) => {
			const openTitle = getCommitFormatterOpenPullRequestTitle(id, provider);
			return `"${escapeMarkdownLinkTitle(openTitle, { escapeHashes: true })}\n——\n${title}\n${getCommitFormatterPullRequestStateLabel(
				state,
			)}, ${date}"`;
		},
	);

	return localized;
}

function localizeExactMarkdownLinkTitles(value: string): string {
	return value.replace(/"((?:\\.|[^"\\])*)"/g, (match, rawTitle: string) => {
		const title = rawTitle.replace(/\\"/g, '"');
		const localized = localizeCommitDisplayString(title);
		if (localized === title) return match;

		return `"${escapeMarkdownLinkTitle(localized)}"`;
	});
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getAuthorEmailTitle(name: string, email: string): string {
	return localizeCommitDisplayString('Email {name} ({email})', { email: email, name: name });
}

export function getCommitFormatterConnectToProviderLabel(provider: string): string {
	return localizeCommitDisplayString('Connect to {provider}…', { provider: provider });
}

export function getCommitFormatterConnectToProviderTitle(provider: string): string {
	return localizeCommitDisplayString(
		'Connect to {provider} to enable the display of the Pull Request (if any) that introduced this commit',
		{
			provider: provider,
		},
	);
}

export function getCommitFormatterCopyShaTitle(): string {
	return localizeCommitDisplayString('Copy SHA');
}

export function getCommitFormatterExplainChangesTitle(): string {
	return localizeCommitDisplayString('Explain Changes');
}

export function getCommitFormatterExplainLabel(): string {
	return localizeCommitDisplayString('Explain');
}

export function getCommitFormatterInspectCommitDetailsTitle(): string {
	return localizeCommitDisplayString('Inspect Commit Details');
}

export function getCommitFormatterMessageLabel(conflicted: boolean, staged: boolean): string {
	if (conflicted) return localizeCommitDisplayString('Merge changes');
	if (staged) return localizeCommitDisplayString('Staged changes');

	return localizeCommitDisplayString('Uncommitted changes');
}

export function getCommitFormatterOpenBlamePriorToThisChangeTitle(): string {
	return localizeCommitDisplayString('Open Blame Prior to this Change');
}

export function getCommitFormatterOpenChangesWithPreviousRevisionTitle(): string {
	return localizeCommitDisplayString('Open Changes with Previous Revision');
}

export function getCommitFormatterOpenCommitOnProviderTitle(provider: string): string {
	return localizeCommitDisplayString('Open Commit on {provider}', { provider: provider });
}

export function getCommitFormatterOpenInCommitGraphTitle(): string {
	return localizeCommitDisplayString('Open in Commit Graph');
}

export function getCommitFormatterOpenPullRequestTitle(id: string, provider?: string): string {
	return provider != null
		? localizeCommitDisplayString('Open Pull Request #{id} on {provider}', {
				id: id,
				provider: provider,
			})
		: localizeCommitDisplayString('Open Pull Request #{id}...', { id: id });
}

export function getCommitFormatterPullRequestPendingTitle(): string {
	return localizeCommitDisplayString('Searching for a Pull Request (if any) that introduced this commit...');
}

export function getCommitFormatterPullRequestStateLabel(state: PullRequestState | string | undefined): string {
	switch (state) {
		case 'closed':
			return localizeCommitDisplayString('closed');
		case 'merged':
			return localizeCommitDisplayString('merged');
		case 'opened':
			return localizeCommitDisplayString('opened');
		default:
			return state ?? '';
	}
}

export function getCommitFormatterRemoteName(): string {
	return localizeCommitDisplayString('Remote');
}

export function getCommitFormatterRevealInSideBarTitle(): string {
	return localizeCommitDisplayString('Reveal in Side Bar');
}

export function getCommitFormatterShowMoreActionsTitle(): string {
	return localizeCommitDisplayString('Show More Actions');
}

export function getCommitFormatterShowTeamActionsTitle(): string {
	return localizeCommitDisplayString('Show Team Actions');
}

export function getCommitFormatterSignatureTooltip(): string {
	return `${localizeCommitDisplayString('Signed')}\n${localizeCommitDisplayString('Click to verify signature in Commit Details')}`;
}

export function getCommitFormatterStashLabel(stashNumber?: string): string {
	return stashNumber != null
		? localizeCommitDisplayString('Stash #{stashNumber}', { stashNumber: stashNumber })
		: localizeCommitDisplayString('Stash');
}

export function getCommitFormatterWorkingTreeLabel(): string {
	return localizeCommitDisplayString('Working Tree');
}
