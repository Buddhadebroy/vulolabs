/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ColumnComponent, NoticeComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup, { resolveModuleDisplayName } from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import './SeoVisibility.scss';

const KEYWORDS_MODULE_ID = 'keywords';

/**
 * Same real copy this tab's own pre-Pro-migration "not connected yet" hero
 * used, and the same real one GoogleServicesPanel.tsx (Settings →
 * Connections) still shows today — genuine, not fabricated, so it's safe
 * to keep in Free even though the dashboard it used to lead to now lives in
 * vulopilot-pro's own Keywords module.
 */
const BENEFITS = [
	__('Verify this site with Google Search Console in a single click.', 'vulopilot'),
	__('See your real, already-verified Search Console property without leaving this tab.', 'vulopilot'),
	__('Real ranking positions, impressions, and clicks — synced from Search Console, tracked over time.', 'vulopilot'),
];

/**
 * "Keywords" tab of "SEO & Visibility" — real, synced Search Console
 * rank-tracking dashboard, moved wholesale to vulopilot-pro's own Keywords
 * module per direct instruction, same "vulopilot_commerce_panel"/
 * "vulopilot_automations_panel" whole-component filter-slot shape
 * Commerce.tsx/Automations.tsx already establish. Free's own Google
 * Services OAuth connection (Services\GoogleServicesConnection, shared
 * with Settings → Connections, Backup, AdSense, VuloCloud, …) and the
 * `vulopilot_keyword_rankings` table schema (Install.php/Utill.php) both
 * stay in Free — only the sync service/REST controller/this tab's own
 * real dashboard UI moved, same "Free owns the shared connection + table,
 * Pro owns the only code that reads/writes it" split BrandIntelligence's
 * own `brand_mention` precedent already establishes.
 *
 * Reads the real content back via the `vulopilot_keywords_panel` filter
 * slot; when it hasn't resolved, this shows the same real "Connect Google
 * Search Console" hero the tab always has — genuine copy, not a fabricated
 * data preview — per direct instruction ("do not show dummy data show the
 * real content in free"), with the real Pro/module tag docked in this
 * section itself (not hidden inside the popup) — generic "PRO" when Pro
 * isn't installed at all, this module's own real display name when Pro is
 * installed but Keywords isn't active yet. Clicking "Connect Google
 * Services" doesn't run the real OAuth handshake itself (that would hand
 * a Free install a working on-ramp into a Pro-only dashboard); it opens
 * the same Pro/module upgrade popup every other gate in this plugin uses.
 */
const KeywordsTab = () => {
	const RealPanel = useFilterSlot('vulopilot_keywords_panel');
	const isProInstalled = Boolean(appLocalizer.khali_dabba);
	const [isPopupOpen, setIsPopupOpen] = useState(false);

	if (RealPanel) {
		return <RealPanel />;
	}

	const badgeText = isProInstalled
		? resolveModuleDisplayName(KEYWORDS_MODULE_ID)
		: __('PRO', 'vulopilot');

	return (
		<ColumnComponent>
			<div className="keywords-locked">
				<div className="keywords-locked-tag">
					<span className="admin-tag pro-tag">
						<i className="adminfont-lock" />
						{badgeText}
					</span>
				</div>
				<CardComponent
					title={__('Ranking Keywords', 'vulopilot')}
					titleIcon="search"
					desc={__('Connect Google Search Console to see your real keyword rankings.', 'vulopilot')}
				>
					<div className="gsc-connect-hero">
						<ButtonInput
							buttons={{
								text: __('Connect Google Services', 'vulopilot'),
								icon: 'link',
								onClick: () => setIsPopupOpen(true),
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
							displayPosition="inline"
							message={__(
								'We don’t store any of your Google account’s data on our servers — everything is processed and stored on your own site. Tokens are encrypted at rest the same way every other API key in VuloPilot is.',
								'vulopilot'
							)}
						/>
					</div>
				</CardComponent>
				<PopupComponent
					open={isPopupOpen}
					onClose={() => setIsPopupOpen(false)}
					width={31.25}
					height="auto"
					position="lightbox"
				>
					{isProInstalled ? (
						<ShowProPopup moduleName={KEYWORDS_MODULE_ID} />
					) : (
						<ShowProPopup />
					)}
				</PopupComponent>
			</div>
		</ColumnComponent>
	);
};

export default KeywordsTab;
