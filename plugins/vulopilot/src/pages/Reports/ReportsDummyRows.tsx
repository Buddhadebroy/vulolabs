import { __ } from '@wordpress/i18n';
import { BadgeComponent } from '@zyra/components';
import { DUMMY_REPORT_ROWS } from './reportsOverview';

const ReportsDummyRows = () => (
	<div className="reports-dummy-rows">
		{DUMMY_REPORT_ROWS.map((row) => (
			<div className="reports-dummy-row" key={row.id}>
				<i className={`adminfont-${row.icon} reports-dummy-row-icon`} />
				<div className="reports-dummy-row-main">
					<span className="reports-dummy-row-name">{row.name}</span>
					<span className="reports-dummy-row-period">{row.period}</span>
				</div>
				<BadgeComponent color={row.badgeColor} text={row.shortLabel} />
				<BadgeComponent color="green" text={row.statusLabel} />
				<span className="reports-dummy-row-date">{row.date}</span>
				<span className="reports-dummy-row-actions">
					{__('View', 'vulopilot')} · {__('Download', 'vulopilot')}
				</span>
			</div>
		))}
	</div>
);

export default ReportsDummyRows;
