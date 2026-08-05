import { __ } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';

/**
 * "Performance" tab of "Improve Speed" — body extracted verbatim from the
 * former standalone Performance.tsx page (same "extract body, drop the
 * header" move every other folded-in tab this session already made) —
 * its own NavigatorHeaderComponent now lives once on Performance.tsx's
 * shared tab-shell header. Kept alongside the new Overview tab (rather
 * than replaced by it) since Overview's own "Top Issues" card is only a
 * 5-row glimpse of this exact same category's findings, not a
 * replacement for the full searchable/paginated table here — same
 * "condensed glimpse + full page coexist" reasoning `GeoTab.tsx` already
 * established for its own Overview/GEO split.
 */
const PerformanceTab = () => {
	return (
		<ContainerComponent general>
			<ColumnComponent>
				<FindingsTable
					title={__('Performance', 'vulopilot')}
					description={__(
						'No performance findings yet — run a scan to check caching, heavy plugins, large images, and slow pages.',
						'vulopilot'
					)}
					category="performance"
				/>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default PerformanceTab;
