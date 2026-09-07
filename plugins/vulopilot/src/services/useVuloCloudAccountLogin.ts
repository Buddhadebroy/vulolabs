/* global appLocalizer */
import axios from 'axios';
import { getApiLink } from '@zyra/core';

/**
 * Whether the current WP admin has a personal VuloCloud account connected
 * — a different concept from `appLocalizer.khali_dabba`. `khali_dabba` is
 * the *site's* own Product ID + License Key pair, validated against
 * VuloCloud's Licensing bounded context (vulopilot-pro's own
 * `classes/License/LicenseManager.php` — see that plugin's own docblock
 * and `/LICENSING_INTEGRATION.md` in the vulocloud repo). This hook is
 * about a *person* signing into the VuloCloud platform itself, the way
 * you'd sign into any SaaS dashboard.
 *
 * Real now — `VuloCloudAccountConnection.php` (this plugin's own
 * `classes/Services/`) really calls VuloCloud's own `POST /auth/login`
 * (identity-access bounded context) via the "Connect to VuloCloud" popup
 * (`components/Popup/VuloCloudConnectPopup.tsx`, opened from
 * useContentGate.tsx's own "log in" tier). `isLoggedIn` below is a plain,
 * synchronous read of `appLocalizer.vulocloud_connected` — localized once
 * at page load (FrontendScripts.php's own `localize_scripts()`), same
 * shape `appLocalizer.khali_dabba` already has — not a fetch, so there's
 * no loading state to track here either.
 *
 * `connectVuloCloudAccount()`/`disconnectVuloCloudAccount()` below are
 * plain functions rather than something this hook returns: a successful
 * call reloads the page (see their own docblocks for why) rather than
 * updating local React state, so there's no per-call-site state for a
 * hook to own — any component that needs to trigger a connect/disconnect
 * imports them directly, same as `getApiLink`/`sendApiResponse` etc.
 * aren't wrapped in a hook either.
 */
export const useVuloCloudAccountLogin = (): {
	isLoggedIn: boolean;
	isLoading: boolean;
	email: string | null;
} => {
	return {
		isLoggedIn: !!appLocalizer.vulocloud_connected,
		isLoading: false,
		email: appLocalizer.vulocloud_account_email || null,
	};
};

/**
 * The shape WP_REST_Server::error_to_response() gives a WP_Error —
 * VuloCloudAccount::connect()'s own error codes
 * (`vulopilot_vulocloud_invalid_credentials`,
 * `vulopilot_vulocloud_two_factor_required`, etc. — see
 * VuloCloudAccountConnection::connect()'s own docblock) arrive here as
 * `code`. Raw axios rather than @zyra/core's sendApiResponse() on
 * purpose, same reasoning as useCopilotChat.ts: sendApiResponse()
 * swallows the response body on any error, and
 * VuloCloudConnectPopup.tsx needs the real `code`/`message` to decide
 * whether to prompt for a 2FA code or just show the error.
 */
export interface VuloCloudConnectErrorBody {
	code?: string;
	message?: string;
}

/**
 * `POST vulocloud-account/connect` (VuloCloudAccount::connect(), this
 * plugin's own `classes/RestAPI/Controllers/`) — a real login against
 * VuloCloud's own account system, not this site's Pro license. Reloads
 * the page on success rather than updating any client-side state: every
 * `useContentGate()` call site (there can be several on one page, each
 * with its own hook instance) needs to see the new `isLoggedIn` at once,
 * and the simplest way to guarantee that is the same one
 * GoogleServicesConnection's own OAuth callback already relies on — land
 * back on a fresh page load that re-reads the real, just-updated
 * `appLocalizer.vulocloud_connected` from the server, rather than trying
 * to keep several independent hook instances' local state in sync.
 *
 * @param email
 * @param password
 * @param twoFactorCode Only sent when non-empty — see
 *   VuloCloudAccountApiClient::login()'s own PHP-side docblock.
 * @return A promise that resolves after the page has already started
 *   reloading on success, or rejects with the real axios error (read
 *   `error.response.data` as {@link VuloCloudConnectErrorBody}) on
 *   failure — VuloCloudConnectPopup.tsx's own `.catch()` is what a caller
 *   should use to show the real error/prompt for 2FA.
 */
export const connectVuloCloudAccount = (
	email: string,
	password: string,
	twoFactorCode?: string
): Promise<void> =>
	axios
		.post(
			getApiLink(appLocalizer, 'vulocloud-account/connect'),
			{
				email,
				password,
				...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
			},
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
		.then(() => {
			window.location.reload();
		});

/**
 * `POST vulocloud-account/disconnect` — best-effort remote logout, always
 * clears the local connection either way (see
 * VuloCloudAccountConnection::disconnect()'s own docblock). No UI calls
 * this yet (no "manage your VuloCloud connection" settings surface
 * exists) — exported for when one does, same "real and callable before
 * anything wires it up" posture the REST route itself already has.
 */
export const disconnectVuloCloudAccount = (): Promise<void> =>
	axios
		.post(
			getApiLink(appLocalizer, 'vulocloud-account/disconnect'),
			{},
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
		.then(() => {
			window.location.reload();
		});
