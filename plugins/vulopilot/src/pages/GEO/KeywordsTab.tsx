/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { formatWpDate } from '../../services/formatWpDate';

const SETTINGS_GOOGLE_SERVICES_URL =
	'?page=vulopilot#&tab=settings&subtab=google-services';

interface GoogleStatus {
	connected: boolean;
	has_client_credentials: boolean;
	search_console_site: string;
	connected_at: string;
}

/**
 * "Keywords" tab of "Grow My Traffic" — previously a single
 * `ModuleGuardComponent` tucked into the SEO tab's own footer; pulled out
 * into its own top-level tab per direct instruction (see SeoTab.tsx's own
 * docblock). "Go to Settings" lands on the real "Google Services"
 * settings tab (Scanning → Google Services, GoogleServicesPanel.tsx) that
 * actually has the real "Connect Google Services" flow, rather than the
 * generic Settings landing page.
 *
 * `GET /google-services/status` (Controllers\GoogleServices) is real —
 * once a Google account is genuinely connected there, this tab reflects
 * that honestly instead of always showing "not connected" regardless of
 * what Settings says. Still no fabricated ranking-keyword data:
 * connecting only proves this site can read real Search Console data —
 * actually pulling and displaying keyword positions/impressions/clicks
 * here is the clearly-flagged next step, not built yet (see
 * GoogleServicesPanel.tsx's own closing note, same honest boundary
 * repeated here so this tab alone doesn't overstate what "Connected"
 * means).
 */
const KeywordsTab = () => {
	const [status, setStatus] = useState<GoogleStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<GoogleStatus>(
			getApiLink(appLocalizer, 'google-services/status'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setStatus(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<div className="geo-info-banner">
					<i className="adminfont-info" />
					<span>
						<strong>{__('In plain English:', 'vulopilot')}</strong>{' '}
						{__(
							'This is where you’d see which real Google search queries your pages already rank for, and where — once a rank-tracking data source is connected.',
							'vulopilot'
						)}
					</span>
				</div>

				<CardComponent
					title={__('Ranking Keywords', 'vulopilot')}
					titleIcon="search"
					isLoading={isLoading}
				>
					{!isLoading && status && !status.connected && (
						<>
							<ModuleGuardComponent
								icon="lock"
								title={__('Not connected yet', 'vulopilot')}
								desc={__(
									'VuloPilot doesn’t track real keyword positions, impressions, clicks, or search volume yet — that needs a connected Google Search Console (or similar rank-tracking) account. Flag if you want this scoped next.',
									'vulopilot'
								)}
								buttonText={__('Go to Settings', 'vulopilot')}
								onButtonClick={() => {
									window.open(SETTINGS_GOOGLE_SERVICES_URL, '_self');
								}}
							/>
							<p className="desc keywords-verification-note">
								{__(
									'You can already verify this site with Google Search Console under Settings → Scanning → SEO — that confirms domain ownership, but doesn’t pull keyword ranking data back into VuloPilot on its own.',
									'vulopilot'
								)}
							</p>
						</>
					)}

					{!isLoading && status && status.connected && (
						<>
							<div className="keywords-connected-row">
								<span className="admin-badge green">
									{__('Connected', 'vulopilot')}
								</span>
								{status.search_console_site && (
									<span className="desc">
										<i className="adminfont-search" /> {status.search_console_site}
									</span>
								)}
								{status.connected_at && (
									<span className="desc">
										{__('Since', 'vulopilot')}{' '}
										{formatWpDate(status.connected_at)}
									</span>
								)}
							</div>
							<ModuleGuardComponent
								icon="info"
								title={__('Ranking keywords: not pulled in yet', 'vulopilot')}
								desc={__(
									'The connection itself is real and working — VuloPilot just doesn’t fetch and display real keyword positions/impressions/clicks from it yet. Flag if you want this scoped next.',
									'vulopilot'
								)}
								buttonText={__('Manage connection', 'vulopilot')}
								onButtonClick={() => {
									window.open(SETTINGS_GOOGLE_SERVICES_URL, '_self');
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
