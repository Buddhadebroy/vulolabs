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

/** Plain color-name modifier classes, as HealthPillarsWidget's `admin-badge` uses (`green`/`red`/
 * `yellow`). Only zyra `$color-palette` names: `'grey'` isn't shipped (the key is `'gray'`). */
export const getSeverityClass = (severity: FindingSeverity): string =>
	SEVERITY_COLOR_NAME[severity] ?? '';

/**
 * Actual hex value behind each severity, for spots that need a real CSS color rather than an
 * `admin-badge` modifier class.
 */
export const getSeverityColor = (severity: FindingSeverity): string =>
	COLOR_PALETTE[SEVERITY_COLOR_NAME[severity]];
