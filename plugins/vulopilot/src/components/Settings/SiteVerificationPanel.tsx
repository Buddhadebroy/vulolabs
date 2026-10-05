/* global vulopilotAppLocalizer */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { ButtonInput, TextInput, TextAreaInput } from '@zyra/inputs';
import { NoticeComponent, NoticeManager, FormGroupWrapperComponent, FormGroupComponent } from '@zyra/components';
import { useSetting } from '../../contexts/SettingContext';
import { formatWpDate } from '../../services/formatWpDate';

interface VerifyResult {
	success: boolean;
	message: string;
}

/** "Stop typing, then save" debounce for the plain text fields. */
const AUTOSAVE_DEBOUNCE_MS = 1000;

interface WebmasterRowProps {
	icon: string;
	title: string;
	badge: ReactNode;
	steps: string;
	guideLabel: string;
	guideUrl: string;
	children: ReactNode;
}

/** One provider: icon + name/status + instructions and link on the left, the code field on the right. */
const WebmasterRow = ({ icon, title, badge, steps, guideLabel, guideUrl, children }: WebmasterRowProps) => (
	<div className="webmaster-row">
		<div className="webmaster-row-info">
			<i className={`webmaster-row-icon adminfont-${icon}`} />
			<div className="webmaster-row-text">
				<div className="webmaster-row-title">
					<span>{title}</span>
					{badge}
				</div>
				<p className="webmaster-row-steps">{steps}</p>
				<a className="webmaster-row-link" href={guideUrl} target="_blank" rel="noopener noreferrer">
					{guideLabel} <i className="adminfont-external-link" />
				</a>
			</div>
		</div>
		<div className="webmaster-row-field">{children}</div>
	</div>
);

const StatusBadge = ({ done, doneLabel, todoLabel }: { done: boolean; doneLabel: string; todoLabel: string }) => (
	<span className={`admin-badge ${done ? 'green' : 'red'}`}>{done ? doneLabel : todoLabel}</span>
);

const HELPER_TEXT = __('Paste only the value inside content="...".', 'vulopilot');

/** Baidu/Yandex/Norton - plain code field, saved on a debounce. */
interface PlainCodeFieldProps {
	fieldKey: 'webmaster_baidu_verification' | 'webmaster_yandex_verification' | 'webmaster_norton_verification';
	icon: string;
	title: string;
	steps: string;
	guideLabel: string;
	guideUrl: string;
}

const PlainCodeField = ({ fieldKey, icon, title, steps, guideLabel, guideUrl }: PlainCodeFieldProps) => {
	const { setting, updateSetting } = useSetting();
	const [value, setValue] = useState<string>((setting[fieldKey] as string | undefined) ?? '');
	useEffect(() => {
		setValue((setting[fieldKey] as string | undefined) ?? '');
	}, [setting[fieldKey]]);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const persist = (nextValue: string) => {
		updateSetting(fieldKey, nextValue);
		return sendApiResponse<{ message: string }>(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, 'settings'), {
			setting: { [fieldKey]: nextValue },
		}).then((response) => {
			NoticeManager.add({
				message: response ? __('Saved.', 'vulopilot') : __('Could not save. Please try again.', 'vulopilot'),
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
		<WebmasterRow
			icon={icon}
			title={title}
			steps={steps}
			guideLabel={guideLabel}
			guideUrl={guideUrl}
			badge={
				<StatusBadge
					done={isAdded}
					doneLabel={__('Added', 'vulopilot')}
					todoLabel={__('Not Added', 'vulopilot')}
				/>
			}
		>
			<TextInput
				id={`${fieldKey}-input`}
				type="text"
				value={value}
				onChange={(next) => {
					const nextValue = String(next);
					setValue(nextValue);
					scheduleSave(nextValue);
				}}
				placeholder={__('Paste your verification code', 'vulopilot')}
			/>
			<p className="webmaster-row-helper">{HELPER_TEXT}</p>
		</WebmasterRow>
	);
};

/** Google/Bing/Pinterest - code field plus a real "Verify" action. */
interface ProviderRowProps {
	provider: 'google' | 'bing' | 'pinterest';
	icon: string;
	title: string;
	steps: string;
	guideLabel: string;
	guideUrl: string;
}

const ProviderRow = ({ provider, icon, title, steps, guideLabel, guideUrl }: ProviderRowProps) => {
	const { setting, updateSetting } = useSetting();
	const codeKey = `webmaster_${provider}_verification`;
	const verifiedAtKey = `webmaster_${provider}_verified_at`;

	const [code, setCode] = useState<string>((setting[codeKey] as string | undefined) ?? '');
	useEffect(() => {
		setCode((setting[codeKey] as string | undefined) ?? '');
	}, [setting[codeKey]]);
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
		<WebmasterRow
			icon={icon}
			title={title}
			steps={steps}
			guideLabel={guideLabel}
			guideUrl={guideUrl}
			badge={
				<StatusBadge
					done={isVerified}
					doneLabel={__('Verified', 'vulopilot')}
					todoLabel={__('Not Verified', 'vulopilot')}
				/>
			}
		>
			<div className="webmaster-row-input-group">
				<TextInput
					id={`${codeKey}-input`}
					type="text"
					value={code}
					onChange={(value) => setCode(String(value))}
					placeholder={__('Paste your verification code', 'vulopilot')}
				/>
				<ButtonInput
					buttons={{
						text: isVerifying
							? __('Verifying…', 'vulopilot')
							: isVerified
								? __('Manage Verification', 'vulopilot')
								: __('Verify', 'vulopilot'),
						color: 'text-purple',
						disabled: isVerifying,
						onClick: verify,
					}}
				/>
			</div>
			<p className="webmaster-row-helper">{HELPER_TEXT}</p>
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
		</WebmasterRow>
	);
};

/** Custom meta tags - free text, only `meta` tags are kept (WebmasterToolsManager sanitizes them). */
const CustomTagsField = () => {
	const { setting, updateSetting } = useSetting();
	const [value, setValue] = useState<string>((setting.webmaster_custom_tags as string | undefined) ?? '');
	useEffect(() => {
		setValue((setting.webmaster_custom_tags as string | undefined) ?? '');
	}, [setting.webmaster_custom_tags]);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const persist = (nextValue: string) => {
		updateSetting('webmaster_custom_tags', nextValue);
		return sendApiResponse<{ message: string }>(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, 'settings'), {
			setting: { webmaster_custom_tags: nextValue },
		}).then((response) => {
			NoticeManager.add({
				message: response ? __('Saved.', 'vulopilot') : __('Could not save. Please try again.', 'vulopilot'),
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
		<div className="webmaster-row">
			<div className="webmaster-row-info">
				<i className="webmaster-row-icon adminfont-shortcode" />
				<div className="webmaster-row-text">
					<div className="webmaster-row-title">
						<span>{__('Custom webmaster tags', 'vulopilot')}</span>
						<StatusBadge
							done={isAdded}
							doneLabel={__('Added', 'vulopilot')}
							todoLabel={__('Not Added', 'vulopilot')}
						/>
					</div>
					<p className="webmaster-row-steps">
						{__('Paste complete verification meta tags from other services. Only <meta> tags are kept.', 'vulopilot')}
					</p>
				</div>
			</div>
			<div className="webmaster-row-field">
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
	);
};

/**
 * Settings → Integrations → Webmaster Tools.
 */
const SiteVerificationPanel = () => {
	return (
		<FormGroupWrapperComponent>
			<div className="webmaster-tools">
				<ProviderRow
					provider="google"
					icon="google"
					title={__('Google', 'vulopilot')}
					steps={__('Add your site in Google Search Console. Choose URL prefix → HTML tag.', 'vulopilot')}
					guideLabel={__('Get Google verification code', 'vulopilot')}
					guideUrl="https://search.google.com/search-console/welcome"
				/>
				<ProviderRow
					provider="bing"
					icon="search-discovery"
					title={__('Bing', 'vulopilot')}
					steps={__('Add your site in Bing Webmaster Tools and choose HTML meta tag.', 'vulopilot')}
					guideLabel={__('Get Bing verification code', 'vulopilot')}
					guideUrl="https://www.bing.com/webmasters"
				/>
				<ProviderRow
					provider="pinterest"
					icon="pinterest"
					title={__('Pinterest', 'vulopilot')}
					steps={__('Go to Settings → Link to Pinterest → Claim website → Add HTML tag.', 'vulopilot')}
					guideLabel={__('Get Pinterest verification code', 'vulopilot')}
					guideUrl="https://www.pinterest.com/settings/claim"
				/>
				<PlainCodeField
					fieldKey="webmaster_baidu_verification"
					icon="search-discovery"
					title={__('Baidu', 'vulopilot')}
					steps={__('Add your site in Baidu and choose HTML tag verification.', 'vulopilot')}
					guideLabel={__('Get Baidu verification code', 'vulopilot')}
					guideUrl="https://ziyuan.baidu.com/"
				/>
				<PlainCodeField
					fieldKey="webmaster_yandex_verification"
					icon="search"
					title={__('Yandex', 'vulopilot')}
					steps={__('Add your site in Yandex Webmaster and choose Meta tag.', 'vulopilot')}
					guideLabel={__('Get Yandex verification code', 'vulopilot')}
					guideUrl="https://webmaster.yandex.com/"
				/>
				<PlainCodeField
					fieldKey="webmaster_norton_verification"
					icon="security"
					title={__('Norton Safe Web', 'vulopilot')}
					steps={__('If Norton provided a verification code, add it here.', 'vulopilot')}
					guideLabel={__('Open Norton Safe Web', 'vulopilot')}
					guideUrl="https://safeweb.norton.com/"
				/>
				<CustomTagsField />
			</div>
			<FormGroupComponent>
				<NoticeComponent
					displayPosition="inline-notice"
					type="info"
					title={__('Where do I get my code?', 'vulopilot')}
					message={__(
						'Use the link beside each service. Save your code here, then return to the provider to verify.',
						'vulopilot'
					)}
				/>
			</FormGroupComponent>
		</FormGroupWrapperComponent>
	);
};

export default SiteVerificationPanel;
