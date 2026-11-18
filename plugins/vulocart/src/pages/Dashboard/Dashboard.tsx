/* global vulocartLocalizer */
import { useEffect, useMemo, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import type { ReactNode } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { AvatarComponent, ContainerComponent, ColumnComponent, NavigatorHeaderComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';
import { ModuleRequired, type EngineView } from '../../components/EngineScreen/EngineScreen';
import { ProSample, proLocked } from '../../components/Popup/ProSample';
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
	/** `stock` is null when the product doesn't track stock. */
	top_products: { product_id: number; title: string; quantity: number; revenue: number; stock: number | null }[];
	low_stock: { id: number; title: string; sku: string | null; quantity: number }[];
	/** Product count, the low-stock threshold, and the catalogue gaps that cost sales. */
	catalog: { products: number; threshold: number; drafts: number; no_price: number; no_image: number };
	/** Paid orders to ship and unpaid orders, oldest first (5 each). */
	queue: { to_ship: Summary[ 'recent_orders' ]; unpaid: Summary[ 'recent_orders' ] };
	unpaid_value: number;
	last_order_at: string | null;
	/** People who bought in the range, and how many of them had bought before it. */
	customers: { buyers: number; returning: number };
	/** Ids of the payment methods checkout offers right now. */
	payments: string[];
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

/** Made-up figures for the Store insights sample, in the Analytics module's own terms. */
const SAMPLE_INSIGHTS: Array< [ string, string, string ] > = [
	[ __( 'Conversion rate', 'vulocart' ), '3.4%', __( 'Visits that ordered', 'vulocart' ) ],
	[ __( 'Customer lifetime value', 'vulocart' ), '$186', __( 'Average per customer', 'vulocart' ) ],
	[ __( 'Returning customers', 'vulocart' ), '28%', __( 'Ordered more than once', 'vulocart' ) ],
	[ __( 'Recovered carts', 'vulocart' ), '$640', __( '12 abandoned checkouts won back', 'vulocart' ) ],
];

/** Store insights while VuloCart Pro can't provide them: sample figures and the Pro popup. */
const StoreInsightsSample = () => (
	<ProSample
		feature={ { title: ANALYTICS_VIEW.title, description: ANALYTICS_VIEW.description, icon: ANALYTICS_VIEW.icon } }
		text={ __( 'Conversion, lifetime value, retention, abandoned carts, AI insights and stock forecasts.', 'vulocart' ) }
		cta={ __( 'Unlock store insights', 'vulocart' ) }
	>
		<div className="vc-sample-tiles">
			{ SAMPLE_INSIGHTS.map( ( [ label, value, hint ] ) => (
				<div key={ label }>
					<span>{ label }</span>
					<strong>{ value }</strong>
					<small>{ hint }</small>
				</div>
			) ) }
		</div>
	</ProSample>
);

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
							<stop offset="0%" stopColor="#5007aa" stopOpacity="0.16" />
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

/** How long ago a UTC `Y-m-d H:i:s` timestamp was, in hours or days. */
const waitedHours = ( createdAt: string ): number => Math.max( 0, ( Date.now() - new Date( `${ createdAt.replace( ' ', 'T' ) }Z` ).getTime() ) / 3600000 );

/** "Just now", "5h" or "3 days": how long an order has been waiting. */
const waitedLabel = ( hours: number ): string => {
	if ( hours < 1 ) {
		return __( 'just now', 'vulocart' );
	}

	if ( hours < 24 ) {
		return sprintf( /* translators: %d: hours. */ __( '%dh', 'vulocart' ), Math.floor( hours ) );
	}

	const days = Math.floor( hours / 24 );

	return sprintf( /* translators: %d: days. */ _n( '%d day', '%d days', days, 'vulocart' ), days );
};

/** An order waiting this long is late: shown in red, and called out in the header. */
const LATE_HOURS = 48;

/** Offline methods the Payment module ships; anything else (Stripe, PayPal…) takes payment online. */
const OFFLINE_METHODS = [ 'manual', 'bank-transfer', 'cash-on-delivery' ];

type QueueOrder = Summary[ 'queue' ][ 'to_ship' ][ number ];

type WorkTab = {
	id: 'ship' | 'pay' | 'stock' | 'reviews';
	label: string;
	count: number;
	more: { label: string; href: string };
};

/**
 * "Needs you": the work waiting on the merchant, one tab per kind, each showing the actual orders or products with
 * the action that clears them. Oldest first, so the top row is always the next thing to do.
 */
function WorkQueue( { summary, currency }: { summary: Summary; currency: string } ) {
	const { attention, queue, low_stock: lowStock } = summary;

	const tabs = (
		[
			{ id: 'ship', label: __( 'To ship', 'vulocart' ), count: attention.to_fulfill, more: { label: __( 'All pending orders', 'vulocart' ), href: 'admin.php?page=orders&filter=pending' } },
			{ id: 'pay', label: __( 'Awaiting payment', 'vulocart' ), count: attention.unpaid, more: { label: __( 'All orders', 'vulocart' ), href: 'admin.php?page=orders' } },
			{ id: 'stock', label: __( 'Low stock', 'vulocart' ), count: attention.low_stock + attention.out_of_stock, more: { label: __( 'Inventory', 'vulocart' ), href: 'admin.php?page=inventory' } },
			{ id: 'reviews', label: __( 'Reviews', 'vulocart' ), count: attention.pending_reviews, more: { label: __( 'Moderate reviews', 'vulocart' ), href: 'admin.php?page=vulocart#&tab=reviews' } },
		] as WorkTab[]
	).filter( ( tab ) => tab.count > 0 );

	const [ picked, setPicked ] = useState< WorkTab[ 'id' ] | null >( null );
	const active = tabs.find( ( tab ) => tab.id === picked ) ?? tabs[ 0 ];

	if ( ! active ) {
		return (
			<div className="vd-clear">
				<i className="adminfont-check" aria-hidden="true" />
				<div>
					<strong>{ __( "You're all caught up", 'vulocart' ) }</strong>
					<span>{ __( 'Every paid order has shipped and nothing is running low.', 'vulocart' ) }</span>
				</div>
			</div>
		);
	}

	// One quiet action per row, the same on every row: the page header keeps the only filled button, and a row of
	// identical buttons reads as a list of tasks rather than one loud call and several faint ones.
	const action = ( label: string, icon: string, href: string ) => (
		<a className="vd-work-action" href={ href }>
			<i className={ `adminfont-${ icon }` } aria-hidden="true" />
			{ label }
		</a>
	);

	const orderRow = ( order: QueueOrder, cta: string, icon: string ) => {
		const hours = waitedHours( order.created_at );
		const late = hours >= LATE_HOURS;
		const href = `admin.php?page=orders&action=edit&id=${ order.id }`;

		return (
			<li key={ order.id }>
				<AvatarComponent name={ order.customer || '' } size="sm" />
				<a className="vd-work-main" href={ href }>
					<strong>
						#{ order.order_number } · { money( order.total, order.currency || currency ) }
					</strong>
					<span>{ order.customer || __( 'Guest', 'vulocart' ) }</span>
				</a>
				<span className={ `vd-work-age${ late ? ' is-late' : '' }` } title={ formatWpDate( order.created_at ) }>
					<i className="adminfont-pending" aria-hidden="true" />
					{ waitedLabel( hours ) }
				</span>
				{ action( cta, icon, href ) }
			</li>
		);
	};

	return (
		<>
			<div className="vd-work-tabs" role="tablist" aria-label={ __( 'Work waiting', 'vulocart' ) }>
				{ tabs.map( ( tab ) => (
					<button key={ tab.id } type="button" role="tab" aria-selected={ tab.id === active.id } className={ tab.id === active.id ? 'is-active' : '' } onClick={ () => setPicked( tab.id ) }>
						{ tab.label }
						<span>{ tab.count }</span>
					</button>
				) ) }
			</div>

			<ul className="vd-work-list" role="tabpanel">
				{ 'ship' === active.id && queue.to_ship.map( ( order ) => orderRow( order, __( 'Fulfil', 'vulocart' ), 'delivery' ) ) }
				{ 'pay' === active.id && queue.unpaid.map( ( order ) => orderRow( order, __( 'Follow up', 'vulocart' ), 'mail' ) ) }
				{ 'stock' === active.id &&
					lowStock.map( ( product ) => (
						<li key={ product.id }>
							<span className="vd-work-thumb" aria-hidden="true">
								<i className="adminfont-product" />
							</span>
							<a className="vd-work-main" href={ `admin.php?page=products&action=edit&id=${ product.id }` }>
								<strong>{ product.title }</strong>
								<span>{ product.sku ? sprintf( __( 'SKU %s', 'vulocart' ), product.sku ) : __( 'No SKU', 'vulocart' ) }</span>
							</a>
							<span className={ `vd-work-age${ product.quantity <= 0 ? ' is-late' : '' }` }>
								{ product.quantity <= 0 ? __( 'Out of stock', 'vulocart' ) : sprintf( __( '%d left', 'vulocart' ), product.quantity ) }
							</span>
							{ action( __( 'Restock', 'vulocart' ), 'export-import-stock', `admin.php?page=products&action=edit&id=${ product.id }` ) }
						</li>
					) ) }
				{ 'reviews' === active.id && (
					<li className="vd-work-note">
						<span className="vd-work-thumb" aria-hidden="true">
							<i className="adminfont-review" />
						</span>
						<span className="vd-work-main">
							<strong>{ sprintf( _n( '%d review is waiting for approval', '%d reviews are waiting for approval', active.count, 'vulocart' ), active.count ) }</strong>
							<span>{ __( 'Approved reviews show on the product page and help the next shopper decide.', 'vulocart' ) }</span>
						</span>
						{ action( __( 'Moderate', 'vulocart' ), 'review', active.more.href ) }
					</li>
				) }
			</ul>

			{ active.count > 5 && 'reviews' !== active.id && (
				<a className="vd-work-more" href={ active.more.href }>
					{ sprintf( __( 'See all %d', 'vulocart' ), active.count ) }
					<i className="adminfont-arrow-right" aria-hidden="true" />
				</a>
			) }
		</>
	);
}

type Recommendation = {
	id: string;
	icon: string;
	tone: 'is-bad' | 'is-warn' | 'is-info' | 'is-good';
	title: string;
	detail: string;
	cta: { label: string; href: string };
};

/**
 * What would grow the store, from the same summary: each a finding plus the one action that addresses it. Ordered
 * by what costs the most sales when left alone (no way to pay, a best seller about to run out) down to polish.
 */
const recommend = ( summary: Summary, range: number ): Recommendation[] => {
	const list: Recommendation[] = [];
	const { catalog, customers, payments, current, previous } = summary;

	if ( ! payments.length ) {
		list.push( {
			id: 'no-payments',
			icon: 'payment',
			tone: 'is-bad',
			title: __( 'Shoppers have no way to pay', 'vulocart' ),
			detail: __( 'No payment method is switched on, so checkout cannot finish.', 'vulocart' ),
			cta: { label: __( 'Set up payments', 'vulocart' ), href: 'admin.php?page=vulocart#&tab=settings&subtab=payments' },
		} );
	} else if ( payments.every( ( method ) => OFFLINE_METHODS.includes( method ) ) ) {
		list.push( {
			id: 'offline-only',
			icon: 'payment',
			tone: 'is-warn',
			title: __( 'Take card payments', 'vulocart' ),
			detail: sprintf(
				/* translators: %d: unpaid orders. */
				__( 'Only offline methods are on, so every order waits for you to collect the money. %d are unpaid right now.', 'vulocart' ),
				summary.attention.unpaid
			),
			cta: { label: __( 'Payment settings', 'vulocart' ), href: 'admin.php?page=vulocart#&tab=settings&subtab=payments' },
		} );
	}

	// A best seller that runs out at its current pace within two weeks.
	const runningOut = summary.top_products
		.filter( ( product ) => null !== product.stock && product.quantity > 0 )
		.map( ( product ) => ( { ...product, days: Math.floor( ( product.stock as number ) / ( product.quantity / range ) ) } ) )
		.filter( ( product ) => product.days < 14 )
		.sort( ( a, b ) => a.days - b.days )[ 0 ];

	if ( runningOut ) {
		list.push( {
			id: 'running-out',
			icon: 'store-inventory',
			tone: 'is-bad',
			title:
				runningOut.days <= 0
					? sprintf( __( '%s, a best seller, is sold out', 'vulocart' ), runningOut.title )
					: sprintf( _n( '%1$s sells out in about %2$d day', '%1$s sells out in about %2$d days', runningOut.days, 'vulocart' ), runningOut.title, runningOut.days ),
			detail: sprintf( __( '%1$d sold in the last %2$d days, %3$d left.', 'vulocart' ), runningOut.quantity, range, Math.max( 0, runningOut.stock as number ) ),
			cta: { label: __( 'Restock', 'vulocart' ), href: `admin.php?page=products&action=edit&id=${ runningOut.product_id }` },
		} );
	}

	if ( catalog.no_price > 0 ) {
		list.push( {
			id: 'no-price',
			icon: 'price',
			tone: 'is-bad',
			title: sprintf( _n( '%d live product has no price', '%d live products have no price', catalog.no_price, 'vulocart' ), catalog.no_price ),
			detail: __( 'Shoppers can see it but cannot add it to the cart.', 'vulocart' ),
			cta: { label: __( 'Fix prices', 'vulocart' ), href: 'admin.php?page=products&filter=published' },
		} );
	}

	const quiet = summary.last_order_at ? waitedHours( summary.last_order_at ) / 24 : null;

	if ( null !== quiet && quiet >= 3 ) {
		list.push( {
			id: 'quiet',
			icon: 'coupon',
			tone: 'is-warn',
			title: sprintf( __( 'No orders in %d days', 'vulocart' ), Math.floor( quiet ) ),
			detail: __( 'A time-limited coupon is a quick way to bring shoppers back.', 'vulocart' ),
			cta: { label: __( 'Create a coupon', 'vulocart' ), href: 'admin.php?page=marketing&view=coupons' },
		} );
	} else if ( previous.revenue > 0 && current.revenue < previous.revenue * 0.8 ) {
		list.push( {
			id: 'revenue-down',
			icon: 'arrow-down',
			tone: 'is-warn',
			title: sprintf( __( 'Revenue is down %d%%', 'vulocart' ), Math.round( ( 1 - current.revenue / previous.revenue ) * 100 ) ),
			detail: sprintf( __( 'Against the %d days before. A promotion can win some of it back.', 'vulocart' ), range ),
			cta: { label: __( 'Create a coupon', 'vulocart' ), href: 'admin.php?page=marketing&view=coupons' },
		} );
	}

	if ( customers.buyers >= 3 && customers.returning / customers.buyers < 0.2 ) {
		list.push( {
			id: 'repeat',
			icon: 'membership',
			tone: 'is-info',
			title: customers.returning
				? sprintf( __( 'Only %1$d of %2$d buyers came back', 'vulocart' ), customers.returning, customers.buyers )
				: sprintf( __( 'None of your %d buyers has ordered again yet', 'vulocart' ), customers.buyers ),
			detail: __( 'A thank-you coupon for a second order is the cheapest sale you can make.', 'vulocart' ),
			cta: { label: __( 'Create a coupon', 'vulocart' ), href: 'admin.php?page=marketing&view=coupons' },
		} );
	}

	if ( catalog.no_image > 0 ) {
		list.push( {
			id: 'no-image',
			icon: 'image',
			tone: 'is-info',
			title: sprintf( _n( '%d product has no photo', '%d products have no photo', catalog.no_image, 'vulocart' ), catalog.no_image ),
			detail: __( 'Shoppers skip products they cannot see. Add a featured image to each.', 'vulocart' ),
			cta: { label: __( 'Add photos', 'vulocart' ), href: 'admin.php?page=products&filter=published' },
		} );
	}

	if ( catalog.drafts > 0 ) {
		list.push( {
			id: 'drafts',
			icon: 'edit',
			tone: 'is-info',
			title: sprintf( _n( '%d product is still a draft', '%d products are still drafts', catalog.drafts, 'vulocart' ), catalog.drafts ),
			detail: __( 'Drafts are not in your store yet. Finish and publish them to start selling.', 'vulocart' ),
			cta: { label: __( 'Finish drafts', 'vulocart' ), href: 'admin.php?page=products&filter=draft' },
		} );
	}

	return list;
};

/**
 * VuloCart → Dashboard, built around what the merchant should do next rather than numbers to read:
 *  1. Needs you      the orders to ship, payments to chase, stock to reorder and reviews to approve - the actual
 *                    items, oldest first, each with the button that clears it.
 *  2. Grow           findings with one action each: no card payments, a best seller running out, buyers who
 *                    never came back, products missing a price or photo, drafts never published.
 *  3. Performance    the four numbers against the previous range, the daily trend and the best sellers with how
 *                    long their stock lasts.
 * Everything comes from one `GET /dashboard` call (Controllers\Dashboard).
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
	const recommendations = useMemo( () => ( summary ? recommend( summary, range ) : [] ), [ summary, range ] );

	// One sentence under the greeting: the most urgent thing, so the page answers "what now?" before any number.
	const headline = useMemo( () => {
		if ( ! summary ) {
			return __( 'Checking what needs your attention…', 'vulocart' );
		}

		const { to_fulfill: toShip, unpaid } = summary.attention;
		const oldest = summary.queue.to_ship[ 0 ];
		const parts: string[] = [];

		if ( toShip ) {
			parts.push(
				oldest && waitedHours( oldest.created_at ) >= LATE_HOURS
					? sprintf( _n( '%1$d paid order is waiting to ship, the oldest for %2$s', '%1$d paid orders are waiting to ship, the oldest for %2$s', toShip, 'vulocart' ), toShip, waitedLabel( waitedHours( oldest.created_at ) ) )
					: sprintf( _n( '%d paid order is ready to ship', '%d paid orders are ready to ship', toShip, 'vulocart' ), toShip )
			);
		}

		if ( unpaid ) {
			parts.push( sprintf( __( '%s is waiting on payment', 'vulocart' ), money( summary.unpaid_value, currency ) ) );
		}

		if ( ! parts.length ) {
			return __( 'Nothing is waiting on you. Here is how the store is doing.', 'vulocart' );
		}

		return `${ parts.join( __( ' and ', 'vulocart' ) ) }.`;
	}, [ summary, currency ] );

	const header = (
		<NavigatorHeaderComponent
			headerIcon="storefront"
			headerTitle={ sprintf(
				/* translators: 1: time-of-day greeting, 2: current user's display name. */
				__( '%1$s, %2$s', 'vulocart' ),
				greeting(),
				vulocartLocalizer.user_display_name || __( 'there', 'vulocart' )
			) }
			headerDescription={ headline }
			headerCustomContent={
				<div className="vulocart-dash-header-actions">
					<a className="admin-btn btn-purple" href="admin.php?page=orders&action=add">
						<i className="adminfont-plus" aria-hidden="true" />
						{ __( 'Create order', 'vulocart' ) }
					</a>
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
	const paidRate = now && now.orders ? Math.round( ( now.paid_orders / now.orders ) * 100 ) : null;
	const perDay = now ? now.revenue / Math.max( 1, series.length || range ) : 0;
	const bestDay = series.reduce< Summary[ 'series' ][ number ] | null >( ( best, point ) => ( ! best || point.revenue + point.orders > best.revenue + best.orders ? point : best ), null );
	const isNewStore = summary && 0 === summary.recent_orders.length;
	const versus = sprintf(
		/* translators: %d: number of days. */
		__( 'vs previous %d days', 'vulocart' ),
		range
	);
	const topRevenue = Math.max( 1, ...( summary?.top_products ?? [] ).map( ( product ) => product.revenue ) );
	const workCount = summary ? summary.attention.to_fulfill + summary.attention.unpaid + summary.attention.low_stock + summary.attention.out_of_stock + summary.attention.pending_reviews : 0;

	const insights = applyFilters( 'vulocart_analytics_view', null, { view: 'dashboard', days: range, currency } ) as ReactNode;

	const kpis = [
		{
			label: __( 'Revenue', 'vulocart' ),
			icon: 'revenue',
			value: now ? money( now.revenue, currency ) : '–',
			change: now && before ? delta( now.revenue, before.revenue ) : null,
			hint: now && now.revenue > 0 ? sprintf( __( 'About %s a day', 'vulocart' ), money( perDay, currency ) ) : versus,
			href: 'admin.php?page=orders',
		},
		{
			label: __( 'Orders', 'vulocart' ),
			icon: 'order',
			value: now ? String( now.orders ) : '–',
			change: now && before ? delta( now.orders, before.orders ) : null,
			hint: null !== paidRate ? sprintf( __( '%d%% paid', 'vulocart' ), paidRate ) : versus,
			href: 'admin.php?page=orders',
		},
		{
			label: __( 'Average order', 'vulocart' ),
			icon: 'cart',
			value: now ? money( average, currency ) : '–',
			change: delta( average, averageBefore ),
			hint: versus,
			href: 'admin.php?page=orders',
		},
		{
			label: __( 'New customers', 'vulocart' ),
			icon: 'user-circle',
			value: now ? String( now.new_customers ) : '–',
			change: now && before ? delta( now.new_customers, before.new_customers ) : null,
			hint: summary && summary.customers.buyers ? sprintf( __( '%1$d of %2$d buyers returning', 'vulocart' ), summary.customers.returning, summary.customers.buyers ) : versus,
			href: 'admin.php?page=customers',
		},
	];

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
								<li className={ summary.payments.length > 0 ? 'is-done' : '' }>
									<i className={ summary.payments.length > 0 ? 'adminfont-check' : 'adminfont-payment' } aria-hidden="true" />
									<a href="admin.php?page=vulocart#&tab=settings&subtab=payments">{ __( 'Set up payments', 'vulocart' ) }</a>
								</li>
								<li>
									<i className="adminfont-storefront" aria-hidden="true" />
									<a href={ vulocartLocalizer.site_url } target="_blank" rel="noopener noreferrer">{ __( 'Place a test order', 'vulocart' ) }</a>
								</li>
							</ol>
						</section>
					) }

					{ /* 1 + 2: what to do now, and what would grow the store. */ }
					<div className="vd-act">
						<Card title={ __( 'Needs you', 'vulocart' ) } icon="notification" badge={ workCount || undefined } note={ __( 'Oldest first. Clear these and every customer is looked after.', 'vulocart' ) }>
							{ summary ? <WorkQueue summary={ summary } currency={ currency } /> : <div className="vulocart-dash-skeleton" /> }
						</Card>

						<Card title={ __( 'Grow your store', 'vulocart' ) } icon="analytics" note={ __( 'What would make the biggest difference, from your own numbers.', 'vulocart' ) }>
							{ ! summary && <div className="vulocart-dash-skeleton" /> }
							{ summary && ! recommendations.length && (
								<div className="vd-clear">
									<i className="adminfont-check" aria-hidden="true" />
									<div>
										<strong>{ __( 'Your store is in good shape', 'vulocart' ) }</strong>
										<span>{ __( 'Payments, stock and your catalogue all look right.', 'vulocart' ) }</span>
									</div>
								</div>
							) }
							{ recommendations.length > 0 && (
								<ul className="vd-recs">
									{ recommendations.slice( 0, 4 ).map( ( item ) => (
										<li key={ item.id } className={ item.tone }>
											<span className="vd-recs-icon" aria-hidden="true">
												<i className={ `adminfont-${ item.icon }` } />
											</span>
											<span className="vd-recs-text">
												<strong>{ item.title }</strong>
												<span>{ item.detail }</span>
											</span>
											<a className="admin-btn btn-purple" href={ item.cta.href }>
												{ item.cta.label }
											</a>
										</li>
									) ) }
								</ul>
							) }
						</Card>
					</div>

					{ /* 3: how the store is doing. */ }
					<div className="vd-section-head">
						<h2>{ __( 'Performance', 'vulocart' ) }</h2>
						<div className="vulocart-dash-range" role="group" aria-label={ __( 'Date range', 'vulocart' ) }>
							{ RANGES.map( ( option ) => (
								<button key={ option.value } type="button" className={ range === option.value ? 'is-active' : '' } onClick={ () => setRange( option.value ) }>
									{ option.label }
								</button>
							) ) }
						</div>
					</div>

					<section className="vd-kpis" aria-label={ __( 'Key figures', 'vulocart' ) }>
						{ kpis.map( ( kpi ) => (
							<a key={ kpi.label } className="vd-kpi" href={ kpi.href }>
								<span className="vd-kpi-label">
									<span className="vd-kpi-icon" aria-hidden="true">
										<i className={ `adminfont-${ kpi.icon }` } />
									</span>
									{ kpi.label }
								</span>
								<span className="vd-kpi-value">
									{ kpi.value }
									<Delta change={ kpi.change } />
								</span>
								<span className="vd-kpi-hint">{ kpi.hint }</span>
							</a>
						) ) }
					</section>

					<div className="vd-layout">
						<div className="vd-col">
							<Card
								title={ __( 'Sales', 'vulocart' ) }
								icon="bar-chart"
								note={ bestDay && ( bestDay.revenue || bestDay.orders ) ? sprintf( __( 'Best day %s', 'vulocart' ), shortDate( bestDay.date ) ) : undefined }
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
						</div>

						<div className="vd-col">
							<Card title={ __( 'Best sellers', 'vulocart' ) } icon="product" action={ { label: __( 'Products', 'vulocart' ), href: 'admin.php?page=products' } }>
								{ ! summary && <div className="vulocart-dash-skeleton" /> }
								{ summary && ! summary.top_products.length && <Empty icon="product" text={ __( 'Best sellers appear once orders come in.', 'vulocart' ) } /> }
								{ summary && summary.top_products.length > 0 && (
									<ol className="vd-rank">
										{ summary.top_products.slice( 0, 5 ).map( ( product, index ) => {
											const days = null !== product.stock && product.quantity > 0 ? Math.floor( product.stock / ( product.quantity / range ) ) : null;

											return (
												<li key={ product.product_id }>
													<span className="vd-rank-no">{ index + 1 }</span>
													<a className="vd-list-main" href={ `admin.php?page=products&action=edit&id=${ product.product_id }` }>
														<strong>{ product.title }</strong>
														<span>
															{ sprintf( _n( '%d sold', '%d sold', product.quantity, 'vulocart' ), product.quantity ) }
															{ null !== product.stock && ` · ${ sprintf( __( '%d in stock', 'vulocart' ), Math.max( 0, product.stock ) ) }` }
														</span>
														<span className="vd-rank-bar" aria-hidden="true">
															<i style={ { width: `${ Math.max( 4, ( product.revenue / topRevenue ) * 100 ) }%` } } />
														</span>
													</a>
													<span className="vd-rank-side">
														<strong className="vd-list-value">{ money( product.revenue, currency ) }</strong>
														{ null !== days && days < 14 && (
															<a className="vd-rank-warn" href={ `admin.php?page=products&action=edit&id=${ product.product_id }` }>
																{ days <= 0 ? __( 'Sold out', 'vulocart' ) : sprintf( __( '~%d days left', 'vulocart' ), days ) }
															</a>
														) }
													</span>
												</li>
											);
										} ) }
									</ol>
								) }
							</Card>
						</div>
					</div>

					{ /* vulocart-pro's Analytics module fills this through `vulocart_analytics_view` (one compact card). */ }
					{ insights || ( proLocked() ? <StoreInsightsSample /> : <ModuleRequired view={ ANALYTICS_VIEW } compact /> ) }
				</div>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default Dashboard;
