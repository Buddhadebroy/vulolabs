import { __ } from '@wordpress/i18n';

/**
 * Settings → Get Started → Preferences.
 *
 * "Site tone" — moved here from Settings → AI Visibility (AiVisibility.ts,
 * where it sat right above "Business") per direct instruction ("move the
 * settings from ai visibility to in get started a tab create after site
 * verification called Preferences"). Same real field/key/option
 * (`vulopilot_settings.site_tone`) it's always been — originally on
 * Settings → General before that tab was emptied out and removed
 * entirely. Plain InputRenderer-driven (`groupBySections`/`modal`), unlike
 * this folder's other three tabs (AiProviders.ts/GoogleServices.ts/
 * SiteVerification.ts), which are all hand-built `PanelComponent` escape
 * hatches for real OAuth/verification flows — this tab has no such need,
 * it's one plain text field.
 */
export default {
	id: 'preferences',
	priority: 5,
	headerTitle: __('Preferences', 'vulopilot'),
	headerDescription: __(
		'Controls how VuloPilot’s AI features sound when writing or rewriting your content.',
		'vulopilot'
	),
	headerIcon: 'ai',
	submitUrl: 'settings',
	hideSettingHeader: true,
	groupBySections: true,
	modal: [
		{
			key: 'ai-section',
			type: 'section',
			icon: 'ai',
			title: __('AI Assistant', 'vulopilot'),
			desc: __(
				'Controls how VuloPilot’s AI features sound when writing or rewriting your content.',
				'vulopilot'
			),
		},
		{
			key: 'site_tone',
			type: 'text',
			size: 30,
			label: __('Site tone', 'vulopilot'),
			settingDescription: __(
				'A short description of how this site should sound (e.g. "Friendly and casual" or "Formal and technical") — included with every AI request.',
				'vulopilot'
			),
			placeholder: __('e.g. Friendly and casual', 'vulopilot'),
		},
	],
};
