import { __ } from '@wordpress/i18n';

/**
 * Same 3-tier 0-100 score thresholds used throughout the SEO tab (the "SEO Health Score" ring,
 * "SEO areas" tiles, and "Pages that need attention").
 */
export const getRating = (score: number): string => {
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 40) {
		return __('Needs Work', 'vulopilot');
	}
	return __('At Risk', 'vulopilot');
};

/**
 * Same 3-tier thresholds as `getRating()` above, as one of zyra's own `$color-palette` names.
 */
export const ratingColor = (score: number): string => {
	if (score >= 70) {
		return 'green';
	}
	if (score >= 40) {
		return 'purple';
	}
	return 'red';
};
