import type { Uri } from '@gitlens/utils/uri.js';
import type { GitBranch } from '../models/branch.js';
import type { GitReference, GitRefTip } from '../models/reference.js';
import type { GitTag } from '../models/tag.js';
import type { GitCommandPriority } from '../run.types.js';

export interface GitRefsSubProvider {
	checkIfCouldBeValidBranchOrTagName(repoPath: string, ref: string): Promise<boolean>;
	getMergeBase(
		repoPath: string,
		ref1: string,
		ref2: string,
		options?: { forkPoint?: boolean | undefined; priority?: GitCommandPriority },
		cancellation?: AbortSignal,
	): Promise<string | undefined>;
	getReference(repoPath: string, ref: string, cancellation?: AbortSignal): Promise<GitReference | undefined>;
	/**
	 * Lightweight enumeration of ref tips (heads/remotes/tags) — no enrichment.
	 * Use this when you need a SHA-to-refs map; use `getBranches`/`getTags` for full models.
	 */
	getRefTips(
		repoPath: string,
		options?: { include?: ReadonlyArray<'heads' | 'remotes' | 'tags'> },
		cancellation?: AbortSignal,
	): Promise<GitRefTip[]>;
	/**
	 * Batch reachability — for each input SHA, the refs whose tips contain it.
	 *
	 * One bounded `git rev-list --topo-order --parents --all ^<oldestSha>^@` walk; ref-set
	 * propagation runs in memory. Cost is O(walked subgraph), not O(N × refs) like the per-sha
	 * `getBranchesWithCommits([sha])` pattern. Pass the oldest SHA in your dataset to bound the walk.
	 */
	getRefsContainingShas(
		repoPath: string,
		shas: ReadonlySet<string> | readonly string[],
		oldestSha: string,
		options?: { include?: ReadonlyArray<'heads' | 'remotes' | 'tags'> },
		cancellation?: AbortSignal,
	): Promise<Map<string, GitRefTip[]>>;
	getSymbolicReferenceName?(
		repoPath: string,
		ref: string,
		options?: { priority?: GitCommandPriority },
		cancellation?: AbortSignal,
	): Promise<string | undefined>;
	hasBranchOrTag(
		repoPath: string | undefined,
		options?: {
			filter?:
				| { branches?: ((b: GitBranch) => boolean) | undefined; tags?: ((t: GitTag) => boolean) | undefined }
				| undefined;
		},
		cancellation?: AbortSignal,
	): Promise<boolean>;
	isValidReference(
		repoPath: string,
		ref: string,
		pathOrUri?: string | Uri,
		cancellation?: AbortSignal,
	): Promise<boolean>;
	validateReference(
		repoPath: string,
		ref: string,
		relativePath?: string,
		cancellation?: AbortSignal,
	): Promise<string | undefined>;
	updateReference(repoPath: string, ref: string, newRef: string, cancellation?: AbortSignal): Promise<void>;
}
