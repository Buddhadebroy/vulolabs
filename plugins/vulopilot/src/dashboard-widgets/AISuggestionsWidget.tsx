import React from 'react';
import { __ } from '@wordpress/i18n';
import { ListComponent, ModuleGuardComponent, ButtonInput } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { getCategoryTabLink } from '../services/getCategoryTabLink';
import { WidgetProps } from './types';

interface FindingRow {
	id: number;
	title: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	category?: string;
}

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
			title={__('AI Suggestions', 'vulopilot')}
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
							window.location.href = getCategoryTabLink(
								finding.category
							);
						};

						return {
							id: String(finding.id),
							icon: 'ai purple',
							title: finding.title,
							action: goToFix,
							tags: (
								<>
									<span
										className={`admin-badge badge-${finding.severity}`}
									>
										SEO Impact: {finding.severity}
									</span>
									<ButtonInput
										position="left"
										buttons={[
											{
												icon: 'ai',
												color: 'border-purple',
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
