/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, TrendStatComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface TrendSnapshotRow {
	snapshot_date: string;
	revenue: string | number;
	order_count: string | number;
	avg_order_value: string | number;
}

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
 * "Store Overview" — real Revenue/Orders/Average Order Value, each with a
 * real week-over-week % change and a real sparkline, all computed
 * client-side from one existing endpoint,
 * `GET store-trends-history?days=14` (`StoreTrendsRest.php`,
 * vulopilot_store_trends_snapshots) — its rows already carry `revenue`,
 * `order_count`, AND `avg_order_value` per finished calendar day, nothing
 * fabricated. Conversion Rate and Net Profit render an honest "Not
 * tracked yet" tile — no site-visit tracking or cost/expense data exists
 * anywhere in this codebase to compute either. Drops the mockup's "Data
 * synced from VuloCart" badge (vulopilot/vulocart share no namespace —
 * see this repo's own CLAUDE.md) and its custom date-range picker (no
 * arbitrary date-range comparison exists in the real endpoint) — "View
 * Full Report" instead does a real navigation to the WooCommerce tab.
 */
interface StoreOverviewCardsProps {
	onNavigateToWooCommerceTab: () => void;
}

const StoreOverviewCards = ({
	onNavigateToWooCommerceTab,
}: StoreOverviewCardsProps) => {
	const [rows, setRows] = useState<TrendSnapshotRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<TrendSnapshotRow[]>(
			getApiLink(appLocalizer, 'store-trends-history?days=14'),
			nonceHeaders
		)
			.then((response) => setRows(response ?? []))
			.finally(() => setIsLoading(false));
	}, []);

	const last7 = rows.slice(-7);
	const prev7 = rows.slice(-14, -7);

	const sum = (list: TrendSnapshotRow[], key: 'revenue' | 'order_count') =>
		list.reduce((total, row) => total + Number(row[key]), 0);

	const revenueThisWeek = sum(last7, 'revenue');
	const revenueLastWeek = sum(prev7, 'revenue');
	const ordersThisWeek = sum(last7, 'order_count');
	const ordersLastWeek = sum(prev7, 'order_count');
	const aovThisWeek = ordersThisWeek > 0 ? revenueThisWeek / ordersThisWeek : 0;
	const aovLastWeek = ordersLastWeek > 0 ? revenueLastWeek / ordersLastWeek : 0;

	const items = [
		{
			icon: 'price',
			label: __('Total Revenue', 'vulopilot'),
			value: formatCurrency(revenueThisWeek),
			badge: pctBadge(revenueThisWeek, revenueLastWeek),
			color: 'primary',
			chartData: rows.map((row) => ({ value: Number(row.revenue) })),
		},
		{
			icon: 'cart',
			label: __('Orders', 'vulopilot'),
			value: ordersThisWeek.toLocaleString(),
			badge: pctBadge(ordersThisWeek, ordersLastWeek),
			color: 'secondary',
			chartData: rows.map((row) => ({ value: Number(row.order_count) })),
		},
		{
			icon: 'bar-chart',
			label: __('Average Order Value', 'vulopilot'),
			value: formatCurrency(aovThisWeek),
			badge: pctBadge(aovThisWeek, aovLastWeek),
			color: 'accent',
			chartData: rows.map((row) => ({ value: Number(row.avg_order_value) })),
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
			title={__('Store Overview', 'vulopilot')}
			titleIcon="cart"
			isLoading={isLoading}
			action={
				<ButtonInput
					buttons={{
						text: __('View Full Report →', 'vulopilot'),
						onClick: onNavigateToWooCommerceTab,
					}}
				/>
			}
		>
			<TrendStatComponent items={items} cols={3} isLoading={isLoading} />
		</CardComponent>
	);
};

export default StoreOverviewCards;
