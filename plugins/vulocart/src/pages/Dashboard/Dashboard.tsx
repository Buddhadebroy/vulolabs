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

/** Reads the chosen reporting range (in days) from localStorage, defaulting to 30. */
const readRange = (): number => {
	try {
		const stored = Number( window.localStorage.getItem( RANGE_KEY ) );
		return RANGES.some( ( range ) => range.value === stored ) ? stored : 30;
	} catch {
		return 30;
	}
};

/** Returns "Good morning", "Good afternoon" or "Good evening" for the current hour. */
const greeting = (): string => {
	const hour = new Date().getHours();

	if ( hour < 12 ) {
		return __( 'Good morning', 'vulocart' );
	}

	return hour < 18 ? __( 'Good afternoon', 'vulocart' ) : __( 'Good evening', 'vulocart' );
};

/**
 * Formats an amount as currency (optionally compact, such as 1.2K); falls back to a plain number for an unknown
 * currency.
 */
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

/** Formats a date as a short label such as "Mar 4". */
const shortDate = ( date: string ): string =>
	new Date( `${ date }T00:00:00` ).toLocaleDateString( undefined, { month: 'short', day: 'numeric' } );

/** A change against the previous period as a coloured chip; nothing when there is nothing to compare with. */
function Delta( { change, inverse = false }: { change: number | null; inverse?: boolean } ) {
	if ( null === change || 0 === change ) {
		return null;
	}

	const good = inverse ? change < 0 : change > 0;

	return (
		<span className={ `vd-delta ${ good ? 'is-good' : 'is-bad' }` }>
			<i className={ `adminfont-arrow-${ change > 0 ? 'up' : 'down' }` } aria-hidden="true" />
			{ Math.abs( change ) }%
		</span>
	);
}

/** Dashboard card with a title, icon, optional action link and note around its content. */
function Card( {
	title,
	icon,
	action,
	note,
	control,
	badge,
	tone = 'violet',
	children,
	className = '',
}: {
	title: string;
	icon: string;
	action?: { label: string; href: string };
	note?: string;
	control?: ReactNode;
	badge?: number;
	tone?: 'violet' | 'blue' | 'green' | 'amber' | 'red';
	children: ReactNode;
	className?: string;
} ) {
	return (
		<section className={ `vd-card is-${ tone } ${ className }` }>
			<header className="vd-card-head">
				<div>
					<h2>
						<span className="vd-icon">
							<i className={ `adminfont-${ icon }` } aria-hidden="true" />
						</span>
						{ title }
						{ badge ? <span className="vd-badge">{ badge }</span> : null }
					</h2>
					{ note && <p>{ note }</p> }
				</div>
				{ control }
				{ action && (
					<a href={ action.href }>
						{ action.label }
						<i className="adminfont-arrow-right" aria-hidden="true" />
					</a>
				) }
			</header>
			<div className="vd-card-body">{ children }</div>
		</section>
	);
}

/** Placeholder shown inside a dashboard card when there is no data yet. */
function Empty( { icon, text }: { icon: string; text: string } ) {
	return (
		<div className="vd-empty">
			<i className={ `adminfont-${ icon }` } aria-hidden="true" />
			<span>{ text }</span>
		</div>
	);
}

/** Smooth area chart of revenue or orders per day; hover (or focus) a column to read that day. */
function AreaChart( { series, currency, metric }: { series: Summary[ 'series' ]; currency: string; metric: 'revenue' | 'orders' } ) {
	const [ hover, setHover ] = useState< number | null >( null );
	const values = series.map( ( point ) => point[ metric ] );
	const max = Math.max( ...values, 0 );
	const format = ( value: number ) => ( 'revenue' === metric ? money( value, currency ) : String( value ) );
	const count = series.length;
	const x = ( index: number ) => ( count > 1 ? ( index / ( count - 1 ) ) * 600 : 300 );
	const y = ( value: number ) => ( max ? 176 - ( value / max ) * 160 : 176 );

	// Catmull-Rom → bezier: a smooth line through every day.
	const path = values.reduce( ( d, value, index ) => {
		if ( 0 === index ) {
			return `M ${ x( 0 ) } ${ y( value ) }`;
		}

		const p0 = values[ Math.max( 0, index - 2 ) ];
		const p1 = values[ index - 1 ];
		const p3 = values[ Math.min( count - 1, index + 1 ) ];
		const c1x = x( index - 1 ) + ( x( index ) - x( Math.max( 0, index - 2 ) ) ) / 6;
		const c1y = y( p1 ) + ( y( value ) - y( p0 ) ) / 6;
		const c2x = x( index ) - ( x( Math.min( count - 1, index + 1 ) ) - x( index - 1 ) ) / 6;
		const c2y = y( value ) - ( y( p3 ) - y( p1 ) ) / 6;

		// Keep the curve between the two days it joins, so a spike never dips below the baseline.
		const lo = Math.min( y( p1 ), y( value ) );
		const hi = Math.max( y( p1 ), y( value ) );
		const clamp = ( v: number ) => Math.min( hi, Math.max( lo, v ) );

		return `${ d } C ${ c1x } ${ clamp( c1y ) }, ${ c2x } ${ clamp( c2y ) }, ${ x( index ) } ${ y( value ) }`;
	}, '' );

	const ticks = count > 1 ? [ 0, Math.floor( ( count - 1 ) / 2 ), count - 1 ] : [ 0 ];
	const active = null !== hover ? series[ hover ] : null;

	return (
		<div className="vd-chart">
			<div className="vd-chart-grid" aria-hidden="true">
				<span>{ max ? format( max ) : '' }</span>
				<span>{ max ? format( max / 2 ) : '' }</span>
				<span>{ format( 0 ) }</span>
			</div>
			<div className="vd-chart-plot" onMouseLeave={ () => setHover( null ) } role="img" aria-label={ __( 'Sales chart', 'vulocart' ) }>
				<svg viewBox="0 0 600 190" preserveAspectRatio="none" aria-hidden="true">
					<defs>
						<linearGradient id="vd-area" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="#5007aa" stopOpacity="0.28" />
							<stop offset="100%" stopColor="#5007aa" stopOpacity="0" />
						</linearGradient>
					</defs>
					<path d={ `${ path } L ${ x( count - 1 ) } 190 L ${ x( 0 ) } 190 Z` } fill="url(#vd-area)" />
					<path d={ path } className="vd-chart-line" />
				</svg>
				{ series.map( ( point, index ) => (
					<span
						key={ point.date }
						className={ `vd-chart-hit${ hover === index ? ' is-hover' : '' }` }
						style={ { left: `${ ( index / count ) * 100 }%`, width: `${ 100 / count }%` } }
						onMouseEnter={ () => setHover( index ) }
					>
						{ hover === index && <i style={ { top: `${ ( y( point[ metric ] ) / 190 ) * 100 }%` } } /> }
					</span>
				) ) }
				{ active && null !== hover && (
					<div className="vd-chart-tip" style={ { left: `${ ( ( hover + 0.5 ) / count ) * 100 }%` } }>
						<strong>{ format( active[ metric ] ) }</strong>
						<span>
							{ shortDate( active.date ) }
							{ 'revenue' === metric && ` · ${ sprintf( _n( '%d order', '%d orders', active.orders, 'vulocart' ), active.orders ) }` }
						</span>
					</div>
				) }
			</div>
			<div className="vd-chart-axis">
				{ ticks.map( ( index ) => (
					<span key={ index }>{ series[ index ] ? shortDate( series[ index ].date ) : '' }</span>
				) ) }
			</div>
		</div>
	);
}

/** Healthy / low / out-of-stock as one bar, so catalogue health reads at a glance. */
function StockBar( { products, low, out }: { products: number; low: number; out: number } ) {
	const total = Math.max( products, low + out, 1 );
	const healthy = Math.max( 0, total - low - out );
	const part = ( value: number ) => `${ ( value / total ) * 100 }%`;

	return (
		<div className="vd-stock">
			<div className="vd-stock-bar" role="img" aria-label={ __( 'Stock health', 'vulocart' ) }>
				<i className="is-good" style={ { width: part( healthy ) } } />
				<i className="is-warn" style={ { width: part( low ) } } />
				<i className="is-bad" style={ { width: part( out ) } } />
			</div>
			<ul className="vd-stock-legend">
				<li className="is-good">{ sprintf( __( '%d healthy', 'vulocart' ), healthy ) }</li>
				<li className="is-warn">{ sprintf( __( '%d low', 'vulocart' ), low ) }</li>
				<li className="is-bad">{ sprintf( __( '%d out', 'vulocart' ), out ) }</li>
			</ul>
		</div>
	);
}

/**
 * VuloCart → Dashboard, laid out around the questions a store owner opens it with:
 *  1. How am I doing?        hero: revenue against the previous range, daily trend, and the four numbers behind it
 *  2. What do I do next?     "Today's focus": the work waiting on them, worst first, each a click from done
 *  3. What sells / what runs out?   best sellers by share of revenue; stock health and the products to reorder
 *  4. What just happened?    latest orders, with the ones that need fulfilling flagged
 * Everything comes from one `GET /dashboard` call (Controllers\Dashboard); derived figures (paid rate, daily
 * average, best day) are computed here from it.
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
			{ count: outOfStock, icon: 'out-of-stock', tone: 'is-bad', cta: __( 'Restock', 'vulocart' ), text: _n( 'product is out of stock', 'products are out of stock', outOfStock, 'vulocart' ), href: 'admin.php?page=inventory' },
			{ count: toFulfill, icon: 'delivery', tone: 'is-warn', cta: __( 'Fulfil', 'vulocart' ), text: _n( 'paid order to fulfil', 'paid orders to fulfil', toFulfill, 'vulocart' ), href: 'admin.php?page=orders' },
			{ count: unpaid, icon: 'pending', tone: 'is-warn', cta: __( 'Review', 'vulocart' ), text: _n( 'order awaiting payment', 'orders awaiting payment', unpaid, 'vulocart' ), href: 'admin.php?page=orders' },
			{ count: lowStock, icon: 'store-inventory', tone: 'is-warn', cta: __( 'Reorder', 'vulocart' ), text: _n( 'product running low', 'products running low', lowStock, 'vulocart' ), href: 'admin.php?page=inventory' },
			{ count: pendingReviews, icon: 'review', tone: 'is-info', cta: __( 'Moderate', 'vulocart' ), text: _n( 'review to moderate', 'reviews to moderate', pendingReviews, 'vulocart' ), href: 'admin.php?page=vulocart#&tab=reviews' },
		].filter( ( item ) => item.count > 0 );
	}, [ summary ] );

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
					<div className="vulocart-dash-range" role="group" aria-label={ __( 'Date range', 'vulocart' ) }>
						{ RANGES.map( ( option ) => (
							<button key={ option.value } type="button" className={ range === option.value ? 'is-active' : '' } onClick={ () => setRange( option.value ) }>
								{ option.label }
							</button>
						) ) }
					</div>
					<ButtonInput
						buttons={ [
							{
								text: __( 'Add product', 'vulocart' ),
								icon: 'plus',
								color: 'purple-bg',
								onClick: () => {
									window.location.href = 'admin.php?page=products&action=add';
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
					<div className="vd-card">
						<Empty icon="error" text={ __( 'The dashboard could not be loaded. Reload the page to try again.', 'vulocart' ) } />
					</div>
				</ColumnComponent>
			</ContainerComponent>
		);
	}

	const now = summary?.current;
	const before = summary?.previous;
	const series = summary?.series ?? [];
	const average = now && now.orders ? now.order_value / now.orders : 0;
	const averageBefore = before && before.orders ? before.order_value / before.orders : 0;
	const awaiting = now ? Math.max( 0, now.order_value - now.revenue ) : 0;
	const paidRate = now && now.orders ? Math.round( ( now.paid_orders / now.orders ) * 100 ) : null;
	const perDay = now ? now.revenue / Math.max( 1, series.length || range ) : 0;
	const bestDay = series.reduce< Summary[ 'series' ][ number ] | null >( ( best, point ) => ( ! best || point.revenue + point.orders > best.revenue + best.orders ? point : best ), null );
	const isNewStore = summary && 0 === summary.recent_orders.length;
	const revenueChange = now && before ? delta( now.revenue, before.revenue ) : null;
	const versus = sprintf(
		/* translators: %d: number of days. */
		__( 'vs previous %d days', 'vulocart' ),
		range
	);
	const topRevenue = Math.max( 1, summary?.top_products[ 0 ]?.revenue ?? 1 );
	const revenueShare = summary && now && now.revenue > 0 ? summary.top_products.reduce( ( sum, product ) => sum + product.revenue, 0 ) / now.revenue : 0;

	const insights = applyFilters( 'vulocart_analytics_view', null, { view: 'dashboard', days: range, currency } ) as ReactNode;

	return (
		<ContainerComponent general>
			<ColumnComponent>
				{ header }

				<div className={ `vd ${ isLoading ? 'is-loading' : '' }` }>
					{ isNewStore && (
						<section className="vd-setup">
							<div>
								<strong>{ __( 'Get ready for your first order', 'vulocart' ) }</strong>
								<span>{ __( 'Three quick steps and your store is live.', 'vulocart' ) }</span>
							</div>
							<ol>
								<li className={ summary.catalog.products > 0 ? 'is-done' : '' }>
									<i className={ summary.catalog.products > 0 ? 'adminfont-check' : 'adminfont-add-product' } aria-hidden="true" />
									<a href={ summary.catalog.products > 0 ? 'admin.php?page=products' : 'admin.php?page=products&action=add' }>{ __( 'Add products', 'vulocart' ) }</a>
								</li>
								<li>
									<i className="adminfont-payment" aria-hidden="true" />
									<a href="admin.php?page=vulocart#&tab=settings&subtab=payments">{ __( 'Set up payments', 'vulocart' ) }</a>
								</li>
								<li>
									<i className="adminfont-storefront" aria-hidden="true" />
									<a href={ vulocartLocalizer.site_url } target="_blank" rel="noopener noreferrer">{ __( 'Place a test order', 'vulocart' ) }</a>
								</li>
							</ol>
						</section>
					) }

					{ /* How am I doing? Four numbers, each against the previous range. */ }
					<section className="vd-kpis" aria-label={ __( 'Key figures', 'vulocart' ) }>
						<div className="vd-kpi">
							<span className="vd-kpi-label is-green">
								<span className="vd-icon">
									<i className="adminfont-bar-chart" aria-hidden="true" />
								</span>
								{ __( 'Revenue', 'vulocart' ) }
							</span>
							<span className="vd-kpi-value">
								{ now ? money( now.revenue, currency ) : '–' }
								<Delta change={ revenueChange } />
							</span>
							<span className="vd-kpi-hint">{ awaiting > 0 ? sprintf( __( '%s awaiting payment', 'vulocart' ), money( awaiting, currency ) ) : versus }</span>
						</div>
						<div className="vd-kpi">
							<span className="vd-kpi-label is-blue">
								<span className="vd-icon">
									<i className="adminfont-order" aria-hidden="true" />
								</span>
								{ __( 'Orders', 'vulocart' ) }
							</span>
							<span className="vd-kpi-value">
								{ now ? now.orders : '–' }
								<Delta change={ now && before ? delta( now.orders, before.orders ) : null } />
							</span>
							<span className="vd-kpi-hint">{ now ? sprintf( __( '%1$d paid%2$s', 'vulocart' ), now.paid_orders, null !== paidRate ? ` · ${ paidRate }%` : '' ) : '' }</span>
						</div>
						<div className="vd-kpi">
							<span className="vd-kpi-label is-violet">
								<span className="vd-icon">
									<i className="adminfont-analytics" aria-hidden="true" />
								</span>
								{ __( 'Average order', 'vulocart' ) }
							</span>
							<span className="vd-kpi-value">
								{ now ? money( average, currency ) : '–' }
								<Delta change={ delta( average, averageBefore ) } />
							</span>
							<span className="vd-kpi-hint">{ versus }</span>
						</div>
						<div className="vd-kpi">
							<span className="vd-kpi-label is-amber">
								<span className="vd-icon">
									<i className="adminfont-membership" aria-hidden="true" />
								</span>
								{ __( 'New customers', 'vulocart' ) }
							</span>
							<span className="vd-kpi-value">
								{ now ? now.new_customers : '–' }
								<Delta change={ now && before ? delta( now.new_customers, before.new_customers ) : null } />
							</span>
							<span className="vd-kpi-hint">{ versus }</span>
						</div>
					</section>

					<div className="vd-layout">
						<div className="vd-col">
							<Card
								title={ __( 'Sales', 'vulocart' ) }
								icon="bar-chart"
								tone="blue"
								note={
									now && now.revenue > 0
										? `${ sprintf( __( 'About %s a day', 'vulocart' ), money( perDay, currency ) ) }${ bestDay && ( bestDay.revenue || bestDay.orders ) ? ` · ${ sprintf( __( 'best day %s', 'vulocart' ), shortDate( bestDay.date ) ) }` : '' }`
										: undefined
								}
								control={
									<div className="vulocart-dash-range is-small" role="group" aria-label={ __( 'Chart metric', 'vulocart' ) }>
										<button type="button" className={ 'revenue' === metric ? 'is-active' : '' } onClick={ () => setMetric( 'revenue' ) }>
											{ __( 'Revenue', 'vulocart' ) }
										</button>
										<button type="button" className={ 'orders' === metric ? 'is-active' : '' } onClick={ () => setMetric( 'orders' ) }>
											{ __( 'Orders', 'vulocart' ) }
										</button>
									</div>
								}
							>
								{ summary && series.length ? <AreaChart series={ series } currency={ currency } metric={ metric } /> : <div className="vulocart-dash-skeleton is-chart" /> }
							</Card>

							<Card title={ __( 'Recent orders', 'vulocart' ) } icon="order" tone="violet" action={ { label: __( 'All orders', 'vulocart' ), href: 'admin.php?page=orders' } }>
								{ ! summary && <div className="vulocart-dash-skeleton" /> }
								{ summary && ! summary.recent_orders.length && <Empty icon="order" text={ __( 'No orders yet. They will show up here as they come in.', 'vulocart' ) } /> }
								{ summary && summary.recent_orders.length > 0 && (
									<ul className="vd-list">
										{ summary.recent_orders.slice( 0, 5 ).map( ( order ) => {
											const needsFulfil = 'paid' === order.payment_status && 'pending' === order.fulfillment_status;

											return (
												<li key={ order.id }>
													<span className="vd-avatar" aria-hidden="true">{ ( order.customer || '?' ).charAt( 0 ).toUpperCase() }</span>
													<a className="vd-list-main" href={ `admin.php?page=orders&action=edit&id=${ order.id }` }>
														<strong>#{ order.order_number }</strong>
														<span>
															{ order.customer || __( 'Guest', 'vulocart' ) } · { formatWpDate( order.created_at ) }
														</span>
													</a>
													<span className="vd-list-badges">
														<span className={ `vulocart-dash-pill ${ PAYMENT_BADGE[ order.payment_status ] ?? 'is-muted' }` }>
															{ 'pending' === order.payment_status ? __( 'Unpaid', 'vulocart' ) : STATUS_LABELS[ order.payment_status ] ?? order.payment_status }
														</span>
														<span className={ `vulocart-dash-pill ${ FULFILLMENT_BADGE[ order.fulfillment_status ] ?? 'is-muted' }` }>
															{ 'pending' === order.fulfillment_status ? __( 'Unfulfilled', 'vulocart' ) : STATUS_LABELS[ order.fulfillment_status ] ?? order.fulfillment_status }
														</span>
													</span>
													{ needsFulfil && (
														<a className="vd-chip-cta" href={ `admin.php?page=orders&action=edit&id=${ order.id }` }>
															{ __( 'Fulfil', 'vulocart' ) }
														</a>
													) }
													<strong className="vd-list-value">{ money( order.total, order.currency || currency ) }</strong>
												</li>
											);
										} ) }
									</ul>
								) }
							</Card>
						</div>

						<div className="vd-col">
							<Card
								title={ __( "Today's focus", 'vulocart' ) }
								icon="notification"
								tone="red"
								badge={ attention.length > 0 ? attention.length : undefined }
							>
								{ ! summary && <div className="vulocart-dash-skeleton" /> }
								{ summary && attention.length > 0 && (
									<ul className="vd-queue">
										{ attention.map( ( item ) => (
											<li key={ item.icon + item.href }>
												<a className={ item.tone } href={ item.href }>
													<span className="vd-queue-icon">
														<i className={ `adminfont-${ item.icon }` } aria-hidden="true" />
													</span>
													<span className="vd-queue-text">
														<strong>{ item.count }</strong> { item.text }
													</span>
													<span className="vd-queue-cta">
														{ item.cta }
														<i className="adminfont-arrow-right" aria-hidden="true" />
													</span>
												</a>
											</li>
										) ) }
									</ul>
								) }
								{ summary && 0 === attention.length && (
									<div className="vd-clear">
										<i className="adminfont-check" aria-hidden="true" />
										<div>
											<strong>{ __( "You're all caught up", 'vulocart' ) }</strong>
											<span>{ __( 'Nothing needs your attention. A good time to run a promotion.', 'vulocart' ) }</span>
										</div>
										<a href="admin.php?page=marketing&view=coupons">{ __( 'Create a coupon', 'vulocart' ) }</a>
									</div>
								) }
								<div className="vd-shortcuts">
									<a href="admin.php?page=products&action=add">
										<i className="adminfont-add-product" aria-hidden="true" />
										{ __( 'Add product', 'vulocart' ) }
									</a>
									<a href="admin.php?page=orders&action=add">
										<i className="adminfont-order" aria-hidden="true" />
										{ __( 'Create order', 'vulocart' ) }
									</a>
									<a href={ vulocartLocalizer.site_url } target="_blank" rel="noopener noreferrer">
										<i className="adminfont-storefront" aria-hidden="true" />
										{ __( 'View store', 'vulocart' ) }
									</a>
								</div>
							</Card>

							<Card title={ __( 'Top products', 'vulocart' ) } icon="product" tone="amber" action={ { label: __( 'Products', 'vulocart' ), href: 'admin.php?page=products' } }>
								{ ! summary && <div className="vulocart-dash-skeleton" /> }
								{ summary && ! summary.top_products.length && <Empty icon="product" text={ __( 'Best sellers appear once orders come in.', 'vulocart' ) } /> }
								{ summary && summary.top_products.length > 0 && (
									<>
										{ revenueShare > 0 && (
											<p className="vd-note">
												{ sprintf( __( 'These %1$d products bring in %2$d%% of your revenue.', 'vulocart' ), Math.min( 4, summary.top_products.length ), Math.min( 100, Math.round( revenueShare * 100 ) ) ) }
											</p>
										) }
										<ol className="vd-rank">
											{ summary.top_products.slice( 0, 4 ).map( ( product, index ) => (
												<li key={ product.product_id }>
													<span className="vd-rank-no">{ index + 1 }</span>
													<a className="vd-list-main" href={ `admin.php?page=products&action=edit&id=${ product.product_id }` }>
														<strong>{ product.title }</strong>
														<span>{ sprintf( _n( '%d sold', '%d sold', product.quantity, 'vulocart' ), product.quantity ) }</span>
														<span className="vd-rank-bar" aria-hidden="true">
															<i style={ { width: `${ Math.max( 4, ( product.revenue / topRevenue ) * 100 ) }%` } } />
														</span>
													</a>
													<strong className="vd-list-value">{ money( product.revenue, currency ) }</strong>
												</li>
											) ) }
										</ol>
									</>
								) }
							</Card>

							<Card title={ __( 'Stock', 'vulocart' ) } icon="store-inventory" tone="green" action={ { label: __( 'Inventory', 'vulocart' ), href: 'admin.php?page=inventory' } }>
								{ ! summary && <div className="vulocart-dash-skeleton" /> }
								{ summary && (
									<>
										<StockBar products={ summary.catalog.products } low={ summary.attention.low_stock } out={ summary.attention.out_of_stock } />
										{ ! summary.low_stock.length ? (
											<p className="vd-fine">
												{ sprintf(
													/* translators: %d: low stock threshold. */
													__( 'Everything has more than %d in stock.', 'vulocart' ),
													summary.catalog.threshold
												) }
											</p>
										) : (
											<ul className="vd-list is-compact">
												{ summary.low_stock.slice( 0, 4 ).map( ( product ) => (
													<li key={ product.id }>
														<a className="vd-list-main" href={ `admin.php?page=products&action=edit&id=${ product.id }` }>
															<strong>{ product.title }</strong>
														</a>
														<span className={ `vulocart-dash-pill ${ product.quantity <= 0 ? 'is-bad' : 'is-warn' }` }>
															{ product.quantity <= 0 ? __( 'Out of stock', 'vulocart' ) : sprintf( __( '%d left', 'vulocart' ), product.quantity ) }
														</span>
														<a className="vd-chip-cta" href={ `admin.php?page=products&action=edit&id=${ product.id }` }>
															{ __( 'Restock', 'vulocart' ) }
														</a>
													</li>
												) ) }
											</ul>
										) }
									</>
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
