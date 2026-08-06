/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ListComponent, ModuleGuardComponent } from '@zyra/components';

interface TopProduct {
	product_id: number;
	name: string;
	revenue: number;
	units_sold: number;
}

interface RevenueInsights {
	top_products: TopProduct[];
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * "Top Selling Products" — real, `GET revenue-insights`'s `top_products`
 * (Pro's WooCommerceIntelligence module, RevenueInsightsRest.php),
 * ranked by 30-day revenue. `units_sold` was added to that endpoint's
 * existing per-product loop specifically for this card (a 2-line
 * addition to already-executing code, not new tracking — see this
 * folder's plan). This is a Pro-only REST route with no filter-slot
 * wrapper the way other Pro panels have — same graceful-404 handling
 * `getApiResponse` already gives every other WooCommerce REST call in
 * this codebase (RecentContentCard.tsx's own wc/v3 calls), so Pro/module
 * inactive renders the same honest empty state as "no data yet".
 */
const TopSellingProductsCard = () => {
	const [products, setProducts] = useState<TopProduct[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<RevenueInsights>(
			getApiLink(appLocalizer, 'revenue-insights'),
			nonceHeaders
		)
			.then((response) => setProducts(response?.top_products ?? []))
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<CardComponent
			title={__('Top Selling Products', 'vulopilot')}
			titleIcon="cart"
			isLoading={isLoading}
		>
			{!isLoading && (!products || products.length === 0) && (
				<ModuleGuardComponent
					icon="info"
					title={__('No sales data yet', 'vulopilot')}
					desc={__(
						'Top-selling products will appear here once your store has some order history.',
						'vulopilot'
					)}
				/>
			)}
			{!isLoading && products && products.length > 0 && (
				<ListComponent
					className="mini-card list"
					border
					items={products.map((product) => ({
						id: String(product.product_id),
						title: product.name,
						desc: sprintf(
							/* translators: %d is the number of units sold. */
							__('%d sold', 'vulopilot'),
							product.units_sold
						),
						tags: `$${product.revenue.toLocaleString()}`,
					}))}
				/>
			)}
		</CardComponent>
	);
};

export default TopSellingProductsCard;
