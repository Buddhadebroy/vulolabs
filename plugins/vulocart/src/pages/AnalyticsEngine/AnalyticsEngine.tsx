import { __ } from '@wordpress/i18n';
import { renderEngineView, type EngineView } from '../../components/EngineScreen/EngineScreen';

interface AnalyticsEngineProps {
	view: string | null;
}

const views: Record< string, EngineView > = {
	dashboard: {
		title: __( 'Analytics', 'vulocart' ),
		description: __(
			'Sales, revenue, customers, products, funnels, abandonment, conversion, lifetime value, retention and inventory in one place.',
			'vulocart'
		),
		icon: 'analytics',
		module: 'analytics',
		pro: true,
	},
};

/** Free owns the frame; the Analytics module (vulocart-pro) registers the dashboard into `vulocart_analytics_view`. */
export function AnalyticsEngine( { view }: AnalyticsEngineProps ) {
	return renderEngineView( 'vulocart_analytics_view', views, view && views[ view ] ? view : 'dashboard' );
}

export default AnalyticsEngine;
