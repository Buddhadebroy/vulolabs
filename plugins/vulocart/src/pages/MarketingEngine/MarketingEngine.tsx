import { renderEngineView } from '../../components/EngineScreen/EngineScreen';
import { storeExtraViews } from '../Products/extraViews';

interface MarketingEngineProps {
	/** One of the `storeExtraViews` ids (coupons, gift-cards, abandoned-checkouts, ...) - anything else shows Coupons. */
	view: string | null;
}

/**
 * The Marketing menu. Free registers one submenu item per page (Coupons, Pricing Rules, Gift Cards, Cart Abandoned,
 * Payment Links - Admin\Menu::add_marketing_menu()) and owns the frame; each page is filled by a vulocart-pro module
 * through `vulocart_marketing_view`. Without the module - Pro missing, unlicensed or the module off - the page shows its
 * sample-data preview and what it takes to unlock it.
 */
export function MarketingEngine( { view }: MarketingEngineProps ) {
	return renderEngineView( 'vulocart_marketing_view', storeExtraViews, view && storeExtraViews[ view ] ? view : 'coupons' );
}

export default MarketingEngine;
