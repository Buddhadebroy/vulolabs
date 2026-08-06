import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import './AICopilot.scss';
import {
	InformationItemComponent,
	ListComponent,
	ModuleGuardComponent,
	TooltipComponent,
} from '@zyra/components';
import { TableRow } from '@zyra/table';
import { useApiList } from '../../services/useApiList';

interface FindingRow extends TableRow {
	id: number;
	title: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	category?: string;
	description?: string;
	/**
	 * Resolved page path (e.g. '/pricing') or 'Site-wide' — added
	 * server-side by Controllers/Findings.php's add_page_field(), same
	 * field FindingsTable.tsx's own Finding type already models.
	 */
	page?: string;
}

/** Same category → tab mapping AISuggestionsWidget.tsx's own Dashboard
 * widget already uses — a finding's actual fix lives on its category's
 * page, not behind a one-click AI trigger (confirmed not to exist yet). */
const CATEGORY_TABS: Record<string, string> = {
	seo: 'seo',
	performance: 'performance',
	accessibility: 'accessibility',
	woocommerce: 'woocommerce',
	geo: 'geo',
	security: 'health',
	content: 'content',
	brand: 'brand-visibility',
};

const CATEGORY_ICONS: Record<string, string> = {
	seo: 'search-discovery',
	performance: 'bar-chart',
	accessibility: 'security',
	woocommerce: 'woocommerce',
	geo: 'geo-location',
	security: 'security',
	content: 'document',
	brand: 'star',
};

/** Most-to-least severe, for the full tab's "ranked by severity" sort. */
const SEVERITY_RANK: Record<string, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4,
};

const FIX_DISABLED_REASON = __(
	"One-click AI fixes aren't available yet — click a suggestion to review and fix it on its own page.",
	'vulopilot'
);

interface SuggestedActionsListProps {
	/** Row cap — omit for the full "Suggested Actions" tab. */
	limit?: number;
}

/**
 * Real open findings (`GET /findings`, same endpoint the Dashboard's
 * AISuggestionsWidget.tsx already uses), rendered as the mockup's icon
 * box + title + one-line description rows. Shared between ChatTab.tsx's
 * sidebar preview and SuggestedActionsTab.tsx's full list so both read
 * the same live data instead of two independent fetches drifting apart.
 */
const SuggestedActionsList: React.FC<SuggestedActionsListProps> = ({
	limit,
}) => {
	const { data, isLoading, error, refetch } = useApiList<FindingRow>(
		'findings',
		{
			status: 'open',
			per_page: limit ?? 20,
		}
	);

	if (error) {
		return (
			<ModuleGuardComponent
				icon="error"
				title={__('Could not load suggested actions', 'vulopilot')}
				desc={error}
				buttonText={__('Retry', 'vulopilot')}
				onButtonClick={refetch}
			/>
		);
	}

	// ChatTab.tsx's sidebar preview (limit passed, narrow column) keeps
	// today's compact icon+title+desc list — a full table would be
	// cramped there and wasn't part of this ask.
	if (limit) {
		if (isLoading) {
			return (
				<>
					{Array.from({ length: limit }).map((_, index) => (
						<InformationItemComponent key={index} title="" isLoading />
					))}
				</>
			);
		}

		if (data.length === 0) {
			return (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing to suggest right now', 'vulopilot')}
					desc={__(
						'AI suggestions appear here once a scan finds something worth fixing.',
						'vulopilot'
					)}
				/>
			);
		}

		return (
			<ListComponent
				className="mini-card report suggested-actions-list"
				items={data.map((finding) => {
					const category = finding.category ?? '';
					const goToFix = () => {
						const tab = CATEGORY_TABS[category] ?? 'health';

						window.location.href = `?page=vulopilot#&tab=${tab}`;
					};

					return {
						id: String(finding.id),
						title: finding.title,
						icon: CATEGORY_ICONS[category] ?? 'ai',
						className: `category-${category || 'default'}`,
						desc:
							finding.description ||
							sprintf(
								/* translators: %s: finding severity (e.g. "high") */
								__('%s severity', 'vulopilot'),
								finding.severity
							),
						tags: (
							<i className="adminfont-arrow-right ai-copilot-row-arrow" />
						),
						action: goToFix,
					};
				})}
			/>
		);
	}

	// The full "Suggested Actions" tab (SuggestedActionsTab.tsx, no limit
	// passed) — the mockup's icon-box + title/desc + severity badge +
	// "Fix with AI" row, sorted most-severe-first. No pagination chrome
	// (the mockup has none); the `per_page` cap above is the same 20-row
	// default this branch already used before this rebuild.
	if (isLoading) {
		return (
			<>
				{Array.from({ length: 5 }).map((_, index) => (
					<InformationItemComponent key={index} title="" isLoading />
				))}
			</>
		);
	}

	if (data.length === 0) {
		return (
			<ModuleGuardComponent
				icon="check"
				title={__('Nothing to suggest right now', 'vulopilot')}
				desc={__(
					'AI suggestions appear here once a scan finds something worth fixing.',
					'vulopilot'
				)}
			/>
		);
	}

	// Findings' list endpoint doesn't support server-side severity
	// ordering (only the Dashboard's own top-findings query does, via a
	// dedicated repository method) — sorting this already-fetched page of
	// real data client-side is enough to honestly back "ranked by
	// severity" without adding a new backend sort param.
	const sortedData = [...data].sort(
		(a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
	);

	return (
		<div className="suggested-actions-full-list">
			{sortedData.map((finding) => {
				const category = finding.category ?? '';
				const goToFix = () => {
					const tab = CATEGORY_TABS[category] ?? 'health';

					window.location.href = `?page=vulopilot#&tab=${tab}`;
				};

				return (
					<InformationItemComponent
						key={finding.id}
						title={finding.title}
						onClick={goToFix}
						avatar={{ iconClass: CATEGORY_ICONS[category] ?? 'ai' }}
						descriptions={[
							{
								value:
									finding.description ||
									sprintf(
										/* translators: %s: finding severity (e.g. "high") */
										__(
											'Flagged as a %s-severity issue during the last scan.',
											'vulopilot'
										),
										finding.severity
									),
							},
						]}
						rightContent={
							<div className="suggested-action-controls">
								<span
									className={`suggested-action-severity severity-${finding.severity}`}
								>
									{finding.severity}
								</span>
								<TooltipComponent text={FIX_DISABLED_REASON}>
									<span
										role="button"
										aria-disabled="true"
										className="suggested-action-fix-btn disabled"
									>
										{__('Fix with AI', 'vulopilot')}
									</span>
								</TooltipComponent>
							</div>
						}
					/>
				);
			})}
		</div>
	);
};

export default SuggestedActionsList;
