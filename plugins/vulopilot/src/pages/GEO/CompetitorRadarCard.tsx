/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import ProLockedCard from '../../components/ProLockedCard';
import { useFilterSlot } from '../../services/useFilterSlot';

const isGeoInsightsActive = () =>
	appLocalizer.active_modules?.includes('geo-insights') ?? false;

/**
 * "Competitor Radar" — reuses the exact `vulopilot_geo_competitor_visibility`
 * Pro filter slot GeoTab.tsx already declares (GeoInsights'
 * GeoCompetitorVisibility, a real on-demand structural comparison against
 * competitor URLs configured in Settings → GEO). Same `ProLockedCard`
 * upsell when the module isn't active — not a fabricated competitor
 * table, since the mockup's numbers would otherwise have to be invented.
 */
const CompetitorRadarCard = () => {
	const GeoCompetitorVisibility = useFilterSlot(
		'vulopilot_geo_competitor_visibility'
	);

	return (
		<CardComponent title={__('Competitor Radar', 'vulopilot')} titleIcon="bar-chart">
			{isGeoInsightsActive() && GeoCompetitorVisibility ? (
				<GeoCompetitorVisibility />
			) : (
				<ProLockedCard moduleName="geo-insights" />
			)}
		</CardComponent>
	);
};

export default CompetitorRadarCard;
