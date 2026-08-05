import React from 'react';
import { __ } from '@wordpress/i18n';
import { ListComponent, ModuleGuardComponent, ButtonInput } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { getSeverityClass } from '../services/getSeverityClass';
import { WidgetProps } from './types';

interface FindingRow {
	id: number;
	title: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	category?: string;
}

/** Same category → tab mapping NeedsAttentionWidget's own findings rows
 * navigate to — a finding's actual fix lives on its category's page, not
 * behind a one-click AI trigger that doesn't exist yet. */
const CATEGORY_TABS: Record<string, string> = {
	seo: 'seo',
	performance: 'performance',
	accessibility: 'accessibility',
	woocommerce: 'woocommerce',
	geo: 'geo',
	security: 'health',
};

/**
 * "AI Suggestions" — the mockup's severity-ranked findings list with a
 * "Fix with AI" call to action. Reads the same `/findings` endpoint
 * NeedsAttentionWidget's "Open issues" tab already uses rather than a new
 * data source; "Fix with AI" navigates to the finding's category page
 * (same as NeedsAttentionWidget's own row click) since there's no
 * single-finding AI-fix trigger endpoint to call directly yet.
 */
const AISuggestionsWidget: React.FC<WidgetProps> = ({
	onHide,
	isCustomizing,
}) => {
	const { data, isLoading, error, refetch } = useApiList<FindingRow>(
		'findings',
		{ status: 'open', per_page: 4, orderby: 'id', order: 'desc' }
	);

	return (
		<DashboardWidget
			title={__('AI Suggestionddds', 'vulopilot')}
			icon="ai"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			{error ? (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load suggestions', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={refetch}
				/>
			) : data.length === 0 ? (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing to suggest right now', 'vulopilot')}
					desc={__(
						'AI suggestions appear here once a scan finds something worth fixing.',
						'vulopilot'
					)}
				/>
			) : (
				<ListComponent
					className="mini-card report"
					items={data.map((finding) => {
						const goToFix = () => {
							const tab =
								CATEGORY_TABS[finding.category ?? ''] ??
								'health';
							window.location.href = `?page=vulopilot#&tab=${tab}`;
						};

						return {
							id: String(finding.id),
							icon: 'ai',
							title: finding.title,
							action: goToFix,
							tags: (
								<>
									<span
										className={`admin-badge ${getSeverityClass(finding.severity)}`}
									>
										{finding.severity}
									</span>
									<ButtonInput
										position="left"
										buttons={[
											{
												icon: 'ai',
												text: __('Fix with AI', 'vulopilot'),
												onClick: (e) => {
													e.stopPropagation();
													goToFix();
												},
											},
										]}
									/>
								</>
							),
						};
					})}
				/>
			)}
		</DashboardWidget>
	);
};

export default AISuggestionsWidget;
