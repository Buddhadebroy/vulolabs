/* global vulopilotAppLocalizer */

/**
 * Whether the real, genuinely free `ai-copilot` module (modules/AiCopilot/Module.php) is currently
 * active.
 */
export const useAiCopilotEnabled = (): boolean =>
	vulopilotAppLocalizer.active_modules?.includes('ai-copilot') ?? false;
