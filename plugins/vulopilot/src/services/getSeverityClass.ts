import { COLOR_PALETTE } from '@zyra/core';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * The one canonical severity → zyra palette color name mapping — every
 * severity badge/icon/chart across the app should read this (or
 * `getSeverityClass`/`getSeverityColor` below, both now built from it)
 * rather than re-guessing its own. This used to disagree with itself:
 * `getSeverityClass('high')` returned `'green'` (badges/tabs) while
 * `getSeverityColor('high')` returned `#d88c5c` (a muted tan, matching
 * neither `'green'` nor any other real named color) — the exact
 * "different color for the same severity in different places" bug this
 * shared mapping exists to make impossible.
 */
const SEVERITY_COLOR_NAME: Record<FindingSeverity, keyof typeof COLOR_PALETTE> = {
	critical: 'critical',
	high: 'red',
	medium: 'orange',
	low: 'blue',
	info: 'gray',
};

/** Same plain color-name modifier classes HealthPillarsWidget's own
 * `admin-badge` usage already uses (`green`/`red`/`yellow`), rather than a
 * new class per severity level. Real zyra `$color-palette` names only —
 * this used to return `'grey'` for `low`, a class zyra never ships
 * (`$color-palette`'s own key is `'gray'`), silently leaving every "Low"
 * severity badge unstyled. */
export const getSeverityClass = (severity: FindingSeverity): string =>
	SEVERITY_COLOR_NAME[severity] ?? '';

/**
 * Actual hex value behind each severity, for spots that need a real CSS
 * color rather than an `admin-badge` modifier class — e.g. FindingsTable's
 * `layout="compact"` row icon, or `ChartComponent`'s own `color` prop.
 * Reads the exact same real zyra color `getSeverityClass` above's class
 * resolves to (`COLOR_PALETTE`, `@zyra/core`) — a finding's severity now
 * reads as the literal same color everywhere in the app, not just the
 * same color *name* with a different hex behind it depending on which of
 * these two functions a given call site happened to use.
 */
export const getSeverityColor = (severity: FindingSeverity): string =>
	COLOR_PALETTE[SEVERITY_COLOR_NAME[severity]];
