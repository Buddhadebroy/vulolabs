/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ColumnComponent, ListComponent, BadgeComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface TopPageRow {
	post_id: number;
	title: string;
	edit_link: string;
	permalink: string;
	open_findings: number;
}

interface TopPagesResponse {
	top: TopPageRow[];
	bottom: TopPageRow[];
}

interface TopPagesCardProps {
	/** Scrolls to the real "Page-by-page analysis" table further down the tab (GeoPageAnalysisTable.tsx) — real "view everything" destination, not a dead link. */
	onViewAll?: () => void;
	/** Comma-joined scanner ids to scope by, instead of the default `category=geo` — AeoTab.tsx passes its own 5 real AEO scanner ids. */
	scannerIds?: string[];
	/** Defaults to "Your Best & Worst Pages" (GEO tab). */
	title?: string;
	/** Defaults to "Which pages AI already likes, and which need the most work." (GEO tab). */
	desc?: string;
	/** Defaults to "AI likes these pages already" (GEO tab). */
	topLabel?: string;
	/** Defaults to "Needs attention" (GEO tab). */
	bottomLabel?: string;
	id?: string;
}

/**
 * "Your Best & Worst Pages" (GEO tab) — `GET /geo-analysis/top-pages`
 * (Controllers\GeoAnalysis, Free — a deterministic ranking over
 * already-persisted `vulopilot_scan_findings` rows, no AI call). Ranks by
 * open `geo`-category finding count per post rather than
 * GeoAnalysis\GeoAnalyzer's own AI-judged score, since that score only
 * exists for posts someone has explicitly analyzed — see that
 * controller's own docblock.
 *
 * Genericized (optional `scannerIds`/labels) so AeoTab.tsx's own "Top
 * pages by answer readiness" can reuse this exact card + endpoint scoped
 * to its own 5 real AEO scanner ids instead of GEO's `category=geo`
 * default, rather than a second near-identical component.
 */
const TopPagesCard = ({
	onViewAll,
	scannerIds,
	title,
	desc,
	topLabel,
	bottomLabel,
	id,
}: TopPagesCardProps) => {
	const [data, setData] = useState<TopPagesResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const endpoint = scannerIds
			? `geo-analysis/top-pages?scanner_ids=${encodeURIComponent(scannerIds.join(','))}`
			: 'geo-analysis/top-pages';

		getApiResponse<TopPagesResponse>(getApiLink(appLocalizer, endpoint), {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (response) {
					setData(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, [scannerIds && scannerIds.join(',')]);

	const renderList = (rows: TopPageRow[], title: string, icon: string) => (
		<div className="geo-top-pages__list">
			<div className="title">
				<i className={`adminfont-${icon}`} /> {title}
			</div>
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
							text={
								row.open_findings === 0
									? __('No issues', 'vulopilot')
									: row.open_findings === 1
										? __('1 issue', 'vulopilot')
										: sprintf(
												/* translators: %d is the number of open GEO issues. */
												__('%d issues', 'vulopilot'),
												row.open_findings
											)
							}
						/>
					),
				}))}
			/>
		</div>
	);

	return (
		<ColumnComponent grid={6} fullHeight>
		<CardComponent
			id={id || 'geo-top-pages'}
			title={title || __('Your Best & Worst Pages', 'vulopilot')}
			titleIcon="bar-chart"
			desc={
				desc ||
				__(
					'Which pages AI already likes, and which need the most work.',
					'vulopilot'
				)
			}
			isLoading={isLoading}
			action={
				onViewAll && (
					<ButtonInput
						buttons={{
							text: `${__('View all', 'vulopilot')} ›`,
							color: 'text-purple',
							onClick: onViewAll,
						}}
					/>
				)
			}
		>
			{data && data.top.length > 0 ? (
				<ColumnComponent row>
					{renderList(
						data.top,
						topLabel || __('AI likes these pages already', 'vulopilot'),
						'check'
					)}
					{data.bottom.length > 0 &&
						renderList(
							data.bottom,
							bottomLabel || __('Needs attention', 'vulopilot'),
							'error'
						)}
				</ColumnComponent>
			) : (
				<div className="desc">
					{__(
						'No published pages yet — publish some content to see this ranking.',
						'vulopilot'
					)}
				</div>
			)}
		</CardComponent>
		</ColumnComponent>
	);
};

export default TopPagesCard;
