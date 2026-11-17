/* global vulopilotAppLocalizer */

/** Whether the real, genuinely free `ai-copilot` module. */
export const useAiCopilotEnabled = (): boolean =>
	vulopilotAppLocalizer.active_modules?.includes('ai-copilot') ?? false;
