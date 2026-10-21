import { useEffect, useState } from '@wordpress/element';
import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { fetchInventory, openInventoryTab, type InventoryItem } from '../Inventory/inventory';
import '../Inventory/inventory-page.scss';
import './inventory-overview.scss';

const ATTENTION_LIMIT = 6;

/**
 * The Inventory page's dashboard: where stock stands (tiles and a health bar) and what needs attention now. It is
 * the one place that summarises stock - the Stock Levels tab is just the table. vulocart-pro adds its forecast and
 * recent activity below through `vulocart_inventory_overview`, so nothing here is repeated in another tab.
 */
export function InventoryOverview() {
	const [ items, setItems ] = useState< InventoryItem[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );

	useEffect( () => {
		fetchInventory()
			.then( setItems )
			.finally( () => setIsLoading( false ) );
	}, [] );

	const count = ( test: ( item: InventoryItem ) => boolean ) => items.filter( test ).length;
	const out = count( ( item ) => 'out_of_stock' === item.stock_status );
	const low = count( ( item ) => item.low_stock && 'out_of_stock' !== item.stock_status );
	const backorder = count( ( item ) => 'backorder' === item.stock_status );
	const healthy = Math.max( 0, items.length - out - low - backorder );
	const units = items.reduce( ( sum, item ) => sum + ( item.stock_quantity ?? 0 ), 0 );

	const tiles = [
		{ key: 'units', label: __( 'Units on hand', 'vulocart' ), value: units, tone: 'neutral', icon: 'store-inventory', hint: sprintf( /* translators: %d: number of products. */ _n( 'across %d product', 'across %d products', items.length, 'vulocart' ), items.length ) },
		{ key: 'in', label: __( 'Healthy', 'vulocart' ), value: healthy, tone: 'good', icon: 'check', hint: __( 'Ready to sell', 'vulocart' ) },
		{ key: 'low', label: __( 'Low stock', 'vulocart' ), value: low, tone: 'warn', icon: 'bar-chart', hint: __( 'At or under the threshold', 'vulocart' ) },
		{ key: 'out', label: __( 'Out of stock', 'vulocart' ), value: out, tone: 'bad', icon: 'out-of-stock', hint: __( 'Not sellable', 'vulocart' ) },
	];

	const segments = [
		{ key: 'good', label: __( 'Healthy', 'vulocart' ), value: healthy },
		{ key: 'warn', label: __( 'Low', 'vulocart' ), value: low },
		{ key: 'info', label: __( 'Backorder', 'vulocart' ), value: backorder },
		{ key: 'bad', label: __( 'Out', 'vulocart' ), value: out },
	];

	// Out of stock first, then the lowest quantities.
	const attention = items
		.filter( ( item ) => item.low_stock || 'out_of_stock' === item.stock_status )
		.sort( ( a, b ) => Number( 'out_of_stock' === b.stock_status ) - Number( 'out_of_stock' === a.stock_status ) || ( a.stock_quantity ?? 0 ) - ( b.stock_quantity ?? 0 ) );

	const extra = applyFilters( 'vulocart_inventory_overview', null, { items } ) as ReactNode;

	return (
		<div className="vulocart-inv-overview">
			<div className="vulocart-inv-tiles">
				{ tiles.map( ( tile ) => (
					<div key={ tile.key } className={ `vulocart-inv-tile is-${ tile.tone }` }>
						<span className="vulocart-inv-icon">
							<i className={ `adminfont-${ tile.icon }` } aria-hidden="true" />
						</span>
						<span className="vulocart-inv-tile-label">{ tile.label }</span>
						<span className="vulocart-inv-tile-value">{ isLoading ? '…' : tile.value.toLocaleString() }</span>
						<span className="vulocart-inv-tile-hint">{ tile.hint }</span>
					</div>
				) ) }
			</div>

			<div className="vulocart-inv-panel is-good">
				<div className="vulocart-inv-panel-head">
					<h3>
						<span className="vulocart-inv-icon">
							<i className="adminfont-analytics" aria-hidden="true" />
						</span>
						{ __( 'Stock health', 'vulocart' ) }
					</h3>
					<span className="vulocart-inv-panel-sub">{ sprintf( /* translators: %d: number of products. */ _n( '%d tracked product', '%d tracked products', items.length, 'vulocart' ), items.length ) }</span>
				</div>
				{ items.length ? (
					<>
						<div className="vulocart-inv-health" role="img" aria-label={ segments.map( ( segment ) => `${ segment.label }: ${ segment.value }` ).join( ', ' ) }>
							{ segments.map( ( segment ) => segment.value > 0 && <span key={ segment.key } className={ `is-${ segment.key }` } style={ { flexGrow: segment.value } } /> ) }
						</div>
						<ul className="vulocart-inv-legend">
							{ segments.map( ( segment ) => (
								<li key={ segment.key }>
									<i className={ `is-${ segment.key }` } aria-hidden="true" />
									{ segment.label } <strong>{ segment.value }</strong>
								</li>
							) ) }
						</ul>
					</>
				) : (
					<p className="vulocart-inv-empty">{ isLoading ? __( 'Loading…', 'vulocart' ) : __( 'No stock-tracked products yet.', 'vulocart' ) }</p>
				) }
			</div>

			<div className="vulocart-inv-panel is-bad">
				<div className="vulocart-inv-panel-head">
					<h3>
						<span className="vulocart-inv-icon">
							<i className="adminfont-out-of-stock" aria-hidden="true" />
						</span>
						{ __( 'Needs attention', 'vulocart' ) }
					</h3>
					{ attention.length > 0 && (
						<a href="#stock" onClick={ ( event ) => { event.preventDefault(); openInventoryTab( 'stock' ); } }>
							{ __( 'Manage stock', 'vulocart' ) }
						</a>
					) }
				</div>
				{ attention.length ? (
					<ul className="vulocart-inv-attention">
						{ attention.slice( 0, ATTENTION_LIMIT ).map( ( item ) => (
							<li key={ item.id }>
								<a href={ `admin.php?page=products&action=edit&id=${ item.id }` }>{ item.title }</a>
								<span className={ `admin-badge ${ 'out_of_stock' === item.stock_status ? 'badge-inactive' : 'badge-pending' }` }>
									{ 'out_of_stock' === item.stock_status ? __( 'Out of stock', 'vulocart' ) : sprintf( /* translators: %s: units left. */ __( '%s left', 'vulocart' ), item.stock_quantity ?? 0 ) }
								</span>
							</li>
						) ) }
						{ attention.length > ATTENTION_LIMIT && (
							<li className="vulocart-inv-more">{ sprintf( /* translators: %d: number of products. */ __( '+ %d more', 'vulocart' ), attention.length - ATTENTION_LIMIT ) }</li>
						) }
					</ul>
				) : (
					<p className="vulocart-inv-empty is-good">
							<i className="adminfont-check" aria-hidden="true" />
							{ isLoading ? __( 'Loading…', 'vulocart' ) : __( 'Everything is stocked.', 'vulocart' ) }
						</p>
				) }
			</div>

			{ extra }
		</div>
	);
}

export default InventoryOverview;
