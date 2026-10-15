import { __ } from '@wordpress/i18n';
import type { EngineView } from '../../components/EngineScreen/EngineScreen';
import { EngineTabs } from '../../components/EngineScreen/EngineTabs';

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

const pageHeader: EngineView = {
	title: __( 'Shipping', 'vulocart' ),
	description: __( 'Zones and rates, packaging, shipments, returns and local pickup.', 'vulocart' ),
	icon: 'shipping',
	module: moduleId,
};

/** One Shipping page with a tab per area; the Shipping Engine module (vulocart-pro) registers each into `vulocart_shipping_view`. */
export function ShippingEngine( { view }: ShippingEngineProps ) {
	return <EngineTabs header={ pageHeader } views={ views } filterName="vulocart_shipping_view" view={ view } />;
}

export default ShippingEngine;
