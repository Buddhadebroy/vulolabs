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
/** Shared by `formatWpDate`/`formatWpTime` below — same token-replace algorithm either way, just a different real format string (Settings → General → Date Format vs. Time Format) and fallback. */
const formatWithTokens = (
	value: string,
	format: string
): string => {
	const dateObj = new Date(value);

	if (isNaN(dateObj.getTime())) {
		return value;
	}

	const map: Record<string, string> = {
		YYYY: String(dateObj.getFullYear()),
		YY: String(dateObj.getFullYear()).slice(-2),
		MMMM: dateObj.toLocaleString(undefined, { month: 'long' }),
		MMM: dateObj.toLocaleString(undefined, { month: 'short' }),
		MM: String(dateObj.getMonth() + 1).padStart(2, '0'),
		DD: String(dateObj.getDate()).padStart(2, '0'),
		D: String(dateObj.getDate()),
		HH: String(dateObj.getHours()).padStart(2, '0'),
		mm: String(dateObj.getMinutes()).padStart(2, '0'),
		ss: String(dateObj.getSeconds()).padStart(2, '0'),
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
