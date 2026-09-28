import { COLOR_PALETTE } from '@zyra/core';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * The one canonical severity → zyra palette color name mapping.
 */
const SEVERITY_COLOR_NAME: Record<FindingSeverity, keyof typeof COLOR_PALETTE> = {
	critical: 'critical',
	high: 'red',
	medium: 'orange',
	low: 'yellow',
	info: 'blue',
};

/** Same plain color-name modifier classes HealthPillarsWidget's own
 * `admin-badge` usage already uses (`green`/`red`/`yellow`), rather than a
 * new class per severity level. Real zyra `$color-palette` names only -
 * this used to return `'grey'` for `low`, a class zyra never ships
 * (`$color-palette`'s own key is `'gray'`), silently leaving every "Low"
 * severity badge unstyled. */
export const getSeverityClass = (severity: FindingSeverity): string =>
	SEVERITY_COLOR_NAME[severity] ?? '';

/**
 * Actual hex value behind each severity, for spots that need a real CSS color rather than an
 * `admin-badge` modifier class.
 */
export const getSeverityColor = (severity: FindingSeverity): string =>
	COLOR_PALETTE[SEVERITY_COLOR_NAME[severity]];
