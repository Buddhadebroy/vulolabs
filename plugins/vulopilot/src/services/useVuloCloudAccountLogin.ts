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
 * No such login flow exists anywhere in this codebase yet — confirmed via
 * a repo-wide search for "vulocloud" across both `vulolabs` and
 * `vulolabs-pro`, which turns up only that one License Key integration.
 * There's no session, no REST endpoint, no localized flag for it. Rather
 * than fake a "connected" state or silently reuse `khali_dabba` for a
 * question it doesn't actually answer, this hook honestly reports
 * logged-out unconditionally until a real VuloCloud account/SSO system is
 * designed and built — AccessGate.tsx's own docblock has the real gating
 * this currently drives.
 */
export const useVuloCloudAccountLogin = (): { isLoggedIn: boolean; isLoading: boolean } => {
	return { isLoggedIn: true, isLoading: false };
};
