import { __ } from '@wordpress/i18n';
import AiProvidersPanel from './AiProvidersPanel';

/**
 * Settings → Connections → AI Providers.
 *
 * Previously the flat top-level Settings/AiProviders.ts — moved into this
 * new Connections folder per direct instruction, alongside Webhooks/
 * External Services, mirroring Settings/Notifications/'s and
 * Settings/Automation/'s own "one folder, several sub-tab files" shape.
 * `id`/`priority`/`headerTitle`/`headerIcon` are what NavigatorComponent
 * actually reads to list this tab and route to it; `PanelComponent` is the
 * same generic escape hatch Settings.tsx's own GetForm() already uses for
 * vulopilot-pro's Licensing tab — AI provider credentials live in their
 * own encrypted-at-rest `vulopilot_ai_provider_configs` table
 * (Repositories\AiProviderConfigRepository), not this plugin's flat
 * settings option row, so `modal` below is never read.
 */
export default {
	id: 'ai-providers',
	priority: 1,
	headerTitle: __( 'AI Providers', 'vulopilot' ),
	headerDescription: __(
		'Configure and manage your AI provider connections. Add API keys to enable AI features across VuloPilot.',
		'vulopilot'
	),
	headerIcon: 'ai',
	submitUrl: 'settings',
	modal: [],
	PanelComponent: AiProvidersPanel,
};
