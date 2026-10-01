/* global vulopilotAppLocalizer */

/**
 * Formats a raw date string using this site's own Settings → General → Date Format
 * (`vulopilotAppLocalizer.date_format_js`, already translated into zyra's token syntax by
 * FrontendScripts::convert_date_format_to_js()).
 *
 * @param value Raw date string (e.g. a MySQL datetime), or null/undefined.
 * @return Formatted date string, or '' if value is empty/unparseable.
 */
/**
 * A raw value with no explicit UTC/offset marker (a plain MySQL `Y-m-d H:i:s`, or the same with a
 * `T` separator).
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
 * Shared by `formatWpDate`/`formatWpTime` below - same token-replace algorithm either way.
 */
const formatWithTokens = (
	value: string,
	format: string,
	offsetMinutes: number = vulopilotAppLocalizer.gmt_offset_minutes ?? 0
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

	return formatWithTokens(value, vulopilotAppLocalizer.date_format_js || 'YYYY-MM-DD');
};

/**
 * Same Settings → General → Date Format, for a calendar-day-only value (`Y-m-d`, e.g. a daily
 * snapshot's `snapshot_date` or a chart's x-axis `date`).
 */
export const formatWpDay = (value?: string | null): string => {
	if (!value) {
		return '';
	}

	return formatWithTokens(
		value.slice(0, 10),
		vulopilotAppLocalizer.date_format_js || 'YYYY-MM-DD',
		0
	);
};

/**
 * WordPress time format (`time_format_js`), converted server-side like `date_format_js`.
 */
export const formatWpTime = (value?: string | null): string => {
	if (!value) {
		return '';
	}

	return formatWithTokens(value, vulopilotAppLocalizer.time_format_js || 'HH:mm');
};

/**
 * This site's own current wall-clock date/time (Settings → General → Timezone), for comparisons
 * like "is this timestamp today".
 */
export const wpNow = (): Date =>
	new Date(Date.now() + (vulopilotAppLocalizer.gmt_offset_minutes ?? 0) * 60000);

/**
 * Same-day comparison against `wpNow()` above, both read via UTC getters.
 */
export const isWpToday = (value: string): boolean => {
	const utcDate = parseAsUtc(value);

	if (isNaN(utcDate.getTime())) {
		return false;
	}

	const siteLocal = new Date(
		utcDate.getTime() + (vulopilotAppLocalizer.gmt_offset_minutes ?? 0) * 60000
	);
	const now = wpNow();

	return (
		siteLocal.getUTCFullYear() === now.getUTCFullYear() &&
		siteLocal.getUTCMonth() === now.getUTCMonth() &&
		siteLocal.getUTCDate() === now.getUTCDate()
	);
};
