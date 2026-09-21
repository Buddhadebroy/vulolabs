/* global appLocalizer */

/**
 * Formats a raw date string using this site's own Settings → General →
 * Date Format (`appLocalizer.date_format_js`, already translated into
 * zyra's token syntax by FrontendScripts::convert_date_format_to_js()).
 *
 * `@zyra/table`'s own TableCard renders `type: 'date'` columns with this
 * exact token-replace algorithm internally once given a `format` prop —
 * this duplicates just that piece for the handful of places that show a
 * date outside a TableCard (a ListComponent `value`, a hand-built
 * `<table>`), since zyra doesn't export its cell renderer as a standalone
 * utility.
 *
 * @param value Raw date string (e.g. a MySQL datetime), or null/undefined.
 * @return Formatted date string, or '' if value is empty/unparseable.
 */
/**
 * A raw value with no explicit UTC/offset marker (a plain MySQL
 * `Y-m-d H:i:s`, or the same with a `T` separator) — every such value this
 * plugin's own REST layer ever returns is UTC (`current_time( 'mysql', true )`,
 * confirmed across ScanPersistenceListener.php/BackupManager.php/
 * AutomationScheduler.php), so it's parsed explicitly as UTC here rather
 * than left to the browser's own `Date` parser, which treats a
 * space-separated "Y-m-d H:i:s" string as *local* time instead (silently
 * disagreeing with this site's own Settings → General → Timezone for any
 * admin not physically in that same zone). A value that already carries
 * its own explicit marker (`Z`, or a `+HH:MM`/`-HH:MM` offset) is trusted
 * as-is — already an unambiguous absolute instant.
 */
const UTC_MARKER = /(?:[Zz]|[+-]\d{2}:?\d{2})$/;

const parseAsUtc = (value: string): Date => {
	const trimmed = value.trim();

	if (UTC_MARKER.test(trimmed)) {
		return new Date(trimmed);
	}

	return new Date(`${trimmed.replace(' ', 'T')}Z`);
};

/**
 * Shared by `formatWpDate`/`formatWpTime` below — same token-replace
 * algorithm either way, just a different real format string (Settings →
 * General → Date Format vs. Time Format) and fallback. Shifts the parsed
 * UTC instant by this site's own configured Settings → General → Timezone
 * offset (`appLocalizer.gmt_offset_minutes`) and reads every token off
 * that shifted instant's *UTC* fields — not its local ones — so the
 * result reflects this site's configured timezone specifically, never the
 * viewing browser's own local zone (which is what plain `Date` getters/
 * `toLocaleString()` would otherwise silently substitute).
 */
const formatWithTokens = (
	value: string,
	format: string,
	offsetMinutes: number = appLocalizer.gmt_offset_minutes ?? 0
): string => {
	const utcDate = parseAsUtc(value);

	if (isNaN(utcDate.getTime())) {
		return value;
	}

	const siteLocal = new Date(utcDate.getTime() + offsetMinutes * 60000);

	const map: Record<string, string> = {
		YYYY: String(siteLocal.getUTCFullYear()),
		YY: String(siteLocal.getUTCFullYear()).slice(-2),
		MMMM: siteLocal.toLocaleString(undefined, { month: 'long', timeZone: 'UTC' }),
		MMM: siteLocal.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' }),
		MM: String(siteLocal.getUTCMonth() + 1).padStart(2, '0'),
		DD: String(siteLocal.getUTCDate()).padStart(2, '0'),
		D: String(siteLocal.getUTCDate()),
		HH: String(siteLocal.getUTCHours()).padStart(2, '0'),
		mm: String(siteLocal.getUTCMinutes()).padStart(2, '0'),
		ss: String(siteLocal.getUTCSeconds()).padStart(2, '0'),
	};

	return format.replace(
		/YYYY|YY|MMMM|MMM|MM|DD|D|HH|mm|ss/g,
		(token) => map[token] ?? token
	);
};

export const formatWpDate = (value?: string | null): string => {
	if (!value) {
		return '';
	}

	return formatWithTokens(value, appLocalizer.date_format_js || 'YYYY-MM-DD');
};

/**
 * Same Settings → General → Date Format, for a calendar-day-only value
 * (`Y-m-d`, e.g. a daily snapshot's `snapshot_date` or a chart's x-axis
 * `date`). Unlike `formatWpDate`, no timezone shift is applied: a date with
 * no time is already the site's own calendar day, and shifting it by the
 * site's offset could land it on the neighbouring day.
 */
export const formatWpDay = (value?: string | null): string => {
	if (!value) {
		return '';
	}

	return formatWithTokens(
		value.slice(0, 10),
		appLocalizer.date_format_js || 'YYYY-MM-DD',
		0
	);
};

/**
 * Real Settings → General → Time Format (`appLocalizer.time_format_js`,
 * converted server-side by the same `FrontendScripts::convert_date_format_to_js()`
 * `date_format_js` already uses) — for anywhere a row needs just the real
 * configured time, not the full date (HistoryTimeline.tsx's own per-row
 * `rowTime()`, previously a hardcoded `toLocaleTimeString()` that ignored
 * this site's own Time Format setting entirely).
 */
export const formatWpTime = (value?: string | null): string => {
	if (!value) {
		return '';
	}

	return formatWithTokens(value, appLocalizer.time_format_js || 'HH:mm');
};

/**
 * This site's own current wall-clock date/time (Settings → General →
 * Timezone), for comparisons like "is this timestamp today" — plain
 * `new Date()` reads the *browser's* local date, which can genuinely be a
 * different calendar day than this site's configured timezone right around
 * midnight in either zone.
 */
export const wpNow = (): Date =>
	new Date(Date.now() + (appLocalizer.gmt_offset_minutes ?? 0) * 60000);

/**
 * Same-day comparison against `wpNow()` above, both read via UTC getters —
 * `toDateString()` (used by every "Today, …" call site before this) reads
 * the browser's own local calendar date instead, which can disagree with
 * this site's configured timezone the same way raw `Date` getters do
 * elsewhere in this file.
 */
export const isWpToday = (value: string): boolean => {
	const utcDate = parseAsUtc(value);

	if (isNaN(utcDate.getTime())) {
		return false;
	}

	const siteLocal = new Date(
		utcDate.getTime() + (appLocalizer.gmt_offset_minutes ?? 0) * 60000
	);
	const now = wpNow();

	return (
		siteLocal.getUTCFullYear() === now.getUTCFullYear() &&
		siteLocal.getUTCMonth() === now.getUTCMonth() &&
		siteLocal.getUTCDate() === now.getUTCDate()
	);
};
