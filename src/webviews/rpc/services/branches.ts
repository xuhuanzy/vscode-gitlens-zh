/**
 * Branches service — per-branch enrichment operations for webviews.
 *
 * Provides branch-level enrichment (merge target status, associated issues,
 * branch autolinks) that any webview can reuse without re-implementing the
 * git-config + integration API plumbing.
 */

import type { GitBranch } from '@gitlens/git/models/branch.js';
import type { PullRequest } from '@gitlens/git/models/pullRequest.js';
import type { GitWorktree } from '@gitlens/git/models/worktree.js';
import type { Container } from '../../../container.js';
import {
	getAssociatedIssuesForBranch,
	removeAssociatedIssueFromBranch,
} from '../../../git/utils/-webview/branch.issue.utils.js';
import {
	getBranchAssociatedPullRequest,
	getBranchEnrichedAutolinks,
} from '../../../git/utils/-webview/branch.utils.js';
import { getReferenceFromBranch } from '../../../git/utils/-webview/reference.utils.js';
import { getWorktreesByBranch } from '../../../git/utils/-webview/worktree.utils.js';
import type {
	OverviewBranch,
	OverviewBranchIssue,
	OverviewBranchMergeTarget,
	OverviewBranchPullRequest,
} from '../../shared/overviewBranches.js';
import { toOverviewBranch } from '../../shared/overviewBranches.js';
import {
	getAutolinkIssuesInfo,
	getBranchMergeTargetStatusInfo,
	getPullRequestInfo,
} from '../../shared/overviewEnrichment.utils.js';

export interface BranchMergeTargetStatus {
	/** Shape compatible with gl-merge-target-status's `branch` prop. */
	branch: Pick<OverviewBranch, 'reference' | 'repoPath' | 'id' | 'name' | 'opened' | 'upstream' | 'worktree'>;
	mergeTarget: OverviewBranchMergeTarget | undefined;
}

/**
 * Combined branch enrichment payload. The outer Promise resolves once the host has
 * the branch and its `gl-merge-target-status`-shaped projection (cheap, single git
 * lookup); each field below is a separate wire-promise that settles on its own
 * roundtrip. Callers can `.then` each leg independently — autolinks (fast/local)
 * and issues (mostly cached) don't wait for the slower `mergeTargetStatus` leg
 * which can hit integration APIs.
 */
export interface BranchEnrichment {
	branch: Pick<OverviewBranch, 'reference' | 'repoPath' | 'id' | 'name' | 'opened' | 'upstream' | 'worktree'>;
	autolinks: Promise<OverviewBranchIssue[]>;
	issues: Promise<OverviewBranchIssue[]>;
	mergeTargetStatus: Promise<OverviewBranchMergeTarget | undefined>;
	pullRequest: Promise<OverviewBranchPullRequest | undefined>;
}

export class BranchesService {
	constructor(private readonly container: Container) {}

	/**
	 * Get branch enrichment with deferred legs. The host resolves the branch and its
	 * worktree-aware shape once, then returns three independent Promise legs; each
	 * settles on its own roundtrip so per-leg latency is preserved.
	 */
	async getBranchEnrichment(
		repoPath: string,
		branchName: string,
		signal?: AbortSignal,
	): Promise<BranchEnrichment | undefined> {
		signal?.throwIfAborted();
		const svc = this.container.git.getRepositoryService(repoPath);
		const branch = await svc.branches.getBranch(branchName, signal);
		signal?.throwIfAborted();
		if (branch == null) return undefined;

		const repo = this.container.git.getRepository(repoPath);
		const worktreesByBranch = repo != null ? await getWorktreesByBranch(repo) : new Map<string, GitWorktree>();
		signal?.throwIfAborted();
		const opened = branch.current || worktreesByBranch.get(branch.id)?.opened === true;
		const overview = toOverviewBranch(branch, worktreesByBranch, opened);

		// Shared associated-PR fetch so the merge-target and PR legs don't fire two
		// integration calls for the same branch.
		const associatedPR = getBranchAssociatedPullRequest(this.container, branch, { avatarSize: 64 });

		return {
			branch: {
				reference: overview.reference,
				repoPath: overview.repoPath,
				id: overview.id,
				name: overview.name,
				opened: overview.opened,
				upstream: overview.upstream,
				worktree: overview.worktree,
			},
			// Each leg fires immediately; Supertalk wire-serializes the Promises so they
			// settle independently on the consumer side. Signal forwards into each leg so
			// in-flight cancellation checks honor the same abort.
			autolinks: this.fetchAutolinksLeg(branch, signal),
			issues: this.fetchIssuesLeg(branch, signal),
			mergeTargetStatus: getBranchMergeTargetStatusInfo(this.container, branch, signal, associatedPR),
			pullRequest: this.fetchPullRequestLeg(branch, associatedPR, signal),
		};
	}

	/**
	 * Unassociate an issue from a branch by its stable identifier (Issue.nodeId).
	 * The association is persisted in git config; this removes its entry.
	 */
	async removeAssociatedIssue(repoPath: string, branchName: string, entityId: string): Promise<void> {
		const svc = this.container.git.getRepositoryService(repoPath);
		const branch = await svc.branches.getBranch(branchName);
		if (branch == null) return;

		await removeAssociatedIssueFromBranch(this.container, getReferenceFromBranch(branch), entityId);
	}

	private async fetchAutolinksLeg(branch: GitBranch, signal?: AbortSignal): Promise<OverviewBranchIssue[]> {
		const enriched = await getBranchEnrichedAutolinks(this.container, branch);
		signal?.throwIfAborted();
		return getAutolinkIssuesInfo(enriched);
	}

	private async fetchIssuesLeg(branch: GitBranch, signal?: AbortSignal): Promise<OverviewBranchIssue[]> {
		const result = await getAssociatedIssuesForBranch(this.container, branch);
		signal?.throwIfAborted();
		const issues = result.paused ? await result.value : result.value;
		signal?.throwIfAborted();
		return (
			issues?.map(i => ({
				type: 'issue' as const,
				id: i.number || i.id,
				title: i.title,
				state: i.state,
				url: i.url,
				entityId: i.nodeId,
			})) ?? []
		);
	}

	private async fetchPullRequestLeg(
		branch: GitBranch,
		associatedPullRequest: Promise<PullRequest | undefined>,
		signal?: AbortSignal,
	): Promise<OverviewBranchPullRequest | undefined> {
		const pr = await getPullRequestInfo(this.container, branch, undefined, associatedPullRequest);
		signal?.throwIfAborted();
		return pr;
	}
}
