import { __ } from '@wordpress/i18n';
import { CardComponent, TrendStatComponent } from '@zyra/components';

/**
 * The mockup's "Content Stats" row (Content Created/Words Generated/SEO
 * Score Improved/Time Saved, each with a fabricated "↑N%" delta) has no
 * real backend anywhere: no word-count/time-saved/SEO-score-delta
 * tracking exists, and `GET /ai-history` has no per-category filter
 * (confirmed: only `provider`/`status` are filterable — no `action_id`),
 * so even "Content Created" can't be reliably scoped to
 * content-generation actions specifically. Same honest-omission posture
 * as the Dashboard's own dropped "vs last 7 days" deltas and AEO's own
 * "Not tracked yet" badges (`color: 'indigo'`, same convention reused
 * here) — same 4-tile layout, no invented numbers.
 */
const ContentStatsCard = () => {
	return (
		<CardComponent title={__('Content Stats', 'vulopilot')}>
			<TrendStatComponent
				cols={2}
				items={[
					{
						icon: 'edit',
						label: __('Content Created', 'vulopilot'),
						value: '—',
						badge: { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
					},
					{
						icon: 'document',
						label: __('Words Generated', 'vulopilot'),
						value: '—',
						badge: { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
					},
					{
						icon: 'bar-chart',
						label: __('SEO Score Improved', 'vulopilot'),
						value: '—',
						badge: { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
					},
					{
						icon: 'clock',
						label: __('Time Saved', 'vulopilot'),
						value: '—',
						badge: { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
					},
				]}
			/>
		</CardComponent>
	);
};

export default ContentStatsCard;
