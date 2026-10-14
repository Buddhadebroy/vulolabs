import { ProductsListing } from './ProductsListing';
import { ProductDetail } from './ProductDetail';

/**
 * Dual-mode, same URL: listing by default, one product's detail view
 * when `?product={id}` is present - the same query-string-driven
 * mode-switch convention this plugin's own wp-admin pages already use
 * (Menu.php's `add_orders_menu()`/`add_products_menu()` docblocks), just
 * applied to a public storefront page instead of wp-admin. Avoids needing
 * a block-editor "pick the product page" control: a store owner adds one
 * `vulocart/products` block to one page, and every product's link
 * (`ProductsListing.tsx`'s card links) just appends `?product={id}` to
 * that same page's own URL.
 */
export function Products( { template, columns }: { template?: string; columns?: number } ) {
	const params = new URLSearchParams( window.location.search );
	const productId = params.get( 'product' );

	if ( productId ) {
		return <ProductDetail id={ Number( productId ) } />;
	}

	return <ProductsListing template={ template } columns={ columns } />;
}
