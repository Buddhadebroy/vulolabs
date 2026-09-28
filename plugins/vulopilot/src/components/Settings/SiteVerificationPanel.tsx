/* global vulopilotAppLocalizer */
import { useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { ButtonInput, TextInput, TextAreaInput } from '@zyra/inputs';
import { NoticeComponent, NoticeManager, FormGroupWrapperComponent, FormGroupComponent } from '@zyra/components';
import CardHeader from '../CardHeader';
import { useSetting } from '../../contexts/SettingContext';
import { formatWpDate } from '../../services/formatWpDate';

interface VerifyResult {
	success: boolean;
	message: string;
}

interface ProviderRowConfig {
	provider: 'google' | 'bing' | 'pinterest';
	icon: string;
	title: string;
	desc: string;
}

const PROVIDERS: ProviderRowConfig[] = [
	{
		provider: 'google',
		icon: 'google yellow',
		title: __('Google ', 'vulopilot'),
		desc: __(
			'Verify your site with Google to access Search Console data, indexing status, and rich insights.',
			'vulopilot'
		),
	},
	{
		provider: 'bing',
		icon: 'search-discovery blue',
		title: __('Bing', 'vulopilot'),
		desc: __('Verify your site with Bing to get insights from Bing Webmaster Tools.', 'vulopilot'),
	},
	{
		provider: 'pinterest',
		icon: 'pinterest red',
		title: __('Pinterest', 'vulopilot'),
		desc: __('Verify your site with Pinterest to claim your site and unlock analytics.', 'vulopilot'),
	},
];

/** "Stop typing, then save" debounce - same shape TitleFormatsPanel.tsx's own `scheduleSave()` already uses for a hand-built (non-InputRenderer) panel's plain text fields. */
const AUTOSAVE_DEBOUNCE_MS = 1000;

interface PlainCodeFieldConfig {
	key: 'webmaster_baidu_verification' | 'webmaster_yandex_verification' | 'webmaster_norton_verification';
	icon: string;
	title: string;
	fieldLabel: string;
	desc: string;
}

/**
 * Baidu/Yandex/Norton - real `meta`-tag verification codes (WebmasterToolsManager, same as the 3
 * `ProviderRow`s above).
 */
const PLAIN_CODE_FIELDS: PlainCodeFieldConfig[] = [
	{
		key: 'webmaster_baidu_verification',
		icon: 'search-discovery red',
		title: __('Baidu', 'vulopilot'),
		// fieldLabel: __('Baidu Webmaster Tools verification ID', 'vulopilot'),
		desc: __(
			'Enter your Baidu Webmaster Tools verification ID. Rendered as <meta name="baidu-site-verification" content="...">.',
			'vulopilot'
		),
	},
	{
		key: 'webmaster_yandex_verification',
		icon: 'search yellow',
		title: __('Yandex', 'vulopilot'),
		// fieldLabel: __('Yandex verification ID', 'vulopilot'),
		desc: __(
			'Enter your Yandex.Webmaster verification ID. Rendered as <meta name="yandex-verification" content="...">.',
			'vulopilot'
		),
	},
	{
		key: 'webmaster_norton_verification',
		icon: 'security green',
		title: __('Norton Safe Web', 'vulopilot'),
		// fieldLabel: __('Norton Safe Web verification ID', 'vulopilot'),
		desc: __(
			'Enter your Norton Safe Web ownership verification ID. Rendered as <meta name="norton-safeweb-site-verification" content="...">.',
			'vulopilot'
		),
	},
];

/** One `ProviderRow`-shaped row for a plain (no-Verify) code field. */
const PlainCodeField = ({ field }: { field: PlainCodeFieldConfig }) => {
	const { setting, updateSetting } = useSetting();
	const [value, setValue] = useState<string>(
		(setting[field.key] as string | undefined) ?? ''
	);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const persist = (nextValue: string) => {
		updateSetting(field.key, nextValue);
		return sendApiResponse<{ message: string }>(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, 'settings'), {
			setting: { [field.key]: nextValue },
		}).then((response) => {
			NoticeManager.add({
				message: response
					? __('Saved.', 'vulopilot')
					: __('Could not save. Please try again.', 'vulopilot'),
				type: response ? 'success' : 'error',
				position: 'float',
			});
		});
	};

	const scheduleSave = (nextValue: string) => {
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = setTimeout(() => persist(nextValue), AUTOSAVE_DEBOUNCE_MS);
	};

	const isAdded = '' !== value.trim();

	return (
		<CardHeader
			className='compact'
			icon={field.icon}
			title={field.title}
			desc={field.desc}
			badge={
				<span className={`admin-badge ${isAdded ? 'green' : 'red'}`}>
					{isAdded ? __('Added', 'vulopilot') : __('Not Added', 'vulopilot')}
				</span>
			}
		>
			<div className="ai-provider-card-body gsc-service-body">
				<div className="ai-provider-field site-verification-code-field">
					<label htmlFor={`${field.key}-input`}>{field.fieldLabel}</label>
					<TextInput
						id={`${field.key}-input`}
						type="text"
						value={value}
						onChange={(next) => {
							const nextValue = String(next);
							setValue(nextValue);
							scheduleSave(nextValue);
						}}
						placeholder={__('Paste the verification code from your provider', 'vulopilot')}
					/>
				</div>
			</div>
		</CardHeader>
	);
};

/**
 * "Custom webmaster tags" - the same real free-text `meta`-tag textarea (WebmasterToolsManager
 * strips anything that isn't a `meta` tag before output), merged in alongside the 3
 * `PlainCodeField`s above, same restyle to `ProviderRow`'s own row shape.
 */
const CustomTagsField = () => {
	const { setting, updateSetting } = useSetting();
	const [value, setValue] = useState<string>(
		(setting.webmaster_custom_tags as string | undefined) ?? ''
	);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const persist = (nextValue: string) => {
		updateSetting('webmaster_custom_tags', nextValue);
		return sendApiResponse<{ message: string }>(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, 'settings'), {
			setting: { webmaster_custom_tags: nextValue },
		}).then((response) => {
			NoticeManager.add({
				message: response
					? __('Saved.', 'vulopilot')
					: __('Could not save. Please try again.', 'vulopilot'),
				type: response ? 'success' : 'error',
				position: 'float',
			});
		});
	};

	const scheduleSave = (nextValue: string) => {
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = setTimeout(() => persist(nextValue), AUTOSAVE_DEBOUNCE_MS);
	};

	const isAdded = '' !== value.trim();

	return (
		<CardHeader
			className='compact'
			icon="shortcode"
			title={__('Custom webmaster tags', 'vulopilot')}
			desc={__(
				'Enter your own custom webmaster tags. Only <meta> tags are allowed - anything else is stripped out before being added to the page.',
				'vulopilot'
			)}
			badge={
				<span className={`admin-badge ${isAdded ? 'green' : 'red'}`}>
					{isAdded ? __('Added', 'vulopilot') : __('Not Added', 'vulopilot')}
				</span>
			}
		>
			<div className="ai-provider-card-body gsc-service-body">
				<div className="ai-provider-field site-verification-code-field">
					<TextAreaInput
						id="webmaster_custom_tags-input"
						value={value}
						onChange={(next) => {
							const nextValue = String(next);
							setValue(nextValue);
							scheduleSave(nextValue);
						}}
					/>
				</div>
			</div>
		</CardHeader>
	);
};

/**
 * One Google/Bing/Pinterest row - code field, real "Verify" action, and an honest status pill.
 */
const ProviderRow = ({ provider, icon, title, desc }: ProviderRowConfig) => {
	const { setting, updateSetting } = useSetting();
	const codeKey = `webmaster_${provider}_verification`;
	const verifiedAtKey = `webmaster_${provider}_verified_at`;

	const [code, setCode] = useState<string>(
		(setting[codeKey] as string | undefined) ?? ''
	);
	const [isVerifying, setIsVerifying] = useState(false);

	const verifiedAt = (setting[verifiedAtKey] as string | undefined) || '';
	const isVerified = '' !== verifiedAt;

	const verify = () => {
		setIsVerifying(true);

		sendApiResponse<VerifyResult>(
			vulopilotAppLocalizer,
			getApiLink(vulopilotAppLocalizer, 'settings/verify-webmaster'),
			{ provider, code }
		)
			.then((response) => {
				if (!response) {
					return;
				}
				// Floating notice (NoticeReceiverComponent position="float", already mounted app-
				// wide by zyra's own HeaderComponent).
				NoticeManager.add({
					message: response.message,
					type: response.success ? 'success' : 'error',
					position: 'float',
				});
				updateSetting(codeKey, code);
				if (response.success) {
					updateSetting(verifiedAtKey, new Date().toISOString());
				}
			})
			.finally(() => setIsVerifying(false));
	};

	return (
		<CardHeader
			className='compact'
			icon={icon}
			title={title}
			desc={desc}
			badge={
				<span className={`admin-badge ${isVerified ? 'green' : 'red'}`}>
					{isVerified ? __('Verified', 'vulopilot') : __('Not Verified', 'vulopilot')}
				</span>
			}
		>
			<div className="ai-provider-card-body gsc-service-body">
				<div className="ai-provider-field site-verification-code-field">
					<div className="site-verification-code-row">
						<TextInput
							id={`${codeKey}-input`}
							type="text"
							value={code}
							onChange={(value) => setCode(String(value))}
							placeholder={__('Paste the verification code from your provider', 'vulopilot')}
						/>
						<ButtonInput
							buttons={{
								text: isVerifying
									? __('Verifying…', 'vulopilot')
									: isVerified
										? __('Manage Verification', 'vulopilot')
										: sprintf(
											/* translators: %s is the provider name (Bing, Pinterest). */
											__('Verify', 'vulopilot'),
											title
										),
								color: isVerifying
									? 'text-purple'
									: isVerified
										? 'text-purple'
										: 'text-purple',
								disabled: isVerifying,
								onClick: verify,
							}}
						/>
					</div>
					{isVerified && (
						<NoticeComponent
							displayPosition="inline"
							type="success"
							message={sprintf(
								/* translators: %s is a formatted date/time. */
								__('Verified on %s. Method: HTML Tag.', 'vulopilot'),
								formatWpDate(verifiedAt)
							)}
						/>
					)}
				</div>
			</div>
		</CardHeader>
	);
};

/**
 * Settings → Connections → Site Verification.
 */
const SiteVerificationPanel = () => {
	return (
		<>

			<FormGroupWrapperComponent>
				{PROVIDERS.map((row) => (
					<ProviderRow key={row.provider} {...row} />
				))}
				{PLAIN_CODE_FIELDS.map((field) => (
					<PlainCodeField key={field.key} field={field} />
				))}
				<CustomTagsField />
				<FormGroupComponent>
					<NoticeComponent
						displayPosition="inline-notice"
						type="info"
						title={__('Why verify your site?', 'vulopilot')}
						message={__(
							'Site verification helps VuloPilot fetch accurate data, monitor your presence, and provide personalized recommendations.',
							'vulopilot'
						)}
					/>
				</FormGroupComponent>
			</FormGroupWrapperComponent>
		</>
	);
};

export default SiteVerificationPanel;
