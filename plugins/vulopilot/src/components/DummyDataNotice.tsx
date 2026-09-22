import { __ } from '@wordpress/i18n';
import './DummyDataNotice.scss';

/**
 * "This is dummy data" disclaimer - shown below every Pro-gated section's
 * fabricated preview content (a "PRO"-tagged card/tile whose rows/chart/
 * numbers are fake, standing in for the real Pro feature), so a
 * plausible-looking number never reads as this site's own real data.
 * Shared across every real "PRO tag + fabricated content" spot in this
 * plugin - `useContentGate.tsx`'s own `dummyContent` slot (AiSpeedAssistantCard.tsx/
 * AeoCitationCoverageCard.tsx/AeoEngineTestingCard.tsx), Automations'
 * `AutomationsProDummies.tsx`, and GEO's `BrandVisibilityProDummies.tsx` -
 * one real component/message/style, not a hand-copied notice per page.
 */
const DummyDataNotice = () => (
	<div className="dummy-data-notice">
		<i className="adminfont-info" />
		<span className="dummy-data-notice-divider" />
		{__('This is dummy data for visualization purposes only.', 'vulopilot')}
	</div>
);

export default DummyDataNotice;
