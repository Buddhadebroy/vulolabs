/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, PopupComponent } from '@zyra/components';
import DummyDataNotice from '../../components/DummyDataNotice';
import ShowProPopup from '../../components/Popup/Popup';
import { BlurredProContent } from '../../components/UpgradeToProOverlay';
import { useFilterSlot } from '../../services/useFilterSlot';
import './SeoVisibility.scss';

/** Inert example rows, clearly not real numbers - the real card comes from the unlocked feature. */
const DUMMY_SOURCES = [
	{ label: __('Organic search', 'vulopilot'), sessions: 5491, percent: 44, color: '#3157d5' },
	{ label: __('Direct', 'vulopilot'), sessions: 2870, percent: 23, color: '#7c52d0' },
	{ label: __('Referral', 'vulopilot'), sessions: 1622, percent: 13, color: '#2bb08f' },
	{ label: __('Organic social', 'vulopilot'), sessions: 1123, percent: 9, color: '#e3a53f' },
	{ label: __('AI referrals', 'vulopilot'), sessions: 374, percent: 3, color: '#43a0d0' },
];

/** Google Analytics sessions by channel - real data plugs in via `vulopilot_visibility_by_source_card`, else a locked example shows. */
const VisibilityBySourceCard = () => {
	const ProCard = useFilterSlot('vulopilot_visibility_by_source_card');
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	if (ProCard) {
		return <ProCard />;
	}

	return (
		<>
			<CardComponent
				title={__('Traffic by Source', 'vulopilot')}
				titleIcon="analytics"
				desc={__('Sessions from Google Analytics 4 · Last 30 days', 'vulopilot')}
			>
				<BlurredProContent
					contentClassName="visibility-source-dummy"
					onClick={() => setIsProPopupOpen(true)}
				>
					<div className="visibility-source-dummy-total">12,480</div>
					{DUMMY_SOURCES.map((source) => (
						<div key={source.label} className="visibility-source-dummy-row">
							<span
								className="visibility-source-dummy-dot"
								style={{ backgroundColor: source.color }}
							/>
							<span className="visibility-source-dummy-name">{source.label}</span>
							<span className="visibility-source-dummy-bar">
								<span
									style={{
										width: `${source.percent * 2}%`,
										backgroundColor: source.color,
									}}
								/>
							</span>
							<span>{source.sessions.toLocaleString()}</span>
							<span>{source.percent}%</span>
						</div>
					))}
				</BlurredProContent>
				<DummyDataNotice />
			</CardComponent>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{vulopilotAppLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="geo-analysis" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default VisibilityBySourceCard;
