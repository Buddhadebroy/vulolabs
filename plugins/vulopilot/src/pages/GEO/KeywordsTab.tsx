/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NoticeComponent,
	BadgeComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import {
	useGoogleServicesConnection,
	GoogleServicesStatus,
} from '../../services/useGoogleServicesConnection';
import { formatWpDate } from '../../services/formatWpDate';
import './GrowMyTraffic.scss';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

interface GscSite {
	site_url: string;
	permission_level: string;
}

const BENEFITS = [
	__('Verify this site with Google Search Console in a single click.', 'vulopilot'),
	__('See your real, already-verified Search Console property without leaving this tab.', 'vulopilot'),
	__('The real first step toward pulling actual ranking keyword data onto this page.', 'vulopilot'),
];

/**
 * "Keywords" tab of "Grow My Traffic" — previously a single
 * `ModuleGuardComponent` tucked into the SEO tab's own footer; pulled out
 * into its own top-level tab per direct instruction (see SeoTab.tsx's own
 * docblock).
 *
 * Real inline "Connect Google Services" flow, per direct instruction to
 * match the reference RankMath connect experience — a site owner
 * connects and picks their Search Console property right here, instead
 * of bouncing out to Settings the way this tab used to ("Go to
 * Settings"). The actual OAuth 2.0 handshake, status shape, and REST
 * routes are 100% the same real ones Settings → Scanning → Google
 * Services (GoogleServicesPanel.tsx) already uses — both now share
 * `useGoogleServicesConnection` (services/useGoogleServicesConnection.ts)
 * rather than this tab hand-rolling a second copy of that state machine.
 * `useGoogleServicesConnection('keywords')` is what makes Google's own
 * OAuth redirect land back on THIS tab instead of Settings — see that
 * hook's own docblock, and GoogleServicesConnection.php's
 * `get_return_to_from_state()`.
 *
 * This tab only ever surfaces Search Console (the one service ranking
 * keyword data would come from) — Analytics/AdSense setup stays on the
 * Settings panel, reachable via "Manage full connection" below once
 * connected, same as before.
 *
 * Still no fabricated ranking-keyword data: connecting and picking a
 * property only proves this site can read real Search Console data —
 * actually pulling and displaying keyword positions/impressions/clicks
 * here is the clearly-flagged next step, not built yet (see
 * GoogleServicesPanel.tsx's own closing note, same honest boundary
 * repeated here so this tab alone doesn't overstate what "Connected"
 * means).
 */
const KeywordsTab = () => {
	const {
		status,
		setStatus,
		isLoading,
		isConnecting,
		isDisconnecting,
		connect,
		disconnect,
	} = useGoogleServicesConnection('keywords');

	const [gscSites, setGscSites] = useState<GscSite[] | null>(null);

	useEffect(() => {
		if (!status?.connected || status.search_console_site || null !== gscSites) {
			return;
		}

		getApiResponse<GscSite[]>(
			getApiLink(appLocalizer, 'google-services/search-console-sites'),
			nonceHeaders
		).then((response) => setGscSites(response ?? []));
	}, [status?.connected, status?.search_console_site, gscSites]);

	const handleSelectSite = (siteUrl: string) => {
		sendApiResponse<GoogleServicesStatus>(
			appLocalizer,
			getApiLink(appLocalizer, 'google-services/select-search-console-site'),
			{ site_url: siteUrl }
		).then((response) => {
			if (response) {
				setStatus(response);
			}
		});
	};

	const handleDisconnect = () => {
		disconnect().then(() => setGscSites(null));
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NoticeComponent
					// type="banner"
					displayPosition="inline"
					message={sprintf(
						'<strong>%1$s</strong> %2$s',
						__('In plain English:', 'vulopilot'),
						__(
							'This is where you’d see which real Google search queries your pages already rank for, and where — once a rank-tracking data source is connected.',
							'vulopilot'
						)
					)}
				/>

				<CardComponent
					title={__('Ranking Keywords', 'vulopilot')}
					titleIcon="search"
					isLoading={isLoading}
				>
					{!isLoading && status && !status.connected && (
						<>
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
											onClick: connect,
											disabled: isConnecting,
										}}
									/>
									<div className="gsc-benefits-title">
										{__('Benefits of connecting your Google account', 'vulopilot')}
									</div>
									<ul className="gsc-benefits-list">
										{BENEFITS.map((benefit) => (
											<li key={benefit}>
												<i className="adminfont-check" /> {benefit}
											</li>
										))}
									</ul>
									<NoticeComponent
										// type="banner"
										displayPosition="inline"
										message={__(
											'We don’t store any of your Google account’s data on our servers — everything is processed and stored on your own site. Tokens are encrypted at rest the same way every other API key in VuloPilot is.',
											'vulopilot'
										)}
									/>
								</div>
							)}
						</>
					)}

					{!isLoading && status && status.connected && !status.search_console_site && (
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

					{!isLoading && status && status.connected && status.search_console_site && (
						<>
							<div className="keywords-connected-row">
								<BadgeComponent color="green" text={__('Connected', 'vulopilot')} />
								<span className="desc">
									<i className="adminfont-search" /> {status.search_console_site}
								</span>
								{status.connected_at && (
									<span className="desc">
										{__('Since', 'vulopilot')}{' '}
										{formatWpDate(status.connected_at)}
									</span>
								)}
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
							<ModuleGuardComponent
								icon="info"
								title={__('Ranking keywords: not pulled in yet', 'vulopilot')}
								desc={__(
									'The connection itself is real and working — VuloPilot just doesn’t fetch and display real keyword positions/impressions/clicks from it yet. Flag if you want this scoped next.',
									'vulopilot'
								)}
								buttonText={__('Manage full connection', 'vulopilot')}
								onButtonClick={() => {
									window.open(
										'?page=vulopilot#&tab=settings&subtab=google-services',
										'_self'
									);
								}}
							/>
						</>
					)}
				</CardComponent>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default KeywordsTab;
