/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, AnalyticsComponent } from '@zyra/components';

interface AiUsageSummary {
	ai_jobs_used: number;
	ai_jobs_quota: number;
}

/**
 * Moved here from the Dashboard's own widget grid (was the 'ai-usage'
 * StatWidget in dashboard-widgets/registry.ts) — same real source
 * (`GET /dashboard`'s `ai_jobs_used`/`ai_jobs_quota` fields), just read
 * directly here instead of via the Dashboard summary payload passed down
 * through DashboardGrid. Both fields are still a real, honest `0/0` on the
 * backend today (Controllers\Dashboard::get_items() — no AI job quota
 * subsystem has been built yet), not a fabricated number; once that
 * subsystem exists this card picks up real values with no further change.
 */
const AiUsageCard = () => {
	const [summary, setSummary] = useState<AiUsageSummary>({
		ai_jobs_used: 0,
		ai_jobs_quota: 0,
	});
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<AiUsageSummary>(getApiLink(appLocalizer, 'dashboard'), {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (response) {
					setSummary(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<CardComponent
			className="dashboard-widget"
			titleIcon="ai"
			title={__('AI usage', 'vulopilot')}
			isLoading={isLoading}
		>
			<AnalyticsComponent
				variant="progress"
				cols={1}
				isLoading={isLoading}
				data={[
					{
						icon: 'ai',
						number: `${summary.ai_jobs_used}/${summary.ai_jobs_quota}`,
						text: __('AI usage', 'vulopilot'),
						extra: __('This month', 'vulopilot'),
						progress: `${summary.ai_jobs_used}/${summary.ai_jobs_quota}`,
						colorClass: 'red-color',
					},
				]}
			/>
		</CardComponent>
	);
};

export default AiUsageCard;
