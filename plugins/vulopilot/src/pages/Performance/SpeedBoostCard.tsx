import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import './ImproveSpeed.scss';

interface FindingRow {
	id: number;
}

interface SpeedBoostCardProps {
	/** Scrolls to the full FindingsTable further down this same Overview tab. */
	onViewDetails: () => void;
}

/**
 * "Speed Boost Available" — real open-finding count for category
 * 'performance' (same `/findings?status=open` shape OpenIssuesGlimpse
 * already uses, just reading `total` instead of rendering the rows).
 * Drops the mockup's "Estimated improvement +18 points" line — no
 * scoring-impact-per-fix model exists anywhere in this codebase. "Fix
 * All Issues with AI" is honestly disabled the same way every other
 * per-page "Fix All"/"Let AI Optimize" control on this page is; "View
 * Details" scrolls to the "Top Issues" FindingsTable (PerformanceTab.tsx)
 * further down this Overview tab.
 */
const SpeedBoostCard = ({ onViewDetails }: SpeedBoostCardProps) => {
	const { total, isLoading } = useApiList<FindingRow>('findings', {
		category: 'performance',
		status: 'open',
		per_page: 1,
	});

	return (
		<CardComponent
			title={__('Speed Boost Available', 'vulopilot')}
			titleIcon="analytics"
			isLoading={isLoading}
		>
			{!isLoading && (
				<p className="desc">
					{total > 0
						? sprintf(
								/* translators: %d is the number of open performance findings. */
								__(
									'We found %d optimization opportunities that can improve your score.',
									'vulopilot'
								),
								total
							)
						: __(
								"You're all caught up — no open optimization opportunities right now.",
								'vulopilot'
							)}
				</p>
			)}
			<TooltipComponent
				text={__(
					"Bulk auto-fix isn't available yet — there's no AI action-trigger engine wired up. Fix findings individually below.",
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
			<ButtonInput
				buttons={{
					text: __('View Details', 'vulopilot'),
					onClick: onViewDetails,
				}}
			/>
		</CardComponent>
	);
};

export default SpeedBoostCard;
