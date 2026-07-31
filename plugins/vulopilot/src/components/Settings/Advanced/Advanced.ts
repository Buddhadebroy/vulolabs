import { __ } from '@wordpress/i18n';

export default {
	id: 'advanced',
	priority: 1,
	headerTitle: __('Advanced', 'vulopilot'),
	headerIcon: 'admin-tools',
	submitUrl: 'settings',
	modal: [
		{
			key: 'enable_debug_logging',
			type: 'checkbox',
			look: 'toggle',
			label: __('Enable debug logging', 'vulopilot'),
			desc: __(
				'Writes report-generation failures to the server error log, in addition to the failure reason already shown on the Reports page. Leave off unless you\'re actively debugging.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_debug_logging', label: '', value: 'enable_debug_logging' },
			],
		},
		{
			key: 'enable_mcp_server',
			type: 'checkbox',
			look: 'toggle',
			label: __('Enable MCP server', 'vulopilot'),
			desc: __(
				'Exposes an MCP (Model Context Protocol) endpoint so external AI clients can call VuloPilot as a set of tools. Every tool that would change content only ever proposes a change for you to review and approve on the Dashboard — nothing is applied automatically. Requires a WordPress Application Password to connect.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_mcp_server', label: '', value: 'enable_mcp_server' },
			],
			moduleEnabled: 'mcp-server',
		},
	],
};
