import { __ } from '@wordpress/i18n';
import VuloCloudAiPanel from '../components/Settings/VuloCloudAiPanel';

/**
 * Integrations: one flat page with one section per integration (Email, MCP, VuloCloud AI). The declarative sections
 * are drawn and autosaved by InputRenderer; the AI section is a connection panel, not a field list, so it is rendered
 * after them through `AfterComponent` (Settings.tsx).
 *
 * Backed by the Email and MCP sections of `Utill::SETTINGS_DEFAULTS`:
 *
 * - Email: `send_order_confirmation_email` and `send_status_update_email` turn each email on or off, and `notification_from_email` is the `From:` address (Notifications\OrderEmails).
 * - MCP: there is no "Enable MCP server" toggle; activating the MCP module on the Modules screen is the switch (`moduleEnabled: 'mcp'`).
 * - AI: a VuloCloud connection (classes/AI/VuloCloudConnection.php); nothing is stored as a setting.
 */
export default {
	id: 'integrations',
	priority: 7,
	headerTitle: __( 'Integrations', 'vulocart' ),
	headerIcon: 'centralized-connections',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	AfterComponent: VuloCloudAiPanel,
	modal: [
		{
			key: 'email-section-notifications',
			type: 'section',
			icon: 'mail',
			title: __( 'Email', 'vulocart' ),
			desc: __( 'Which order emails actually get sent, and who they come from.', 'vulocart' ),
		},
		{
			key: 'send_order_confirmation_email',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Send order confirmation email', 'vulocart' ),
			settingDescription: __( 'Emails the buyer right after they place an order.', 'vulocart' ),
			options: [ { key: 'send_order_confirmation_email', label: '', value: 'send_order_confirmation_email' } ],
		},
		{
			key: 'send_status_update_email',
			type: 'checkbox',
			look: 'toggle',
			label: __( 'Send order status update email', 'vulocart' ),
			settingDescription: __( 'Emails the buyer whenever an admin changes their order\'s status.', 'vulocart' ),
			options: [ { key: 'send_status_update_email', label: '', value: 'send_status_update_email' } ],
		},
		{
			key: 'notification_from_email',
			type: 'email',
			label: __( 'From address', 'vulocart' ),
			placeholder: __( 'orders@yourstore.com', 'vulocart' ),
			settingDescription: __( 'Address order emails are sent from. Leave blank to use your site\'s default mail sender.', 'vulocart' ),
		},
		{
			key: 'mcp-section-server',
			type: 'section',
			icon: 'centralized-connections',
			title: __( 'MCP', 'vulocart' ),
			desc: __( 'Configure how MCP clients authenticate once the MCP module is active.', 'vulocart' ),
		},
		{
			key: 'mcp_api_key',
			type: 'password',
			label: __( 'MCP API key', 'vulocart' ),
			settingDescription: __( 'Credential an MCP client presents to authenticate against the server.', 'vulocart' ),
			moduleEnabled: 'mcp',
		},
	],
};
