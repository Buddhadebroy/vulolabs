/* global appLocalizer */
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { getApiLink, getApiResponse } from '@zyra/core';

/**
 * `GET /ai-credits/status` (AiCredits::get_status(), this plugin's own
 * `classes/RestAPI/Controllers/`) — the real, live AI Credits balance
 * (architecture plan: "WordPress may cache/display the balance, but it
 * must never be considered the source of truth" — this hook always
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
 * The shape WP_REST_Server::error_to_response() gives a WP_Error —
 * AiCredits::connect()'s own error codes (`vulopilot_ai_credits_*`, see
 * AiCreditsConnection.php's own docblocks) arrive here as `code`. Raw
 * axios rather than @zyra/core's sendApiResponse(), same reasoning
 * useVuloCloudAccountLogin.ts's own VuloCloudConnectErrorBody already
 * documents: sendApiResponse() swallows the response body on error, and
 * the connect form needs the real `code`/`message` to decide whether to
 * prompt for a 2FA code or just show the error.
 */
export interface AiCreditsErrorBody {
	code?: string;
	message?: string;
}

/**
 * Fetches and refreshes AiCreditsStatus — a real, independent hook
 * instance per consumer (this codebase has no shared client-state library
 * to reach for here, e.g. Redux/TanStack Query — see the Pro plugin's own
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
			getApiLink(appLocalizer, 'ai-credits/status'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => response && setStatus(response))
			.finally(() => setIsLoading(false));
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return { status, isLoading, refresh };
};

/**
 * `POST /ai-credits/connect` — the whole install→claim→connect
 * orchestration in one call (AiCreditsConnection::connect_and_claim()'s
 * own docblock). Unlike connectVuloCloudAccount() (which reloads the
 * page), this resolves with the fresh AiCreditsStatus so the calling
 * popup can show the real new balance immediately without a full reload —
 * there's exactly one consumer of this result (the credits popup itself),
 * so there's no multi-instance-sync problem reload was solving there.
 *
 * @param email
 * @param password
 * @param twoFactorCode Only sent when non-empty. Agency path only — the Customer Portal has no 2FA.
 * @param createAccount Registers a brand-new VuloCloud account instead of logging into an existing one.
 * @param asCustomer    "I'm a solo site owner" (architecture plan §F) — registers/logs into the Customer Portal under
 *                      VULOPILOT_VULOCLOUD_HOST_ORGANIZATION_ID instead of creating a personal Organization.
 * @param firstName     Solo + createAccount only — the Customer Portal's own registration requires a name.
 * @param lastName      Solo + createAccount only.
 */
export const connectAiCredits = (
	email: string,
	password: string,
	twoFactorCode: string | undefined,
	createAccount: boolean,
	asCustomer = false,
	firstName?: string,
	lastName?: string
): Promise<AiCreditsStatus> =>
	axios
		.post<AiCreditsStatus>(
			getApiLink(appLocalizer, 'ai-credits/connect'),
			{
				email,
				password,
				...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
				create_account: createAccount,
				as_customer: asCustomer,
				...(firstName ? { first_name: firstName } : {}),
				...(lastName ? { last_name: lastName } : {}),
			},
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
		.then((response) => response.data);
