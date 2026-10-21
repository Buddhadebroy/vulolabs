import { renderEngineView } from '../../components/EngineScreen/EngineScreen';
import { storeExtraViews } from '../Products/extraViews';

interface MarketingEngineProps {
	/** One of the `storeExtraViews` ids (coupons, gift-cards, abandoned-checkouts, ...) - anything else shows Coupons. */
	view: string | null;
}

/**
 * The Marketing menu. The free plugin owns the frame only; each page is registered by a vulocart-pro module into
 * `vulocart_marketing_view` (Coupons, Pricing Rules, Gift Cards, Abandoned Checkout, Checkout Links), one Marketing
 * submenu each. Without the module active the frame shows its "module required" state.
 */
export function MarketingEngine( { view }: MarketingEngineProps ) {
	return renderEngineView( 'vulocart_marketing_view', storeExtraViews, view && storeExtraViews[ view ] ? view : 'coupons' );
}

export default MarketingEngine;
