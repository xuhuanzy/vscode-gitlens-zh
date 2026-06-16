import * as assert from 'assert';
import type { TimelineDatum } from '../../../../../../plus/timeline/protocol.js';
import type { BubbleMetrics } from '../timelineData.js';
import { bubbleRadius, buildViewModel, chooseBinUnit, computeBubbleMetrics } from '../timelineData.js';

const day = (offset: number, overrides: Partial<TimelineDatum> = {}): TimelineDatum => ({
	sha: overrides.sha ?? `sha${offset}`,
	author: overrides.author ?? 'Alice',
	date: new Date(Date.UTC(2026, 0, 1 + offset)).toISOString(),
	message: overrides.message ?? `msg ${offset}`,
	files: overrides.files,
	additions: overrides.additions,
	deletions: overrides.deletions,
	branches: overrides.branches,
	// Mirror what production producers do — `sort` is the parsed ms timestamp, same value as
	// `date`. `expandRows` reads `commit.sort` directly to avoid per-row Date parsing, so the
	// helper must produce a real ms value (not a small ordering integer) or day-binning collapses.
	sort: Date.UTC(2026, 0, 1 + offset),
});

suite('timelineData Test Suite', () => {
	suite('computeBubbleMetrics', () => {
		test('returns zero for empty dataset', () => {
			const m = computeBubbleMetrics([]);
			assert.strictEqual(m.p99, 0);
			assert.strictEqual(m.max, 0);
		});

		test('returns zero when every commit is empty', () => {
			const m = computeBubbleMetrics([day(0, { additions: 0, deletions: 0 }), day(1)]);
			assert.strictEqual(m.p99, 0);
			assert.strictEqual(m.max, 0);
		});

		test('p99 shields against a single huge outlier', () => {
			// 99 small commits + one giant. p99 should track the body of the data, not the outlier.
			const dataset: TimelineDatum[] = [];
			for (let i = 0; i < 99; i++) {
				dataset.push(day(i, { additions: 10, deletions: 0 }));
			}
			dataset.push(day(99, { additions: 100_000, deletions: 0 }));
			const m = computeBubbleMetrics(dataset);
			assert.strictEqual(m.max, 100_000);
			assert.ok(m.p99 < 1000, `expected p99 close to body of data, got ${m.p99}`);
		});

		test('p99 ≈ max on smooth distributions', () => {
			const dataset = [10, 20, 30, 40, 50].map((n, i) => day(i, { additions: n, deletions: 0 }));
			const m = computeBubbleMetrics(dataset);
			assert.strictEqual(m.max, 50);
			assert.ok(m.p99 >= 40, `p99 should sit near the max for smooth data, got ${m.p99}`);
		});

		test('zero-total entries do not collapse p99 on sparse datasets', () => {
			// Regression: 1 real commit + the empty Working-Tree placeholder used to land p99 on
			// the zero entry (Math.floor((2-1) * 0.99) = 0), short-circuiting bubbleMagnitude to
			// 0 and rendering every real bubble at radiusMin.
			const placeholder = day(0, { sha: '', additions: 0, deletions: 0 });
			const real = day(1, { additions: 60, deletions: 0 });
			const m = computeBubbleMetrics([placeholder, real]);
			assert.strictEqual(m.max, 60);
			assert.strictEqual(m.p99, 60, `p99 should track the real commit's magnitude, got ${m.p99}`);
		});
	});

	suite('bubbleRadius', () => {
		const metrics: BubbleMetrics = { p99: 1000, max: 100_000 };

		test('returns radiusMin for zero-change commits', () => {
			assert.strictEqual(bubbleRadius(0, 0, metrics, 4, 50), 4);
			assert.strictEqual(bubbleRadius(undefined, undefined, metrics, 4, 50), 4);
		});

		test('returns radiusMin when metrics are degenerate', () => {
			assert.strictEqual(bubbleRadius(100, 0, { p99: 0, max: 0 }, 4, 50), 4);
		});

		test('clamps to radiusMax even when total exceeds p99 (V1 cap)', () => {
			// A 100K-line commit with p99=1000 must not draw a 200px bubble.
			const r = bubbleRadius(100_000, 0, metrics, 4, 50);
			assert.ok(r <= 50, `expected ≤ 50, got ${r}`);
		});

		test('grows monotonically with change magnitude', () => {
			const small = bubbleRadius(10, 0, metrics, 4, 50);
			const medium = bubbleRadius(100, 0, metrics, 4, 50);
			const large = bubbleRadius(900, 0, metrics, 4, 50);
			assert.ok(small < medium && medium < large, `expected monotonic, got ${small} ${medium} ${large}`);
		});

		test('treats additions and deletions symmetrically', () => {
			const a = bubbleRadius(50, 50, metrics, 4, 50);
			const b = bubbleRadius(100, 0, metrics, 4, 50);
			assert.strictEqual(a, b);
		});

		test('respects a tighter radiusMax (V1: row-height-driven cap)', () => {
			// Caller passes a small radiusMax derived from the swimlane's row height — the bubble
			// must shrink accordingly even when the change magnitude is large.
			const tight = bubbleRadius(900, 0, metrics, 3, 12);
			assert.ok(tight <= 12, `expected ≤ 12, got ${tight}`);
		});

		test('uses magnitudeAnchorLines floor when p99 is small (sparse datasets)', () => {
			// Regression: with 3 commits sized [50, 100, 200], p99 = sums[1] = 100 — small enough
			// that without an anchor floor, log1p(200)/log1p(100) = 1.15 → clamped to 1.0 → max
			// bubble for what's actually a 200-line commit. Anchor at 500 prevents the runaway.
			const sparse: BubbleMetrics = { p99: 100, max: 200 };
			const r = bubbleRadius(200, 0, sparse, 4, 50);
			// log1p(200)/log1p(500) ≈ 5.30 / 6.22 ≈ 0.852 → 4 + (50-4) * 0.852 ≈ 43.2
			assert.ok(r < 50, `expected anchor to keep r below max (50), got ${r}`);
			assert.ok(r > 30, `expected anchor to keep r reasonably large (>30), got ${r}`);
		});

		test('p99 wins over anchor when dataset has substantial commits', () => {
			// Dense dataset: p99 = 2000 > 500 anchor → behavior unchanged from pre-anchor.
			// Verifies the anchor doesn't shrink bubbles in datasets where it shouldn't apply.
			const dense: BubbleMetrics = { p99: 2000, max: 5000 };
			const r2000 = bubbleRadius(2000, 0, dense, 4, 50);
			assert.strictEqual(r2000, 50, `2000-line commit at p99 should hit max, got ${r2000}`);
		});
	});

	suite('buildViewModel — slice grouping', () => {
		test('slices by author by default', () => {
			const dataset = [
				day(0, { author: 'Alice', additions: 5 }),
				day(1, { author: 'Bob', additions: 5 }),
				day(2, { author: 'Alice', additions: 5 }),
			];
			const vm = buildViewModel({
				dataset: dataset,
				sliceBy: 'author',
			});
			assert.strictEqual(vm.slices.length, 2);
			assert.strictEqual(vm.slices[0].name, 'Alice');
			assert.strictEqual(vm.slices[1].name, 'Bob');
			assert.strictEqual(vm.commits.length, 3);
		});

		test('preserves author insertion order so swimlanes are stable across renders', () => {
			const dataset = [
				day(0, { author: 'Charlie' }),
				day(1, { author: 'Alice' }),
				day(2, { author: 'Bob' }),
				day(3, { author: 'Alice' }),
			];
			const vm = buildViewModel({ dataset: dataset, sliceBy: 'author' });
			assert.deepStrictEqual(
				vm.slices.map(s => s.name),
				['Charlie', 'Alice', 'Bob'],
			);
		});

		test('expands a multi-branch commit into one row per branch', () => {
			const dataset = [day(0, { branches: ['main', 'develop'], additions: 10 })];
			const vm = buildViewModel({ dataset: dataset, sliceBy: 'branch' });
			assert.strictEqual(vm.slices.length, 2);
			assert.strictEqual(vm.commits.length, 2);
			assert.deepStrictEqual(vm.sliceIndex.toSorted(), new Uint16Array([0, 1]));
		});

		test('falls back to defaultBranch when branch slice has no branches', () => {
			const dataset = [day(0, {}), day(1, { branches: ['feature/foo'] })];
			const vm = buildViewModel({
				dataset: dataset,
				sliceBy: 'branch',
				defaultBranch: 'main',
			});
			const sliceNames = vm.slices.map(s => s.name).sort();
			assert.deepStrictEqual(sliceNames, ['feature/foo', 'main'].sort());
		});
	});

	suite('buildViewModel — packing', () => {
		test('produces non-decreasing timestamps so binary search hit-tests stay correct', () => {
			const dataset = [day(2), day(0), day(3), day(1)];
			const vm = buildViewModel({ dataset: dataset, sliceBy: 'author' });
			for (let i = 1; i < vm.timestamps.length; i++) {
				assert.ok(vm.timestamps[i - 1] <= vm.timestamps[i], `not sorted at index ${i}`);
			}
		});

		test('shaToIndex resolves each sha to a single index', () => {
			const dataset = [day(0, { sha: 'a', branches: ['main', 'develop'] }), day(1, { sha: 'b' })];
			const vm = buildViewModel({ dataset: dataset, sliceBy: 'branch' });
			assert.notStrictEqual(vm.shaToIndex.get('a'), undefined);
			assert.notStrictEqual(vm.shaToIndex.get('b'), undefined);
		});

		test('yMaxAdd / yMaxDel reflect the largest individual values', () => {
			const dataset = [
				day(0, { additions: 50, deletions: 5 }),
				day(1, { additions: 200, deletions: 10 }),
				day(2, { additions: 0, deletions: 80 }),
			];
			const vm = buildViewModel({ dataset: dataset, sliceBy: 'author' });
			assert.strictEqual(vm.yMaxAdd, 200);
			assert.strictEqual(vm.yMaxDel, 80);
		});
	});

	suite('buildViewModel — LOD binning (V3)', () => {
		test('day-binning collapses commits within a day into one bubble per slice', () => {
			const dataset = [
				day(0, { additions: 10, sha: 'a' }),
				day(0, { additions: 20, sha: 'b' }),
				day(0, { additions: 30, sha: 'c' }),
				day(2, { additions: 5, sha: 'd' }),
			];
			const vm = buildViewModel({
				dataset: dataset,
				sliceBy: 'author',

				binUnit: 'day',
			});
			// One slice (Alice), two days with commits → 2 rows.
			assert.strictEqual(vm.commits.length, 2);
			assert.notStrictEqual(vm.binCount, undefined);
			// First bin aggregates 3 commits, second has 1.
			assert.deepStrictEqual(vm.binCount!.toSorted(), new Uint16Array([1, 3]));
		});

		test('binned bubble shows the largest-change commit as the representative', () => {
			const dataset = [
				day(0, { additions: 10, sha: 'small' }),
				day(0, { additions: 999, sha: 'whale' }),
				day(0, { additions: 20, sha: 'medium' }),
			];
			const vm = buildViewModel({
				dataset: dataset,
				sliceBy: 'author',

				binUnit: 'day',
			});
			assert.strictEqual(vm.commits.length, 1);
			assert.strictEqual(vm.commits[0].sha, 'whale');
		});

		test('every sha in a bin maps to the same bin index', () => {
			const dataset = [day(0, { sha: 'a' }), day(0, { sha: 'b' }), day(0, { sha: 'c' })];
			const vm = buildViewModel({
				dataset: dataset,
				sliceBy: 'author',

				binUnit: 'day',
			});
			const idxA = vm.shaToIndex.get('a');
			assert.notStrictEqual(idxA, undefined);
			assert.strictEqual(vm.shaToIndex.get('b'), idxA);
			assert.strictEqual(vm.shaToIndex.get('c'), idxA);
		});

		test('aggregate additions/deletions sum across the bin', () => {
			const dataset = [day(0, { additions: 10, deletions: 5 }), day(0, { additions: 20, deletions: 15 })];
			const vm = buildViewModel({
				dataset: dataset,
				sliceBy: 'author',

				binUnit: 'day',
			});
			assert.strictEqual(vm.additions[0], 30);
			assert.strictEqual(vm.deletions[0], 20);
		});

		test('binned timestamps are non-decreasing even when a bin rep gets reassigned to a later commit', () => {
			// Two authors commit early in the same hour. Then Alice commits late in the same hour
			// with a huge changeset — the bin (hour, Alice) reassigns its representative to the
			// late commit. Now: bin (hour, Alice) has rep ts ≈ 0:55, bin (hour, Bob) has rep ts ≈
			// 0:05. Both bins share the same `binStart`, so a naive sort by `binStart` keeps map
			// insertion order — bin Alice was created first, so `vm.timestamps` ends up [0:55,
			// 0:05]: non-monotonic. The canvas drawer's `visibleIndexRange()` does a binary
			// search on `vm.timestamps`, so the wrong range is culled and Alice's bubble silently
			// disappears even though `shaToIndex` still resolves correctly — the symptom the user
			// reported was an empty selection ring with no underlying bubble.
			const baseHour = Date.UTC(2026, 0, 1, 12, 0, 0);
			const aliceSmallEarly: TimelineDatum = {
				sha: 'alice-small',
				author: 'Alice',
				date: new Date(baseHour + 5 * 60 * 1000).toISOString(),
				message: '',
				files: undefined,
				additions: 1,
				deletions: 0,
				sort: baseHour + 5 * 60 * 1000,
			};
			const bobSmall: TimelineDatum = {
				sha: 'bob-small',
				author: 'Bob',
				date: new Date(baseHour + 8 * 60 * 1000).toISOString(),
				message: '',
				files: undefined,
				additions: 1,
				deletions: 0,
				sort: baseHour + 8 * 60 * 1000,
			};
			const aliceHugeLate: TimelineDatum = {
				sha: 'alice-huge',
				author: 'Alice',
				date: new Date(baseHour + 55 * 60 * 1000).toISOString(),
				message: '',
				files: undefined,
				additions: 1000,
				deletions: 0,
				sort: baseHour + 55 * 60 * 1000,
			};
			const vm = buildViewModel({
				dataset: [aliceSmallEarly, bobSmall, aliceHugeLate],
				sliceBy: 'author',
				binUnit: 'hour',
			});
			for (let i = 1; i < vm.timestamps.length; i++) {
				assert.ok(
					vm.timestamps[i] >= vm.timestamps[i - 1],
					`timestamps must be non-decreasing for binary-search culling; got [${vm.timestamps[i - 1]}, ${vm.timestamps[i]}] at i=${i}`,
				);
			}
		});
	});

	suite('chooseBinUnit', () => {
		test('returns "none" when bubbles have room to breathe', () => {
			assert.strictEqual(chooseBinUnit(10), 'none');
			assert.strictEqual(chooseBinUnit(6), 'none');
		});

		test('escalates bin granularity as pxPerCommit shrinks', () => {
			assert.strictEqual(chooseBinUnit(2), 'hour');
			assert.strictEqual(chooseBinUnit(0.5), 'day');
			assert.strictEqual(chooseBinUnit(0.1), 'week');
			assert.strictEqual(chooseBinUnit(0.001), 'month');
		});
	});
});
