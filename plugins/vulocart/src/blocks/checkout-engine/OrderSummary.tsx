/* global vulocartFrontendData */
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { CartResponse } from '../shared/cart';
import { formatMoney } from '../shared/money';
import { billingText } from '../../lib/priceText';
import type { CheckoutSummary } from './registry';

interface OrderSummaryProps {
	cart: CartResponse | null;
	summary: CheckoutSummary | null;
	/** Whether a shipping method has been picked yet (until then shipping shows as "next step"). */
	hasShipping: boolean;
}

/**
 * The checkout's order summary: what is being bought and the live total. Sits beside the steps on a wide
 * container and above them on a narrow one (a popup, a phone), where the item list folds away behind a toggle so
 * the form stays in reach. The numbers come from the engine's `/review/summary` call, so shipping, tax and a
 * coupon's discount appear here the moment they apply.
 */
export function OrderSummary( { cart, summary, hasShipping }: OrderSummaryProps ) {
	const [ isOpen, setIsOpen ] = useState( false );

	if ( ! cart ) {
		return null;
	}

	const currency = summary?.currency ?? cart.totals.currency ?? cart.currency;
	const subtotal = summary?.subtotal ?? cart.totals.subtotal;
	const shipping = summary?.shipping_cost ?? 0;
	const tax = summary?.tax_amount ?? 0;
	const total = summary?.total ?? cart.totals.total;
	const discount = summary ? Math.max( 0, Math.round( ( summary.subtotal + summary.shipping_cost + summary.tax_amount - summary.total ) * 100 ) / 100 ) : 0;
	// Tax-inclusive prices already contain these amounts, so they are shown under the total instead of added to it.
	const taxLines = summary?.prices_include_tax ? [] : summary?.tax_lines ?? [];
	const taxIncluded = summary?.prices_include_tax ? summary.tax_included ?? 0 : 0;
	const count = cart.items.reduce( ( sum, item ) => sum + item.quantity, 0 );

	return (
		<aside className={ `vulocart-checkout-summary${ isOpen ? ' is-open' : '' }` } aria-label={ __( 'Order summary', 'vulocart' ) }>
			<div className="vulocart-checkout-summary-head">
				<button type="button" className="vulocart-checkout-summary-toggle" aria-expanded={ isOpen } onClick={ () => setIsOpen( ! isOpen ) }>
					<span>
						{ isOpen ? __( 'Hide order summary', 'vulocart' ) : sprintf( /* translators: %d: number of items. */ _n( 'Show order summary (%d item)', 'Show order summary (%d items)', count, 'vulocart' ), count ) }
					</span>
					<strong>{ formatMoney( total, currency ) }</strong>
				</button>
				<h2>{ __( 'Order summary', 'vulocart' ) }</h2>
				{ vulocartFrontendData.cartPageUrl && (
					<a className="vulocart-checkout-summary-edit" href={ vulocartFrontendData.cartPageUrl }>
						{ __( 'Edit cart', 'vulocart' ) }
					</a>
				) }
			</div>

			<div className="vulocart-checkout-summary-body">
				<ul className="vulocart-checkout-summary-items">
					{ cart.items.map( ( item ) => {
						const note = item.price ? [ item.price.label, billingText( item.price ) ].filter( Boolean ).join( ' · ' ) : '';

						return (
							<li key={ item.id }>
								<span className="vulocart-checkout-summary-thumb">
									{ item.image ? <img src={ item.image } alt="" loading="lazy" /> : null }
									<em aria-label={ sprintf( /* translators: %d: quantity. */ __( 'Quantity: %d', 'vulocart' ), item.quantity ) }>{ item.quantity }</em>
								</span>
								<span className="vulocart-checkout-summary-name">
									{ item.title }
									{ note && <small>{ note }</small> }
								</span>
								<strong>{ formatMoney( item.subtotal, item.currency ?? currency ) }</strong>
							</li>
						);
					} ) }
				</ul>

				<dl className="vulocart-checkout-summary-rows">
					<div>
						<dt>{ __( 'Subtotal', 'vulocart' ) }</dt>
						<dd>{ formatMoney( subtotal, currency ) }</dd>
					</div>
					<div>
						<dt>{ __( 'Shipping', 'vulocart' ) }</dt>
						<dd>{ hasShipping ? ( 0 === shipping ? __( 'Free', 'vulocart' ) : formatMoney( shipping, currency ) ) : __( 'Next step', 'vulocart' ) }</dd>
					</div>
					{ taxLines.map( ( line ) => (
						<div key={ `${ line.name }-${ line.rate }` }>
							<dt>
								{ line.name } ({ line.rate }%)
							</dt>
							<dd>{ formatMoney( line.amount, currency ) }</dd>
						</div>
					) ) }
					{ 0 === taxLines.length && tax > 0 && (
						<div>
							<dt>{ __( 'Tax', 'vulocart' ) }</dt>
							<dd>{ formatMoney( tax, currency ) }</dd>
						</div>
					) }
					{ discount > 0 && (
						<div className="is-discount">
							<dt>{ __( 'Discount', 'vulocart' ) }</dt>
							<dd>−{ formatMoney( discount, currency ) }</dd>
						</div>
					) }
					<div className="is-total">
						<dt>{ __( 'Total', 'vulocart' ) }</dt>
						<dd>{ formatMoney( total, currency ) }</dd>
					</div>
					{ taxIncluded > 0 && (
						<div className="is-included">
							<dt>{ __( 'Includes tax', 'vulocart' ) }</dt>
							<dd>{ formatMoney( taxIncluded, currency ) }</dd>
						</div>
					) }
				</dl>
			</div>
		</aside>
	);
}
