/* global vulopilotAppLocalizer */
import { useCallback, useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface EfficiencyTechnicalDetail {
	label: string;
	value: string;
	status: 'good' | 'attention';
}

export interface EfficiencyCheck {
	id: string;
	title: string;
	description: string;
	icon: string;
	status: 'good' | 'attention' | 'not_applicable';
	badge: string;
	review_title: string;
	review_description: string;
	technical_details: EfficiencyTechnicalDetail[];
}

export interface EfficiencySection {
	key: string;
	label: string;
	question: string;
	checks: EfficiencyCheck[];
}

export interface EfficiencySummary {
	total: number;
	need_attention: number;
	working: number;
	not_applicable: number;
}

export interface EfficiencyChecksResponse {
	summary: EfficiencySummary;
	sections: EfficiencySection[];
	review_items: EfficiencyCheck[];
}

/**
 * `GET /efficiency-checks` (EfficiencyChecks.php) - every check computed live on the server on
 * each call.
 */
export const useEfficiencyChecks = () => {
	const [data, setData] = useState<EfficiencyChecksResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [reloadToken, setReloadToken] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);

		getApiResponse<EfficiencyChecksResponse>(
			getApiLink(vulopilotAppLocalizer, 'efficiency-checks'),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		)
			.then((response) => {
				if (!cancelled && response) {
					setData(response);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [reloadToken]);

	const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

	return { data, isLoading, refetch };
};
