/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, TrendStatComponent } from '@zyra/components';
import { ButtonInput, SelectInput } from '@zyra/inputs';

interface TrendSnapshotRow {
	snapshot_date: string;
	revenue: string | number;
	order_count: string | number;
	avg_order_value: string | number;
}

type PeriodDays = '7' | '30' | '90';

const PERIOD_OPTIONS: { value: PeriodDays; label: string }[] = [
	{ value: '7', label: __('Last 7 Days', 'vulopilot') },
	{ value: '30', label: __('Last 30 Days', 'vulopilot') },
	{ value: '90', label: __('Last 90 Days', 'vulopilot') },
];

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const formatCurrency = (value: number): string =>
	`$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const pctBadge = (
	current: number,
	previous: number
): { text: string; color: string } | undefined => {
	if (previous <= 0) {
		return undefined;
	}
	const pct = ((current - previous) / previous) * 100;
	return {
		text: sprintf('%1$s%2$s%%', pct >= 0 ? '↑ ' : '↓ ', Math.abs(pct).toFixed(1)),
		color: pct >= 0 ? 'green' : 'red',
	};
};

/**
 * Real failed-order count for the "Failed Purchases" tile —
 * `wc/v3/orders?status=failed`'s own `X-WP-Total` header (WooCommerce
 * core's real order status, not fabricated), same raw-axios +
 * `X-WP-Total` technique WooCommerceMetricsGrid.tsx's own
 * `useWcTotalCount()` already established (`getApiResponse` discards
 * response headers, so a real total-count read needs axios directly).
 * Resolves `null` on a 404 (WooCommerce not installed/active), same
 * graceful-degradation posture every other wc/v3 probe in this codebase
 * already uses.
 */
const useFailedOrdersCount = (): number | null => {
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;

		axios
			.get(`${appLocalizer.apiUrl}/wc/v3/orders`, {
				...nonceHeaders,
				params: { status: 'failed', per_page: 1 },
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

/**
 * "At a Glance" (titled "Store Overview" originally) — real Revenue/
 * Orders/Average Order Value/Failed Purchases, each backed by a real
 * period-over-period comparison (7/30/90 days, user-selectable) computed
 * client-side from one existing endpoint, `GET store-trends-history?days=N`
 * (`StoreTrendsRest.php`, vulopilot_store_trends_snapshots) — its rows
 * already carry `revenue`, `order_count`, AND `avg_order_value` per
 * finished calendar day, nothing fabricated. Failed Purchases is a real
 * WooCommerce core order-status count (`useFailedOrdersCount()` above),
 * not derived from the snapshot table. Conversion Rate and Net Profit
 * render an honest "Not tracked yet" tile — no site-visit tracking or
 * cost/expense data exists anywhere in this codebase to compute either.
 * Drops the mockup's "Data synced from VuloCart" badge (vulopilot/vulocart
 * share no namespace — see this repo's own CLAUDE.md). Rendered as a
 * grid-4 sidebar beside CommerceCategoryGrid on the WooCommerce tab
 * (its only consumer now that the separate Overview tab is gone — see
 * WooCommerce.tsx) — "View Full Report" stays caller-supplied
 * (`onNavigateToCommerceTab`) rather than hardcoded, same shape it
 * already had when it was reused across two tabs.
 */
interface StoreOverviewCardsProps {
	onNavigateToCommerceTab: () => void;
}

const StoreOverviewCards = ({
	onNavigateToCommerceTab,
}: StoreOverviewCardsProps) => {
	const [period, setPeriod] = useState<PeriodDays>('30');
	const [rows, setRows] = useState<TrendSnapshotRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const failedOrders = useFailedOrdersCount();

	useEffect(() => {
		setIsLoading(true);
		getApiResponse<TrendSnapshotRow[]>(
			getApiLink(
				appLocalizer,
				`store-trends-history?days=${Number(period) * 2}`
			),
			nonceHeaders
		)
			.then((response) => setRows(response ?? []))
			.finally(() => setIsLoading(false));
	}, [period]);

	const periodDays = Number(period);
	const current = rows.slice(-periodDays);
	const previous = rows.slice(-periodDays * 2, -periodDays);

	const sum = (list: TrendSnapshotRow[], key: 'revenue' | 'order_count') =>
		list.reduce((total, row) => total + Number(row[key]), 0);

	const revenueCurrent = sum(current, 'revenue');
	const revenuePrevious = sum(previous, 'revenue');
	const ordersCurrent = sum(current, 'order_count');
	const ordersPrevious = sum(previous, 'order_count');
	const aovCurrent = ordersCurrent > 0 ? revenueCurrent / ordersCurrent : 0;
	const aovPrevious = ordersPrevious > 0 ? revenuePrevious / ordersPrevious : 0;

	const items = [
		{
			icon: 'price',
			label: __('Total Revenue', 'vulopilot'),
			value: formatCurrency(revenueCurrent),
			badge: pctBadge(revenueCurrent, revenuePrevious),
			color: 'primary',
			chartData: current.map((row) => ({ value: Number(row.revenue) })),
		},
		{
			icon: 'cart',
			label: __('Orders', 'vulopilot'),
			value: ordersCurrent.toLocaleString(),
			badge: pctBadge(ordersCurrent, ordersPrevious),
			color: 'border-purple',
			chartData: current.map((row) => ({ value: Number(row.order_count) })),
		},
		{
			icon: 'bar-chart',
			label: __('Average Order Value', 'vulopilot'),
			value: formatCurrency(aovCurrent),
			badge: pctBadge(aovCurrent, aovPrevious),
			color: 'accent',
			chartData: current.map((row) => ({ value: Number(row.avg_order_value) })),
		},
		{
			icon: 'error',
			label: __('Failed Purchases', 'vulopilot'),
			value: null !== failedOrders ? failedOrders.toLocaleString() : '—',
			badge:
				null !== failedOrders && failedOrders > 0
					? { text: __('Needs attention', 'vulopilot'), color: 'red' }
					: undefined,
		},
		{
			icon: 'analytics',
			label: __('Conversion Rate', 'vulopilot'),
			value: '—',
			badge: { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
		},
		{
			icon: 'revenue',
			label: __('Net Profit', 'vulopilot'),
			value: '—',
			badge: { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
		},
	];

	return (
		<CardComponent
			title={__('At a Glance', 'vulopilot')}
			titleIcon="cart"
			isLoading={isLoading}
			action={
				<>
					<SelectInput
						type="single-select"
						name="store-overview-period"
						value={period}
						onChange={(value) => setPeriod(value as PeriodDays)}
						options={PERIOD_OPTIONS}
						isClearable={false}
					/>
					<ButtonInput
						buttons={{
							icon: 'arrow-right',
							color: 'text-purple',
							text: __('View Full Report', 'vulopilot'),
							onClick: onNavigateToCommerceTab,
						}}
					/>
				</>
			}
		>
			<TrendStatComponent items={items} cols={3} isLoading={isLoading} />
		</CardComponent>
	);
};

export default StoreOverviewCards;
