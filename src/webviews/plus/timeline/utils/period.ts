import { createFromDateDelta } from '@gitlens/utils/date.js';
import type { TimelinePeriod } from '../protocol.js';

/** Resolve a `TimelinePeriod` to its earliest-included `Date`. Calendar-accurate (uses
 *  `createFromDateDelta`), so leap years and variable month lengths are handled correctly.
 *  Returns `undefined` for `'all'` (no upper bound on history). */
export function getPeriodDate(period: TimelinePeriod): Date | undefined {
	if (period === 'all') return undefined;

	const [number, unit] = period.split('|');

	let date;
	switch (unit) {
		case 'D':
			date = createFromDateDelta(new Date(), { days: -parseInt(number, 10) });
			break;
		case 'M':
			date = createFromDateDelta(new Date(), { months: -parseInt(number, 10) });
			break;
		case 'Y':
			date = createFromDateDelta(new Date(), { years: -parseInt(number, 10) });
			break;
		default:
			date = createFromDateDelta(new Date(), { months: -3 });
			break;
	}

	// If we are more than 1/2 way through the day, then set the date to the next day
	if (date.getHours() >= 12) {
		date.setDate(date.getDate() + 1);
	}
	date.setHours(0, 0, 0, 0);
	return date;
}

/** Calendar-accurate millisecond span for a `TimelinePeriod`. Returns `undefined` for `'all'`.
 *  Built on `getPeriodDate` so the windowed timeline's viewport math matches the host's fetch
 *  span exactly. Webview-safe (no vscode imports). */
export function periodToMs(period: TimelinePeriod): number | undefined {
	const date = getPeriodDate(period);
	return date != null ? Date.now() - date.getTime() : undefined;
}
