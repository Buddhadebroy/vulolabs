import { __, sprintf } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import {
	ACCESSIBILITY_SCANNER_IDS,
	checkForScannerId,
	sectionAnchorId,
} from './accessibilityChecks';

interface AccessibilityFinding {
	id: number;
	title: string;
	description?: string;
	page?: string;
	scanner_id: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

/** Real severity → risk rank, worst first — same scale getSeverityClass.ts's own 5-value palette already orders (critical highest risk, info lowest). Findings.php's `orderby` has no severity-aware sort (severity is stored as text, so a plain `ORDER BY severity` would sort alphabetically, not by risk), so this ranks the fetched batch client-side instead — same tradeoff AccessibilityHeroCard.tsx's own high-priority tally already documents. */
const SEVERITY_RANK: Record<AccessibilityFinding['severity'], number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4,
};

/** "HIGH"/"MEDIUM"/"LOW" — the mockup's own 3-tier label; critical folds into "High" and info folds into "Low", same 3-tier collapse Findings.php's own `attention-summary` route already establishes for the identical reason (a 5-value severity scale is finer-grained than any UI on this page actually needs). */
const PRIORITY_LABEL: Record<AccessibilityFinding['severity'], string> = {
	critical: __('High', 'vulopilot'),
	high: __('High', 'vulopilot'),
	medium: __('Medium', 'vulopilot'),
	low: __('Low', 'vulopilot'),
	info: __('Low', 'vulopilot'),
};

interface AccessibilityPriorityListProps {
	id?: string;
	onViewAll: () => void;
}

/**
 * The mockup's "What should I fix first?" — the 3 highest-risk open
 * accessibility findings (client-side ranked, see SEVERITY_RANK's own
 * docblock), each row showing its real title, page, and description,
 * tagged with the check bucket it belongs to (ACCESSIBILITY_CHECKS'
 * shared icon/color) and a 3-tier priority pill. "Review" scrolls to
 * that finding's own detailed section rather than the finding itself —
 * there's no single-finding detail view on this page.
 */
const AccessibilityPriorityList = ({
	id,
	onViewAll,
}: AccessibilityPriorityListProps) => {
	const { data, total, isLoading } = useApiList<AccessibilityFinding>(
		'findings',
		{
			scanner_id: ACCESSIBILITY_SCANNER_IDS.join(','),
			status: 'open',
			per_page: 100,
		}
	);

	const topFindings = [...data]
		.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
		.slice(0, 3);

	return (
		<CardComponent
			id={id}
			title={__('What should I fix first?', 'vulopilot')}
			desc={__(
				'These issues have the biggest impact on accessibility.',
				'vulopilot'
			)}
			isLoading={isLoading}
			action={
				total > 0 && (
					<ButtonInput
						buttons={{
							text: sprintf(
								/* translators: %d is the number of open findings. */
								__('View all %d findings', 'vulopilot'),
								total
							),
							onClick: onViewAll,
						}}
					/>
				)
			}
		>
			{!isLoading && topFindings.length === 0 && (
				<p className="desc">
					{__(
						"You're all caught up — no open accessibility issues right now.",
						'vulopilot'
					)}
				</p>
			)}
			{!isLoading && topFindings.length > 0 && (
				<div className="accessibility-priority-list">
					{topFindings.map((row) => {
						const check = checkForScannerId(row.scanner_id);

						return (
							<div className="accessibility-priority-row" key={row.id}>
								<span
									className={`accessibility-priority-pill is-${row.severity}`}
								>
									{PRIORITY_LABEL[row.severity]}
								</span>
								{check && (
									<i
										className={`adminfont-${check.icon} accessibility-priority-icon`}
										style={{ color: check.color }}
									/>
								)}
								<div className="accessibility-priority-title-block">
									<div className="accessibility-priority-title">
										{row.title}
									</div>
									{row.page && (
										<div className="accessibility-priority-page">
											{sprintf(
												/* translators: %s is a page path or "Site-wide". */
												__('Page: %s', 'vulopilot'),
												row.page
											)}
										</div>
									)}
								</div>
								{row.description && (
									<div className="accessibility-priority-explain">
										{row.description}
									</div>
								)}
								<ButtonInput
									buttons={{
										text: __('Review', 'vulopilot'),
										rightIcon: 'pagination-right-arrow',
										color: 'border-purple',
										onClick: () =>
											document
												.getElementById(
													sectionAnchorId(
														check?.key || 'page-structure'
													)
												)
												?.scrollIntoView({
													behavior: 'smooth',
													block: 'start',
												}),
									}}
								/>
							</div>
						);
					})}
				</div>
			)}
		</CardComponent>
	);
};

export default AccessibilityPriorityList;
