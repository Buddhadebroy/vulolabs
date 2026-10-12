/* global vulopilotAppLocalizer */
import { useCallback, useEffect, useState } from 'react';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';

/**
 * `GET /ai-credits/status` (AiCredits::get_status()) returns whatever is cached in
 * `wp_options` (`AiCreditsConnection::cache_status()`) — it never talks to VuloCloud itself, so it
 * can only ever be as fresh as the last successful `POST /ai-credits/refresh-balance`
 * (`AiCreditsConnection::refresh_balance()`, the one call that actually hits the server). This
 * hook used to only ever call the cached GET, on mount and from the panel's own "Refresh balance"
 * button alike — meaning the displayed balance could go stale indefinitely (surviving even a full
 * WordPress logout/login, since the cache lives in the DB, not a session) with no way, including
 * the button meant for exactly this, to actually pull a fresh number. `refresh()` now calls the
 * live endpoint; `loadCached()` is kept only for the instant-paint read on mount.
 */
export interface AiCreditsStatus {
	connected: boolean;
	/** Fractional - exactly what the server last reported. */
	credits: number;
	lifetime_earned: number;
	lifetime_used: number;
	/** The AI Credits page (Buy Credits) - '' until first synced. */
	buy_credits_url: string;
	connected_at: string;
	last_synced_at: string;
	vulocloud_account_connected: boolean;
	vulocloud_account_email: string;
}

export const useAiCredits = () => {
	const [status, setStatus] = useState<AiCreditsStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const loadCached = useCallback(() => {
		return getApiResponse<AiCreditsStatus>(
			getApiLink(vulopilotAppLocalizer, 'ai-credits/status'),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setStatus(response);
			}
			return response;
		});
	}, []);

	// The live sync — the only call that actually asks VuloCloud for the real balance. A failed
	// sync (e.g. VuloCloud briefly unreachable) deliberately leaves `status` as whatever was last
	// shown, same "never destroy the cached balance on a failed sync" rule the PHP side applies to
	// its own cache.
	const refresh = useCallback(() => {
		setIsLoading(true);
		return sendApiResponse<AiCreditsStatus>(
			vulopilotAppLocalizer,
			getApiLink(vulopilotAppLocalizer, 'ai-credits/refresh-balance'),
			{}
		)
			.then((response) => response && setStatus(response))
			.finally(() => setIsLoading(false));
	}, []);

	useEffect(() => {
		// Paint instantly from whatever's cached, then resync for real — so opening the panel
		// isn't blocked on a network round trip, but always ends up showing the live balance
		// without needing the "Refresh balance" button clicked by hand. Skipped when the site
		// was never connected in the first place — refresh-balance always 400s
		// (vulopilot_ai_credits_not_connected) in that case, so calling it on every mount of
		// every AI-Credits-aware component just spams the console for nothing.
		loadCached().then((cached) => {
			if (cached?.connected) {
				refresh();
			} else {
				setIsLoading(false);
			}
		});
	}, [loadCached, refresh]);

	return { status, isLoading, refresh };
};

/** Credits are fractional: always shown to 3 decimals ("76.550"). */
export const formatCredits = (value: number | null | undefined): string =>
	(value ?? 0).toLocaleString(undefined, {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
