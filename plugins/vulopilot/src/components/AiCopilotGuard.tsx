/* global appLocalizer */
import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ModuleGuardComponent } from '@zyra/components';
import { useAiCopilotEnabled } from '../services/useAiCopilotEnabled';

interface AiCopilotGuardProps {
	title?: string;
	desc?: string;
	children: ReactNode;
}

/**
 * Shared "AI Copilot is off" fallback for every AI-branded card in this
 * plugin — same real module-inactive shape KnowledgeGraphTab.tsx's own
 * `<ModuleGuardComponent icon="error" title="Entity Extraction module is
 * turned off" .../>` already uses for a different free module, just with a
 * button (same "Enable Now" deep-link-to-Modules pattern Popup.tsx's
 * ShowProPopup already uses for Pro modules — this is the free-module
 * equivalent, so it navigates to Modules instead of pitching an upgrade).
 * Renders `children` unchanged once `ai-copilot` is active — see
 * useAiCopilotEnabled()'s own docblock for the real gate this reads.
 */
const AiCopilotGuard = ({ title, desc, children }: AiCopilotGuardProps) => {
	const isEnabled = useAiCopilotEnabled();

	if (isEnabled) {
		return <>{children}</>;
	}

	return (
		<ModuleGuardComponent
			icon="ai"
			title={title ?? __('AI Copilot is turned off', 'vulopilot')}
			desc={
				desc ??
				__(
					'Turn the AI Copilot module back on from Settings → Modules to use this feature.',
					'vulopilot'
				)
			}
			buttonText={__('Enable AI Copilot', 'vulopilot')}
			onButtonClick={() => {
				// Same admin_url-hash + '_self' navigation Popup.tsx's own
				// "Enable Now" button already uses for a Pro module's
				// locked-state popup — see that component's own comment for
				// why '_self' (not the omitted-target default) is required.
				window.open(
					`${appLocalizer.admin_url}#&tab=modules&module=ai-copilot`,
					'_self'
				);
			}}
		/>
	);
};

export default AiCopilotGuard;
