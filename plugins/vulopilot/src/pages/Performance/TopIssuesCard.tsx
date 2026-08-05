import { __ } from '@wordpress/i18n';
import { TooltipComponent } from '@zyra/components';
import OpenIssuesGlimpse from '../../components/OpenIssuesGlimpse';
import './ImproveSpeed.scss';

interface TopIssuesCardProps {
	onNavigateToPerformanceTab: () => void;
}

/**
 * "Top Issues" — the mockup's condensed issues list. Reuses
 * OpenIssuesGlimpse's real `/findings` data (category 'performance', the
 * same data the Performance tab's own full FindingsTable shows) rather
 * than a second parallel fetch. Drops the mockup's "Potential
 * Improvement: +N points" column — no per-issue score-impact prediction
 * exists anywhere in this codebase. Clicking a row switches to the
 * Performance tab (`onItemClick`) instead of the component's own default
 * same-page scroll-and-highlight, since Overview has no
 * `performance-section-*` anchors of its own.
 */
const TopIssuesCard = ({ onNavigateToPerformanceTab }: TopIssuesCardProps) => (
	<OpenIssuesGlimpse
		category="performance"
		title={__('Top Issues', 'vulopilot')}
		titleIcon="error"
		onItemClick={onNavigateToPerformanceTab}
		emptyTitle={__("You're all caught up", 'vulopilot')}
		emptyDesc={__('No open performance findings right now.', 'vulopilot')}
		footer={
			<TooltipComponent
				text={__(
					"Bulk auto-fix isn't available yet — there's no AI action-trigger engine wired up. Fix findings individually from the Performance tab.",
					'vulopilot'
				)}
			>
				<span
					role="button"
					aria-disabled="true"
					className="speed-boost-fix-all disabled"
				>
					<i className="adminfont-ai" />
					{__('Fix All Issues with AI', 'vulopilot')}
				</span>
			</TooltipComponent>
		}
	/>
);

export default TopIssuesCard;
