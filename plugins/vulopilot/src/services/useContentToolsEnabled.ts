/* global vulopilotAppLocalizer */

/**
 * Gate for the Content tools, distinct from `copilot-chat` and `ai-copilot`.
 */
export const useContentToolsEnabled = (): boolean =>
	vulopilotAppLocalizer.active_modules?.includes('content-optimization') ?? false;
