/* global appLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { ButtonInput, TextInput } from '@zyra/inputs';
import AiProviderCardHeader from '../../AiProviderCardHeader';
import { useSetting } from '../../../contexts/SettingContext';
import { formatWpDate } from '../../../services/formatWpDate';

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
		icon: 'google',
		title: __('Google', 'vulopilot'),
		desc: __(
			'Verify your site with Google to access Search Console data, indexing status, and rich insights.',
			'vulopilot'
		),
	},
	{
		provider: 'bing',
		icon: 'search-discovery',
		title: __('Bing', 'vulopilot'),
		desc: __('Verify your site with Bing to get insights from Bing Webmaster Tools.', 'vulopilot'),
	},
	{
		provider: 'pinterest',
		icon: 'pinterest',
		title: __('Pinterest', 'vulopilot'),
		desc: __('Verify your site with Pinterest to claim your site and unlock analytics.', 'vulopilot'),
	},
];

/** Free's own real per-tab `?page=vulopilot#&tab=settings&subtab=...` deep-link shape. */
const SEO_CONTENT_URL = '?page=vulopilot#&tab=settings&subtab=seo-content';

/**
 * One Google/Bing/Pinterest row — code field, real "Verify" action, and an
 * honest status pill. See SiteVerification.ts's own docblock for why
 * "Verified" here means "the tag is live on your homepage" (a real,
 * self-checkable fact this plugin can confirm on its own) rather than
 * "Google/Bing/Pinterest have confirmed your account" (an external claim
 * this plugin has no API access to confirm).
 */
const ProviderRow = ({ provider, icon, title, desc }: ProviderRowConfig) => {
	const { setting, updateSetting } = useSetting();
	const codeKey = `webmaster_${provider}_verification`;
	const verifiedAtKey = `webmaster_${provider}_verified_at`;

	const [code, setCode] = useState<string>(
		(setting[codeKey] as string | undefined) ?? ''
	);
	const [isVerifying, setIsVerifying] = useState(false);
	const [result, setResult] = useState<VerifyResult | null>(null);

	const verifiedAt = (setting[verifiedAtKey] as string | undefined) || '';
	const isVerified = '' !== verifiedAt;

	const verify = () => {
		setIsVerifying(true);
		setResult(null);

		sendApiResponse<VerifyResult>(
			appLocalizer,
			getApiLink(appLocalizer, 'settings/verify-webmaster'),
			{ provider, code }
		)
			.then((response) => {
				if (!response) {
					return;
				}
				setResult(response);
				updateSetting(codeKey, code);
				if (response.success) {
					updateSetting(verifiedAtKey, new Date().toISOString());
				}
			})
			.finally(() => setIsVerifying(false));
	};

	return (
		<div className="ai-provider-card gsc-service-card">
			<AiProviderCardHeader
				icon={icon}
				title={title}
				desc={desc}
				action={
					<span className={`gsc-service-status ${isVerified ? 'is-connected' : 'is-not-connected'}`}>
						{isVerified ? __('Verified', 'vulopilot') : __('Not Verified', 'vulopilot')}
					</span>
				}
			/>

			<div className="ai-provider-card-body gsc-service-body">
				<div className="ai-provider-field site-verification-code-field">
					<label htmlFor={`${codeKey}-input`}>
						{sprintf(
							/* translators: %s is the provider name (Google, Bing, Pinterest). */
							__('%s verification code', 'vulopilot'),
							title
						)}
					</label>
					<TextInput
						id={`${codeKey}-input`}
						type="text"
						value={code}
						onChange={(value) => setCode(String(value))}
						placeholder={__('Paste the verification code from your provider', 'vulopilot')}
					/>
					{isVerified && (
						<div className="desc">
							{sprintf(
								/* translators: %s is a formatted date/time. */
								__('Verified on %s. Method: HTML Tag.', 'vulopilot'),
								formatWpDate(verifiedAt)
							)}
						</div>
					)}
				</div>
				<div className="gsc-service-actions">
					<ButtonInput
						buttons={{
							text: isVerifying
								? __('Verifying…', 'vulopilot')
								: isVerified
									? __('Manage Verification', 'vulopilot')
									: sprintf(
											/* translators: %s is the provider name (Bing, Pinterest). */
											__('Verify with %s', 'vulopilot'),
											title
										),
							disabled: isVerifying,
							onClick: verify,
						}}
					/>
				</div>
			</div>

			{result && (
				<p className={`ai-provider-test-result ${result.success ? 'is-success' : 'is-error'}`}>
					{result.message}
				</p>
			)}
		</div>
	);
};

/**
 * Settings → Connections → Site Verification.
 *
 * Real backing: Services\WebmasterToolsManager already outputs one
 * `<meta>` tag per provider on `wp_head` from
 * `webmaster_{google,bing,pinterest}_verification` (Utill::VULOPILOT_SETTINGS_DEFAULTS)
 * — this tab is a restyle of how those 3 codes are edited (they previously
 * lived as plain text fields inside the much bigger Scanning → SEO &
 * Content tab, SeoContent.ts, which still owns Baidu/Yandex/Norton/Custom
 * Tags — see "Other verification" below for why those aren't duplicated
 * here). "Verify" is a real, honest self-check (Controllers\Settings::verify_webmaster_tool())
 * — this plugin fetches its OWN homepage and confirms the tag actually
 * renders there; it never calls Google/Bing/Pinterest's own APIs, so
 * "Verified" means "the tag is live," not "your account is confirmed" —
 * see `webmaster_google_verified_at`'s own docblock (Utill.php).
 *
 * "Other verification" doesn't get its own live-verify flow: the mockup's
 * own copy for it ("Not Added"/"Add Verification") is honest about this
 * already — it's a status summary, not a claim of live verification.
 * Rather than rebuilding Baidu/Yandex/Norton/Custom Tags editing a second
 * time on this tab, it deep-links to the real, already-working fields on
 * Scanning → SEO & Content (same "point at the real existing feature
 * instead of duplicating it" reasoning Reports.ts's own "Report Delivery"
 * section documents).
 */
const SiteVerificationPanel = () => {
	const { setting } = useSetting();

	const hasOtherVerification = Boolean(
		(setting.webmaster_baidu_verification as string | undefined) ||
			(setting.webmaster_yandex_verification as string | undefined) ||
			(setting.webmaster_norton_verification as string | undefined) ||
			(setting.webmaster_custom_tags as string | undefined)
	);

	return (
		<div className="site-verification-panel">
			{PROVIDERS.map((row) => (
				<ProviderRow key={row.provider} {...row} />
			))}

			<div className="ai-provider-card gsc-service-card">
				<AiProviderCardHeader
					icon="link"
					title={__('Other verification', 'vulopilot')}
					desc={__(
						'Add custom verification for other platforms like Yandex, Baidu, and more.',
						'vulopilot'
					)}
					action={
						<span className={`gsc-service-status ${hasOtherVerification ? 'is-connected' : 'is-not-connected'}`}>
							{hasOtherVerification ? __('Added', 'vulopilot') : __('Not Added', 'vulopilot')}
						</span>
					}
				/>
				<div className="ai-provider-card-body gsc-service-body">
					<div className="gsc-service-info">
						<div className="desc">
							{__('Add meta tags or file verification for other platforms.', 'vulopilot')}
						</div>
					</div>
					<div className="gsc-service-actions">
						<ButtonInput
							buttons={{
								text: __('Add Verification', 'vulopilot'),
								icon: 'plus-circle',
								onClick: () => {
									window.location.href = SEO_CONTENT_URL;
								},
							}}
						/>
					</div>
				</div>
			</div>

			<div className="ui-notice type-info display-notice">
				<i className="admin-font adminfont-info" />
				<div className="notice-details">
					<strong>{__('Why verify your site?', 'vulopilot')}</strong>
					<div className="notice-desc">
						{__(
							'Site verification helps VuloPilot fetch accurate data, monitor your presence, and provide personalized recommendations.',
							'vulopilot'
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default SiteVerificationPanel;
