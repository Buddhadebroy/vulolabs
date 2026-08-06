import { __ } from '@wordpress/i18n';
import { TooltipComponent } from '@zyra/components';
import OpenIssuesGlimpse from '../../components/OpenIssuesGlimpse';

interface VulnerabilitiesFoundCardProps {
	onNavigateToSecurityTab: () => void;
}

/**
 * "Vulnerabilities Found" — the mockup's condensed issues list. Reuses
 * OpenIssuesGlimpse's real `/findings` data (category 'security', the
 * same data the Security tab's own full FindingsTable shows) rather than
 * a second parallel fetch. Drops the mockup's "Location" column — the
 * glimpse doesn't carry a location field, same class of simplification
 * "Improve Speed" made dropping "Potential Improvement". Clicking a row
 * switches to the Security tab (`onItemClick`) instead of the component's
 * own default same-page scroll-and-highlight, since Overview has no
 * `security-section-*` anchors of its own.
 */
const VulnerabilitiesFoundCard = ({
	onNavigateToSecurityTab,
}: VulnerabilitiesFoundCardProps) => (
	<OpenIssuesGlimpse
		category="security"
		title={__('Vulnerabilities Found', 'vulopilot')}
		titleIcon="error"
		onItemClick={onNavigateToSecurityTab}
		emptyTitle={__("You're all caught up", 'vulopilot')}
		emptyDesc={__('No open vulnerabilities right now.', 'vulopilot')}
		footer={
			<TooltipComponent
				text={__(
					"Bulk auto-fix isn't available yet — no security scanner is mapped to an automated fix action. Fix findings individually from the Security tab.",
					'vulopilot'
				)}
			>
				<span
					role="button"
					aria-disabled="true"
					className="security-fix-all disabled"
				>
					<i className="adminfont-ai" />
					{__('Fix All Issues with AI', 'vulopilot')}
				</span>
			</TooltipComponent>
		}
	/>
);

export default VulnerabilitiesFoundCard;
