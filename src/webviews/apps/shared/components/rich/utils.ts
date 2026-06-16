export type AutolinkIconType = 'autolink' | 'issue' | 'pr';
export type AutolinkIconStatus = 'opened' | 'closed' | 'merged';

export function getAutolinkIcon(
	type: AutolinkIconType = 'autolink',
	status: AutolinkIconStatus = 'merged',
	isDraft: boolean = false,
): { icon: string; modifier: string } {
	let icon;
	let modifier: string;
	switch (type) {
		case 'issue':
			modifier = status === 'closed' ? 'issue-closed' : 'issue-opened';
			icon = status === 'closed' ? 'pass' : 'issues';
			break;
		case 'pr':
			switch (status) {
				case 'merged':
					modifier = 'pr-merged';
					icon = 'git-merge';
					break;
				case 'closed':
					modifier = 'pr-closed';
					icon = 'git-pull-request-closed';
					break;
				case 'opened':
				default:
					modifier = isDraft ? 'pr-draft' : 'pr-opened';
					icon = isDraft ? 'git-pull-request-draft' : 'git-pull-request';
					break;
			}
			break;
		case 'autolink':
		default:
			modifier = '';
			icon = 'link';
			break;
	}

	return { icon: icon, modifier: modifier };
}
