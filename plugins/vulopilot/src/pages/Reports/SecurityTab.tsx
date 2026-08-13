import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';

/**
 * Same shape as SEO/Performance/Accessibility/WooCommerce — `category`
 * scanner findings already exist for 'security' (Dashboard.php's
 * category_scores includes it, and vulopilot-pro's SecurityMonitoring
 * module writes findings under this category), it just never had its own
 * top-level page before; Health's unfiltered findings list was the only
 * place they surfaced.
 *
 * SECURITY-MODULE.md's Pro additions register into these two slots —
 * same "register a source, don't modify the host" pattern GEO.tsx/
 * Reports.tsx already use, rather than replacing this whole page the way
 * Automation.tsx's single `vulopilot_automation_panel` slot does: Security
 * findings are useful with Free alone (the FindingsTable below already
 * shows every 'security' finding, Free or Pro), so this page only adds
 * extra cards on top rather than gating its base content behind Pro.
 */
const SecurityDashboardCard = applyFilters(
	'vulopilot_security_dashboard_card',
	null
) as ComponentType | null;

const SecurityIncidentReportsPanel = applyFilters(
	'vulopilot_security_incident_reports_panel',
	null
) as ComponentType | null;

/**
 * "Security" tab of "Reports" — deliberately lives here rather than on
 * "Protect My Site": that page's own tabs are Overview (the mockup's
 * dashboard-style summary) and Accessibility only, since a raw
 * findings-review screen belongs with Reports' other findings-oriented
 * tabs (Report, Activity), not duplicated onto Protect My Site as well.
 * "Protect My Site"'s Overview still links out here ("Review Issues
 * First"/clicking a vulnerability row) via a real cross-page
 * `#&tab=reports&subtab=security` navigation rather than an in-page tab
 * switch — same `admin_url`+`subtab` pattern
 * HistoryDetailPanel.tsx's "View findings" link already uses.
 */
const SecurityTab = () => {
	return (
		<ContainerComponent general>
			<ColumnComponent>
				{SecurityDashboardCard && <SecurityDashboardCard />}
				<FindingsTable
					title={__('Security', 'vulopilot')}
					description={__(
						'No security findings yet — run a scan to check for hardening and exposure issues.',
						'vulopilot'
					)}
					category="security"
				/>
				{SecurityIncidentReportsPanel && (
					<SecurityIncidentReportsPanel />
				)}
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default SecurityTab;
