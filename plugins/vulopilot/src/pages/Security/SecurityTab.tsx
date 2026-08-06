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
 * "Security" tab of "Protect My Site" — body extracted verbatim from the
 * former standalone Security.tsx page (same "extract body, drop the
 * header" move every other tab on this page already made) — its own
 * NavigatorHeaderComponent now lives once on Security.tsx's shared
 * tab-shell header.
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
