/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { ListComponent, BadgeComponent, ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

interface KeyPageRow {
	post_id: number;
	title: string;
	edit_link: string;
	open_findings: number;
}

interface TopPagesResponse {
	bottom: KeyPageRow[];
}

/**
 * "Key pages at a glance" — real published posts/pages ranked by their own
 * real open-finding count, most first. Reuses `GET /geo-analysis/top-pages`
 * (Controllers\GeoAnalysis, already backs GEO tab's "Your Best & Worst
 * Pages") with the new `scope=all` param added alongside this widget —
 * that endpoint's existing default only ranks by `category=geo` findings,
 * which would misrepresent a page with many security/performance findings
 * but zero GEO ones as a "best" page; `scope=all` counts open findings of
 * any category instead, the right scope for a sitewide Dashboard teaser.
 * Shows only the "bottom" (most open findings) half of that response —
 * the "at a glance, what needs a look" framing this widget's title
 * promises, not a full best/worst split (that's still GEO tab's own job).
 */
const KeyPagesWidget: React.FC<WidgetProps> = ({
	isLoading: parentLoading,
	onHide,
	isCustomizing,
}) => {
	const [rows, setRows] = useState<KeyPageRow[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<TopPagesResponse>(
			getApiLink(appLocalizer, 'geo-analysis/top-pages?limit=5&scope=all'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				setRows(response?.bottom ?? []);
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<DashboardWidget
			title={__('Key pages at a glance', 'vulopilot')}
			icon="pages"
			isLoading={parentLoading || isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
			headerAction={
				<a
					href="?page=vulopilot#&tab=seo-visibility&subtab=geo"
					className="vital-pulse-full-report-link"
				>
					{__('View all pages ›', 'vulopilot')}
				</a>
			}
		>
			{!isLoading && rows && rows.length === 0 && (
				<ModuleGuardComponent
					icon="check"
					title={__('No open issues on any page', 'vulopilot')}
					desc={__(
						'Publish some content, or check back after your next scan.',
						'vulopilot'
					)}
				/>
			)}
			{!isLoading && rows && rows.length > 0 && (
				<ListComponent
					className="mini-card report"
					items={rows.map((row) => ({
						id: String(row.post_id),
						title: row.title,
						action: () => {
							window.location.href = row.edit_link;
						},
						tags: (
							<BadgeComponent
								color={row.open_findings > 0 ? 'red' : 'green'}
								text={
									row.open_findings === 0
										? __('No issues', 'vulopilot')
										: row.open_findings === 1
											? __('1 issue', 'vulopilot')
											: sprintf(
													/* translators: %d: number of real open findings, any category. */
													__('%d issues', 'vulopilot'),
													row.open_findings
												)
								}
							/>
						),
					}))}
				/>
			)}
		</DashboardWidget>
	);
};

export default KeyPagesWidget;
