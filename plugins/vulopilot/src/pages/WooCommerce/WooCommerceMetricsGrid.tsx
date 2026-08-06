/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent } from '@zyra/components';
import { useSectionStatus } from '../../services/useSectionStatus';

interface MetricTile {
	id: string;
	icon: string;
	title: string;
	desc: string;
}

const METRIC_TILES: MetricTile[] = [
	{
		id: 'products',
		icon: 'cart',
		title: __('Products', 'vulopilot'),
		desc: __('Optimize your products for more visibility and sales.', 'vulopilot'),
	},
	{
		id: 'categories',
		icon: 'category',
		title: __('Categories', 'vulopilot'),
		desc: __('Organize categories to improve navigation.', 'vulopilot'),
	},
	{
		id: 'checkout',
		icon: 'cash',
		title: __('Checkout', 'vulopilot'),
		desc: __('Optimize checkout experience to reduce drop-offs.', 'vulopilot'),
	},
	{
		id: 'cart',
		icon: 'cart',
		title: __('Cart', 'vulopilot'),
		desc: __('AI insights to increase add-to-cart and AOV.', 'vulopilot'),
	},
	{
		id: 'product-seo',
		icon: 'search',
		title: __('Product SEO', 'vulopilot'),
		desc: __('Improve product visibility on search engines.', 'vulopilot'),
	},
	{
		id: 'product-schema',
		icon: 'editor-code',
		title: __('Product Schema', 'vulopilot'),
		desc: __('Enhance rich results & search visibility.', 'vulopilot'),
	},
	{
		id: 'conversion',
		icon: 'analytics',
		title: __('Conversion', 'vulopilot'),
		desc: __('Improve conversion rate with AI recommendations.', 'vulopilot'),
	},
	{
		id: 'coupons',
		icon: 'coupon',
		title: __('Coupons', 'vulopilot'),
		desc: __('Create and manage coupons to boost sales.', 'vulopilot'),
	},
	{
		id: 'orders',
		icon: 'order',
		title: __('Orders', 'vulopilot'),
		desc: __('Track and manage orders efficiently.', 'vulopilot'),
	},
	{
		id: 'inventory',
		icon: 'database',
		title: __('Inventory', 'vulopilot'),
		desc: __('Track stock levels and avoid stockouts.', 'vulopilot'),
	},
	{
		id: 'recommendations',
		icon: 'thumb-up',
		title: __('Recommendations', 'vulopilot'),
		desc: __('AI-powered product recommendations.', 'vulopilot'),
	},
	{
		id: 'customer-insights',
		icon: 'person',
		title: __('Customer Insights', 'vulopilot'),
		desc: __('Understand customers and purchase behavior.', 'vulopilot'),
	},
	{
		id: 'funnels',
		icon: 'filter',
		title: __('Funnels', 'vulopilot'),
		desc: __('Build high-converting sales funnels.', 'vulopilot'),
	},
	{
		id: 'abandoned-cart',
		icon: 'cart',
		title: __('Abandoned Cart', 'vulopilot'),
		desc: __('Recover lost sales from abandoned carts.', 'vulopilot'),
	},
	{
		id: 'revenue-reports',
		icon: 'bar-chart',
		title: __('Revenue Reports', 'vulopilot'),
		desc: __('Detailed reports to grow your revenue.', 'vulopilot'),
	},
];

const NOT_TRACKED_BADGE = { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' };

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Fetches just the `X-WP-Total` header from a WooCommerce core `wc/v3`
 * list endpoint — `getApiResponse` only returns `response.data` (headers
 * are discarded), so this needs a raw `axios.get()`, same pattern
 * `BulkOptimizePanel.tsx` already established for `wc/v3/products?search=`.
 * No active-plugin flag exists anywhere in this codebase (confirmed) — a
 * site without WooCommerce just 404s here and this resolves to `null`.
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

interface Coupon {
	date_expires: string | null;
}

/**
 * Real Active/Expiring-soon counts derived from each coupon's own
 * `date_expires` — WooCommerce core's `wc/v3/coupons` list, not fabricated.
 */
const useCouponStats = (): { active: number; expiringSoon: number } | null => {
	const [stats, setStats] = useState<{ active: number; expiringSoon: number } | null>(
		null
	);

	useEffect(() => {
		let cancelled = false;

		axios
			.get<Coupon[]>(`${appLocalizer.apiUrl}/wc/v3/coupons`, {
				...nonceHeaders,
				params: { per_page: 100 },
			})
			.then((response) => {
				if (cancelled) {
					return;
				}
				const now = Date.now();
				const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
				let active = 0;
				let expiringSoon = 0;

				response.data.forEach((coupon) => {
					const expiresAt = coupon.date_expires
						? new Date(coupon.date_expires).getTime()
						: null;

					if (!expiresAt || expiresAt > now) {
						active++;
					}
					if (expiresAt && expiresAt > now && expiresAt <= sevenDaysFromNow) {
						expiringSoon++;
					}
				});

				setStats({ active, expiringSoon });
			})
			.catch(() => {
				if (!cancelled) {
					setStats(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return stats;
};

interface TrendSnapshotRow {
	order_count: string | number;
}

/**
 * Real "This week" order count — same `store-trends-history` endpoint
 * `StoreOverviewCards.tsx` uses, fetched independently here (small
 * per-card fetch, same "don't share state across sibling cards" pattern
 * every other Overview this session already uses).
 */
const useOrdersThisWeek = (): number | null => {
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		getApiResponse<TrendSnapshotRow[]>(
			getApiLink(appLocalizer, 'store-trends-history?days=7'),
			nonceHeaders
		).then((response) => {
			if (response) {
				setCount(
					response.reduce((total, row) => total + Number(row.order_count), 0)
				);
			}
		});
	}, []);

	return count;
};

/**
 * The mockup's 15-tile grid. Real tiles: Products (real WC total count +
 * real low-stock count shared with Inventory), Categories (real WC total
 * count — drops the mockup's fabricated "N Need attention" sub-metric),
 * Product SEO (real open-finding count, category 'woocommerce', scanner
 * `product-seo`), Coupons (real, Active/Expiring-soon derived from each
 * coupon's own `date_expires`), Orders (real, `order_count` summed over
 * the last 7 `store-trends-history` rows), Inventory (real, same low-
 * stock count as Products), Customer Insights (real WC total customer
 * count — labeled as a plain total, not "Active", since no recency data
 * backs that word). Checkout/Cart/Product Schema/Conversion/
 * Recommendations/Funnels/Abandoned Cart/Revenue Reports have zero
 * backing anywhere in vulopilot/vulopilot-pro (confirmed via full-
 * codebase search, including checking the cross-plugin-inaccessible
 * vulocart analytics) — honest "Not tracked yet". Static display, no
 * per-tile click — same as Improve Speed/Protect My Site's own grids.
 */
const WooCommerceMetricsGrid = () => {
	const productsTotal = useWcTotalCount('products');
	const categoriesTotal = useWcTotalCount('products/categories');
	const customersTotal = useWcTotalCount('customers');
	const couponStats = useCouponStats();
	const ordersThisWeek = useOrdersThisWeek();
	const lowStock = useSectionStatus('woocommerce', ['inventory-intelligence']);
	const productSeo = useSectionStatus('woocommerce', ['product-seo']);

	const descFor = (id: string): string => {
		switch (id) {
			case 'products':
				return productsTotal !== null
					? sprintf(
							/* translators: %d is the total number of products. */
							__('%d products total.', 'vulopilot'),
							productsTotal
						)
					: __('Optimize your products for more visibility and sales.', 'vulopilot');
			case 'categories':
				return categoriesTotal !== null
					? sprintf(
							/* translators: %d is the total number of categories. */
							__('%d categories total.', 'vulopilot'),
							categoriesTotal
						)
					: __('Organize categories to improve navigation.', 'vulopilot');
			case 'customer-insights':
				return customersTotal !== null
					? sprintf(
							/* translators: %d is the total number of customers. */
							__('%d customers total.', 'vulopilot'),
							customersTotal
						)
					: __('Understand customers and purchase behavior.', 'vulopilot');
			default:
				return METRIC_TILES.find((tile) => tile.id === id)?.desc ?? '';
		}
	};

	const badgeFor = (id: string) => {
		switch (id) {
			case 'products':
			case 'inventory':
				return (
					lowStock.badge ?? {
						text: __('No open findings', 'vulopilot'),
						color: 'green',
					}
				);
			case 'product-seo':
				return (
					productSeo.badge ?? {
						text: __('No open findings', 'vulopilot'),
						color: 'green',
					}
				);
			case 'coupons':
				return couponStats
					? {
							text: sprintf(
								/* translators: 1: active coupons, 2: coupons expiring within 7 days. */
								__('%1$d Active · %2$d Expiring soon', 'vulopilot'),
								couponStats.active,
								couponStats.expiringSoon
							),
							color: 'green',
						}
					: null;
			case 'orders':
				return ordersThisWeek !== null
					? {
							text: sprintf(
								/* translators: %d is the number of orders this week. */
								__('%d This week', 'vulopilot'),
								ordersThisWeek
							),
							color: 'green',
						}
					: null;
			default:
				return NOT_TRACKED_BADGE;
		}
	};

	return (
		<div className="woocommerce-metrics-grid">
			{METRIC_TILES.map((tile) => {
				const badge = badgeFor(tile.id);
				return (
					<CardComponent key={tile.id} className="woocommerce-metric-tile">
						<i className={`woocommerce-metric-icon adminfont-${tile.icon}`} />
						<div className="woocommerce-metric-title">{tile.title}</div>
						{badge && (
							<span className={`admin-badge ${badge.color}`}>
								{badge.text}
							</span>
						)}
						<div className="desc">{descFor(tile.id)}</div>
					</CardComponent>
				);
			})}
		</div>
	);
};

export default WooCommerceMetricsGrid;
