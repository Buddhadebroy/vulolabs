/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface StoreReadiness {
	has_woocommerce: boolean;
	readiness: {
		shop: boolean;
		cart: boolean;
		checkout: boolean;
		my_account: boolean;
	};
	payment_methods_active: number;
	secure_checkout: boolean;
	automation_failed_count: number;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Shared `GET /store-readiness` fetch (StoreReadiness.php) — used by
 * WooCommerceCategoryGrid.tsx, which needs this same real live snapshot
 * for its "Store Readiness"/"Checkout & Payments"/"Store Automation"
 * cards all at once; lifted into one hook rather than three independent
 * fetches on the same page load.
 */
export const useStoreReadiness = (): {
	data: StoreReadiness | null;
	isLoading: boolean;
} => {
	const [data, setData] = useState<StoreReadiness | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<StoreReadiness>(
			getApiLink(appLocalizer, 'store-readiness'),
			nonceHeaders
		)
			.then((response) => setData(response ?? null))
			.finally(() => setIsLoading(false));
	}, []);

	return { data, isLoading };
};
