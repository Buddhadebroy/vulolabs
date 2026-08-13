import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import type { CategoryTile } from './reportsOverview';

interface ReportsCategoryStatusGridProps {
	categories: CategoryTile[];
	isLoading: boolean;
}

const statusClass = (status: string): string => {
	if (status === 'Improving' || status === 'Excellent') {
		return 'is-good';
	}
	if (status === 'Needs attention') {
		return 'is-attention';
	}
	if (status === 'Not applicable') {
		return 'is-neutral';
	}
	return 'is-ok';
};

/**
 * "How is each part of my website doing?" — 7 tiles, one per real
 * category `GET /reports-overview`'s own `categories` array already
 * scores + labels honestly (Controllers\ReportsOverview::build_categories()
 * — "Not applicable" for Store when WooCommerce is inactive, real deltas
 * everywhere else). Same category set CategoryScoresGrid.tsx (this tab's
 * previous version) covered, now with a real status word and a real delta
 * arrow per tile instead of just a bare score.
 */
const ReportsCategoryStatusGrid = ({
	categories,
	isLoading,
}: ReportsCategoryStatusGridProps) => (
	<div className="reports-category-grid-wrap">
		<h3 className="reports-section-title">
			{__('How is each part of my website doing?', 'vulopilot')}
		</h3>
		<div className="reports-category-grid">
			{isLoading || categories.length === 0
				? Array.from({ length: 7 }).map((_, index) => (
						// eslint-disable-next-line react/no-array-index-key -- fixed-length skeleton placeholders, no stable id exists yet.
						<CardComponent
							key={index}
							isLoading
							className="reports-category-tile"
						/>
					))
				: categories.map((category) => (
						<CardComponent
							key={category.key}
							className="reports-category-tile"
						>
							<i className={`adminfont-${category.icon}`} />
							<p className="reports-category-tile-title">
								{category.label}
							</p>
							<p className="reports-category-tile-sublabel">
								{category.sublabel}
							</p>
							<p
								className={`reports-category-tile-status ${statusClass(category.status)}`}
							>
								{category.status}
							</p>
							{category.delta !== null && category.delta !== 0 && (
								<p
									className={`reports-category-tile-delta ${category.delta > 0 ? 'is-good' : 'is-attention'}`}
								>
									{category.delta > 0 ? '↑' : '↓'}{' '}
									{Math.abs(category.delta)}
								</p>
							)}
						</CardComponent>
					))}
		</div>
	</div>
);

export default ReportsCategoryStatusGrid;
