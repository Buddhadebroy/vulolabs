/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, COLOR_PALETTE } from '@zyra/core';
import { CardComponent, ChartComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';

interface DashboardSummary {
	category_scores: { security: number };
}

interface FindingRow {
	id: number;
}

/**
 * Sidebar "Security Status" gauge — same real
 * `category_scores.security` value used elsewhere on this tab (the mockup
 * repeats the same number in two panels), and the same open-finding total
 * `VulnerabilityHeroCard`'s Free fallback
 * already fetches, used here to derive "Your site is protected"/"N open
 * issue(s) need attention" honestly rather than a fabricated status.
 */
const SecurityStatusCard = () => {
	const [score, setScore] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const { total: openFindings, isLoading: isLoadingFindings } =
		useApiList<FindingRow>('findings', {
			category: 'security',
			status: 'open',
			per_page: 1,
		});

	useEffect(() => {
		getApiResponse<DashboardSummary>(
			getApiLink(appLocalizer, 'dashboard'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setScore(response.category_scores.security);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<CardComponent
			title={__('Security Status', 'vulopilot')}
			titleIcon="security"
			desc={__('Your real, site-wide security score.', 'vulopilot')}
			isLoading={isLoading}
		>
			{score !== null && (
				<ChartComponent
					type="pie"
					height={160}
					centerLabel={
						<i
							className={`adminfont-${
								openFindings > 0 ? 'error' : 'check'
							}`}
						/>
					}
					data={[
						{
							label: __('Score', 'vulopilot'),
							value: score,
							color: openFindings > 0 ? COLOR_PALETTE.orange : COLOR_PALETTE.green,
						},
						{
							label: __('Remaining', 'vulopilot'),
							value: 100 - score,
							color: '#e5e7eb',
						},
					]}
				/>
			)}
			{!isLoadingFindings && (
				<>
					<p className="security-status-headline">
						{openFindings > 0
							? __('Your site needs attention', 'vulopilot')
							: __('Your site is protected', 'vulopilot')}
					</p>
					<div className="desc">
						{openFindings > 0
							? sprintf(
									/* translators: %d is the number of open security findings. */
									__(
										'%d open issue(s) need attention.',
										'vulopilot'
									),
									openFindings
								)
							: __('No active threats.', 'vulopilot')}
					</div>
				</>
			)}
		</CardComponent>
	);
};

export default SecurityStatusCard;
