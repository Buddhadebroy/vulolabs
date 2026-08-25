/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, COLOR_PALETTE } from '@zyra/core';
import {
	CardComponent,
	InformationItemComponent,
	ModuleGuardComponent,
	ChartComponent,
	ListComponent,
	TypographyComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import './AICopilot.scss';

/**
 * Narrow local slice of `/dashboard`'s real aggregate payload (same
 * endpoint OverallScoreWidget.tsx/SecurityStatusCard.tsx already read) —
 * only the fields this card's own "Site Overview" breakdown renders,
 * same "define just the subset actually used" call SecurityStatusCard.tsx
 * already makes rather than importing dashboard-widgets/types.ts's full
 * DashboardSummary wholesale.
 */
interface DashboardSummary {
	overall_score: number;
	open_findings: number;
	category_scores: {
		seo: number;
		performance: number;
		security: number;
		content: number;
	};
}

export interface IssuesFilter {
	scannerId: string;
	label: string;
	category: string;
}

interface NeedsAttentionCardProps {
	onNavigateTab: (tab: string, filter?: IssuesFilter) => void;
}

type ScoreTone = 'green' | 'orange' | 'red';

/**
 * One shared 3-band split for both the ring's own descriptive rating and
 * each category row's colored number — green >= 75, orange 60-74, red <
 * 60. Deliberately one function reused both places rather than two
 * separately-tuned scales, so a row's color and the headline rating it
 * rolls up into never disagree about where a given score sits.
 */
const getScoreTone = (score: number): ScoreTone => {
	if (score >= 75) {
		return 'green';
	}
	if (score >= 60) {
		return 'orange';
	}
	return 'red';
};

// Real zyra palette hex (`@zyra/core`'s `COLOR_PALETTE`) — same colors
// SecurityStatusCard.tsx's own ChartComponent pie uses for this exact
// "green/orange/red gauge" pattern (that one only needed two of the
// three, this one needs the full set), read from the one shared source
// instead of each file guessing its own approximation of "orange".
const TONE_COLOR: Record<ScoreTone, string> = {
	green: COLOR_PALETTE.green,
	orange: COLOR_PALETTE.orange,
	red: COLOR_PALETTE.red,
};

const TONE_RATING_LABEL: Record<ScoreTone, string> = {
	green: __('Good', 'vulopilot'),
	orange: __('Needs improvement', 'vulopilot'),
	red: __('Needs attention', 'vulopilot'),
};

/**
 * AI Copilot's "Site Overview" card — a real health-score breakdown read
 * from `GET /dashboard` (the same aggregate payload the Dashboard's own
 * OverallScoreWidget/SecurityStatusCard already read), replacing the old
 * priority-pill + top-issue-type preview: a ring for `overall_score`, the
 * 4 category scores the mockup shows (SEO & Visibility, Performance,
 * Security, Content), and a real `open_findings` count linking to the
 * Issues table.
 */
const NeedsAttentionCard: React.FC<NeedsAttentionCardProps> = ({
	onNavigateTab,
}) => {
	const [summary, setSummary] = useState<DashboardSummary | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = () => {
		setIsLoading(true);
		setError(null);

		getApiResponse<DashboardSummary>(getApiLink(appLocalizer, 'dashboard'), {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (!response) {
					setError(
						__(
							'Could not load your site overview.',
							'vulopilot'
						)
					);
					return;
				}

				setSummary(response);
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(load, []);

	// The Issues table is inline on the Chat tab now (appended below the
	// composer), not a separate 'issues' nav tab — this card is only ever
	// rendered on the Chat tab itself (ChatTab.tsx), so 'chat' just updates
	// AIAssistant.tsx's own issuesFilter state and its scroll-into-view
	// effect, rather than actually switching tabs.
	const goToAllIssues = () => onNavigateTab('chat');

	const overallTone = summary ? getScoreTone(summary.overall_score) : 'green';

	const scoreRows = summary
		? [
				{
					key: 'seo',
					icon: 'search-discovery yellow',
					label: __('SEO & Visibility', 'vulopilot'),
					score: summary.category_scores.seo,
				},
				{
					key: 'performance',
					icon: 'bar-chart teal',
					label: __('Performance', 'vulopilot'),
					score: summary.category_scores.performance,
				},
				{
					key: 'security',
					icon: 'security purple',
					label: __('Security', 'vulopilot'),
					score: summary.category_scores.security,
				},
				{
					key: 'content',
					icon: 'document yellow',
					label: __('Content', 'vulopilot'),
					score: summary.category_scores.content,
				},
			]
		: [];

	return (
		<CardComponent title={__('Site Overview', 'vulopilot')} titleIcon="analytics">
			{error ? (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load issues', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={load}
				/>
			) : isLoading || !summary ? (
				<>
					{Array.from({ length: 3 }).map((_, index) => (
						<InformationItemComponent key={index} title="" isLoading />
					))}
				</>
			) : (
				<>
					<div className="site-overview-health">
						<ChartComponent
							type="ring"
							height={100}
							isLoading={false}
							color={TONE_COLOR[overallTone]}
							centerLabel={
								<span className="site-overview-ring-number">
									{summary.overall_score}
								</span>
							}
							data={[{ value: summary.overall_score }]}
						/>
						<div className="site-overview-health-text">
							<TypographyComponent
								variant="body-md"
								weight="semibold"
								className="site-overview-health-title"
							>
								{__('Overall Health', 'vulopilot')}
							</TypographyComponent>
							<TypographyComponent
								variant="h5"
								weight="semibold"
								color={overallTone}
							>
								{TONE_RATING_LABEL[overallTone]}
							</TypographyComponent>
						</div>
					</div>

					{/* Same `ListComponent` + "mini-card report" variant this card's own
					    old group rows used (and most other cards across this plugin —
					    TopIssuesToWorkOn.tsx, StoreIntelligenceSummaryCard.tsx, etc. —
					    already reuse it too): icon on the left, `tags` pinned to the
					    right (ListComponent.scss's own `.report .tags`), which is
					    exactly this row's icon+label…score shape without hand-rolling a
					    new row layout. */}
					<ListComponent
						className="mini-card report without-border"
						items={scoreRows.map((row) => {
							const tone = getScoreTone(row.score);

							return {
								id: row.key,
								icon: row.icon,
								title: row.label,
								tags: (
									<TypographyComponent
										as="span"
										variant="body-md"
										weight="bold"
										color={tone}
										className="site-overview-score-row-value"
									>
										{row.score}
										<TypographyComponent
											as="span"
											variant="body-md"
											className="site-overview-score-row-suffix"
										>
											/100
										</TypographyComponent>
									</TypographyComponent>
								),
							};
						})}
					/>

					<div className="site-overview-footer">
						<TypographyComponent
							variant="desc"
						>
							{sprintf(
								/* translators: %d: number of real open findings across the site */
								__('%d open issues found', 'vulopilot'),
								summary.open_findings
							)}
						</TypographyComponent>
						<ButtonInput
							wrapperClass="site-overview-footer-link"
							buttons={{
								text: __('View all issues', 'vulopilot'),
								rightIcon: 'pagination-right-arrow',
								color: 'text-purple',
								onClick: goToAllIssues,
							}}
						/>
					</div>

				</>
			)}
		</CardComponent>
	);
};

export default NeedsAttentionCard;
