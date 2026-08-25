import { __ } from '@wordpress/i18n';

/**
 * Same 3-tier 0-100 score thresholds used throughout the SEO tab (the
 * "SEO Health Score" ring, "SEO areas" tiles, and now "Pages that need
 * attention") — pulled out of SeoTab.tsx so PagesNeedingAttentionTable.tsx/
 * WhatShouldIFixFirstCard.tsx can reuse the exact same real labels/classes
 * rather than inventing their own scale. SeoTab.tsx itself now imports these
 * instead of defining them locally.
 */
export const getRating = (score: number): string => {
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 40) {
		return __('Needs Attention', 'vulopilot');
	}
	return __('Poor', 'vulopilot');
};

export const ratingClass = (score: number): string => {
	if (score >= 70) {
		return 'is-good';
	}
	if (score >= 40) {
		return 'is-attention';
	}
	return 'is-poor';
};

/**
 * Same 3-tier thresholds as `ratingClass()`/`getRating()` above, as one of
 * zyra's own `$color-palette` names — for call sites (`AnalyticsComponent`'s
 * `colorClass`) that resolve against that real palette instead of the
 * `is-good`/`is-attention`/`is-poor` semantic classes.
 */
export const ratingColor = (score: number): string => {
	if (score >= 70) {
		return 'green';
	}
	if (score >= 40) {
		return 'yellow';
	}
	return 'red';
};
