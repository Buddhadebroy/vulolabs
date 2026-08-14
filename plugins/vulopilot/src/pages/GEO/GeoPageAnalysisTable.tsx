/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { TableCard, TableRow } from '@zyra/table';
import { useApiList } from '../../services/useApiList';

interface PageAnalysisRow extends TableRow {
	post_id: number;
	title: string;
	edit_link: string;
	permalink: string;
	open_findings: number;
	visibility_score: number | null;
}

const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const ratingClass = (score: number): string => {
	if (score >= 70) {
		return 'is-good';
	}
	if (score >= 40) {
		return 'is-attention';
	}
	return 'is-poor';
};

const VisibilityCell = ({ row }: { row: PageAnalysisRow }) => {
	if (null === row.visibility_score) {
		return <span className="geo-page-visibility-empty">—</span>;
	}

	return (
		<div className={`geo-page-visibility-bar ${ratingClass(row.visibility_score)}`}>
			<div className="geo-page-visibility-track">
				<div
					className="geo-page-visibility-fill"
					style={{ width: `${row.visibility_score}%` }}
				/>
			</div>
			<span className="geo-page-visibility-value">
				{row.visibility_score}%
			</span>
		</div>
	);
};

/**
 * "Page-by-page analysis" — every published page/post
 * (`GET /geo-analysis/pages`, Controllers\GeoAnalysis::get_pages()), with
 * its real open-GEO-finding count and a real, deterministic (non-AI)
 * visibility percentage — the exact same formula
 * (GeoAnalyzer::score_from_failures()) GeoAnalyzer's own per-post
 * "Generate GEO score" card computes, just derived from already-persisted
 * scan findings instead of an AI call, so every page gets a real number
 * instead of only the handful someone has explicitly analyzed. `—` (not a
 * fabricated percentage) for a site with no GEO scan history at all yet
 * — see that endpoint's own docblock. Sortable/searchable/paginated same
 * as every other TableCard-backed list in this plugin; Export CSV mirrors
 * SlowPagesTab.tsx's own `handleExport()` shape.
 */
const GeoPageAnalysisTable = () => {
	const { data, total, isLoading, error, refetch, onQueryUpdate } =
		useApiList<PageAnalysisRow>('geo-analysis/pages', {
			orderby: 'open_findings',
			order: 'desc',
		});

	const handleExport = () => {
		const headerRow = ['Page', 'URL', 'Open Issues', 'AI Visibility (%)'];
		const lines = [headerRow.map(csvEscape).join(',')];

		data.forEach((row) => {
			const cells = [
				row.title,
				row.permalink,
				row.open_findings,
				row.visibility_score ?? '',
			];
			lines.push(cells.map((cell) => csvEscape(String(cell))).join(','));
		});

		const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'geo-page-analysis.csv';
		anchor.click();
		URL.revokeObjectURL(url);
	};

	return (
		<CardComponent
			title={__('Page-by-page analysis', 'vulopilot')}
			titleIcon="report"
			desc={__('Click a row to see full details.', 'vulopilot')}
			action={
				<button
					type="button"
					className="geo-page-analysis-export"
					onClick={handleExport}
				>
					<i className="adminfont-download" />
					{__('Export CSV', 'vulopilot')}
				</button>
			}
		>
			{error ? (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load pages', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={refetch}
				/>
			) : (
				<TableCard
					search={{ placeholder: __('Search pages…', 'vulopilot') }}
					headers={{
						title: {
							label: __('Page', 'vulopilot'),
							isSortable: true,
							render: (row: PageAnalysisRow) => (
								<a href={row.edit_link}>{row.title}</a>
							),
						},
						open_findings: {
							label: __('Open Issues', 'vulopilot'),
							isSortable: true,
							defaultSort: true,
							defaultOrder: 'desc',
						},
						visibility_score: {
							label: __('AI Visibility', 'vulopilot'),
							isSortable: true,
							render: (row: PageAnalysisRow) => (
								<VisibilityCell row={row} />
							),
						},
					}}
					rows={data}
					ids={data.map((row) => row.post_id)}
					totalRows={total}
					isLoading={isLoading}
					onQueryUpdate={onQueryUpdate}
					emptyMessage={__(
						'No published pages yet — publish some content to see this analysis.',
						'vulopilot'
					)}
				/>
			)}
		</CardComponent>
	);
};

export default GeoPageAnalysisTable;
