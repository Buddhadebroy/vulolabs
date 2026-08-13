/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface SalesInsights {
	cross_sell_count: number;
	upsell_count: number;
	bundle_count: number;
	bundle_top_pair: { product_a: string; product_b: string; occurrences: number } | null;
	frequent_payment_failure_count: number;
	stale_products_count: number;
	stale_products_sample: { id: number; name: string }[];
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Shared `GET /sales-insights` fetch (Pro's WooCommerceIntelligence
 * module, SalesInsightsRest.php) — used by AiSalesOptimizerCard.tsx,
 * StoreIntelligenceSummaryCard.tsx, and ProductsToLookAtCard.tsx (its own
 * "No sales" row, from `stale_products_sample`), which all read the same
 * real cross-sell/upsell/bundle/at-risk data. Pro-only route with no
 * filter-slot wrapper — same graceful-404-to-null handling every other
 * Pro-only REST probe in this codebase already uses (TopSellingProductsCard.tsx's
 * own docblock), so Pro/module inactive renders the same honest locked
 * state as "no data yet."
 */
export const useSalesInsights = (): {
	data: SalesInsights | null;
	isLoading: boolean;
} => {
	const [data, setData] = useState<SalesInsights | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<SalesInsights>(
			getApiLink(appLocalizer, 'sales-insights'),
			nonceHeaders
		)
			.then((response) => setData(response ?? null))
			.finally(() => setIsLoading(false));
	}, []);

	return { data, isLoading };
};
