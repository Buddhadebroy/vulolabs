/* global vulopilotAppLocalizer */
import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ModuleGuardComponent } from '@zyra/components';
import { useAiCopilotEnabled } from '../services/useAiCopilotEnabled';

interface AiCopilotGuardProps {
	title?: string;
	desc?: string;
	children: ReactNode;
}

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
				window.open(
					`${vulopilotAppLocalizer.admin_url}#&tab=settings&subtab=modules&module=ai-copilot`,
					'_self'
				);
			}}
		/>
	);
};

export default AiCopilotGuard;
