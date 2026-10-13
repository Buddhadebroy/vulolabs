import { renderEngineView } from '../../components/EngineScreen/EngineScreen';
import { movedViews, storeExtraViews } from '../Offerings/extraViews';

interface MarketingEngineProps {
	/** One of the `storeExtraViews` ids (coupons, gift-cards, subscriptions, ...) - anything else shows Coupons. */
	view: string | null;
}

/**
 * Free owns this menu's frame only; each page is registered by a vulocart-pro module into
 * `vulocart_marketing_view` (Coupons, Gift Cards, Subscriptions, Checkout Links, Checkout Builder,
 * Abandoned Checkouts). Without the module active the frame shows its "module required" state.
 */
export function MarketingEngine( { view }: MarketingEngineProps ) {
	if ( view && movedViews[ view ] ) {
		window.location.replace( `${ vulocartLocalizer.adminUrl }admin.php?page=${ movedViews[ view ].page }&view=${ movedViews[ view ].view }` );

		return null;
	}

	return renderEngineView( 'vulocart_marketing_view', storeExtraViews, view && storeExtraViews[ view ] ? view : 'coupons' );
}

export default MarketingEngine;
