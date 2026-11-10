import { __ } from '@wordpress/i18n';
import { SectionComponent } from '@zyra/components';

/**
 * The reference mockup's page-header row: "Reports" title + description.
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
