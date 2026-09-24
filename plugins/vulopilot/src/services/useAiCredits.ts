/* global vulopilotAppLocalizer */
import { useCallback, useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

/**
 * `GET /ai-credits/status` (AiCredits::get_status(), this plugin's own
 * `classes/RestAPI/Controllers/`) - the real, live AI Credits balance
 * (architecture plan: "WordPress may cache/display the balance, but it
 * must never be considered the source of truth" - this hook always
 * reflects what THIS site's own local cache last synced from VuloCloud,
 * itself synced from VuloCloud's own authoritative wallet).
 */
export interface AiCreditsStatus {
	connected: boolean;
	credits: number;
	lifetime_earned: number;
	lifetime_used: number;
	connected_at: string;
	last_synced_at: string;
	vulocloud_account_connected: boolean;
	vulocloud_account_email: string;
}

/**
 * Fetches and refreshes AiCreditsStatus - a real, independent hook
 * instance per consumer (this codebase has no shared client-state library
 * to reach for here, e.g. Redux/TanStack Query - see the Pro plugin's own
 * CLAUDE.md on why those specifically aren't introduced), so a component
 * that just changed the balance (e.g. right after a credits-metered AI
 * action) should call `refresh()` itself rather than expect another
 * mounted instance (like the header's own indicator) to notice on its own.
 */
export const useAiCredits = () => {
	const [status, setStatus] = useState<AiCreditsStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const refresh = useCallback(() => {
		setIsLoading(true);
		return getApiResponse<AiCreditsStatus>(
			getApiLink(vulopilotAppLocalizer, 'ai-credits/status'),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		)
			.then((response) => response && setStatus(response))
			.finally(() => setIsLoading(false));
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return { status, isLoading, refresh };
};
