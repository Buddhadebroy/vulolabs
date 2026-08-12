import { __ } from '@wordpress/i18n';
import { CardComponent, ColumnComponent, ContainerComponent } from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';

/**
 * The full, searchable/paginated category-'performance' FindingsTable —
 * "Improve Speed"'s own OverviewTab.tsx (wrapped in
 * `#performance-section-findings`) is this component's only remaining call
 * site — Security.tsx's own former "Performance" tab, which used to import
 * this same component, is gone (redundant with this one). Titled "Top
 * Issues" rather than "Performance" since it replaced the standalone
 * condensed "Top Issues" glimpse card (TopIssuesCard.tsx, an
 * OpenIssuesGlimpse instance) that used to sit above it on the same page —
 * this full table is now the one and only "Top Issues" view.
 *
 * FindingsTable's own `title` prop only renders in its error state (its
 * normal-state `TableCard` never shows one) — wrapped in a CardComponent
 * here for a real visible heading, same "wrap FindingsTable in its own
 * CardComponent title" pattern SeoTab.tsx's own per-section usage already
 * established.
 */
const PerformanceTab = () => {
	return (
			<CardComponent title={__('Top Issues', 'vulopilot')}>
				<FindingsTable
					title={__('Top Issues', 'vulopilot')}
					description={__(
						'No performance findings yet — run a scan to check caching, heavy plugins, large images, and slow pages.',
						'vulopilot'
					)}
					category="performance"
				/>
			</CardComponent>
	);
};

export default PerformanceTab;
