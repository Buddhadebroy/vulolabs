/* global vulocartLocalizer */
import { __ } from '@wordpress/i18n';
import type { EngineView } from '../../components/EngineScreen/EngineScreen';
import { EngineTabs } from '../../components/EngineScreen/EngineTabs';

interface FulfillmentEngineProps {
	/** `shipments`|`returns`|`pickup` (vulocart-pro's Fulfillment module) - anything else shows `shipments`. */
	view: string | null;
}

const moduleId = 'shipping';

const views: Record< string, EngineView > = {
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
	title: __( 'Shipment', 'vulocart' ),
	description: __( 'Ship orders, handle returns and local pickup. Zones, rates and packaging are set up in Settings → Shipping.', 'vulocart' ),
	icon: 'shipping',
	module: moduleId,
};

/** Configuration that used to be a tab here and now lives in Settings: old `&view=` links open that Settings sub-tab. */
const SETTINGS_VIEWS: Record< string, string > = { zones: 'shipping-zones', packaging: 'shipping-packaging' };

/** One Fulfillment page with a tab per area; the Fulfillment module (vulocart-pro) registers each into `vulocart_fulfillment_view`. */
export function FulfillmentEngine( { view }: FulfillmentEngineProps ) {
	if ( view && SETTINGS_VIEWS[ view ] ) {
		window.location.replace( `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=settings&subtab=${ SETTINGS_VIEWS[ view ] }` );
		return null;
	}

	return <EngineTabs header={ pageHeader } views={ views } filterName="vulocart_fulfillment_view" view={ view } />;
}

export default FulfillmentEngine;


