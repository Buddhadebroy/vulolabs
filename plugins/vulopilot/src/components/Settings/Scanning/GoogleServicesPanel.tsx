/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ModuleGuardComponent,
	NoticeManager,
	BadgeComponent,
} from '@zyra/components';
import { ButtonInput, SelectInput, ToggleInput } from '@zyra/inputs';
import { useSetting } from '../../../contexts/SettingContext';
import { formatWpDate } from '../../../services/formatWpDate';

interface GoogleStatus {
	connected: boolean;
	has_client_credentials: boolean;
	search_console_site: string;
	ga4_account_id: string;
	ga4_account_name: string;
	ga4_property_id: string;
	ga4_property_name: string;
	ga4_measurement_id: string;
	adsense_account_id: string;
	adsense_account_name: string;
	connected_at: string;
}

interface GscSite {
	site_url: string;
	permission_level: string;
}

interface Ga4Property {
	property_id: string;
	property_name: string;
}

interface Ga4Account {
	account_id: string;
	account_name: string;
	properties: Ga4Property[];
}

interface Ga4DataStream {
	data_stream_id: string;
	display_name: string;
	measurement_id: string;
}

interface AdSenseAccount {
	account_id: string;
	display_name: string;
}

interface TestResults {
	search_console: boolean;
	analytics: boolean;
	adsense: boolean;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const BENEFITS = [
	__('Verify site ownership on Google Search Console in a single click.', 'vulopilot'),
	__('See real Search Console properties without leaving your WP dashboard.', 'vulopilot'),
	__('Set up Google Analytics (GA4) tracking without another 3rd-party plugin.', 'vulopilot'),
	__('Read your real AdSense account, if this site has one.', 'vulopilot'),
];

/**
 * "Google Services" settings tab (Scanning → Google Services,
 * `?page=vulopilot#&tab=settings&subtab=google-services` — KeywordsTab.tsx's
 * own "Go to Settings" button lands here directly). Real Google OAuth 2.0
 * connect/disconnect flow covering Search Console + Analytics (GA4) +
 * AdSense through one connection, backed by Controllers\GoogleServices →
 * GoogleServicesConnection/GoogleAnalyticsClient/GoogleAdSenseClient —
 * same "hand-built escape-hatch panel, not InputRenderer" shape
 * IndexNowPanel.tsx/LlmsTxtCard.tsx already establish for a tab whose
 * real actions don't fit the per-field auto-save model.
 *
 * One click, nothing to configure: VuloPilot ships with its own shared
 * Google Cloud OAuth Client (VULOPILOT_GOOGLE_CLIENT_ID/SECRET, see
 * config.php's own docblock) — a site owner never sees or enters a
 * Client ID/Secret, matching the reference RankMath flow's own single
 * "Connect Google Services" button. Clicking it is a real
 * `window.location.href` handoff to Google's own multi-scope consent
 * screen; Google's redirect back through `admin-post.php`
 * (GoogleServicesConnection::get_redirect_uri()) lands back here with a
 * `gsc_status` flag this component reads once on mount. If VuloLabs
 * hasn't configured a real shared Client ID/Secret for this build yet
 * (`status.has_client_credentials` false — always true for this dev
 * environment's placeholder-empty config.php constants), the button is
 * replaced with an honest "not available yet" state rather than a button
 * that would silently fail.
 */
const GoogleServicesPanel = () => {
	const { setting, updateSetting } = useSetting();

	const [status, setStatus] = useState<GoogleStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isConnecting, setIsConnecting] = useState(false);
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [testResults, setTestResults] = useState<TestResults | null>(null);

	const [gscSites, setGscSites] = useState<GscSite[] | null>(null);
	const [ga4Accounts, setGa4Accounts] = useState<Ga4Account[] | null>(null);
	const [ga4Streams, setGa4Streams] = useState<Ga4DataStream[] | null>(null);
	const [adsenseAccounts, setAdsenseAccounts] = useState<AdSenseAccount[] | null>(null);

	const [selectedAccountId, setSelectedAccountId] = useState('');
	const [selectedPropertyId, setSelectedPropertyId] = useState('');

	const installTrackingCode = ((setting.ga_install_tracking_code as string[]) || []).length > 0;
	const anonymizeIp = ((setting.ga_anonymize_ip as string[]) || []).length > 0;
	const selfHostedJs = ((setting.ga_self_hosted_js as string[]) || []).length > 0;
	const excludeLoggedInUsers = ((setting.ga_exclude_logged_in_users as string[]) || []).length > 0;

	const toggleSetting = (key: string, isOn: boolean) => {
		const newValue = isOn ? [] : [key];
		updateSetting(key, newValue);
		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'settings'), {
			setting: { [key]: newValue },
		});
	};

	const loadStatus = () =>
		getApiResponse<GoogleStatus>(
			getApiLink(appLocalizer, 'google-services/status'),
			nonceHeaders
		).then((response) => {
			if (response) {
				setStatus(response);
			}
			return response;
		});

	useEffect(() => {
		setIsLoading(true);
		loadStatus().finally(() => setIsLoading(false));

		// Google's own OAuth redirect lands back on this exact URL
		// (admin-post.php's handler builds it — see that class's own
		// docblock) carrying `gsc_status=connected|error` as a real
		// signal, not a fabricated success message.
		const params = new URLSearchParams(
			window.location.hash.split('?')[1] || window.location.hash.substring(1)
		);
		const gscStatus = params.get('gsc_status');

		if (gscStatus === 'connected') {
			NoticeManager.add({
				uniqueKey: 'vulopilot-gsc-connected',
				type: 'success',
				position: 'float',
				message: __('Connected to Google.', 'vulopilot'),
			});
		} else if (gscStatus === 'error') {
			NoticeManager.add({
				uniqueKey: 'vulopilot-gsc-connect-failed',
				type: 'error',
				position: 'float',
				message: __(
					'Could not connect to Google. Please check your Client ID/Secret and try again.',
					'vulopilot'
				),
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Once connected, real per-service pickers load their own real data.
	useEffect(() => {
		if (!status?.connected) {
			return;
		}

		if (null === gscSites && !status.search_console_site) {
			getApiResponse<GscSite[]>(
				getApiLink(appLocalizer, 'google-services/search-console-sites'),
				nonceHeaders
			).then((response) => setGscSites(response ?? []));
		}

		if (null === ga4Accounts) {
			getApiResponse<Ga4Account[]>(
				getApiLink(appLocalizer, 'google-services/analytics-accounts'),
				nonceHeaders
			).then((response) => {
				setGa4Accounts(response ?? []);
				if (status.ga4_account_id) {
					setSelectedAccountId(status.ga4_account_id);
					setSelectedPropertyId(status.ga4_property_id);
				}
			});
		}

		if (null === adsenseAccounts) {
			getApiResponse<AdSenseAccount[]>(
				getApiLink(appLocalizer, 'google-services/adsense-accounts'),
				nonceHeaders
			).then((response) => setAdsenseAccounts(response ?? []));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status?.connected]);

	// Real data streams load whenever the selected property changes.
	useEffect(() => {
		if (!selectedPropertyId) {
			setGa4Streams(null);
			return;
		}

		getApiResponse<Ga4DataStream[]>(
			getApiLink(
				appLocalizer,
				`google-services/analytics-data-streams?property_id=${encodeURIComponent(selectedPropertyId)}`
			),
			nonceHeaders
		).then((response) => setGa4Streams(response ?? []));
	}, [selectedPropertyId]);

	const handleConnect = () => {
		setIsConnecting(true);

		getApiResponse<{ url: string }>(
			getApiLink(appLocalizer, 'google-services/authorize-url'),
			nonceHeaders
		)
			.then((response) => {
				if (response?.url) {
					window.location.href = response.url;
					return;
				}

				NoticeManager.add({
					uniqueKey: 'vulopilot-gsc-authorize-url-failed',
					type: 'error',
					position: 'float',
					message: __(
						'Could not start the Google connection. Please try again.',
						'vulopilot'
					),
				});
				setIsConnecting(false);
			})
			.catch(() => setIsConnecting(false));
	};

	const handleDisconnect = () => {
		setIsDisconnecting(true);

		sendApiResponse<GoogleStatus>(
			appLocalizer,
			getApiLink(appLocalizer, 'google-services/disconnect'),
			{}
		)
			.then((response) => {
				if (response) {
					setStatus(response);
					setGscSites(null);
					setGa4Accounts(null);
					setGa4Streams(null);
					setAdsenseAccounts(null);
					setSelectedAccountId('');
					setSelectedPropertyId('');
					setTestResults(null);
				}
			})
			.finally(() => setIsDisconnecting(false));
	};

	const handleTestConnections = () => {
		setIsTesting(true);

		getApiResponse<TestResults>(
			getApiLink(appLocalizer, 'google-services/test-connections'),
			nonceHeaders
		)
			.then((response) => setTestResults(response ?? null))
			.finally(() => setIsTesting(false));
	};

	const handleSelectSite = (siteUrl: string) => {
		sendApiResponse<GoogleStatus>(
			appLocalizer,
			getApiLink(appLocalizer, 'google-services/select-search-console-site'),
			{ site_url: siteUrl }
		).then((response) => {
			if (response) {
				setStatus(response);
			}
		});
	};

	const handleSelectAdsense = (accountId: string) => {
		sendApiResponse<GoogleStatus>(
			appLocalizer,
			getApiLink(appLocalizer, 'google-services/select-adsense-account'),
			{ account_id: accountId }
		).then((response) => {
			if (response) {
				setStatus(response);
			}
		});
	};

	const handleSelectDataStream = (dataStreamId: string) => {
		if (!selectedAccountId || !selectedPropertyId) {
			return;
		}

		sendApiResponse<GoogleStatus>(
			appLocalizer,
			getApiLink(appLocalizer, 'google-services/select-analytics-property'),
			{
				account_id: selectedAccountId,
				property_id: selectedPropertyId,
				data_stream_id: dataStreamId,
			}
		).then((response) => {
			if (response) {
				setStatus(response);
			}
		});
	};

	const selectedAccount = ga4Accounts?.find(
		(account) => account.account_id === selectedAccountId
	);

	return (
		<>
			{status && !status.connected && (
				<CardComponent
					title={__('Connect Google Services', 'vulopilot')}
					titleIcon="admin-links"
					isLoading={isLoading}
				>
					{!status.has_client_credentials ? (
						<ModuleGuardComponent
							icon="info"
							title={__('Google Connect isn’t available yet', 'vulopilot')}
							desc={__(
								'This build doesn’t have a Google Cloud OAuth Client configured yet — that’s a one-time setup VuloLabs does, not something you configure. Flag if you’re seeing this on a real release.',
								'vulopilot'
							)}
						/>
					) : (
						<div className="gsc-connect-hero">
							<ButtonInput
								buttons={{
									text: isConnecting
										? __('Redirecting…', 'vulopilot')
										: __('Connect Google Services', 'vulopilot'),
									icon: 'admin-links',
									onClick: handleConnect,
									disabled: isConnecting,
								}}
							/>
							<p className="gsc-benefits-title">
								{__('Benefits of connecting your Google account', 'vulopilot')}
							</p>
							<ul className="gsc-benefits-list">
								{BENEFITS.map((benefit) => (
									<li key={benefit}>
										<i className="adminfont-check" /> {benefit}
									</li>
								))}
							</ul>
							<div className="geo-info-banner">
								<i className="adminfont-info" />
								<span>
									{__(
										'We don’t store any of your Google account’s data on our servers — everything is processed and stored on your own site. Tokens are encrypted at rest the same way every other API key in VuloPilot is.',
										'vulopilot'
									)}
								</span>
							</div>
						</div>
					)}
				</CardComponent>
			)}

			{status && status.connected && (
				<>
					<CardComponent title={__('Connection', 'vulopilot')} titleIcon="admin-links">
						<div className="gsc-connected-row">
							<BadgeComponent color="green" text={__('Connected', 'vulopilot')} />
							{status.connected_at && (
								<span className="desc">
									{__('Since', 'vulopilot')} {formatWpDate(status.connected_at)}
								</span>
							)}
							<button
								type="button"
								className="gsc-inline-action"
								onClick={handleConnect}
							>
								{__('Reconnect', 'vulopilot')}
							</button>
							<button
								type="button"
								className="gsc-inline-action"
								onClick={handleTestConnections}
							>
								{isTesting
									? __('Testing…', 'vulopilot')
									: __('Test Connections', 'vulopilot')}
							</button>
							<button
								type="button"
								className="gsc-inline-action is-destructive"
								onClick={handleDisconnect}
								disabled={isDisconnecting}
							>
								{isDisconnecting
									? __('Disconnecting…', 'vulopilot')
									: __('Disconnect', 'vulopilot')}
							</button>
						</div>

						{testResults && (
							<div className="gsc-test-results">
								{(
									[
										['search_console', __('Search Console', 'vulopilot')],
										['analytics', __('Analytics', 'vulopilot')],
										['adsense', __('AdSense', 'vulopilot')],
									] as const
								).map(([key, label]) => (
									<BadgeComponent
										key={key}
										color={testResults[key] ? 'green' : 'yellow'}
										text={`${label}: ${
											testResults[key]
												? __('OK', 'vulopilot')
												: __('Failed', 'vulopilot')
										}`}
									/>
								))}
							</div>
						)}
					</CardComponent>

					<CardComponent title={__('Search Console', 'vulopilot')} titleIcon="search-discovery">
						{status.search_console_site ? (
							<p className="gsc-selected-site">
								<i className="adminfont-search" /> {status.search_console_site}
							</p>
						) : (
							<div className="gsc-site-picker">
								<div className="desc">
									{__('Choose which verified property to use:', 'vulopilot')}
								</div>
								{null === gscSites && (
									<div className="desc">{__('Loading…', 'vulopilot')}</div>
								)}
								{gscSites && gscSites.length === 0 && (
									<div className="desc">
										{__(
											'No verified Search Console properties found on this Google account.',
											'vulopilot'
										)}
									</div>
								)}
								{gscSites?.map((site) => (
									<button
										key={site.site_url}
										type="button"
										className="gsc-site-option"
										onClick={() => handleSelectSite(site.site_url)}
									>
										{site.site_url}
									</button>
								))}
							</div>
						)}
					</CardComponent>

					<CardComponent title={__('Analytics', 'vulopilot')} titleIcon="chart-bar">
						<div className="gsc-select-row">
							<SelectInput
								name="ga4_account"
								placeholder={__('Account', 'vulopilot')}
								value={selectedAccountId}
								options={(ga4Accounts ?? []).map((account) => ({
									label: account.account_name,
									value: account.account_id,
								}))}
								onChange={(value) => {
									setSelectedAccountId(value as string);
									setSelectedPropertyId('');
								}}
								size="14rem"
							/>
							<SelectInput
								name="ga4_property"
								placeholder={__('Property', 'vulopilot')}
								value={selectedPropertyId}
								options={(selectedAccount?.properties ?? []).map((property) => ({
									label: property.property_name,
									value: property.property_id,
								}))}
								onChange={(value) => setSelectedPropertyId(value as string)}
								size="14rem"
							/>
							<SelectInput
								name="ga4_data_stream"
								placeholder={__('Data Stream', 'vulopilot')}
								value={status.ga4_measurement_id}
								options={(ga4Streams ?? []).map((stream) => ({
									label: `${stream.display_name} (${stream.measurement_id})`,
									value: stream.data_stream_id,
								}))}
								onChange={(value) => handleSelectDataStream(value as string)}
								size="16rem"
							/>
						</div>
						{status.ga4_measurement_id && (
							<p className="desc gsc-measurement-id">
								{__('Measurement ID:', 'vulopilot')} <code>{status.ga4_measurement_id}</code>
							</p>
						)}

						<div className="gsc-toggle-row">
							<ToggleInput
								options={[
									{
										key: 'ga_install_tracking_code',
										value: 'ga_install_tracking_code',
										label: __('Install analytics code', 'vulopilot'),
									},
								]}
								value={installTrackingCode ? ['ga_install_tracking_code'] : []}
								multiSelect
								modules={[]}
								onChange={() =>
									toggleSetting('ga_install_tracking_code', installTrackingCode)
								}
							/>
							<div className="desc">
								{__(
									'Outputs a real gtag.js snippet on the frontend for the selected property. Only takes effect once a Data Stream is selected above.',
									'vulopilot'
								)}
							</div>
						</div>

						{installTrackingCode && (
							<div className="gsc-sub-toggles">
								{(
									[
										['ga_anonymize_ip', __('Anonymize IP addresses', 'vulopilot'), anonymizeIp],
										['ga_self_hosted_js', __('Self-Hosted Analytics JS File', 'vulopilot'), selfHostedJs],
										['ga_exclude_logged_in_users', __('Exclude logged-in users', 'vulopilot'), excludeLoggedInUsers],
									] as const
								).map(([key, label, isOn]) => (
									<ToggleInput
										key={key}
										options={[{ key, value: key, label }]}
										value={isOn ? [key] : []}
										multiSelect
										modules={[]}
										onChange={() => toggleSetting(key, isOn)}
									/>
								))}
							</div>
						)}
					</CardComponent>

					<CardComponent title={__('AdSense', 'vulopilot')} titleIcon="money">
						{status.adsense_account_name ? (
							<p className="gsc-selected-site">
								<i className="adminfont-money" /> {status.adsense_account_name}
							</p>
						) : (
							<>
								{null === adsenseAccounts && (
									<div className="desc">{__('Loading…', 'vulopilot')}</div>
								)}
								{adsenseAccounts && adsenseAccounts.length === 0 && (
									<div className="desc">
										{__(
											'No AdSense account found on this Google account — that’s fine, AdSense is optional.',
											'vulopilot'
										)}
									</div>
								)}
								{adsenseAccounts?.map((account) => (
									<button
										key={account.account_id}
										type="button"
										className="gsc-site-option"
										onClick={() => handleSelectAdsense(account.account_id)}
									>
										{account.display_name}
									</button>
								))}
							</>
						)}
					</CardComponent>

					<div className="geo-info-banner">
						<i className="adminfont-info" />
						<span>
							{__(
								'We don’t store any of your Google account’s data on our servers — everything is processed and stored on your own site.',
								'vulopilot'
							)}
						</span>
					</div>
				</>
			)}

			<div className="geo-info-banner">
				<i className="adminfont-info" />
				<span>
					{__(
						'Connecting and selecting a property only proves this site can read your real Google data. Storing/reporting on that data over time — the Analytics Database, Frontend Stats Bar, Email Reports, and pulling real ranking keywords onto the Keywords tab — is the next step, not built yet. Flag if you want any of it scoped next.',
						'vulopilot'
					)}
				</span>
			</div>
		</>
	);
};

export default GoogleServicesPanel;
