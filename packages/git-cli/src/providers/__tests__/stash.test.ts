// Tests removed: `findOldestStashTimestamp` was deleted alongside the stash ancestry-filtering
// rewrite. `getStash({ reachableFrom })` now relies on `stashOnRef` metadata only and no longer
// needs the parent-timestamps fallback. This file should be `git rm`'d at commit time.
export {};
