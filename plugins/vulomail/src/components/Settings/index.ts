/* global vulomailAppLocalizer */
import { createElement } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { SaveStatus } from '@zyra/components';
import { __ } from '@wordpress/i18n';
import { EmailSettings, SmsSettings } from '../../pages/ChannelSettings';
import Tools from '../../pages/Tools';
import AlertMessage, { TEMPLATE_PREFIX } from './AlertMessage';

/**
 * Settings sub-tabs, in zyra's settings-schema format (the same one VuloPilot's Settings uses):
 * `InputRenderer` draws each `modal` and autosaves it to `submitUrl`.
 *
 * On/off settings are `setting-row` toggles. A setting-row field's value is
 * `{ [valueKey]: { enable: boolean } }`; each `valueKey` is the name of the stored setting, and the
 * REST controller (classes/Rest/Settings.php) unpacks it.
 */

const ON_OFF = { on: __('On', 'vulomail'), off: __('Off', 'vulomail') };

const toggle = (valueKey: string, icon: string, title: string, desc: ReactNode) => ({
	valueKey,
	icon,
	title,
	desc,
	control: { toggle: true, toggleStatusLabel: ON_OFF },
});

export interface SettingsField {
	key: string;
	type: string;
	rows?: { valueKey: string }[];
	[key: string]: unknown;
}

export interface SettingsSchema {
	id: string;
	headerTitle: string;
	headerDescription: string;
	headerIcon: string;
	submitUrl?: string;
	hideSettingHeader?: boolean;
	groupBySections?: boolean;
	modal: SettingsField[];
	/** Values the sub-tab keeps besides its fields' own: the alert messages edited inside a row. */
	extraKeys?: string[];
	/** Renders the whole sub-tab itself instead of a generated form; told when it is saving. */
	// eslint-disable-next-line no-unused-vars -- parameter name in a type signature, not a variable.
	PanelComponent?: ComponentType<{ onSaveStatusChange?: (status: SaveStatus) => void }>;
}

export { TEMPLATE_PREFIX };

// Settings → Email and Settings → SMS are drawn by pages/ChannelSettings.tsx (status, delivery order, connections,
// then the channel's own details). Their `modal` is not rendered: it only describes what is on the screen, so the
// header search (searchIndex.ts) can find each setting.
const searchOnly = (key: string, title: string, desc: string): SettingsField => ({ key, type: 'section', title, desc });

const email: SettingsSchema = {
	id: 'email',
	headerTitle: __('Email', 'vulomail'),
	headerDescription: __('Which service sends your email, what takes over when it fails, and who it comes from.', 'vulomail'),
	headerIcon: 'mail',
	hideSettingHeader: true,
	PanelComponent: EmailSettings,
	modal: [
		searchOnly('email_enabled', __('Send email with VuloMail', 'vulomail'), __('Switch VuloMail\'s email delivery on or off.', 'vulomail')),
		searchOnly('email_route', __('Email delivery order', 'vulomail'), __('Primary and backup email connections.', 'vulomail')),
		searchOnly('fallback_to_default', __('Fall back to the WordPress default mailer', 'vulomail'), __('Hand email to WordPress when every connection fails.', 'vulomail')),
		searchOnly('email_connections', __('Email connections', 'vulomail'), __('Add, edit, test or delete an email service.', 'vulomail')),
		searchOnly('from_email', __('Sender email', 'vulomail'), __('The address your email is sent from.', 'vulomail')),
		searchOnly('from_name', __('Sender name', 'vulomail'), __('The name shown in the inbox.', 'vulomail')),
	],
};

const sms: SettingsSchema = {
	id: 'sms',
	headerTitle: __('SMS', 'vulomail'),
	headerDescription: __('Which gateway sends your text messages, what takes over when it fails, and how numbers are read.', 'vulomail'),
	headerIcon: 'send',
	hideSettingHeader: true,
	PanelComponent: SmsSettings,
	modal: [
		searchOnly('sms_enabled', __('Send SMS with VuloMail', 'vulomail'), __('Switch text messages on or off.', 'vulomail')),
		searchOnly('sms_route', __('SMS delivery order', 'vulomail'), __('Primary and backup SMS gateways.', 'vulomail')),
		searchOnly('sms_connections', __('SMS gateways', 'vulomail'), __('Add, edit, test or delete an SMS gateway.', 'vulomail')),
		searchOnly('sms_country_code', __('Default country code', 'vulomail'), __('Added to numbers written without one.', 'vulomail')),
		searchOnly('sms_admin_phone', __('Your phone number', 'vulomail'), __('Where alerts meant for you are sent.', 'vulomail')),
	],
};

const triggers = vulomailAppLocalizer.sms_triggers;

const WOOCOMMERCE = [
	{
		plugin: 'woocommerce',
		name: 'WooCommerce',
		link: vulomailAppLocalizer.plugins_url,
	},
];

/**
 * One group of alerts, one row each: the on/off switch and, while it is on, the message it sends. A group that needs a plugin is
 * still listed when the plugin is missing, locked with a "requires" notice, so the alerts it would
 * add are visible.
 */
const alertFields = (
	groupKey: string,
	requires: string,
	recipient: 'admin' | 'customer',
	section: { key: string; icon: string; title: string; desc: string }
): SettingsField[] => {
	const group = triggers.filter((trigger) => trigger.requires === requires && trigger.recipient === recipient);
	const locked = group.some((trigger) => !trigger.available);
	const dependentPlugin = 'woocommerce' === requires ? { dependentPlugin: WOOCOMMERCE } : {};

	if (0 === group.length) {
		return [];
	}

	return [
		{ ...section, type: 'section' },
		...(locked
			? [
					{
						key: `${groupKey}-requires-notice`,
						type: 'notice',
						noticeType: 'warning',
						title: __('Requires WooCommerce', 'vulomail'),
						message: __('Install and activate WooCommerce to use these alerts.', 'vulomail'),
					},
			  ]
			: []),
		{
			key: groupKey,
			type: 'setting-row',
			row: false,
			...dependentPlugin,
			// Each alert's message is edited inside its own row, and only while the alert is on.
			rows: group.map((trigger) => ({
				...toggle(
					trigger.id,
					'customer' === trigger.recipient ? 'profile blue' : 'notification green',
					trigger.label,
					createElement(AlertMessage, { groupKey, trigger })
				),
				plainDesc: trigger.desc,
			})),
		},
	];
};

const notifications: SettingsSchema = {
	id: 'sms-alerts',
	headerTitle: __('SMS Alerts', 'vulomail'),
	headerDescription: __(
		'Send a text message when something happens on your site. Every alert is off until you switch it on.',
		'vulomail'
	),
	headerIcon: 'notification',
	submitUrl: 'settings',
	hideSettingHeader: true,
	groupBySections: true,
	extraKeys: triggers.map((trigger) => `${TEMPLATE_PREFIX}${trigger.id}`),
	modal: [
		...alertFields('sms_triggers', '', 'admin', {
			key: 'sms-site-alerts-section',
			icon: 'notification',
			title: __('Site alerts', 'vulomail'),
			desc: __('Sent to the admin phone number set under Settings → SMS.', 'vulomail'),
		}),
		...alertFields('sms_triggers_woocommerce', 'woocommerce', 'admin', {
			key: 'sms-woocommerce-alerts-section',
			icon: 'cart',
			title: __('Store alerts', 'vulomail'),
			desc: __('Orders, refunds, stock and reviews. Sent to the admin phone number set under Settings → SMS.', 'vulomail'),
		}),
		...alertFields('sms_triggers_woocommerce_customer', 'woocommerce', 'customer', {
			key: 'sms-customer-alerts-section',
			icon: 'profile',
			title: __('Customer alerts', 'vulomail'),
			desc: __(
				'Sent to the billing phone on the order. Only switch these on if your customers have agreed to receive text messages. A customer gets one text per status change.',
				'vulomail'
			),
		}),
	],
};

const logging: SettingsSchema = {
	id: 'logging',
	headerTitle: __('Privacy & data', 'vulomail'),
	headerDescription: __('What the delivery log keeps, what is tracked, and what happens to your data when VuloMail is deleted.', 'vulomail'),
	headerIcon: 'security',
	submitUrl: 'settings',
	hideSettingHeader: true,
	groupBySections: true,
	modal: [
		{
			key: 'logging-section',
			type: 'section',
			icon: 'clock',
			title: __('Delivery log', 'vulomail'),
			desc: __('Kept in your own database. It never leaves this site.', 'vulomail'),
		},
		{
			key: 'log_options',
			type: 'setting-row',
			row: false,
			rows: [
				toggle(
					'log_enabled',
					'clock green',
					__('Keep a delivery log', 'vulomail'),
					__('Who each message went to, which service sent it, and any error.', 'vulomail')
				),
				toggle(
					'log_content',
					'document orange',
					__('Save message content', 'vulomail'),
					__('Lets you read or resend a message later. Messages can contain password reset links and personal details.', 'vulomail')
				),
				toggle(
					'mask_recipients',
					'lock purple',
					__('Hide recipients', 'vulomail'),
					__('Logs j•••@example.com instead of the full address or number. Hidden entries can\'t be resent.', 'vulomail')
				),
			],
		},
		{
			key: 'log_retention_days',
			type: 'number',
			size: 10,
			minNumber: 0,
			maxNumber: 3650,
			postText: __('days', 'vulomail'),
			label: __('Delete entries after', 'vulomail'),
			settingDescription: __('0 keeps them until you delete them yourself.', 'vulomail'),
		},
		{
			key: 'tracking-section',
			type: 'section',
			icon: 'analytics',
			title: __('Opens and clicks', 'vulomail'),
			desc: __(
				'Shown in the Logs. Needs the delivery log. Counts are estimates: some mail apps block images, and security scanners can open links on their own.',
				'vulomail'
			),
		},
		{
			key: 'tracking_options',
			type: 'setting-row',
			row: false,
			rows: [
				toggle(
					'track_opens',
					'eye blue',
					__('Track email opens', 'vulomail'),
					__('Adds an invisible image to HTML emails. No IP address or device details are kept.', 'vulomail')
				),
				toggle(
					'track_clicks',
					'link blue',
					__('Track email link clicks', 'vulomail'),
					__('Links pass through this site first. Unsubscribe, password reset and sign-in links are never changed.', 'vulomail')
				),
				toggle(
					'sms_track_clicks',
					'link blue',
					__('Track SMS link clicks', 'vulomail'),
					__('The same for text messages. Makes each message a little longer.', 'vulomail')
				),
			],
		},
		{
			key: 'data-section',
			type: 'section',
			icon: 'database',
			title: __('If you delete VuloMail', 'vulomail'),
			desc: __('What happens to your connections, settings and log.', 'vulomail'),
		},
		{
			key: 'keep_data_uninstall',
			type: 'choice-toggle',
			iconEnable: true,
			defaultValue: 'keep_data',
			label: __('Your data', 'vulomail'),
			options: [
				{
					key: 'keep_data',
					value: 'keep_data',
					label: __('Keep it', 'vulomail'),
					desc: __('Reinstalling picks up where you left off.', 'vulomail'),
					icon: 'database',
				},
				{
					key: 'delete_everything',
					value: 'delete_everything',
					label: __('Delete everything', 'vulomail'),
					desc: __('Removes connections, settings and the log.', 'vulomail'),
					icon: 'delete',
				},
			],
		},
	],
};

/** The SMS Alerts screen's form. It has a submenu tab of its own (pages/SmsAlerts.tsx). */
export const notificationsSchema = notifications;

// Settings → Tools is drawn by pages/Tools.tsx; nothing on it is a stored setting.
const tools: SettingsSchema = {
	id: 'tools',
	headerTitle: __('Tools', 'vulomail'),
	headerDescription: __('Send a test email or SMS and run diagnostics.', 'vulomail'),
	headerIcon: 'tools',
	hideSettingHeader: true,
	PanelComponent: Tools,
	// Its cards are in searchIndex.ts's PAGE_SECTIONS, which can scroll to them.
	modal: [],
};

const schemas: SettingsSchema[] = [email, sms, logging, tools];

export default schemas;
