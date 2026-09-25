import { __ } from '@wordpress/i18n';
import './DummyDataNotice.scss';

const DummyDataNotice = () => (
	<div className="dummy-data-notice">
		<i className="adminfont-info" />
		<span className="dummy-data-notice-divider" />
		{__('This is dummy data for visualization purposes only.', 'vulopilot')}
	</div>
);

export default DummyDataNotice;
