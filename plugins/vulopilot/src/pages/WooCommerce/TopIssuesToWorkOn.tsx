/* global appLocalizer */
import { __, sprintf, _n } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import type { FindingGroup } from '../AIAssistant/issuesTypes';

const SEVERITY_RANK: Record<FindingGroup['severity'], number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4,
};

const IMPACT_LABEL: Record<FindingGroup['severity'], string> = {
	critical: __('HIGH IMPACT', 'vulopilot'),
	high: __('HIGH IMPACT', 'vulopilot'),
	medium: __('MEDIUM IMPACT', 'vulopilot'),
	low: __('LOW IMPACT', 'vulopilot'),
	info: __('LOW IMPACT', 'vulopilot'),
};

const IMPACT_COLOR: Record<FindingGroup['severity'], string> = {
	critical: 'red',
	high: 'red',
	medium: 'orange',
	low: 'blue',
	info: 'blue',
};

interface TopIssuesToWorkOnProps {
	groups: FindingGroup[];
	isLoading: boolean;
	onViewAll: () => void;
}

/**
 * "What should I work on first?" — the 5 real WooCommerce finding groups
 * with the most urgent severity (ties broken by real affected-count),
 * same `GET /findings/groups` data every other card on this page reads
 * (no separate endpoint). "Review →" deep-links to the real AI Assistant
 * Issues tab pre-scoped to that exact scanner_id, same real navigation
 * pattern HistoryDetailPanel.tsx's own scanner_id deep-link already uses,
 * rather than duplicating a detail panel here.
 */
const TopIssuesToWorkOn = ({
	groups,
	isLoading,
	onViewAll,
}: TopIssuesToWorkOnProps) => {
	const topFive = [...groups]
		.sort((a, b) => {
			const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];

			return 0 !== severityDiff ? severityDiff : b.count - a.count;
		})
		.slice(0, 5);

	if (isLoading || 0 === topFive.length) {
		return null;
	}

	return (
		<div className="woocommerce-top-issues">
			<div className="woocommerce-top-issues-header">
				<div className="woocommerce-top-issues-title">
					{__('What should I work on first?', 'vulopilot')}
				</div>
				<span
					className="woocommerce-top-issues-view-all"
					role="button"
					tabIndex={0}
					onClick={onViewAll}
				>
					{__('View all important issues →', 'vulopilot')}
				</span>
			</div>
			<div className="woocommerce-top-issues-list">
				{topFive.map((group) => (
					<div className="woocommerce-top-issue-row" key={group.scanner_id}>
						<span
							className={`admin-badge ${IMPACT_COLOR[group.severity]}`}
						>
							{IMPACT_LABEL[group.severity]}
						</span>
						<i className="adminfont-woocommerce" />
						<div className="woocommerce-top-issue-body">
							<div className="woocommerce-top-issue-title">
								{group.label}
							</div>
							<div className="desc">
								{sprintf(
									/* translators: %d is the number of open findings in this group. */
									_n(
										'%d open finding.',
										'%d open findings.',
										group.count,
										'vulopilot'
									),
									group.count
								)}
							</div>
						</div>
						<ButtonInput
							buttons={{
								text: __('Review →', 'vulopilot'),
								color: 'secondary',
								onClick: () => {
									window.location.href = `${appLocalizer.admin_url}#&tab=ai-assistant&subtab=issues&scanner_id=${encodeURIComponent(group.scanner_id)}`;
								},
							}}
						/>
					</div>
				))}
			</div>
		</div>
	);
};

export default TopIssuesToWorkOn;
