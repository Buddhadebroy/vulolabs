import { __, sprintf } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { useApiList } from '../../services/useApiList';
import {
	ACCESSIBILITY_SCANNER_IDS,
	checkForScannerId,
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
	/** Switches the merged issues table below to the check this row belongs to, then scrolls to it — same purpose the row's own inline scroll-to-section used to serve, back when each check was its own separate card rather than a tab of one shared table. */
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onReviewCheck: (checkKey: string) => void;
}

/**
 * The mockup's "What should I fix first?" — the 3 highest-risk open
 * accessibility findings (client-side ranked, see SEVERITY_RANK's own
 * docblock), each row showing its real title, page, and description,
 * tagged with the check bucket it belongs to (ACCESSIBILITY_CHECKS'
 * shared icon/color) and a 3-tier priority pill. "Review" switches the
 * merged issues table below to that finding's own check/tab
 * (`onReviewCheck`) rather than the finding itself — there's no
 * single-finding detail view on this page.
 *
 * A real zyra `TableCard` (`transparent-table`, same borderless in-card
 * look `SeoIssuesByPageTable.tsx` uses) rather than a hand-rolled flex-row
 * list — `totalRows` is deliberately left at its default 0 so no
 * pagination footer renders under a list that's always exactly 3 rows.
 * The single "Issue" column is a real `InformationItemComponent`
 * (avatar/title/descriptions), same shape `IssuesList.tsx`'s own findings
 * table already uses — the 3-tier priority pill rides along as one of its
 * `badges` entries rather than a separate column, via a scoped
 * `accessibility-priority-badge` class (ProtectMySite.scss) rather than
 * zyra's own generic `badge-high`/`badge-low`/etc. classes: those are
 * wired to unrelated status semantics (`badge-high` = green "published",
 * `badge-low` = red "rejected" — see SeoVisibility.scss's own docblock for
 * the same trap), not a red/amber/blue risk scale.
 */
const AccessibilityPriorityList = ({
	id,
	onViewAll,
	onReviewCheck,
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
			titleIcon="star"
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
							color:"text-purple",
							onClick: onViewAll,
						}}
					/>
				)
			}
		>
			{!isLoading && topFindings.length === 0 && (
				<div className="desc">
					{__(
						"You're all caught up — no open accessibility issues right now.",
						'vulopilot'
					)}
				</div>
			)}
			{!isLoading && topFindings.length > 0 && (
				<TableCard
					className="transparent-table"
					hideHeader={true}
					showMenu={false}
					headers={{
						issue: {
							key: 'title',
							type: 'info',
							label: __('Issue', 'vulopilot'),
							width: '70%',
							iconKey: 'checkIcon',
							iconColorKey: 'checkColor',
							descriptionKey: 'descriptionText',
							badgesKey: 'priorityBadges',
						},
						action: {
							render: (row: AccessibilityFinding) => {
								const check = checkForScannerId(row.scanner_id);

								return (
									<ButtonInput
										buttons={{
											text: __('Review', 'vulopilot'),
											rightIcon: 'pagination-right-arrow',
											color: 'text-purple',
											onClick: () =>
												onReviewCheck(
													check?.key || 'page-structure'
												),
										}}
									/>
								);
							},
						},
					}}
					rows={topFindings.map((row) => {
						const check = checkForScannerId(row.scanner_id);

						return {
							...row,
							checkIcon: check?.icon,
							checkColor: check?.color,
							descriptionText: [
								row.page &&
									sprintf(
										/* translators: %s is a page path or "Site-wide". */
										__('Page: %s', 'vulopilot'),
										row.page
									),
								row.description,
							]
								.filter(Boolean)
								.join(' — '),
							priorityBadges: [
								{
									text: PRIORITY_LABEL[row.severity],
									color: `accessibility-priority-badge is-${row.severity}`,
								},
							],
						};
					})}
					ids={topFindings.map((row) => row.id)}
					isLoading={isLoading}
				/>
			)}
		</CardComponent>
	);
};

export default AccessibilityPriorityList;
