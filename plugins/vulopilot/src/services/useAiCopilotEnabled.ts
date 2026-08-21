/* global appLocalizer */

/**
 * Whether the real, genuinely free `ai-copilot` module
 * (modules/AiCopilot/Module.php) is currently active — the single master
 * gate every AI-branded surface in this plugin now shares (AI Assistant
 * Chat tab, GEO's "SEO & Visibility" composer, every "Fix with AI"/AI
 * suggestion card). `active_modules` is already localized synchronously at
 * page load (see FrontendScripts.php's own localize_scripts()), so this is
 * a plain read, same shape as GeoTab.tsx's own isGeoInsightsActive() —
 * no fetch, no loading state needed.
 *
 * Server-side, the same real check backs Copilot.php's/ContentAssistant.php's/
 * AiActionRuns.php's own permission callbacks
 * (`VuloPilot()->modules->is_active( 'ai-copilot' )`) — this hook is the
 * client-side half, not the enforcement itself.
 */
export const useAiCopilotEnabled = (): boolean =>
	appLocalizer.active_modules?.includes('ai-copilot') ?? false;
