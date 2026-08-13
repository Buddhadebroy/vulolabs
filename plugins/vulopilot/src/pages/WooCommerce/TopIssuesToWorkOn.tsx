/* global appLocalizer */
import { __, sprintf, _n } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import {
	PRODUCT_SCANNER_IDS,
	INVENTORY_SCANNER_IDS,
	CHECKOUT_SCANNER_IDS,
} from './WooCommerceTab.constants';

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

/** Same red/orange/green rank progression the merged mockup design used, driven by real severity rather than fixed position. */
const RANK_COLOR: Record<FindingGroup['severity'], string> = {
	critical: 'red',
	high: 'red',
	medium: 'orange',
	low: 'green',
	info: 'green',
};

/**
 * Which real `WooCommerceTab.constants.ts` bucket a scanner_id falls
 * into — reused (not re-invented) to drive this row's icon and its
 * "Could help" line, same bucket vocabulary
 * WooCommerceIssuesTable.tsx's own tab bar already groups by. Falls back
 * to the general "store" bucket for anything not in the other three
 * (STORE_SCANNER_IDS plus any future scanner not yet mapped there).
 */
const getBucketMeta = (scannerId: string): { icon: string; impact: string } => {
	if (PRODUCT_SCANNER_IDS.includes(scannerId)) {
		return {
			icon: 'cart',
			impact: __('Could help: Recover lost purchases', 'vulopilot'),
		};
	}

	if (INVENTORY_SCANNER_IDS.includes(scannerId)) {
		return {
			icon: 'database',
			impact: __('Could help: Keep products purchasable', 'vulopilot'),
		};
	}

	if (CHECKOUT_SCANNER_IDS.includes(scannerId)) {
		return {
			icon: 'cash',
			impact: __('Could help: Recover lost orders', 'vulopilot'),
		};
	}

	return {
		icon: 'shield',
		impact: __('Could help: Improve store experience', 'vulopilot'),
	};
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
 *
 * Design merges three mockup variants of this same card (numbered-rank
 * list, a differently-styled "Sales at Risk" list, and a
 * "Potential effect" list) into this one real component rather than
 * shipping three near-duplicate sections: each row's rank circle
 * (colored by real severity), icon chip, and "Could help" line
 * (`getBucketMeta()`, driven by the same real scanner_id → bucket
 * mapping WooCommerceIssuesTable.tsx already uses) replace those three
 * mockups' own icon/badge/impact-line variants. The mockups' extra
 * top-of-card "N opportunities" count pill was dropped as a duplicate of
 * the "Important" tab's own count (WooCommerceIssuesTable.tsx) rather
 * than shown a second time here.
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
			</div>
			<div className="woocommerce-top-issues-list">
				{topFive.map((group, index) => {
					const bucket = getBucketMeta(group.scanner_id);

					return (
						<div className="woocommerce-top-issue-row" key={group.scanner_id}>
							<span
								className={`woocommerce-top-issue-rank ${RANK_COLOR[group.severity]}`}
							>
								{index + 1}
							</span>
							<span className="woocommerce-top-issue-icon">
								<i className={`adminfont-${bucket.icon}`} />
							</span>
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
								<div className="woocommerce-top-issue-impact">
									{bucket.impact}
								</div>
							</div>
							<div className="woocommerce-top-issue-actions">
								<span
									className={`admin-badge ${IMPACT_COLOR[group.severity]}`}
								>
									{IMPACT_LABEL[group.severity]}
								</span>
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
						</div>
					);
				})}
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
	);
};

export default TopIssuesToWorkOn;
