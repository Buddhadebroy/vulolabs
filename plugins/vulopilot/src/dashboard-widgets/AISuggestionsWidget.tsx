import React from 'react';
import { __ } from '@wordpress/i18n';
import { ListComponent, ModuleGuardComponent, ButtonInput, BadgeComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { getCategoryTabLink } from '../services/getCategoryTabLink';
import { WidgetProps } from './types';
import AiCopilotGuard from '../components/AiCopilotGuard';

interface FindingRow {
	id: number;
	title: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	category?: string;
}

/**
 * UNUSED — no longer registered in registry.ts's MOCKUP_WIDGETS (removed
 * per direct instruction once confirmed as a real content duplicate, not
 * just a styling variant: this widget's own query — `/findings`,
 * `status=open`, `orderby=id`, `order=desc` — is the exact same one
 * NeedsAttentionWidget's "Open issues" tab already runs, so the two showed
 * the identical real findings side by side on the Dashboard, just with a
 * "Fix with AI" button here vs a plain severity badge there). Its id
 * (`ai-suggestions`) was also dropped from `Utill::DASHBOARD_WIDGET_IDS`,
 * so it can't be re-added via "Customize dashboard" either. Left in place
 * rather than deleted, same "supersede don't delete" posture this codebase
 * already applies elsewhere — if a distinct "Fix with AI" affordance is
 * ever wanted again, it belongs on NeedsAttentionWidget's own rows instead
 * of a second copy of the same list.
 *
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
			<AiCopilotGuard>
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
										<BadgeComponent
											color={`badge-${finding.severity}`}
											text={`SEO Impact: ${finding.severity}`}
										/>
										<ButtonInput
											position="left"
											buttons={[
												{
													icon: 'ai',
													color: 'orange-bg',
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
			</AiCopilotGuard>
		</DashboardWidget>
	);
};

export default AISuggestionsWidget;
