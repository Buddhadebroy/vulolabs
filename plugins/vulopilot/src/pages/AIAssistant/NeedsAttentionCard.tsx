/* global vulopilotAppLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, COLOR_PALETTE } from '@zyra/core';
import {
	CardComponent,
	ChartComponent,
	InformationItemComponent,
	ModuleGuardComponent,
	ListComponent,
	TypographyComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import './AICopilot.scss';

/** Narrow local slice of /dashboard's aggregate payload. */
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
	// eslint-disable-next-line no-unused-vars
	onNavigateTab: (tab: string, filter?: IssuesFilter) => void;
}

type ScoreTone = 'green' | 'orange' | 'red';

/** Shared 3-band split used by the ring and each category row's color. */
const getScoreTone = (score: number): ScoreTone => {
	if (score >= 75) {
		return 'green';
	}
	if (score >= 60) {
		return 'orange';
	}
	return 'red';
};

// Zyra palette hex (@zyra/core's COLOR_PALETTE).
const TONE_COLOR: Record<ScoreTone, string> = {
	green: COLOR_PALETTE.green,
	orange: COLOR_PALETTE.orange,
	red: COLOR_PALETTE.red,
};

const TONE_RATING_LABEL: Record<ScoreTone, string> = {
	green: __('Good', 'vulopilot'),
	orange: __('Needs Work', 'vulopilot'),
	red: __('At Risk', 'vulopilot'),
};

/**
 * "Site Overview" card: overall score ring, four category scores and the open findings count, from
 * `GET /dashboard`.
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

		getApiResponse<DashboardSummary>(getApiLink(vulopilotAppLocalizer, 'dashboard'), {
			headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce },
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

	// The Issues table is inline on the page, not a separate 'issues' nav tab.
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
		<div id="site-overview-card">
		<CardComponent
			title={__('Site Overview', 'vulopilot')}
			titleIcon="analytics"
			desc={__('Your open issues, broken down by category.', 'vulopilot')}
		>
			{error ? (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load issues', 'vulopilot')}
					desc={error}
				/>
			) : isLoading || !summary ? (
				<>
					{Array.from({ length: 3 }).map((_, index) => (
						<InformationItemComponent key={index} title="" isLoading />
					))}
				</>
			) : (
				<>
					<div className="overall-score-summary">
						{/* Same ring + centerLabel structure used by other score rings in this app. */}
						<ChartComponent
							type="ring"
							height={200}
							// type="ring" only paints its stroke from this top-level color prop.
							color={TONE_COLOR[overallTone]}
							centerLabel={
								<>
									<TypographyComponent variant={'h1'} color={overallTone}>
										{summary.overall_score}
									</TypographyComponent>
									<TypographyComponent variant={'h4'}>
										{TONE_RATING_LABEL[overallTone]}
									</TypographyComponent>
								</>
							}
							data={[
								{
									label: __('Score', 'vulopilot'),
									value: summary.overall_score,
									color: TONE_COLOR[overallTone],
								},
								{
									label: __('Remaining', 'vulopilot'),
									value: 100 - summary.overall_score,
									color: '#e5e7eb',
								},
							]}
						/>
						<TypographyComponent variant={'h3'} color="text-green">
							{__('Overall Health', 'vulopilot')}
						</TypographyComponent>
						<div className="desc">
							{__('Your open issues, broken down by category.', 'vulopilot')}
						</div>
					</div>

					{/* Reuses the mini-card report ListComponent variant other cards use. */}
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
		</div>
	);
};

export default NeedsAttentionCard;
