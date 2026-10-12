import { __ } from '@wordpress/i18n';

/**
 * Integrations → AI & MCP. Merged from the former standalone `Ai.ts` +
 * `Mcp.ts` pair (one field each) - both are addon-module config with no
 * functionality of their own yet (no AI provider client, no MCP server),
 * same "saved, not yet consumed" status, kept honest rather than hidden.
 * Backed by `Utill::SETTINGS_DEFAULTS`'s AI and MCP sections - field keys
 * are unchanged, so no PHP-side change was needed to merge these two tabs
 * into one.
 *
 * Deliberately no "Enable AI"/"Enable MCP server" toggle here - both are
 * their own addon modules (`modules/Ai/Module.php`, `modules/Mcp/Module.php`,
 * same shape as the Passport module), and activating/deactivating one on
 * the Modules page is the real on/off switch - enforced below via
 * `moduleEnabled: 'ai'` / `moduleEnabled: 'mcp'`. This tab only holds
 * configuration for once each module exists.
 */
export default {
	id: 'ai',
	priority: 3,
	headerTitle: __( 'AI & MCP', 'vulocart' ),
	headerIcon: 'ai',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [
		{
			key: 'ai-section-provider',
			type: 'section',
			icon: 'ai',
			title: __( 'Provider', 'vulocart' ),
			desc: __(
				'Choose the AI provider used once the AI module is active.',
				'vulocart'
			),
		},
		{
			key: 'ai_provider',
			type: 'select',
			label: __( 'AI provider', 'vulocart' ),
			settingDescription: __(
				'Service that powers AI features across the plugin.',
				'vulocart'
			),
			options: [
				{ label: __( 'None', 'vulocart' ), value: 'none' },
				{ label: __( 'OpenAI', 'vulocart' ), value: 'openai' },
				{ label: __( 'Anthropic', 'vulocart' ), value: 'anthropic' },
			],
			moduleEnabled: 'ai',
		},
		{
			key: 'mcp-section-server',
			type: 'section',
			icon: 'centralized-connections',
			title: __( 'Server credentials', 'vulocart' ),
			desc: __(
				'Configure how MCP clients authenticate once the MCP module is active.',
				'vulocart'
			),
		},
		{
			key: 'mcp_api_key',
			type: 'password',
			label: __( 'MCP API key', 'vulocart' ),
			settingDescription: __(
				'Credential an MCP client presents to authenticate against the server.',
				'vulocart'
			),
			moduleEnabled: 'mcp',
		},
	],
};
