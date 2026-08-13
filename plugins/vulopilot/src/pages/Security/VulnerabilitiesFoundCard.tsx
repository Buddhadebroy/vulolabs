import { __ } from '@wordpress/i18n';
import { TooltipComponent } from '@zyra/components';
import OpenIssuesGlimpse from '../../components/OpenIssuesGlimpse';

interface VulnerabilitiesFoundCardProps {
	/** Same combined list ClassicSecurityTab.tsx's own IssuesNeedAttentionCard/"Security Findings" section already use. */
	scannerIds: string[];
	/** scanner id → this tab's own section key (`protect-my-site-section-{key}`), for the same-page scroll-and-highlight a row click does. */
	sectionMap: Record<string, string>;
	/** DOM id prefix every section on this tab already carries. */
	anchorPrefix: string;
	/** Section key to fall back to for a scanner id `sectionMap` doesn't cover — the catch-all "Security Findings" section, which lists every one of these scanner ids' findings anyway. */
	fallbackSection: string;
}

/**
 * "Vulnerabilities Found" — the mockup's condensed issues list. Reuses
 * OpenIssuesGlimpse's real `/findings` data. Was Overview tab's own card
 * (now removed); moved here onto the Security tab itself, where it now
 * scopes to `scannerIds` rather than `category="security"` alone — several
 * of this list's real scanners have a raw `category` column that isn't
 * literally `security` (RestApiScanner is `rest-api`, SslMonitoringScanner
 * is `ssl`, etc. — see IssuesNeedAttentionCard.tsx's own docblock for the
 * same distinction), so `category="security"` alone would have silently
 * dropped them from this count. Clicking a row scrolls to that finding's
 * own section further down this same tab (OpenIssuesGlimpse's default
 * same-page behavior) instead of switching tabs, since it's already on the
 * Security tab now.
 */
const VulnerabilitiesFoundCard = ({
	scannerIds,
	sectionMap,
	anchorPrefix,
	fallbackSection,
}: VulnerabilitiesFoundCardProps) => (
	<OpenIssuesGlimpse
		scannerIds={scannerIds}
		title={__('Vulnerabilities Found', 'vulopilot')}
		titleIcon="error"
		sectionMap={sectionMap}
		anchorPrefix={anchorPrefix}
		fallbackSection={fallbackSection}
		emptyTitle={__("You're all caught up", 'vulopilot')}
		emptyDesc={__('No open vulnerabilities right now.', 'vulopilot')}
		footer={
			<TooltipComponent
				text={__(
					"Bulk auto-fix isn't available yet — no security scanner is mapped to an automated fix action. Fix findings individually from the sections below.",
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
