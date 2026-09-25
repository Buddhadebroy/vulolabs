/* global vulopilotAppLocalizer */

/**
 * A distinct id from `copilot-chat` (useCopilotChatEnabled.ts's own gate
 * for "Chat with VuloPilot" - a different feature) and from `ai-copilot`
 * (useAiCopilotEnabled.ts's own free master gate, still also required
 * server-side: "Fix with AI" buttons on individual findings run several
 * of these exact same actions and explicitly stay free - see
 * ContentOptimization\ContentToolsRest.php's own docblock for why only
 * these 9 tiles' entry point moved). `active_modules` is already
 * localized synchronously at page load (see FrontendScripts.php's own
 * localize_scripts()), so this is a plain read, no fetch, no loading
 * state needed.
 */
export const useContentToolsEnabled = (): boolean =>
	vulopilotAppLocalizer.active_modules?.includes('content-optimization') ?? false;
