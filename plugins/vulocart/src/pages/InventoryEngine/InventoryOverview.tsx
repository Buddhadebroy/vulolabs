/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { fetchInventory, openInventoryTab, setTracking, type InventoryItem } from '../Inventory/inventory';
import { StockAdjust } from '../Inventory/InventoryPage';
import { showToast } from '../../lib/rest-errors';
import '../Inventory/inventory-page.scss';
import './inventory-overview.scss';

const QUEUE_LIMIT = 8;
const UNTRACKED_LIMIT = 4;

/**
 * Only products with "Track stock" on have a stock level the shop acts on: with it off the storefront ignores the
 * quantity (ProductView.php), so such a product never sells out and its number means nothing. Those are counted apart.
 *
 * Sold out: a tracked product marked out of stock, or with no units left and no backorders. A tracked product at 0
 * still says "in stock" until someone changes it, but it has nothing to sell, so it counts as sold out here.
 */
const isSoldOut = ( item: InventoryItem ) =>
	item.stock_management && ( 'out_of_stock' === item.stock_status || ( null !== item.stock_quantity && item.stock_quantity <= 0 && 'backorder' !== item.stock_status ) );

/** Low: a tracked product at or under the store's low-stock level (worked out by the server), and not sold out. */
const isLow = ( item: InventoryItem ) => item.stock_management && ! isSoldOut( item ) && item.low_stock;

const goTo = ( view: string ) => ( event: { preventDefault: () => void } ) => {
	event.preventDefault();
	openInventoryTab( view );
};

/**
 * The Inventory page's dashboard, built around what to do next: one line saying what needs doing, the restock queue
 * (sold out first, then the lowest) with a Restock button on every row that opens the stock dialog in place, and on
 * the side the overall stock health, products that sell without a stock count, and shortcuts. vulocart-pro adds its
 * forecast and recent activity below through `vulocart_inventory_overview`.
 */
export function InventoryOverview() {
	const [ items, setItems ] = useState< InventoryItem[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ restocking, setRestocking ] = useState< InventoryItem | null >( null );
	const [ tracking, setTrackingIds ] = useState< number[] >( [] );

	useEffect( () => {
		fetchInventory()
			.then( setItems )
			.finally( () => setIsLoading( false ) );
	}, [] );

	const tracked = items.filter( ( item ) => item.stock_management );
	const untracked = items.filter( ( item ) => ! item.stock_management );
	const soldOut = items.filter( isSoldOut );
	const low = items.filter( isLow );
	const backorder = tracked.filter( ( item ) => ! isSoldOut( item ) && ! isLow( item ) && 'backorder' === item.stock_status );
	const healthy = Math.max( 0, tracked.length - soldOut.length - low.length - backorder.length );
	const units = tracked.reduce( ( sum, item ) => sum + Math.max( 0, item.stock_quantity ?? 0 ), 0 );

	// Sold out first, then the fewest units left.
	// With nothing tracked yet (and the list loaded), the main column is "Start tracking stock" instead of the queue.
	const startTracking = ! isLoading && ! tracked.length && untracked.length > 0;

	const queue = [ ...soldOut, ...low ].sort( ( a, b ) => Number( isSoldOut( b ) ) - Number( isSoldOut( a ) ) || ( a.stock_quantity ?? 0 ) - ( b.stock_quantity ?? 0 ) );

	const replace = ( updated: InventoryItem ) => setItems( ( current ) => current.map( ( item ) => ( item.id === updated.id ? updated : item ) ) );

	// "Track stock" for one product, or for all of them; each row updates as its answer comes back.
	const track = ( targets: InventoryItem[] ) => {
		setTrackingIds( ( current ) => [ ...current, ...targets.map( ( item ) => item.id ) ] );

		Promise.allSettled(
			targets.map( ( item ) =>
				setTracking( item.id, true )
					.then( replace )
					.finally( () => setTrackingIds( ( current ) => current.filter( ( id ) => id !== item.id ) ) )
			)
		).then( ( results ) => {
			const failed = results.filter( ( result ) => 'rejected' === result.status ).length;

			if ( failed ) {
				showToast( 'error', sprintf( /* translators: %d: number of products. */ _n( 'Could not turn on tracking for %d product.', 'Could not turn on tracking for %d products.', failed, 'vulocart' ), failed ) );
			} else {
				showToast(
					'success',
					1 === targets.length
						? sprintf( /* translators: %s: product name. */ __( 'Now tracking stock for %s.', 'vulocart' ), targets[ 0 ].title )
						: sprintf( /* translators: %d: number of products. */ __( 'Now tracking stock for %d products.', 'vulocart' ), targets.length )
				);
			}
		} );
	};

	const saved = ( updated: InventoryItem ) => {
		replace( updated );
		showToast(
			'success',
			isSoldOut( updated ) || isLow( updated )
				? sprintf( /* translators: %s: product name. */ __( '%s updated. It still needs restocking.', 'vulocart' ), updated.title )
				: sprintf( /* translators: %s: product name. */ __( '%s is restocked.', 'vulocart' ), updated.title )
		);
	};

	// The one sentence at the top: what to do now, or that nothing needs doing.
	let tone = 'good';
	let headline = __( 'All stocked. Nothing needs restocking right now.', 'vulocart' );
	let detail = sprintf( /* translators: %d: number of products. */ _n( '%d tracked product is above its low-stock level.', '%d tracked products are above their low-stock level.', tracked.length, 'vulocart' ), tracked.length );
	let focusAction: ReactNode = null;

	if ( isLoading ) {
		tone = 'neutral';
		headline = __( 'Checking your stock…', 'vulocart' );
		detail = '';
	} else if ( ! items.length ) {
		tone = 'neutral';
		headline = __( 'No products to track yet', 'vulocart' );
		detail = __( 'Physical products, rentals, bundles and gift cards show here once you add them.', 'vulocart' );
	} else if ( queue.length ) {
		tone = soldOut.length ? 'bad' : 'warn';
		headline = sprintf( /* translators: %d: number of products. */ _n( '%d product needs restocking', '%d products need restocking', queue.length, 'vulocart' ), queue.length );
		detail = soldOut.length
			? 1 === soldOut.length
				? sprintf( /* translators: %s: product name. */ __( '%s is sold out, so shoppers cannot buy it.', 'vulocart' ), soldOut[ 0 ].title )
				: sprintf( /* translators: %d: number of products. */ __( '%d are sold out, so shoppers cannot buy them.', 'vulocart' ), soldOut.length )
			: __( 'They are running low. Restock before they sell out.', 'vulocart' );
		focusAction = (
			<button type="button" className="vulocart-inv-btn is-primary" onClick={ () => setRestocking( queue[ 0 ] ) }>
				{ sprintf( /* translators: %s: product name. */ __( 'Restock %s', 'vulocart' ), queue[ 0 ].title ) }
			</button>
		);
	} else if ( untracked.length ) {
		tone = 'warn';
		headline = sprintf( /* translators: %d: number of products. */ _n( '%d product sells without a stock count', '%d products sell without a stock count', untracked.length, 'vulocart' ), untracked.length );
		detail = __( 'They never sell out, so you can sell more than you have. Track their stock to be told before they run out.', 'vulocart' );
		focusAction = (
			<button type="button" className="vulocart-inv-btn is-primary" disabled={ tracking.length > 0 } onClick={ () => track( untracked ) }>
				{ sprintf( /* translators: %d: number of products. */ _n( 'Track stock for %d product', 'Track stock for all %d', untracked.length, 'vulocart' ), untracked.length ) }
			</button>
		);
	}

	const segments = [
		{ key: 'good', label: __( 'Healthy', 'vulocart' ), value: healthy, view: 'stock' },
		{ key: 'warn', label: __( 'Low', 'vulocart' ), value: low.length, view: 'stock' },
		{ key: 'info', label: __( 'Backorder', 'vulocart' ), value: backorder.length, view: 'stock' },
		{ key: 'bad', label: __( 'Sold out', 'vulocart' ), value: soldOut.length, view: 'stock' },
		{ key: 'none', label: __( 'Not tracked', 'vulocart' ), value: untracked.length, view: 'stock' },
	];

	const extra = applyFilters( 'vulocart_inventory_overview', null, { items } ) as ReactNode;

	return (
		<div className="vulocart-inv-dash">
			{ /* 1. What to do now. */ }
			<section className={ `vulocart-inv-focus is-${ tone }` } aria-live="polite">
				<span className="vulocart-inv-focus-icon" aria-hidden="true">
					<i className={ `adminfont-${ 'good' === tone ? 'check' : 'neutral' === tone ? 'store-inventory' : 'out-of-stock' }` } />
				</span>
				<div className="vulocart-inv-focus-text">
					<h2>{ headline }</h2>
					{ detail && <p>{ detail }</p> }
				</div>
				{ focusAction }
			</section>

			<div className="vulocart-inv-cols">
				{ /* 2a. Nothing tracked yet: the main task is turning tracking on, product by product. */ }
				{ startTracking && (
					<section className="vulocart-inv-card vulocart-inv-queue">
						<header className="vulocart-inv-card-head">
							<div>
								<h3>
									{ __( 'Start tracking stock', 'vulocart' ) }
									<span className="vulocart-inv-count">{ untracked.length }</span>
								</h3>
								<p>{ __( 'Turn tracking on and the count below starts to matter: sales take from it, and you are told when it runs low.', 'vulocart' ) }</p>
							</div>
							<a href="#stock" onClick={ goTo( 'stock' ) }>
								{ __( 'All stock levels', 'vulocart' ) }
								<i className="adminfont-arrow-right" aria-hidden="true" />
							</a>
						</header>
						<ul className="vulocart-inv-queue-list">
							{ untracked.slice( 0, QUEUE_LIMIT ).map( ( item ) => (
								<li key={ item.id } className="is-none">
									<span className="vulocart-inv-qty" title={ __( 'Units on record (not used until tracking is on)', 'vulocart' ) }>
										<strong>{ null === item.stock_quantity ? '–' : Math.max( 0, item.stock_quantity ) }</strong>
										<small>{ __( 'on record', 'vulocart' ) }</small>
									</span>
									<a className="vulocart-inv-queue-main" href={ `admin.php?page=products&action=edit&id=${ item.id }` }>
										<strong>{ item.title }</strong>
										<span>
											<span className="vulocart-inv-pill is-none">{ __( 'Not tracked', 'vulocart' ) }</span>
											{ item.sku && <span className="vulocart-inv-sku">{ item.sku }</span> }
										</span>
									</a>
									<button type="button" className="vulocart-inv-btn" disabled={ tracking.includes( item.id ) } onClick={ () => track( [ item ] ) }>
										{ tracking.includes( item.id ) ? __( 'Turning on…', 'vulocart' ) : __( 'Track stock', 'vulocart' ) }
									</button>
								</li>
							) ) }
						</ul>
						{ untracked.length > QUEUE_LIMIT && (
							<a className="vulocart-inv-more-link" href="#stock" onClick={ goTo( 'stock' ) }>
								{ sprintf( /* translators: %d: number of products. */ _n( 'See %d more product', 'See %d more products', untracked.length - QUEUE_LIMIT, 'vulocart' ), untracked.length - QUEUE_LIMIT ) }
							</a>
						) }
					</section>
				) }

				{ /* 2b. The restock queue. */ }
				{ ! startTracking && (
				<section className="vulocart-inv-card vulocart-inv-queue">
					<header className="vulocart-inv-card-head">
						<div>
							<h3>
								{ __( 'Restock queue', 'vulocart' ) }
								{ queue.length > 0 && <span className="vulocart-inv-count">{ queue.length }</span> }
							</h3>
							<p>{ __( 'Sold out first, then the fewest units left.', 'vulocart' ) }</p>
						</div>
						<a href="#stock" onClick={ goTo( 'stock' ) }>
							{ __( 'All stock levels', 'vulocart' ) }
							<i className="adminfont-arrow-right" aria-hidden="true" />
						</a>
					</header>

					{ isLoading && <div className="vulocart-inv-skeleton" /> }

					{ ! isLoading && ! queue.length && (
						<div className="vulocart-inv-clear">
							<i className="adminfont-check" aria-hidden="true" />
							<strong>{ __( 'Nothing to restock', 'vulocart' ) }</strong>
							<span>
								{ tracked.length
									? __( 'Tracked products show here when they reach the low-stock level or sell out.', 'vulocart' )
									: __( 'No product tracks its stock yet. Turn tracking on and they show here when they run low.', 'vulocart' ) }
							</span>
						</div>
					) }

					{ ! isLoading && queue.length > 0 && (
						<ul className="vulocart-inv-queue-list">
							{ queue.slice( 0, QUEUE_LIMIT ).map( ( item ) => {
								const out = isSoldOut( item );

								return (
									<li key={ item.id } className={ out ? 'is-out' : 'is-low' }>
										<span className="vulocart-inv-qty" title={ __( 'Units in stock', 'vulocart' ) }>
											<strong>{ Math.max( 0, item.stock_quantity ?? 0 ) }</strong>
											<small>{ __( 'left', 'vulocart' ) }</small>
										</span>
										<a className="vulocart-inv-queue-main" href={ `admin.php?page=products&action=edit&id=${ item.id }` }>
											<strong>{ item.title }</strong>
											<span>
												<span className={ `vulocart-inv-pill ${ out ? 'is-out' : 'is-low' }` }>{ out ? __( 'Sold out', 'vulocart' ) : __( 'Low stock', 'vulocart' ) }</span>
												{ item.sku && <span className="vulocart-inv-sku">{ item.sku }</span> }
											</span>
										</a>
										<button type="button" className={ `vulocart-inv-btn${ out ? ' is-primary' : '' }` } onClick={ () => setRestocking( item ) }>
											<i className="adminfont-plus" aria-hidden="true" />
											{ __( 'Restock', 'vulocart' ) }
										</button>
									</li>
								);
							} ) }
						</ul>
					) }

					{ queue.length > QUEUE_LIMIT && (
						<a className="vulocart-inv-more-link" href="#stock" onClick={ goTo( 'stock' ) }>
							{ sprintf( /* translators: %d: number of products. */ _n( 'See %d more product', 'See %d more products', queue.length - QUEUE_LIMIT, 'vulocart' ), queue.length - QUEUE_LIMIT ) }
						</a>
					) }
				</section>
				) }

				{ /* 3. Where stock stands, and the side tasks. */ }
				<aside className="vulocart-inv-side">
					<section className="vulocart-inv-card">
						<header className="vulocart-inv-card-head">
							<div>
								<h3>{ __( 'Stock health', 'vulocart' ) }</h3>
								<p>
									{ isLoading
										? __( 'Loading…', 'vulocart' )
										: sprintf(
												/* translators: 1: number of units, 2: number of tracked products. */
												_n( '%1$s units across %2$d tracked product', '%1$s units across %2$d tracked products', tracked.length, 'vulocart' ),
												units.toLocaleString(),
												tracked.length
										  ) }
								</p>
							</div>
						</header>
						{ items.length > 0 && (
							<>
								<div className="vulocart-inv-health" role="img" aria-label={ segments.map( ( segment ) => `${ segment.label }: ${ segment.value }` ).join( ', ' ) }>
									{ segments.map( ( segment ) => segment.value > 0 && <span key={ segment.key } className={ `is-${ segment.key }` } style={ { flexGrow: segment.value } } /> ) }
								</div>
								<ul className="vulocart-inv-health-list">
									{ segments.map( ( segment ) => (
										<li key={ segment.key }>
											<a href="#stock" onClick={ goTo( segment.view ) }>
												<i className={ `is-${ segment.key }` } aria-hidden="true" />
												<span>{ segment.label }</span>
												<strong>{ segment.value }</strong>
											</a>
										</li>
									) ) }
								</ul>
							</>
						) }
					</section>

					{ ! startTracking && untracked.length > 0 && (
						<section className="vulocart-inv-card vulocart-inv-warn">
							<h3>
								<i className="adminfont-info" aria-hidden="true" />
								{ sprintf( /* translators: %d: number of products. */ _n( '%d product is not tracking stock', '%d products are not tracking stock', untracked.length, 'vulocart' ), untracked.length ) }
							</h3>
							<p>{ __( 'They keep selling with no count. Track them to get low-stock warnings and stop overselling.', 'vulocart' ) }</p>
							<ul className="vulocart-inv-untracked">
								{ untracked.slice( 0, UNTRACKED_LIMIT ).map( ( item ) => (
									<li key={ item.id }>
										<a href={ `admin.php?page=products&action=edit&id=${ item.id }` }>{ item.title }</a>
										<button type="button" className="vulocart-inv-btn is-small" disabled={ tracking.includes( item.id ) } onClick={ () => track( [ item ] ) }>
											{ tracking.includes( item.id ) ? __( 'Turning on…', 'vulocart' ) : __( 'Track', 'vulocart' ) }
										</button>
									</li>
								) ) }
							</ul>
							{ untracked.length > UNTRACKED_LIMIT && (
								<button type="button" className="vulocart-inv-btn" disabled={ tracking.length > 0 } onClick={ () => track( untracked ) }>
									{ sprintf( /* translators: %d: number of products. */ __( 'Track all %d', 'vulocart' ), untracked.length ) }
								</button>
							) }
						</section>
					) }

					<section className="vulocart-inv-card">
						<h3 className="vulocart-inv-side-title">{ __( 'Shortcuts', 'vulocart' ) }</h3>
						<ul className="vulocart-inv-links">
							<li>
								<a href="#stock" onClick={ goTo( 'stock' ) }>
									<i className="adminfont-store-inventory" aria-hidden="true" />
									{ __( 'Adjust stock levels', 'vulocart' ) }
								</a>
							</li>
							<li>
								<a href="admin.php?page=products&action=add">
									<i className="adminfont-plus" aria-hidden="true" />
									{ __( 'Add a product', 'vulocart' ) }
								</a>
							</li>
							<li>
								<a href={ `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=settings&subtab=general` }>
									<i className="adminfont-setting" aria-hidden="true" />
									{ __( 'Change the low-stock level', 'vulocart' ) }
								</a>
							</li>
						</ul>
					</section>
				</aside>
			</div>

			{ extra && <div className="vulocart-inv-overview vulocart-inv-extra">{ extra }</div> }

			{ restocking && <StockAdjust item={ restocking } onClose={ () => setRestocking( null ) } onSaved={ saved } /> }
		</div>
	);
}

export default InventoryOverview;
