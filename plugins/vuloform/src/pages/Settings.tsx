/* global vuloformAppLocalizer */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent, NavigatorComponent } from '@zyra/components';
import { InputRenderer } from '@zyra/inputs';
import { SettingProvider, useSetting } from '../services/SettingContext';
import { apiGet } from '../services/api';
import { errorMessage } from '../services/notify';
import { settingsTabs } from '../services/slots';

interface Stored {
	retention_days: number;
	rate_limit: number;
	honeypot: boolean;
	min_seconds: number;
	store_ip: boolean;
	keep_data_uninstall: string;
	recaptcha_type: string;
	recaptcha_site_key: string;
	recaptcha_score: number;
	/** The secret itself never reaches the browser; this says whether one is saved. */
	recaptcha_secret_set: boolean;
}

/**
 * Site-wide settings, in zyra's settings-schema format: `InputRenderer` draws the form and saves
 * each change a moment after it is made, as on the other VuloLabs settings screens.
 */
export const schema = {
	id: 'general',
	submitUrl: 'settings',
	hideSettingHeader: true,
	groupBySections: true,
	modal: [
		{
			key: 'privacy-section',
			type: 'section',
			icon: 'security',
			title: __('Privacy', 'vuloform'),
			desc: __('What is kept about the people who fill in your forms, and for how long.', 'vuloform'),
		},
		{
			key: 'retention_days',
			type: 'number',
			size: 10,
			minNumber: 0,
			maxNumber: 3650,
			postText: __('days', 'vuloform'),
			label: __('Keep submissions for', 'vuloform'),
			settingDescription: __('Older submissions and their uploaded files are deleted automatically. 0 keeps them until you delete them.', 'vuloform'),
		},
		{
			key: 'privacy_options',
			type: 'setting-row',
			row: false,
			rows: [
				{
					valueKey: 'store_ip',
					icon: 'lock purple',
					title: __('Store the visitor\'s IP address', 'vuloform'),
					desc: __('Off by default. An IP address is personal data; only keep it if you have a reason to.', 'vuloform'),
					control: { toggle: true, toggleStatusLabel: { on: __('On', 'vuloform'), off: __('Off', 'vuloform') } },
				},
			],
		},
		{
			key: 'spam-section',
			type: 'section',
			icon: 'security',
			title: __('Abuse protection', 'vuloform'),
			desc: __('Checks that need no outside service. They apply to every form.', 'vuloform'),
		},
		{
			key: 'rate_limit',
			type: 'number',
			size: 10,
			minNumber: 0,
			maxNumber: 120,
			postText: __('per minute', 'vuloform'),
			label: __('Submissions allowed from one visitor', 'vuloform'),
			settingDescription: __('Per form. Further attempts in the same minute are refused. 0 switches the limit off.', 'vuloform'),
		},
		{
			key: 'min_seconds',
			type: 'number',
			size: 10,
			minNumber: 0,
			maxNumber: 60,
			postText: __('seconds', 'vuloform'),
			label: __('Minimum fill time', 'vuloform'),
			settingDescription: __('A form sent faster than a person could fill it in is filed as spam. 0 switches this off.', 'vuloform'),
		},
		{
			key: 'spam_options',
			type: 'setting-row',
			row: false,
			rows: [
				{
					valueKey: 'honeypot',
					icon: 'security purple',
					title: __('Hidden trap field', 'vuloform'),
					desc: __('A field people never see. A submission that fills it in is filed as spam.', 'vuloform'),
					control: { toggle: true, toggleStatusLabel: { on: __('On', 'vuloform'), off: __('Off', 'vuloform') } },
				},
			],
		},
		{
			key: 'recaptcha-section',
			type: 'section',
			icon: 'security',
			title: __('Google reCAPTCHA', 'vuloform'),
			desc: __(
				'Optional. Create a site key and secret key for the version you choose here, then switch reCAPTCHA on in each form, at the bottom of its Fields tab.',
				'vuloform'
			),
		},
		{
			key: 'recaptcha_type',
			type: 'choice-toggle',
			variant: 'compact',
			defaultValue: 'v2',
			label: __('Version', 'vuloform'),
			options: [
				{
					key: 'v2',
					value: 'v2',
					label: __('v2 checkbox', 'vuloform'),
					desc: __('Visitors tick "I\'m not a robot".', 'vuloform'),
					icon: 'check green',
				},
				{
					key: 'v3',
					value: 'v3',
					label: __('v3 invisible', 'vuloform'),
					desc: __('Scores each visitor in the background.', 'vuloform'),
					icon: 'security blue',
				},
			],
		},
		{
			key: 'recaptcha_site_key',
			type: 'text',
			size: 30,
			label: __('Site key', 'vuloform'),
			settingDescription:
				__('Keys only work for the version they were created for. Empty this to switch reCAPTCHA off everywhere.', 'vuloform') +
				' <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); text-decoration: underline;">' +
				__('Get reCAPTCHA keys', 'vuloform') +
				'</a>',
		},
		{
			key: 'recaptcha_secret_key',
			type: 'password',
			size: 30,
			label: __('Secret key', 'vuloform'),
			settingDescription: __('Kept on the server and never shown again. Leave empty to keep the key already saved.', 'vuloform'),
		},
		{
			key: 'recaptcha_score',
			type: 'select',
			size: 16,
			label: __('v3 strictness', 'vuloform'),
			settingDescription: __('Only used by v3. Submissions scoring below this are filed as spam, not refused.', 'vuloform'),
			options: [
				{ label: __('Lenient (0.3)', 'vuloform'), value: '0.3' },
				{ label: __('Balanced (0.5)', 'vuloform'), value: '0.5' },
				{ label: __('Strict (0.7)', 'vuloform'), value: '0.7' },
			],
		},
		{
			key: 'data-section',
			type: 'section',
			icon: 'database',
			title: __('Data', 'vuloform'),
			desc: __('What happens to your forms, submissions and uploaded files when VuloForm is deleted.', 'vuloform'),
		},
		{
			key: 'keep_data_uninstall',
			type: 'choice-toggle',
			variant: 'compact',
			defaultValue: 'keep_data',
			label: __('When VuloForm is deleted', 'vuloform'),
			options: [
				{
					key: 'keep_data',
					value: 'keep_data',
					label: __('Keep data', 'vuloform'),
					desc: __('Reinstalling picks up where you left off.', 'vuloform'),
					icon: 'database green',
				},
				{
					key: 'delete_everything',
					value: 'delete_everything',
					label: __('Delete everything', 'vuloform'),
					desc: __('Removes forms, submissions and uploaded files.', 'vuloform'),
					icon: 'delete red',
				},
			],
		},
	],
};

type Field = (typeof schema.modal)[number];

/**
 * The sub-tabs of Settings, each a slice of the schema above: the sections it lists, with the
 * fields that follow each one.
 */
const SUBTABS = [
	{
		id: 'privacy',
		title: __('Privacy', 'vuloform'),
		desc: __('What is kept about the people who fill in your forms, and for how long.', 'vuloform'),
		icon: 'security',
		sections: ['privacy-section'],
	},
	{
		id: 'spam',
		title: __('Spam protection', 'vuloform'),
		desc: __('Limits and checks that apply to every form, and the keys for Google reCAPTCHA.', 'vuloform'),
		icon: 'lock',
		sections: ['spam-section', 'recaptcha-section'],
	},
	{
		id: 'data',
		title: __('Data', 'vuloform'),
		desc: __('What happens to your forms, submissions and uploaded files when VuloForm is deleted.', 'vuloform'),
		icon: 'database',
		sections: ['data-section'],
	},
];

const fieldsOf = (sections: string[]): Field[] => {
	const fields: Field[] = [];
	let wanted = false;

	schema.modal.forEach((field) => {
		if ('section' === field.type) {
			wanted = sections.includes(field.key);
		}

		if (wanted) {
			fields.push(field);
		}
	});

	return fields;
};

/** One schema per sub-tab, in the format `InputRenderer` reads. Also what the header search indexes. */
export const subtabSchemas = SUBTABS.map((tab) => ({ ...schema, id: tab.id, title: tab.title, modal: fieldsOf(tab.sections) }));

const Form = ({ tab, values }: { tab: (typeof subtabSchemas)[number]; values: Record<string, unknown> }) => {
	const { setting, settingName, setSetting, updateSetting } = useSetting();

	useEffect(() => {
		// Only this sub-tab's own values, so saving it never touches the others.
		setSetting(tab.id, Object.fromEntries(tab.modal.filter((field) => field.key in values).map((field) => [field.key, values[field.key]])));
	}, []);

	if (settingName !== tab.id) {
		return null;
	}

	return <InputRenderer settings={tab} setting={setting} updateSetting={updateSetting} Popup={() => null} groupBySections />;
};

/** A sub-tab drawn from the schema. It loads the saved values itself, so it always shows what is stored. */
const Panel = ({ id }: { id: string }) => {
	const tab = subtabSchemas.find((item) => item.id === id) ?? subtabSchemas[0];
	const [values, setValues] = useState<Record<string, unknown> | null>(null);
	const [error, setError] = useState('');

	useEffect(() => {
		apiGet<Stored>('settings')
			.then((stored) =>
				setValues({
					retention_days: stored.retention_days,
					rate_limit: stored.rate_limit,
					min_seconds: stored.min_seconds,
					spam_options: { honeypot: { enable: stored.honeypot } },
					keep_data_uninstall: stored.keep_data_uninstall,
					recaptcha_type: stored.recaptcha_type,
					recaptcha_site_key: stored.recaptcha_site_key,
					recaptcha_secret_key: '',
					recaptcha_score: String(stored.recaptcha_score),
					privacy_options: { store_ip: { enable: stored.store_ip } },
				})
			)
			.catch((e) => setError(errorMessage(e)));
	}, []);

	if (error) {
		return (
			<CardComponent title={tab.title} titleIcon="error">
				<ModuleGuardComponent icon="error" title={__('Could not load settings', 'vuloform')} desc={error} />
			</CardComponent>
		);
	}

	if (!values) {
		return <CardComponent title={tab.title} titleIcon="setting" isLoading />;
	}

	return (
		<SettingProvider>
			<Form tab={tab} values={values} />
		</SettingProvider>
	);
};

/**
 * Settings, in the navigator the other VuloLabs settings screens use: a row of sub-tabs
 * (`#&tab=settings&subtab={id}`), each a page of sections that saves as it is changed. VuloForm's
 * own sub-tabs come first; extensions add theirs after.
 */
const Settings = () => {
	const requested = new URLSearchParams(useLocation().hash.substring(1)).get('subtab');
	const tabs = [
		...SUBTABS.map((tab) => ({ id: tab.id, title: tab.title, desc: tab.desc, icon: tab.icon, Component: () => <Panel id={tab.id} /> })),
		...settingsTabs(),
	];

	return (
		<NavigatorComponent
			settingContent={tabs.map((tab) => ({
				type: 'file' as const,
				content: { id: tab.id, headerTitle: tab.title, headerDescription: tab.desc, headerIcon: tab.icon, hideSettingHeader: true },
			}))}
			currentSetting={tabs.some((tab) => tab.id === requested) ? (requested as string) : tabs[0].id}
			getForm={(currentTab: string | null) => {
				const Current = tabs.find((tab) => tab.id === currentTab)?.Component;

				// Keyed so each sub-tab keeps its own state.
				return Current ? <Current key={currentTab} /> : null;
			}}
			prepareUrl={(subTab: string) => `?page=vuloform#&tab=settings&subtab=${subTab}`}
			appLocalizer={vuloformAppLocalizer}
			Link={Link}
			settingName={'Settings'}
			className="admin-settings"
			menuIcon
		/>
	);
};

export default Settings;
