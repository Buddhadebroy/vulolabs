/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import ProLockedCard from '../../components/ProLockedCard';
import { useFilterSlot } from '../../services/useFilterSlot';

const isGeoInsightsActive = () =>
	appLocalizer.active_modules?.includes('geo-insights') ?? false;

/**
 * "Visibility Trend" — no Free-tier trend data exists for any of the
 * mockup's three series (Organic Traffic, AI Search Visibility, Brand
 * Mentions). Reuses the exact `vulopilot_geo_visibility_trend` Pro filter
 * slot GeoTab.tsx already declares (GeoInsights' real sitewide GEO score
 * history) instead of fabricating a 3-line chart with no backing data.
 */
const VisibilityTrendCard = () => {
	const GeoVisibilityTrend = useFilterSlot('vulopilot_geo_visibility_trend');

	return (
		<CardComponent title={__('Visibility Trend', 'vulopilot')} titleIcon="analytics">
			{isGeoInsightsActive() && GeoVisibilityTrend ? (
				<GeoVisibilityTrend />
			) : (
				<ProLockedCard moduleName="geo-insights" />
			)}
		</CardComponent>
	);
};

export default VisibilityTrendCard;
