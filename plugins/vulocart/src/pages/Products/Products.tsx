import { ProductsList } from './ProductsList';
import { ProductEdit } from './ProductEdit';
import { TermsPage } from '../Terms/TermsPage';
import { AttributesPage } from '../Attributes/AttributesPage';
import { ProductTypesPage } from '../ProductTypes/ProductTypesPage';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { EngineScreen, renderEngineView } from '../../components/EngineScreen/EngineScreen';
import { movedViews, productsExtraViews, storeExtraViews } from './extraViews';

interface ProductsProps {
	action: string | null;
	id: number | null;
	/** `categories`|`collections`|`brands`|`tags`|`attributes`|`product-types`|`inventory`|`reviews`. */
	view: string | null;
}

/**
 * Branches between the list, the dedicated add/edit page, and every other
 * Products-menu sub-page (Categories/Collections/Brands/Attributes/
 * Product Types/Inventory/Reviews) based on the `action`/`id`/`view`
 * query params src/index.tsx parses from `location.search` on mount -
 * see Menu.php's `add_products_menu()` docblock for why this is
 * query-string-driven rather than a client-side route: every transition
 * here is a real browser navigation to a distinct
 * `admin.php?page=vulocart-products...` URL, matching WooCommerce's own
 * Products/Orders admin screens. Any `view` this file doesn't recognize
 * falls through to `vulocart_products_extra_view` before finally
 * defaulting to `ProductsList` - vulocart-pro's own Suppliers/Pricing
 * Rules/Product Templates/Bulk Editor/CSV Import admin pages register
 * their own `add_submenu_page()` entries under this same `vulocart-products`
 * parent slug (License\LicenseManager's own `register_menu()` already
 * establishes that Pro plugins registering submenu pages under a Free
 * top-level slug is a proven, working pattern in this codebase) with
 * `view=suppliers` etc., and hook into that filter to render there.
 */
export function Products( { action, id, view }: ProductsProps ) {
	if ( 'add' === action ) {
		return <ProductEdit id={ null } />;
	}

	if ( 'edit' === action && null !== id ) {
		return <ProductEdit id={ id } />;
	}

	if ( 'categories' === view ) {
		return (
			<TermsPage
				routeSegment="categories"
				itemLabel={ __( 'Category', 'vulocart' ) }
				headerTitle={ __( 'Categories', 'vulocart' ) }
				headerDescription={ __( 'Group products into a hierarchy of categories.', 'vulocart' ) }
				headerIcon="category"
				hierarchical
			/>
		);
	}

	if ( 'collections' === view ) {
		return (
			<TermsPage
				routeSegment="collections"
				itemLabel={ __( 'Collection', 'vulocart' ) }
				headerTitle={ __( 'Collections', 'vulocart' ) }
				headerDescription={ __( 'Manually-curated groups of products, e.g. "Summer Sale" or "Staff Picks".', 'vulocart' ) }
				headerIcon="folder-open"
			/>
		);
	}

	if ( 'brands' === view ) {
		return (
			<TermsPage
				routeSegment="brands"
				itemLabel={ __( 'Brand', 'vulocart' ) }
				headerTitle={ __( 'Brands', 'vulocart' ) }
				headerDescription={ __( 'The manufacturers/brands your products come from.', 'vulocart' ) }
				headerIcon="product"
			/>
		);
	}

	if ( 'tags' === view ) {
		return (
			<TermsPage
				routeSegment="tags"
				itemLabel={ __( 'Tag', 'vulocart' ) }
				headerTitle={ __( 'Tags', 'vulocart' ) }
				headerDescription={ __( 'Free-form labels products can carry, e.g. "clearance" or "eco-friendly".', 'vulocart' ) }
				headerIcon="feature"
			/>
		);
	}

	if ( 'attributes' === view ) {
		return <AttributesPage />;
	}

	if ( 'product-types' === view ) {
		return <ProductTypesPage />;
	}

	// Reviews moved to the VuloCart menu; keep old bookmarks working.
	if ( 'reviews' === view ) {
		window.location.replace( `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=reviews` );

		return null;
	}

	// Product Templates moved to Settings → Commerce; keep old bookmarks working.
	if ( 'product-templates' === view ) {
		window.location.replace( `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=settings&subtab=product-templates` );

		return null;
	}

	if ( view && movedViews[ view ] ) {
		window.location.replace( `${ vulocartLocalizer.adminUrl }admin.php?page=${ movedViews[ view ].page }&view=${ movedViews[ view ].view }` );

		return null;
	}

	// These moved to the Marketing menu; same for their old links.
	if ( view && storeExtraViews[ view ] ) {
		window.location.replace( `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart-marketing&view=${ view }` );

		return null;
	}

	if ( view ) {
		/**
		 * `vulocart_products_extra_view` - the same "Pro extends Free via
		 * filters" pattern `vulocart_product_row_actions`/
		 * `vulocart_product_edit_sections` already establish, extended to
		 * this router itself: a Pro module (e.g. vulocart-pro's Suppliers/
		 * Pricing Rules/Product Templates/Bulk Editor/CSV Import admin
		 * pages) can register its own `view` value here without this file
		 * knowing anything about it. Only consulted when `view` is a
		 * non-empty string this router didn't already recognize above -
		 * an unmatched/typo'd `view` still falls through to `ProductsList`
		 * exactly like it always has, so this is purely additive.
		 */
		if ( productsExtraViews[ view ] ) {
			return renderEngineView( 'vulocart_products_extra_view', productsExtraViews, view );
		}

		// A view only a third-party module knows about: no header/module metadata to show, so the
		// module's own page is wrapped in the frame as is.
		const extra = applyFilters( 'vulocart_products_extra_view', null, { view } );

		if ( extra ) {
			return <EngineScreen>{ extra }</EngineScreen>;
		}
	}

	return <ProductsList />;
}

export default Products;
