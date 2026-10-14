/* global vulocartFrontendData */
import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { formatPrice } from './product';
import type { ProductSummary } from './product';

const TEMPLATES = [ 'grid', 'compact', 'list', 'showcase' ];

interface ProductCardsProps {
	products: ProductSummary[];
	/** Per-block override of Settings → Start from a template. */
	template?: string;
	columns?: number;
	/** Where a card links to; defaults to `?product={id}` on the current page. */
	hrefFor?: ( id: number ) => string;
	/** Rendered under (or, in the list layout, beside) each card - e.g. an "Add to cart" button. */
	renderAction?: ( product: ProductSummary ) => ReactNode;
}

const defaultHref = ( id: number ) => {
	const url = new URL( window.location.href );
	url.searchParams.set( 'product', String( id ) );
	return url.toString();
};

/**
 * The storefront's products layout - one implementation for the catalog block and the checkout
 * block's "Available Products", so Settings → Start from a template (grid / compact / list /
 * showcase, plus columns) changes both. Styled inline: the storefront ships no stylesheet.
 */
export function ProductCards( { products, template: templateOverride, columns: columnsOverride, hrefFor, renderAction }: ProductCardsProps ) {
	const template = templateOverride && TEMPLATES.includes( templateOverride ) ? templateOverride : vulocartFrontendData.listingTemplate || 'grid';
	const columns = columnsOverride && columnsOverride >= 2 && columnsOverride <= 5 ? columnsOverride : vulocartFrontendData.listingColumns || 4;
	const href = hrefFor || defaultHref;
	const isList = 'list' === template;
	const gap = 'compact' === template ? 12 : 'showcase' === template ? 28 : 20;
	// `columns` per row on wide screens, never narrower than a readable card: max() keeps the grid
	// responsive without a media query.
	const minCard = 'compact' === template ? '8rem' : 'showcase' === template ? '16rem' : '10.5rem';

	return (
		<div
			style={
				isList
					? { display: 'flex', flexDirection: 'column', gap: `${ gap }px` }
					: {
							display: 'grid',
							gridTemplateColumns: `repeat(auto-fill, minmax(max(${ minCard }, calc((100% - ${ ( columns - 1 ) * gap }px) / ${ columns })), 1fr))`,
							gap: `${ gap }px`,
					  }
			}
		>
			{ products.map( ( product ) => {
				const price = formatPrice( product );
				const outOfStock = product.meta?.stock_management && 'out_of_stock' === product.meta?.stock_status;
				const summary = ( product.meta?.short_description as string | undefined ) || '';
				const image = product.meta?.featured_image?.url;
				const action = renderAction ? renderAction( product ) : null;

				return (
					<div
						key={ product.id }
						style={ {
							display: 'flex',
							flexDirection: isList ? 'row' : 'column',
							alignItems: isList ? 'center' : 'stretch',
							border: '1px solid #e5e7eb',
							borderRadius: 'showcase' === template ? '14px' : '8px',
							overflow: 'hidden',
							background: '#fff',
							boxShadow: 'showcase' === template ? '0 6px 20px rgba(16, 24, 40, 0.08)' : undefined,
						} }
					>
						<a
							href={ href( product.id ) }
							style={ { display: isList ? 'flex' : 'block', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' } }
						>
							<div
								style={ {
									aspectRatio: 'showcase' === template ? '4 / 3' : '1 / 1',
									width: isList ? '9rem' : undefined,
									flex: isList ? 'none' : undefined,
									background: '#f3f4f6',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									overflow: 'hidden',
								} }
							>
								{ image ? (
									<img src={ image } alt={ product.title } style={ { width: '100%', height: '100%', objectFit: 'cover' } } />
								) : (
									<span style={ { color: '#9ca3af', fontSize: '13px' } }>{ __( 'No image', 'vulocart' ) }</span>
								) }
							</div>
							<div style={ { padding: 'compact' === template ? '8px 10px' : '12px 14px', flex: 1, minWidth: 0 } }>
								{ 'compact' !== template && (
									<div
										style={ {
											fontSize: '11px',
											textTransform: 'uppercase',
											letterSpacing: '0.04em',
											color: '#6b7280',
											marginBottom: '4px',
										} }
									>
										{ product.type }
									</div>
								) }
								<div style={ { fontWeight: 600, marginBottom: '4px', fontSize: 'showcase' === template ? '17px' : undefined } }>
									{ product.title }
								</div>
								{ ( isList || 'showcase' === template ) && summary && (
									<p style={ { margin: '0 0 8px', color: '#4b5563', fontSize: '13px' } }>{ summary }</p>
								) }
								<div style={ { fontSize: '14px', color: '#111827', fontWeight: isList ? 600 : undefined } }>
									{ outOfStock ? (
										<span style={ { color: '#dc2626' } }>{ __( 'Out of stock', 'vulocart' ) }</span>
									) : (
										price ?? __( 'Price not set', 'vulocart' )
									) }
								</div>
							</div>
						</a>
						{ action && <div style={ { padding: isList ? '0 14px' : '0 14px 14px' } }>{ action }</div> }
					</div>
				);
			} ) }
		</div>
	);
}
