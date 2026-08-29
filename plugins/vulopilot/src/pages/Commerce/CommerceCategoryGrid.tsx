/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink, getApiResponse } from '@zyra/core';
import { BadgeComponent, MetricTileComponent } from '@zyra/components';
import type { MetricTileItem } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useStoreReadiness } from '../../services/useStoreReadiness';
import { useSectionStatus } from '../../services/useSectionStatus';
import { sumGroupCounts } from './useWooCommerceFindingGroups';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import {
	PRODUCT_SCANNER_IDS,
	INVENTORY_SCANNER_IDS,
} from './CommerceTab.constants';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/** Same `$`+`toLocaleString()` formatting `StoreOverviewCards.tsx`'s own `formatCurrency()` already established for real revenue figures. */
const formatCurrency = (value: number): string =>
	`$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/**
 * Real total from any `wc/v3` list endpoint's own `X-WP-Total` header —
 * generalized version of this file's own `useOutOfStockCount()`, same
 * technique `WooCommerceMetricsGrid.tsx`'s own `useWcTotalCount()` already
 * established for exactly this "Categories"/"Customer Insights" use case
 * (ported here rather than imported, same "duplicate small per-file
 * hooks" convention this whole page tree already uses).
 */
const useWcTotalCount = (endpoint: string): number | null => {
	const [total, setTotal] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;

		axios
			.get(`${appLocalizer.apiUrl}/wc/v3/${endpoint}`, {
				...nonceHeaders,
				params: { per_page: 1 },
			})
			.then((response) => {
				if (!cancelled) {
					const header = response.headers?.['x-wp-total'];
					setTotal(header ? parseInt(header, 10) : null);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setTotal(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [endpoint]);

	return total;
};

interface RevenueInsights {
	today_revenue: number;
	week_revenue: number;
	month_revenue: number;
}

/**
 * Real revenue snapshot — `GET /revenue-insights` (Pro's
 * WooCommerceIntelligence module, RevenueInsightsRest.php), same
 * inline-fetch + graceful-404-to-null shape `TopSellingProductsCard.tsx`
 * already established for this exact endpoint (Pro-only REST route, no
 * filter-slot wrapper — `getApiResponse` already 404s to `null` when Pro/
 * the module is inactive, same honest "no data yet" degrade every other
 * `wc/v3`/Pro call in this file already gets).
 */
const useRevenueInsights = (): { data: RevenueInsights | null; isLoading: boolean } => {
	const [data, setData] = useState<RevenueInsights | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<RevenueInsights>(
			getApiLink(appLocalizer, 'revenue-insights'),
			nonceHeaders
		)
			.then((response) =>
				setData('number' === typeof response?.month_revenue ? response : null)
			)
			.finally(() => setIsLoading(false));
	}, []);

	return { data, isLoading };
};

/**
 * Same "Not tracked yet" honest badge `WooCommerceMetricsGrid.tsx`'s own
 * `NOT_TRACKED_BADGE` already established for Cart/Product Schema/
 * Conversion/Recommendations/Funnels/Abandoned Cart — none of those have
 * any real backing anywhere in vulopilot/vulopilot-pro (confirmed via
 * full-codebase search, same audit that file's own docblock documents).
 */
const NOT_TRACKED_BADGE = { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' };

/**
 * Real out-of-stock product count — `wc/v3/products?stock_status=outofstock`'s
 * own `X-WP-Total` header, same raw-axios technique
 * WooCommerceMetricsGrid.tsx's own `useWcTotalCount()` already
 * established (kept as its own small local copy rather than importing a
 * private hook across sibling files, same "duplicate small per-file
 * hooks" convention this whole page tree already uses).
 */
const useOutOfStockCount = (): number | null => {
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;

		axios
			.get(`${appLocalizer.apiUrl}/wc/v3/products`, {
				...nonceHeaders,
				params: { stock_status: 'outofstock', per_page: 1 },
			})
			.then((response) => {
				if (!cancelled) {
					const header = response.headers?.['x-wp-total'];
					setCount(header ? parseInt(header, 10) : null);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setCount(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return count;
};

/** Real coupons "expiring soon" cutoff — matches this file's own 7-day window convention. */
const COUPON_EXPIRING_SOON_DAYS = 7;

/** Bounds the client-side expiry scan below — real, but capped, same documented-cap convention `SalesInsightsRest.php`'s own ORDERS_BATCH_SIZE/PRODUCTS_BATCH_SIZE already use. */
const COUPON_SCAN_BATCH_SIZE = 100;

interface CouponRow {
	date_expires: string | null;
}

/**
 * Real published-coupon count (`wc/v3/coupons?status=publish`'s own
 * `X-WP-Total` header, uncapped and exact — same technique
 * `useOutOfStockCount()` above already uses) plus a real "expiring soon"
 * count. The coupons REST API has no `date_expires` filter param to ask
 * WooCommerce to do that filtering server-side, so this fetches up to
 * `COUPON_SCAN_BATCH_SIZE` published coupons and counts client-side how
 * many have a real `date_expires` within the next
 * `COUPON_EXPIRING_SOON_DAYS` days — exact for any store with fewer
 * coupons than the batch size (every real store this feature is aimed at),
 * capped rather than wrong for stores with more.
 */
const useCouponStats = (): { active: number | null; expiringSoon: number | null } => {
	const [active, setActive] = useState<number | null>(null);
	const [expiringSoon, setExpiringSoon] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;

		axios
			.get(`${appLocalizer.apiUrl}/wc/v3/coupons`, {
				...nonceHeaders,
				params: { status: 'publish', per_page: 1 },
			})
			.then((response) => {
				if (!cancelled) {
					const header = response.headers?.['x-wp-total'];
					setActive(header ? parseInt(header, 10) : null);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setActive(null);
				}
			});

		axios
			.get<CouponRow[]>(`${appLocalizer.apiUrl}/wc/v3/coupons`, {
				...nonceHeaders,
				params: { status: 'publish', per_page: COUPON_SCAN_BATCH_SIZE },
			})
			.then((response) => {
				if (cancelled) {
					return;
				}

				const cutoff = Date.now() + COUPON_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;

				setExpiringSoon(
					response.data.filter((coupon) => {
						if (!coupon.date_expires) {
							return false;
						}

						const expiresAt = new Date(coupon.date_expires).getTime();

						return expiresAt >= Date.now() && expiresAt <= cutoff;
					}).length
				);
			})
			.catch(() => {
				if (!cancelled) {
					setExpiringSoon(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return { active, expiringSoon };
};

interface CommerceCategoryGridProps {
	groups: FindingGroup[];
	isLoadingGroups: boolean;
	onReviewTab: (tab: 'products' | 'checkout' | 'store') => void;
}

/**
 * All 18 category cards — the original 8 (Store Readiness, Checkout &
 * Payments, Products, Inventory, Orders, Coupons, Store Automation,
 * Compatibility) plus the full 15-tile mockup's remaining 10, ported into
 * this grid's own card style (icon/title/badge/rows-or-desc/link) instead
 * of that mockup's differently-styled tile grid
 * (`WooCommerceMetricsGrid.tsx`, still used on Overview — this file no
 * longer needs to duplicate it). Real: Categories (`wc/v3/products/categories`
 * total), Product SEO (real open-finding count, scanner `product-seo` —
 * already folded into the aggregate "Products" count too, same accepted
 * "same real number surfaced in two thematically-different cards" pattern
 * "Failed payments" already uses across Checkout & Payments/Orders below),
 * Customer Insights (`wc/v3/customers` total, labeled a plain total, not
 * "Active", since no recency data backs that word), Revenue Reports (real,
 * Pro-gated — `GET /revenue-insights`, same graceful-404-to-null degrade
 * `TopSellingProductsCard.tsx` already uses for this endpoint). Honest,
 * unclickable "Not tracked yet": Cart, Product Schema, Conversion,
 * Recommendations, Funnels, Abandoned Cart — zero real backing anywhere in
 * vulopilot/vulopilot-pro (confirmed via full-codebase search, same audit
 * `WooCommerceMetricsGrid.tsx`'s own docblock already documents).
 *
 * Every number here reconciles exactly to the same `/findings/groups`/
 * `/store-readiness` data CommerceIssuesTable.tsx's own tab counts read
 * (see CommerceTab.constants.ts's bucket map). `groups` is fetched once
 * by WooCommerceTab.tsx (`useWooCommerceFindingGroups()`) and threaded
 * down here and to TopIssuesToWorkOn.tsx/CommerceIssuesTable.tsx,
 * rather than each component re-fetching the same real data independently.
 * "Store Readiness" reuses the same `readiness` data this grid already
 * fetches for "Checkout & Payments"/"Store Automation" — it used to be a
 * separate, differently-styled list-card (StoreReadinessCard.tsx, now
 * removed) above this grid; folded in here as its first card instead.
 * Every real card follows the same "only show a badge when something
 * needs attention" rule (no persistent "good" badge for zero-issue
 * states). "Store Automation" and "Compatibility" have no dedicated
 * issues-table tab (no mockup tab for them either) — Automation links
 * straight to the real Automate Work page; Compatibility's real
 * findings still show up under the table's "Store" tab alongside general
 * store-setup issues.
 */
const CommerceCategoryGrid = ({
	groups,
	isLoadingGroups,
	onReviewTab,
}: CommerceCategoryGridProps) => {
	const { data: readiness, isLoading: isLoadingReadiness } =
		useStoreReadiness();
	const outOfStock = useOutOfStockCount();
	const runningLow = useSectionStatus('woocommerce', ['inventory-intelligence']);
	const coupons = useCouponStats();
	const categoriesTotal = useWcTotalCount('products/categories');
	const customersTotal = useWcTotalCount('customers');
	const productSeo = useSectionStatus('woocommerce', ['product-seo']);
	const { data: revenue, isLoading: isLoadingRevenue } = useRevenueInsights();

	const isLoading = isLoadingGroups || isLoadingReadiness;

	const productsCount = sumGroupCounts(groups, PRODUCT_SCANNER_IDS);
	const inventoryFindingsCount = sumGroupCounts(groups, INVENTORY_SCANNER_IDS);
	const failedOrdersCount = sumGroupCounts(groups, ['woocommerce-failed-orders']);
	const onHoldCount = sumGroupCounts(groups, ['woocommerce-stale-onhold-orders']);
	const pendingTooLongCount = sumGroupCounts(groups, [
		'woocommerce-stale-pending-orders',
	]);
	const compatibilityCount = sumGroupCounts(groups, [
		'woocommerce-compatibility',
	]);
	const testModeOn = groups.some(
		(group) => 'woocommerce-checkout' === group.scanner_id && group.count > 0
	);

	/**
	 * The 6 mockup cards with zero real backing anywhere in vulopilot/
	 * vulopilot-pro (Cart tracking, Product Schema, Conversion, AI
	 * Recommendations, Funnels, Abandoned Cart — same audit
	 * `WooCommerceMetricsGrid.tsx`'s own docblock documents), rendered as
	 * one honest, unclickable "Not tracked yet" tile each rather than a
	 * fake number or a link to nowhere real.
	 */
	const NOT_TRACKED_TILES: { id: string; icon: string; title: string; desc: string }[] = [
		{
			id: 'cart',
			icon: 'cart purple',
			title: __('Cart', 'vulopilot'),
			desc: __('AI insights to increase add-to-cart and AOV.', 'vulopilot'),
		},
		{
			id: 'product-schema',
			icon: 'editor-code gray',
			title: __('Product Schema', 'vulopilot'),
			desc: __('Enhance rich results & search visibility.', 'vulopilot'),
		},
		{
			id: 'conversion',
			icon: 'analytics teal',
			title: __('Conversion', 'vulopilot'),
			desc: __('Improve conversion rate with AI recommendations.', 'vulopilot'),
		},
		{
			id: 'recommendations',
			icon: 'thumb-up pink',
			title: __('Recommendations', 'vulopilot'),
			desc: __('AI-powered product recommendations.', 'vulopilot'),
		},
		{
			id: 'funnels',
			icon: 'filter indigo',
			title: __('Funnels', 'vulopilot'),
			desc: __('Build high-converting sales funnels.', 'vulopilot'),
		},
		{
			id: 'abandoned-cart',
			icon: 'cart orange',
			title: __('Abandoned Cart', 'vulopilot'),
			desc: __('Recover lost sales from abandoned carts.', 'vulopilot'),
		},
	];

	const readinessRows: { key: 'shop' | 'cart' | 'checkout' | 'my_account'; label: string }[] = [
		{ key: 'shop', label: __('Shop page', 'vulopilot') },
		{ key: 'cart', label: __('Cart page', 'vulopilot') },
		{ key: 'checkout', label: __('Checkout page', 'vulopilot') },
		{ key: 'my_account', label: __('My Account page', 'vulopilot') },
	];
	const readinessNeedsAttention =
		!!readiness &&
		(!Object.values(readiness.readiness).every(Boolean) ||
			!readiness.secure_checkout);

	const tiles: MetricTileItem[] = [
		{
			id: 'store-readiness',
			icon: 'shield blue',
			title: __('Store Readiness', 'vulopilot'),
			badge: readinessNeedsAttention
				? { color: 'red', text: __('Needs attention', 'vulopilot') }
				: undefined,
			desc: (
				<div className="woocommerce-category-rows">
					{readinessRows.map((row) => {
						const ready = readiness?.readiness[row.key];

						return (
							<div className="woocommerce-category-row" key={row.key}>
								<span>{row.label}</span>
								<span className={ready ? 'value-good' : 'value-warning'}>
									{ready
										? __('Ready', 'vulopilot')
										: __('Not ready', 'vulopilot')}
								</span>
							</div>
						);
					})}
					<div className="woocommerce-category-row">
						<span>{__('Secure checkout (HTTPS)', 'vulopilot')}</span>
						<span
							className={
								readiness?.secure_checkout ? 'value-good' : 'value-warning'
							}
						>
							{readiness?.secure_checkout
								? __('Secured', 'vulopilot')
								: __('Not secured', 'vulopilot')}
						</span>
					</div>
				</div>
			),
			footer: (
				<ButtonInput
					buttons={{
						text: __('View all store pages →', 'vulopilot'),
						color: 'text-purple',
						onClick: () =>
							window.open(
								`${appLocalizer.site_url}/wp-admin/edit.php?post_type=page`,
								'_self'
							),
					}}
				/>
			),
		},
		{
			id: 'checkout-payments',
			icon: 'cash green',
			title: __('Checkout & Payments', 'vulopilot'),
			badge: failedOrdersCount > 0
				? { color: 'red', text: __('Needs attention', 'vulopilot') }
				: undefined,
			desc: (
				<div className="woocommerce-category-rows">
					<div className="woocommerce-category-row">
						<span>{__('Payment methods', 'vulopilot')}</span>
						<span>
							{sprintf(
								/* translators: %d is the number of active payment methods. */
								__('%d active', 'vulopilot'),
								readiness?.payment_methods_active ?? 0
							)}
						</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Failed payments', 'vulopilot')}</span>
						<span className="value-warning">{failedOrdersCount}</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Test mode', 'vulopilot')}</span>
						<span className={testModeOn ? 'value-warning' : ''}>
							{testModeOn ? __('On', 'vulopilot') : __('Off', 'vulopilot')}
						</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Secure payments', 'vulopilot')}</span>
						<span className="value-good">
							<i className="adminfont-lock" />
							{readiness?.secure_checkout
								? __('Protected', 'vulopilot')
								: __('Not secured', 'vulopilot')}
						</span>
					</div>
				</div>
			),
			footer: (
				<ButtonInput
					buttons={{
						text: __('Review checkout →', 'vulopilot'),
						color: 'text-purple',
						onClick: () => onReviewTab('checkout'),
					}}
				/>
			),
		},
		{
			id: 'products',
			icon: 'cart purple',
			title: __('Products', 'vulopilot'),
			badge: productsCount > 0
				? {
						color: 'red',
						text: sprintf(
							/* translators: %d is the number of products needing attention. */
							__('%d need attention', 'vulopilot'),
							productsCount
						),
					}
				: undefined,
			desc: __(
				'Missing prices, out-of-stock listings, missing images, and incomplete product info.',
				'vulopilot'
			),
			footer: (
				<ButtonInput
					buttons={{
						text: __('Review products →', 'vulopilot'),
						color: 'text-purple',
						onClick: () => onReviewTab('products'),
					}}
				/>
			),
		},
		{
			id: 'inventory',
			icon: 'database teal',
			title: __('Inventory', 'vulopilot'),
			badge:
				inventoryFindingsCount > 0 || (null !== outOfStock && outOfStock > 0)
					? { color: 'red', text: __('Needs attention', 'vulopilot') }
					: undefined,
			desc: (
				<div className="woocommerce-category-rows">
					<div className="woocommerce-category-row">
						<span>{__('Out of stock', 'vulopilot')}</span>
						<span className="value-warning">
							{null !== outOfStock ? outOfStock : '—'}
						</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Running low', 'vulopilot')}</span>
						<span className="value-warning">
							{inventoryFindingsCount}
						</span>
					</div>
					{runningLow.badge && (
						<div className="woocommerce-category-row">
							<BadgeComponent color="purple" text={__('PRO', 'vulopilot')} />
							<span>
								{sprintf(
									/* translators: %d is the number of products projected to run out of stock soon. */
									__('%d may run out soon', 'vulopilot'),
									inventoryFindingsCount
								)}
							</span>
						</div>
					)}
				</div>
			),
			footer: (
				<ButtonInput
					buttons={{
						text: __('Review inventory →', 'vulopilot'),
						color: 'text-purple',
						onClick: () => onReviewTab('products'),
					}}
				/>
			),
		},
		{
			id: 'orders',
			icon: 'order orange',
			title: __('Orders', 'vulopilot'),
			badge: failedOrdersCount + onHoldCount + pendingTooLongCount > 0
				? {
						color: 'orange',
						text: sprintf(
							/* translators: %d is the number of orders needing attention. */
							__('%d need attention', 'vulopilot'),
							failedOrdersCount + onHoldCount + pendingTooLongCount
						),
					}
				: undefined,
			desc: (
				<div className="woocommerce-category-rows">
					<div className="woocommerce-category-row">
						<span>{__('Failed payments', 'vulopilot')}</span>
						<span className="value-warning">{failedOrdersCount}</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('On hold', 'vulopilot')}</span>
						<span className="value-warning">{onHoldCount}</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Pending too long', 'vulopilot')}</span>
						<span className="value-warning">{pendingTooLongCount}</span>
					</div>
				</div>
			),
			footer: (
				<ButtonInput
					buttons={{
						text: __('View orders →', 'vulopilot'),
						color: 'text-purple',
						onClick: () =>
							window.open(
								`${appLocalizer.site_url}/wp-admin/edit.php?post_type=shop_order`,
								'_self'
							),
					}}
				/>
			),
		},
		{
			id: 'coupons',
			icon: 'price rose',
			title: __('Coupons', 'vulopilot'),
			badge:
				null !== coupons.expiringSoon && coupons.expiringSoon > 0
					? {
							color: 'red',
							text: sprintf(
								/* translators: %d is the number of coupons expiring within a week. */
								__('%d expiring soon', 'vulopilot'),
								coupons.expiringSoon
							),
						}
					: undefined,
			desc: (
				<div className="woocommerce-category-rows">
					<div className="woocommerce-category-row">
						<span>{__('Active', 'vulopilot')}</span>
						<span>
							{null !== coupons.active ? coupons.active : '—'}
						</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Expiring soon', 'vulopilot')}</span>
						<span
							className={
								coupons.expiringSoon && coupons.expiringSoon > 0
									? 'value-warning'
									: ''
							}
						>
							{null !== coupons.expiringSoon ? coupons.expiringSoon : '—'}
						</span>
					</div>
				</div>
			),
			footer: (
				<ButtonInput
					buttons={{
						text: __('Manage coupons →', 'vulopilot'),
						color: 'text-purple',
						onClick: () =>
							window.open(
								`${appLocalizer.site_url}/wp-admin/edit.php?post_type=shop_coupon`,
								'_self'
							),
					}}
				/>
			),
		},
		{
			id: 'categories',
			icon: 'category indigo',
			title: __('Categories', 'vulopilot'),
			desc: (
				<div className="woocommerce-category-rows">
					<div className="woocommerce-category-row">
						<span>{__('Categories', 'vulopilot')}</span>
						<span>
							{null !== categoriesTotal ? categoriesTotal : '—'}
						</span>
					</div>
				</div>
			),
			footer: (
				<ButtonInput
					buttons={{
						text: __('Manage categories →', 'vulopilot'),
						color: 'text-purple',
						onClick: () =>
							window.open(
								`${appLocalizer.site_url}/wp-admin/edit-tags.php?taxonomy=product_cat&post_type=product`,
								'_self'
							),
					}}
				/>
			),
		},
		{
			id: 'product-seo',
			icon: 'search sky',
			title: __('Product SEO', 'vulopilot'),
			badge: productSeo.badge ?? undefined,
			desc: __('Improve product visibility on search engines.', 'vulopilot'),
			footer: (
				<ButtonInput
					buttons={{
						text: __('Review product SEO →', 'vulopilot'),
						color: 'text-purple',
						onClick: () => onReviewTab('products'),
					}}
				/>
			),
		},
		{
			id: 'customer-insights',
			icon: 'person cyan',
			title: __('Customer Insights', 'vulopilot'),
			desc: (
				<div className="woocommerce-category-rows">
					<div className="woocommerce-category-row">
						<span>{__('Customers total', 'vulopilot')}</span>
						<span>
							{null !== customersTotal ? customersTotal : '—'}
						</span>
					</div>
				</div>
			),
			footer: (
				<ButtonInput
					buttons={{
						text: __('View customers →', 'vulopilot'),
						color: 'text-purple',
						onClick: () =>
							window.open(
								`${appLocalizer.site_url}/wp-admin/users.php?role=customer`,
								'_self'
							),
					}}
				/>
			),
		},
		{
			id: 'revenue-reports',
			icon: 'bar-chart green',
			title: __('Revenue Reports', 'vulopilot'),
			badge: !revenue ? { color: 'purple', text: __('Pro', 'vulopilot') } : undefined,
			desc: revenue ? (
				<div className="woocommerce-category-rows">
					<div className="woocommerce-category-row">
						<span>{__('Today', 'vulopilot')}</span>
						<span>{formatCurrency(revenue.today_revenue)}</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('This week', 'vulopilot')}</span>
						<span>{formatCurrency(revenue.week_revenue)}</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('This month', 'vulopilot')}</span>
						<span>{formatCurrency(revenue.month_revenue)}</span>
					</div>
				</div>
			) : (
				__(
					'Enable the WooCommerce Intelligence module for detailed revenue reports.',
					'vulopilot'
				)
			),
			footer: (
				<ButtonInput
					buttons={{
						text: revenue
							? __('View full report →', 'vulopilot')
							: __('Enable module →', 'vulopilot'),
						color: 'text-purple',
						onClick: () =>
							window.open(
								`${appLocalizer.admin_url}#&tab=modules`,
								'_self'
							),
					}}
				/>
			),
		},
		...NOT_TRACKED_TILES.map(
			(tile): MetricTileItem => ({
				id: tile.id,
				icon: tile.icon,
				title: tile.title,
				badge: NOT_TRACKED_BADGE,
				desc: tile.desc,
			})
		),
		{
			id: 'store-automation',
			icon: 'automation violet',
			title: __('Store Automation', 'vulopilot'),
			badge:
				(readiness?.automation_failed_count ?? 0) > 0
					? { color: 'red', text: __('Needs attention', 'vulopilot') }
					: undefined,
			desc: (
				<>
					{(readiness?.automation_failed_count ?? 0) > 0 && (
						<div className="woocommerce-category-highlight">
							{sprintf(
								/* translators: %d is the number of failed automation runs. */
								__('%d automatic tasks failed', 'vulopilot'),
								readiness?.automation_failed_count ?? 0
							)}
						</div>
					)}
					{__(
						'Automation rules for orders, emails, and store events that failed to run in the last 30 days.',
						'vulopilot'
					)}
				</>
			),
			footer: (
				<ButtonInput
					buttons={{
						text: __('Review tasks →', 'vulopilot'),
						color: 'text-purple',
						onClick: () =>
							window.open(
								`${appLocalizer.admin_url}#&tab=automations`,
								'_self'
							),
					}}
				/>
			),
		},
		{
			id: 'compatibility',
			icon: 'editor-code gray',
			title: __('Compatibility', 'vulopilot'),
			badge: compatibilityCount > 0
				? {
						color: 'red',
						text: sprintf(
							/* translators: %d is the number of outdated theme templates. */
							__('%d templates outdated', 'vulopilot'),
							compatibilityCount
						),
					}
				: undefined,
			desc: __(
				'Your theme\'s WooCommerce template overrides may be missing fixes from newer versions.',
				'vulopilot'
			),
			footer: (
				<ButtonInput
					buttons={{
						text: __('Review templates →', 'vulopilot'),
						color: 'text-purple',
						onClick: () => onReviewTab('store'),
					}}
				/>
			),
		},
	];

	return (
		<MetricTileComponent
			autoFit
			minTileWidth={16}
			isLoading={isLoading}
			data={tiles}
		/>
	);
};

export default CommerceCategoryGrid;
