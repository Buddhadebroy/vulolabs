import { __ } from '@wordpress/i18n';
import { renderEngineView, type EngineView } from '../../components/EngineScreen/EngineScreen';

interface ShippingEngineProps {
	/** `zones`|`packaging`|`shipments`|`returns`|`pickup` (vulocart-pro's Shipping Engine module) - anything else shows `zones`. */
	view: string | null;
}

const moduleId = 'shipping-engine';

const views: Record< string, EngineView > = {
	zones: {
		title: __( 'Zones & Rates', 'vulocart' ),
		description: __( 'Zone-matched rates layer on top of the free flat-rate/free-shipping fallback - they never replace it.', 'vulocart' ),
		icon: 'shipping',
		module: moduleId,
		pro: true,
	},
	packaging: {
		title: __( 'Packaging', 'vulocart' ),
		description: __( 'Box and envelope presets used to size shipments and quote rates.', 'vulocart' ),
		icon: 'shipping',
		module: moduleId,
		pro: true,
	},
	shipments: {
		title: __( 'Shipments', 'vulocart' ),
		description: __( 'Every shipment across every order. Create a new one from the order\'s own edit page.', 'vulocart' ),
		icon: 'shipping',
		module: moduleId,
		pro: true,
	},
	returns: {
		title: __( 'Returns', 'vulocart' ),
		description: __( 'Request, approve or reject, receive the item, then refund.', 'vulocart' ),
		icon: 'shipping',
		module: moduleId,
		pro: true,
	},
	pickup: {
		title: __( 'Pickup', 'vulocart' ),
		description: __( 'Orders fulfilled by local pickup instead of shipping.', 'vulocart' ),
		icon: 'shipping',
		module: moduleId,
		pro: true,
	},
};

/** Free owns the frame; the Shipping Engine module (vulocart-pro) registers every view into `vulocart_shipping_view`. */
export function ShippingEngine( { view }: ShippingEngineProps ) {
	return renderEngineView( 'vulocart_shipping_view', views, view && views[ view ] ? view : 'zones' );
}

export default ShippingEngine;
