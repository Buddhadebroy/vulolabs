/* global appLocalizer */

/**
 * Whether the real, Pro-only `copilot-chat` module
 * (vulopilot-pro's own modules/CopilotChat/Module.php) is currently
 * active — the real gate for "Chat with VuloPilot" specifically
 * (AIAssistant.tsx/ChatTab.tsx), NOT the same thing as
 * useAiCopilotEnabled()'s own `ai-copilot` gate, which stays free and
 * still covers every OTHER AI-branded surface in this plugin (Content
 * Assistant, "Fix with AI", every AI suggestion card). `active_modules`
 * is already localized synchronously at page load (see
 * FrontendScripts.php's own localize_scripts()), so this is a plain
 * read, no fetch, no loading state needed — same shape as
 * useAiCopilotEnabled() itself.
 *
 * Cardless (no Settings → Modules toggle of its own) — an active Pro
 * license alone turns this on (VuloPilotPro::CARDLESS_MODULE_IDS), so
 * `false` here means "no active Pro license," not "toggled off."
 *
 * Server-side, the same real check backs vulopilot-pro's own
 * CopilotChat\Rest.php permission callback
 * (`VuloPilot()->modules->is_active( 'copilot-chat' )`) — this hook is
 * the client-side half, not the enforcement itself.
 */
export const useCopilotChatEnabled = (): boolean =>
	appLocalizer.active_modules?.includes('copilot-chat') ?? false;
