/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ColumnComponent } from '@zyra/components';

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

/**
 * GEO page's "Top Pages" card — `GET /geo-analysis/top-pages`
 * (Controllers\GeoAnalysis, Free — a deterministic ranking over
 * already-persisted `vulopilot_scan_findings` rows, no AI call). Ranks by
 * open `geo`-category finding count per post rather than
 * GeoAnalysis\GeoAnalyzer's own AI-judged score, since that score only
 * exists for posts someone has explicitly analyzed — see that
 * controller's own docblock.
 */
const TopPagesCard = () => {
	const [data, setData] = useState<TopPagesResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<TopPagesResponse>(
			getApiLink(appLocalizer, 'geo-analysis/top-pages'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setData(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	const renderList = (rows: TopPageRow[]) => (
		<ul className="geo-top-pages__list">
			{rows.map((row) => (
				<li key={row.post_id}>
					<a href={row.edit_link}>{row.title}</a>
					<span className="geo-top-pages__count">
						{row.open_findings === 0
							? __('No open findings', 'vulopilot')
							: row.open_findings === 1
								? __('1 open finding', 'vulopilot')
								: `${row.open_findings} ${__('open findings', 'vulopilot')}`}
					</span>
				</li>
			))}
		</ul>
	);

	return (
		<CardComponent
			title={__('Top Pages', 'vulopilot')}
			desc={__(
				'Ranked by open GEO findings — fewer findings means the page is more AI-visibility ready.',
				'vulopilot'
			)}
			isLoading={isLoading}
		>
			{data && data.top.length > 0 ? (
				<>
					<ColumnComponent>
						<h4>{__('Most AI-visible', 'vulopilot')}</h4>
						{renderList(data.top)}
					</ColumnComponent>
					{data.bottom.length > 0 && (
						<ColumnComponent>
							<h4>{__('Needs attention', 'vulopilot')}</h4>
							{renderList(data.bottom)}
						</ColumnComponent>
					)}
				</>
			) : (
				<p>
					{__(
						'No published pages yet — publish some content to see this ranking.',
						'vulopilot'
					)}
				</p>
			)}
		</CardComponent>
	);
};

export default TopPagesCard;
