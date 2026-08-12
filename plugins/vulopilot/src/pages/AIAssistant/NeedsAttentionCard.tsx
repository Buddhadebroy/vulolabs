/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	InformationItemComponent,
	ListComponent,
	ModuleGuardComponent,
	AnalyticsComponent
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import './AICopilot.scss';

interface FindingGroup {
	scanner_id: string;
	count: number;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	category: string;
	object_type: string | null;
	label: string;
}

interface AttentionSummary {
	total: number;
	priority_counts: { high: number; medium: number; low: number };
	groups: FindingGroup[];
}

/**
 * Real category strings (Scanners/*::get_category()) mapped to the
 * mockup's friendlier display groupings — 'seo'/'images'/'schema'/'links'
 * all fold into "Visibility" the same way GEO.tsx's own "Grow My Traffic"
 * tab already treats them as one visibility-adjacent surface, rather than
 * inventing 4 separate display buckets for what the rest of the plugin
 * already treats as one concern. `className` reuses AICopilot.scss's
 * existing `.suggested-actions-list` per-category icon-tint map
 * (IssuesList.tsx's own CATEGORY_ICONS neighbor) — 'seo' is
 * already one of its defined colors, so images/schema/links inherit that
 * same blue rather than needing new CSS.
 */
const CATEGORY_DISPLAY: Record<string, { label: string; className: string }> = {
	seo: { label: __('Visibility', 'vulopilot'), className: 'category-seo' },
	images: { label: __('Visibility', 'vulopilot'), className: 'category-seo' },
	schema: { label: __('Visibility', 'vulopilot'), className: 'category-seo' },
	links: { label: __('Visibility', 'vulopilot'), className: 'category-seo' },
	accessibility: {
		label: __('Accessibility', 'vulopilot'),
		className: 'category-accessibility',
	},
	woocommerce: {
		label: __('WooCommerce', 'vulopilot'),
		className: 'category-woocommerce',
	},
	security: { label: __('Security', 'vulopilot'), className: 'category-security' },
	performance: {
		label: __('Performance', 'vulopilot'),
		className: 'category-performance',
	},
	geo: { label: __('GEO', 'vulopilot'), className: 'category-geo' },
	content: { label: __('Content', 'vulopilot'), className: 'category-content' },
	brand: { label: __('Brand', 'vulopilot'), className: 'category-brand' },
};

const CATEGORY_ICONS: Record<string, string> = {
	seo: 'search-discovery yellow',
	images: 'search-discovery blue',
	schema: 'search-discovery pink',
	links: 'search-discovery red',
	accessibility: 'security green',
	woocommerce: 'woocommerce indigo',
	security: 'security purple',
	performance: 'bar-chart teal',
	geo: 'geo-location red',
	content: 'document yellow',
	brand: 'star green',
};

/**
 * 5-level severity collapsed into the mockup's 3-tier "impact" label —
 * same bucketing FindingRepository::get_priority_counts() already applies
 * server-side to the header counts, applied again here client-side to
 * each group's own `severity` so a row's "Impact" label always agrees
 * with which priority pill it would count toward.
 */
const IMPACT_LABEL: Record<FindingGroup['severity'], string> = {
	critical: __('High Impact', 'vulopilot'),
	high: __('High Impact', 'vulopilot'),
	medium: __('Medium Impact', 'vulopilot'),
	low: __('Low Impact', 'vulopilot'),
	info: __('Low Impact', 'vulopilot'),
};

export interface IssuesFilter {
	scannerId: string;
	label: string;
	category: string;
}

interface NeedsAttentionCardProps {
	onNavigateTab: (tab: string, filter?: IssuesFilter) => void;
}

/**
 * AI Copilot's "Needs your attention" card — replaces the old "Suggested
 * Actions" preview (a flat list of individual open findings) with a
 * priority-bucketed summary read from `GET /findings/attention-summary`
 * (Findings.php::get_attention_summary()): a real total, 3 real
 * priority-count pills, and the top 3 issue types (grouped by scanner,
 * most severe first) with a real per-type count instead of one row per
 * individual finding.
 */
const NeedsAttentionCard: React.FC<NeedsAttentionCardProps> = ({
	onNavigateTab,
}) => {
	const [summary, setSummary] = useState<AttentionSummary | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = () => {
		setIsLoading(true);
		setError(null);

		getApiResponse<AttentionSummary>(
			getApiLink(appLocalizer, 'findings/attention-summary'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (!response) {
					setError(
						__(
							'Could not load what needs your attention.',
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

	const goToAllIssues = () => onNavigateTab('issues');

	/**
	 * Regression: every group row here used to navigate to the same
	 * unfiltered `goToAllIssues` as the "View all issues" button — so
	 * clicking "18 findings: Weak Password Detection" landed on the Issues
	 * tab's own flat, unrelated top-20-by-severity list, which often
	 * didn't contain a single Weak Password Detection row at all. Passing
	 * the group's own `scanner_id` through lets the Issues tab filter
	 * to exactly the findings this row is counting.
	 */
	const goToGroup = (group: FindingGroup) =>
		onNavigateTab('issues', {
			scannerId: group.scanner_id,
			label: group.label,
			category: group.category,
		});

	// Prepare priority data for AnalyticsComponent
	const priorityData = summary ? [
		{
			colorClass: 'admin-bg-color2',
			number: summary.priority_counts.high,
			text: sprintf(
				/* translators: %d: count of high-priority open findings */
				__('%d High priority', 'vulopilot'),
				summary.priority_counts.high
			),
		},
		{
			colorClass: 'admin-bg-color3',
			number: summary.priority_counts.medium,
			text: sprintf(
				/* translators: %d: count of medium-priority open findings */
				__('%d Medium priority', 'vulopilot'),
				summary.priority_counts.medium
			),
		},
		{
			colorClass: 'admin-bg-color4',
			number: summary.priority_counts.low,
			text: sprintf(
				/* translators: %d: count of low-priority open findings */
				__('%d Low priority', 'vulopilot'),
				summary.priority_counts.low
			),
		},
	] : [];

	return (
		<CardComponent title={__('Needs your attention', 'vulopilot')} titleIcon="error">
			{error ? (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load issues', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={load}
				/>
			) : isLoading ? (
				<>
					{Array.from({ length: 3 }).map((_, index) => (
						<InformationItemComponent key={index} title="" isLoading />
					))}
				</>
			) : !summary || summary.total === 0 ? (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing needs attention right now', 'vulopilot')}
					desc={__(
						'Open findings will appear here once a scan finds something worth fixing.',
						'vulopilot'
					)}
				/>
			) : (
				<>
					<div className="attention-summary-header">
						<span className="attention-summary-count">
							{summary.total}
						</span>
						<span className="attention-summary-label">
							{__('things need attention', 'vulopilot')}
						</span>
					</div>
					<AnalyticsComponent
						data={priorityData}
						variant="background-color"
						cols={3}
						isLoading={false}
					/>

					<ListComponent
						className="mini-card report "
						items={summary.groups.map((group) => {
							const display =
								CATEGORY_DISPLAY[group.category] ?? null;

							return {
								id: group.scanner_id,
								icon: CATEGORY_ICONS[group.category] ?? 'ai',
								className: display?.className ?? '',
								title: sprintf(
									/* translators: 1: real open-finding count, 2: scanner label, e.g. "Meta Descriptions" */
									__('%1$d findings: %2$s', 'vulopilot'),
									group.count,
									group.label
								),
								desc: sprintf(
									/* translators: 1: category display label, 2: impact label */
									__('%1$s • %2$s', 'vulopilot'),
									display?.label ?? group.category,
									IMPACT_LABEL[group.severity] ??
										__('Medium Impact', 'vulopilot')
								),
								tags: (
									<i className="adminfont-pagination-right-arrow ai-copilot-row-arrow" />
								),
								action: () => goToGroup(group),
							};
						})}
					/>

					<ButtonInput
						position="full-width"
						buttons={{
							text: __('View all issues', 'vulopilot'),
							icon: 'arrow-right',
							iconPosition: 'right',
							// color: 'bpurple',
							position: 'full-width',
							onClick: goToAllIssues,
						}}
					/>
				</>
			)}
		</CardComponent>
	);
};

export default NeedsAttentionCard;