import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import {
	ColumnComponent,
	ContainerComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';

/**
 * ACCESSIBILITY-MODULE.md's Pro additions register into these two slots —
 * same "register a source, don't modify the host" pattern Security.tsx/
 * GEO.tsx/Reports.tsx already use, rather than replacing this whole page:
 * accessibility findings are useful with Free alone (the FindingsTable
 * below already shows every 'accessibility' finding, Free or Pro), so this
 * page only adds extra cards on top rather than gating its base content
 * behind Pro.
 */
const AccessibilityDashboardCard = applyFilters(
	'vulopilot_accessibility_dashboard_card',
	null
) as ComponentType | null;

const AccessibilityHistoryPanel = applyFilters(
	'vulopilot_accessibility_history_panel',
	null
) as ComponentType | null;

const Accessibility = () => (
	<>
		<NavigatorHeaderComponent
			headerIcon="support"
			headerTitle={__('Accessibility', 'vulopilot')}
			headerDescription={__(
				'Heading structure, ARIA attributes, and form label findings.',
				'vulopilot'
			)}
		/>
		<ContainerComponent general>
			<ColumnComponent>
				{AccessibilityDashboardCard && <AccessibilityDashboardCard />}
				<FindingsTable
					title={__('Accessibility', 'vulopilot')}
					description={__(
						'No accessibility findings yet — run a scan to check heading structure, ARIA attributes, and form labels.',
						'vulopilot'
					)}
					category="accessibility"
				/>
				{AccessibilityHistoryPanel && <AccessibilityHistoryPanel />}
			</ColumnComponent>
		</ContainerComponent>
	</>
);

export default Accessibility;
