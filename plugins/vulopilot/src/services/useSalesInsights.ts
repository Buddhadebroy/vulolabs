/* global vulopilotAppLocalizer */
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

const nonceHeaders = { headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } };

export const useSalesInsights = (): {
	data: SalesInsights | null;
	isLoading: boolean;
} => {
	const [data, setData] = useState<SalesInsights | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<SalesInsights>(
			getApiLink(vulopilotAppLocalizer, 'sales-insights'),
			nonceHeaders
		)
			.then((response) => setData(response ?? null))
			.finally(() => setIsLoading(false));
	}, []);

	return { data, isLoading };
};
