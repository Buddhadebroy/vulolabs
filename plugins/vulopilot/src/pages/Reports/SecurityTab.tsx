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
 * "Protect My Site": that page now has 5 tabs of its own (Security,
 * Performance, Site Health, Files & Plugins, Accessibility — see
 * Security.tsx), and its default "Security" tab already folds in a full
 * "Issues that need your attention" section with its own in-page "Review
 * Issues First" scroll target (IssuesNeedAttentionCard.tsx), so this tab
 * isn't that page's only findings view — it's Reports' own simpler,
 * unfiltered category="security" list, grouped with Reports' other
 * findings-oriented tabs (Report, Activity) instead.
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
