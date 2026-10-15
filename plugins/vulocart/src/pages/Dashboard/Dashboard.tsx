/* global vulocartLocalizer */
import { useEffect, useMemo, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import type { ReactNode } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { ContainerComponent, ColumnComponent, NavigatorHeaderComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';
import { ModuleRequired, type EngineView } from '../../components/EngineScreen/EngineScreen';
import './dashboard.scss';

interface Period {
	revenue: number;
	orders: number;
	paid_orders: number;
	order_value: number;
	new_customers: number;
}

interface Summary {
	range: number;
	currency: string;
	current: Period;
	previous: Period;
	series: { date: string; revenue: number; orders: number }[];
	attention: { to_fulfill: number; unpaid: number; pending_reviews: number; low_stock: number; out_of_stock: number };
	recent_orders: {
		id: number;
		order_number: string;
		customer: string;
		total: number;
		currency: string | null;
		payment_status: string;
		fulfillment_status: string;
		created_at: string;
	}[];
	top_products: { product_id: number; title: string; quantity: number; revenue: number }[];
	low_stock: { id: number; title: string; sku: string | null; quantity: number }[];
	catalog: { products: number; threshold: number };
}

const RANGES = [
	{ value: 7, label: __( '7 days', 'vulocart' ) },
	{ value: 30, label: __( '30 days', 'vulocart' ) },
	{ value: 90, label: __( '90 days', 'vulocart' ) },
];

const RANGE_KEY = 'vulocart_dashboard_range';

/** What shows under the overview while vulocart-pro's Analytics module isn't there (ModuleRequired's card). */
const ANALYTICS_VIEW: EngineView = {
	title: __( 'Store insights', 'vulocart' ),
	description: __( 'Conversion, lifetime value, retention, checkout funnel, abandoned carts, top customers, AI insights and stock forecasts.', 'vulocart' ),
	icon: 'analytics',
	module: 'analytics',
	pro: true,
};

const PAYMENT_BADGE: Record< string, string > = { paid: 'is-good', pending: 'is-warn', failed: 'is-bad', refunded: 'is-muted' };
const FULFILLMENT_BADGE: Record< string, string > = {
	pending: 'is-warn',
	processing: 'is-info',
	shipped: 'is-info',
	completed: 'is-good',
	cancelled: 'is-muted',
};

const STATUS_LABELS: Record< string, string > = {
	paid: __( 'Paid', 'vulocart' ),
	pending: __( 'Pending', 'vulocart' ),
	failed: __( 'Failed', 'vulocart' ),
	refunded: __( 'Refunded', 'vulocart' ),
	processing: __( 'Processing', 'vulocart' ),
	shipped: __( 'Shipped', 'vulocart' ),
	completed: __( 'Completed', 'vulocart' ),
	cancelled: __( 'Cancelled', 'vulocart' ),
};

const readRange = (): number => {
	try {
		const stored = Number( window.localStorage.getItem( RANGE_KEY ) );
		return RANGES.some( ( range ) => range.value === stored ) ? stored : 30;
	} catch {
		return 30;
	}
};

const greeting = (): string => {
	const hour = new Date().getHours();

	if ( hour < 12 ) {
		return __( 'Good morning', 'vulocart' );
	}

	return hour < 18 ? __( 'Good afternoon', 'vulocart' ) : __( 'Good evening', 'vulocart' );
};

const money = ( amount: number, currency: string, compact = false ): string => {
	try {
		return new Intl.NumberFormat( undefined, {
			style: 'currency',
			currency: currency || 'USD',
			notation: compact ? 'compact' : 'standard',
			maximumFractionDigits: compact ? 1 : 2,
		} ).format( amount );
	} catch {
		return `${ amount.toFixed( 2 ) } ${ currency }`;
	}
};

/** Change against the previous range, as a rounded percentage; null when there is nothing to compare with. */
const delta = ( now: number, before: number ): number | null => {
	if ( ! before ) {
		return now ? null : 0;
	}

	return Math.round( ( ( now - before ) / before ) * 100 );
};

const shortDate = ( date: string ): string =>
	new Date( `${ date }T00:00:00` ).toLocaleDateString( undefined, { month: 'short', day: 'numeric' } );

function Kpi( { label, value, change, hint }: { label: string; value: string; change: number | null; hint?: string } ) {
	let trend = null;

	// No previous period to compare with (null) or no change: show the number alone rather than a badge.
	if ( null !== change && change !== 0 ) {
		trend = (
			<span className={ `vulocart-dash-trend ${ change > 0 ? 'is-up' : 'is-down' }` }>
				<i className={ `adminfont-arrow-${ change > 0 ? 'up' : 'down' }` } />
				{ Math.abs( change ) }%
			</span>
		);
	}

	return (
		<div className="vulocart-dash-kpi">
			<span className="vulocart-dash-kpi-label">{ label }</span>
			<span className="vulocart-dash-kpi-line">
				<strong className="vulocart-dash-kpi-value">{ value }</strong>
				{ trend }
			</span>
			{ hint && <span className="vulocart-dash-kpi-hint">{ hint }</span> }
		</div>
	);
}

function Card( { title, icon, action, children, className = '' }: { title: string; icon: string; action?: { label: string; href: string; onClick?: () => void }; children: React.ReactNode; className?: string } ) {
	return (
		<section className={ `vulocart-dash-card ${ className }` }>
			<header className="vulocart-dash-card-head">
				<span className="vulocart-dash-card-title">
					<i className={ `adminfont-${ icon }` } />
					{ title }
				</span>
				{ action && (
					<a
						className="vulocart-dash-card-link"
						href={ action.href }
						onClick={ ( event ) => {
							if ( action.onClick ) {
								event.preventDefault();
								action.onClick();
							}
						} }
					>
						{ action.label }
						<i className="adminfont-arrow-right" />
					</a>
				) }
			</header>
			<div className="vulocart-dash-card-body">{ children }</div>
		</section>
	);
}

function Empty( { icon, text }: { icon: string; text: string } ) {
	return (
		<div className="vulocart-dash-empty">
			<i className={ `adminfont-${ icon }` } />
			<span>{ text }</span>
		</div>
	);
}

/** Revenue or orders per day as bars; hovering a bar shows that day's figures. */
function SalesChart( { series, currency, metric }: { series: Summary[ 'series' ]; currency: string; metric: 'revenue' | 'orders' } ) {
	const [ hover, setHover ] = useState< number | null >( null );
	const max = Math.max( ...series.map( ( point ) => point[ metric ] ), 0 );
	const total = series.reduce( ( sum, point ) => sum + point[ metric ], 0 );
	const format = ( value: number ) => ( 'revenue' === metric ? money( value, currency ) : String( value ) );
	const shown = null !== hover ? series[ hover ] : null;
	const ticks = series.length > 1 ? [ 0, Math.floor( ( series.length - 1 ) / 2 ), series.length - 1 ] : [ 0 ];

	return (
		<div className="vulocart-dash-chart">
			<div className="vulocart-dash-chart-readout">
				{ shown ? (
					<>
						<strong>{ format( shown[ metric ] ) }</strong>
						<span>
							{ shortDate( shown.date ) }
							{ 'revenue' === metric && ` · ${ sprintf( _n( '%d order', '%d orders', shown.orders, 'vulocart' ), shown.orders ) }` }
						</span>
					</>
				) : (
					<>
						<strong>{ format( total ) }</strong>
						<span>{ 'revenue' === metric ? __( 'Paid revenue in this period', 'vulocart' ) : __( 'Orders in this period', 'vulocart' ) }</span>
					</>
				) }
			</div>

			<div className="vulocart-dash-bars" onMouseLeave={ () => setHover( null ) } role="img" aria-label={ __( 'Sales chart', 'vulocart' ) }>
				{ series.map( ( point, index ) => (
					<span
						key={ point.date }
						className={ `vulocart-dash-bar ${ hover === index ? 'is-hover' : '' } ${ point[ metric ] ? '' : 'is-zero' }` }
						onMouseEnter={ () => setHover( index ) }
					>
						<i style={ { height: max ? `${ Math.max( 2, ( point[ metric ] / max ) * 100 ) }%` : '2px' } } />
					</span>
				) ) }
			</div>

			<div className="vulocart-dash-axis">
				{ ticks.map( ( index ) => (
					<span key={ index }>{ series[ index ] ? shortDate( series[ index ].date ) : '' }</span>
				) ) }
			</div>
		</div>
	);
}

/**
 * VuloCart → Dashboard. What a merchant opens first: how sales are going for the chosen range (against the range
 * before it), what is waiting on them, the latest orders, best sellers and stock running low. All of it comes from
 * one `GET /dashboard` call (Controllers\Dashboard); every block links to the page where the work gets done.
 */
const Dashboard = () => {
	const [ range, setRange ] = useState< number >( readRange );
	const [ pickedMetric, setMetric ] = useState< 'revenue' | 'orders' | null >( null );
	const [ summary, setSummary ] = useState< Summary | null >( null );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ failed, setFailed ] = useState( false );

	useEffect( () => {
		try {
			window.localStorage.setItem( RANGE_KEY, String( range ) );
		} catch {
			// Storage blocked; the range just isn't remembered.
		}

		setIsLoading( true );
		axios
			.get< Summary >( getApiLink( vulocartLocalizer, 'dashboard' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: { range },
			} )
			.then( ( response ) => {
				setSummary( response.data );
				setFailed( false );
			} )
			.catch( () => setFailed( true ) )
			.finally( () => setIsLoading( false ) );
	}, [ range ] );

	const currency = summary?.currency || 'USD';
	// Until the merchant picks one, chart orders while nothing has been paid yet (an all-zero revenue chart says nothing).
	const metric = pickedMetric ?? ( summary && ! summary.current.revenue && summary.current.orders ? 'orders' : 'revenue' );

	const attention = useMemo( () => {
		if ( ! summary ) {
			return [];
		}

		const { to_fulfill: toFulfill, unpaid, pending_reviews: pendingReviews, low_stock: lowStock, out_of_stock: outOfStock } = summary.attention;

		return [
			{
				count: toFulfill,
				icon: 'delivery',
				tone: 'is-warn',
				text: sprintf( _n( '%d order to fulfil', '%d orders to fulfil', toFulfill, 'vulocart' ), toFulfill ),
				href: 'admin.php?page=vulocart-orders',
			},
			{
				count: unpaid,
				icon: 'pending',
				tone: 'is-warn',
				text: sprintf( _n( '%d order awaiting payment', '%d orders awaiting payment', unpaid, 'vulocart' ), unpaid ),
				href: 'admin.php?page=vulocart-orders',
			},
			{
				count: outOfStock,
				icon: 'out-of-stock',
				tone: 'is-bad',
				text: sprintf( _n( '%d product out of stock', '%d products out of stock', outOfStock, 'vulocart' ), outOfStock ),
				href: 'admin.php?page=vulocart-inventory',
			},
			{
				count: lowStock,
				icon: 'store-inventory',
				tone: 'is-warn',
				text: sprintf( _n( '%d product low on stock', '%d products low on stock', lowStock, 'vulocart' ), lowStock ),
				href: 'admin.php?page=vulocart-inventory',
			},
			{
				count: pendingReviews,
				icon: 'review',
				tone: 'is-info',
				text: sprintf( _n( '%d review to moderate', '%d reviews to moderate', pendingReviews, 'vulocart' ), pendingReviews ),
				href: 'admin.php?page=vulocart#&tab=reviews',
			},
		].filter( ( item ) => item.count > 0 );
	}, [ summary ] );

	const rangeSwitch = (
		<div className="vulocart-dash-range" role="group" aria-label={ __( 'Date range', 'vulocart' ) }>
			{ RANGES.map( ( option ) => (
				<button key={ option.value } type="button" className={ range === option.value ? 'is-active' : '' } onClick={ () => setRange( option.value ) }>
					{ option.label }
				</button>
			) ) }
		</div>
	);

	const header = (
		<NavigatorHeaderComponent
			headerIcon="storefront"
			headerTitle={ sprintf(
				/* translators: 1: time-of-day greeting, 2: current user's display name. */
				__( '%1$s, %2$s', 'vulocart' ),
				greeting(),
				vulocartLocalizer.user_display_name || __( 'there', 'vulocart' )
			) }
			headerDescription={ __( 'How your store is doing, and what needs your attention today.', 'vulocart' ) }
			headerCustomContent={
				<div className="vulocart-dash-header-actions">
					{ rangeSwitch }
					<ButtonInput
						buttons={ [
							{
								text: __( 'Add product', 'vulocart' ),
								icon: 'plus',
								color: 'purple-bg',
								onClick: () => {
									window.location.href = 'admin.php?page=vulocart-products&action=add';
								},
							},
						] }
					/>
				</div>
			}
		/>
	);

	if ( failed && ! summary ) {
		return (
			<ContainerComponent general>
				<ColumnComponent>
					{ header }
					<div className="vulocart-dash-card">
						<Empty icon="error" text={ __( 'The dashboard could not be loaded. Reload the page to try again.', 'vulocart' ) } />
					</div>
				</ColumnComponent>
			</ContainerComponent>
		);
	}

	const now = summary?.current;
	const before = summary?.previous;
	const average = now && now.orders ? now.order_value / now.orders : 0;
	const averageBefore = before && before.orders ? before.order_value / before.orders : 0;
	const awaiting = now ? Math.max( 0, now.order_value - now.revenue ) : 0;
	const isNewStore = summary && 0 === summary.recent_orders.length;
	const versus = sprintf(
		/* translators: %d: number of days. */
		__( 'vs previous %d days', 'vulocart' ),
		range
	);

	const insights = applyFilters( 'vulocart_analytics_view', null, { view: 'dashboard', days: range, currency } ) as ReactNode;

	return (
		<ContainerComponent general>
			<ColumnComponent>
				{ header }

				<div className={ `vulocart-dash ${ isLoading ? 'is-loading' : '' }` }>
					{ /* What needs doing comes first: it is the one block a merchant acts on every visit. */ }
					{ summary && (
						<div className="vulocart-dash-todo-bar">
							<span className="vulocart-dash-todo-label">
								<i className="adminfont-notification" />
								{ __( 'Needs attention', 'vulocart' ) }
							</span>
							{ attention.length ? (
								attention.map( ( item ) => (
									<a key={ item.icon + item.text } className={ `vulocart-dash-chip ${ item.tone }` } href={ item.href }>
										<i className={ `adminfont-${ item.icon }` } />
										{ item.text }
									</a>
								) )
							) : (
								<span className="vulocart-dash-chip is-good">
									<i className="adminfont-check" />
									{ __( "You're all caught up", 'vulocart' ) }
								</span>
							) }
						</div>
					) }

					{ isNewStore && (
						<section className="vulocart-dash-setup">
							<strong>{ __( 'Get ready for your first order', 'vulocart' ) }</strong>
							<ol className="vulocart-dash-steps">
								<li className={ summary.catalog.products > 0 ? 'is-done' : '' }>
									<i className={ summary.catalog.products > 0 ? 'adminfont-check' : 'adminfont-add-product' } />
									<a href={ summary.catalog.products > 0 ? 'admin.php?page=vulocart-products' : 'admin.php?page=vulocart-products&action=add' }>
										{ __( 'Add products', 'vulocart' ) }
									</a>
								</li>
								<li>
									<i className="adminfont-payment" />
									<a href="admin.php?page=vulocart#&tab=settings&subtab=payments">{ __( 'Set up payments', 'vulocart' ) }</a>
								</li>
								<li>
									<i className="adminfont-storefront" />
									<a href={ vulocartLocalizer.site_url } target="_blank" rel="noopener noreferrer">
										{ __( 'Place a test order', 'vulocart' ) }
									</a>
								</li>
							</ol>
						</section>
					) }

					<div className="vulocart-dash-kpis">
						<Kpi
							label={ __( 'Revenue', 'vulocart' ) }
							value={ now ? money( now.revenue, currency ) : '–' }
							change={ now && before ? delta( now.revenue, before.revenue ) : 0 }
							hint={ awaiting > 0 ? sprintf( __( '%s awaiting payment', 'vulocart' ), money( awaiting, currency ) ) : versus }
						/>
						<Kpi
							label={ __( 'Orders', 'vulocart' ) }
							value={ now ? String( now.orders ) : '–' }
							change={ now && before ? delta( now.orders, before.orders ) : 0 }
							hint={ now ? sprintf( __( '%d paid', 'vulocart' ), now.paid_orders ) : undefined }
						/>
						<Kpi
							label={ __( 'Average order', 'vulocart' ) }
							value={ now ? money( average, currency ) : '–' }
							change={ delta( average, averageBefore ) }
							hint={ versus }
						/>
						<Kpi
							label={ __( 'New customers', 'vulocart' ) }
							value={ now ? String( now.new_customers ) : '–' }
							change={ now && before ? delta( now.new_customers, before.new_customers ) : 0 }
							hint={ versus }
						/>
					</div>

					<div className="vulocart-dash-grid">
						<div className="vulocart-dash-main">
							<section className="vulocart-dash-card">
								<header className="vulocart-dash-card-head">
									<span className="vulocart-dash-card-title">
										<i className="adminfont-bar-chart" />
										{ __( 'Sales', 'vulocart' ) }
									</span>
									<div className="vulocart-dash-range is-small" role="group" aria-label={ __( 'Chart metric', 'vulocart' ) }>
										<button type="button" className={ 'revenue' === metric ? 'is-active' : '' } onClick={ () => setMetric( 'revenue' ) }>
											{ __( 'Revenue', 'vulocart' ) }
										</button>
										<button type="button" className={ 'orders' === metric ? 'is-active' : '' } onClick={ () => setMetric( 'orders' ) }>
											{ __( 'Orders', 'vulocart' ) }
										</button>
									</div>
								</header>
								<div className="vulocart-dash-card-body">
									{ summary && summary.series.length ? (
										<SalesChart series={ summary.series } currency={ currency } metric={ metric } />
									) : (
										<div className="vulocart-dash-skeleton is-chart" />
									) }
								</div>
							</section>

							<Card title={ __( 'Recent orders', 'vulocart' ) } icon="order" action={ { label: __( 'All orders', 'vulocart' ), href: 'admin.php?page=vulocart-orders' } }>
								{ ! summary && <div className="vulocart-dash-skeleton" /> }
								{ summary && ! summary.recent_orders.length && <Empty icon="order" text={ __( 'No orders yet. They will show up here as they come in.', 'vulocart' ) } /> }
								{ summary && summary.recent_orders.length > 0 && (
									<ul className="vulocart-dash-orders">
										{ summary.recent_orders.slice( 0, 5 ).map( ( order ) => (
											<li key={ order.id }>
												<a className="vulocart-dash-order-main" href={ `admin.php?page=vulocart-orders&action=edit&id=${ order.id }` }>
													<strong>#{ order.order_number }</strong>
													<span>
														{ order.customer || __( 'Guest', 'vulocart' ) } · { formatWpDate( order.created_at ) }
													</span>
												</a>
												<span className="vulocart-dash-order-badges">
													<span className={ `vulocart-dash-pill ${ PAYMENT_BADGE[ order.payment_status ] ?? 'is-muted' }` }>
														{ 'pending' === order.payment_status ? __( 'Unpaid', 'vulocart' ) : STATUS_LABELS[ order.payment_status ] ?? order.payment_status }
													</span>
													<span className={ `vulocart-dash-pill ${ FULFILLMENT_BADGE[ order.fulfillment_status ] ?? 'is-muted' }` }>
														{ 'pending' === order.fulfillment_status ? __( 'Unfulfilled', 'vulocart' ) : STATUS_LABELS[ order.fulfillment_status ] ?? order.fulfillment_status }
													</span>
												</span>
												<strong className="vulocart-dash-order-total">{ money( order.total, order.currency || currency ) }</strong>
											</li>
										) ) }
									</ul>
								) }
							</Card>
						</div>

						<div className="vulocart-dash-side">
							<Card title={ __( 'Top products', 'vulocart' ) } icon="product">
								{ ! summary && <div className="vulocart-dash-skeleton" /> }
								{ summary && ! summary.top_products.length && <Empty icon="product" text={ __( 'Best sellers appear once orders come in.', 'vulocart' ) } /> }
								{ summary && summary.top_products.length > 0 && (
									<ol className="vulocart-dash-rank">
										{ summary.top_products.slice( 0, 4 ).map( ( product, index ) => (
											<li key={ product.product_id }>
												<span className="vulocart-dash-rank-no">{ index + 1 }</span>
												<a className="vulocart-dash-rank-main" href={ `admin.php?page=vulocart-products&action=edit&id=${ product.product_id }` }>
													<strong>{ product.title }</strong>
													<span>{ sprintf( _n( '%d sold', '%d sold', product.quantity, 'vulocart' ), product.quantity ) }</span>
												</a>
												<span className="vulocart-dash-rank-value">{ money( product.revenue, currency ) }</span>
											</li>
										) ) }
									</ol>
								) }
							</Card>

							<Card title={ __( 'Low stock', 'vulocart' ) } icon="store-inventory" action={ { label: __( 'Inventory', 'vulocart' ), href: 'admin.php?page=vulocart-inventory' } }>
								{ ! summary && <div className="vulocart-dash-skeleton" /> }
								{ summary && ! summary.low_stock.length && (
									<Empty
										icon="success"
										text={ sprintf(
											/* translators: %d: low stock threshold. */
											__( 'Everything has more than %d in stock.', 'vulocart' ),
											summary.catalog.threshold
										) }
									/>
								) }
								{ summary && summary.low_stock.length > 0 && (
									<ul className="vulocart-dash-stock">
										{ summary.low_stock.slice( 0, 4 ).map( ( product ) => (
											<li key={ product.id }>
												<a href={ `admin.php?page=vulocart-products&action=edit&id=${ product.id }` }>
													<strong>{ product.title }</strong>
												</a>
												<span className={ `vulocart-dash-pill ${ product.quantity <= 0 ? 'is-bad' : 'is-warn' }` }>
													{ product.quantity <= 0 ? __( 'Out of stock', 'vulocart' ) : sprintf( __( '%d left', 'vulocart' ), product.quantity ) }
												</span>
											</li>
										) ) }
									</ul>
								) }
							</Card>
						</div>
					</div>

					{ /* vulocart-pro's Analytics module fills this through `vulocart_analytics_view` (one compact card). */ }
					{ insights || <ModuleRequired view={ ANALYTICS_VIEW } /> }
				</div>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default Dashboard;
