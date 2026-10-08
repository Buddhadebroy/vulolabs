import { __ } from '@wordpress/i18n';
import { SectionComponent } from '@zyra/components';

/**
 * The reference mockup's page-header row: "Reports" title + description. The "Last N days" range
 * dropdown and action buttons that used to sit in this same row's `rightContent` moved up to the
 * page header itself (ReportsOverviewActions.tsx, rendered by Reports.tsx's own
 * `headerCustomContent`, Overview tab only) per direct instruction.
 */
const ReportsOverviewHeader = () => (
	<SectionComponent
		icon="bar-chart"
		title={__('Reports', 'vulopilot')}
		desc={__(
			"Create, view, and manage detailed reports about your website's performance.",
			'vulopilot'
		)}
		wrapperClass="without-settings"
	/>
);

export default ReportsOverviewHeader;
