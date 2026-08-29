/* global appLocalizer */
import { __, sprintf, _n } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { CardComponent, ListComponent, BadgeComponent } from '@zyra/components';
import { COLOR_PALETTE } from '@zyra/core';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import {
	PRODUCT_SCANNER_IDS,
	INVENTORY_SCANNER_IDS,
	CHECKOUT_SCANNER_IDS,
} from './CommerceTab.constants';

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

/**
 * Same real zyra hex `IMPACT_COLOR` above resolves to (`COLOR_PALETTE`,
 * `@zyra/core`) — this used to disagree with it on the exact same row
 * (`low`/`info` rendered as a green rank number next to a blue "LOW
 * IMPACT" badge), raw hex rather than a color name since ListComponent's
 * own `Item.numberColor` contract wants any real CSS color, same "raw
 * color string" pattern InformationItemComponent's `avatar.color` prop
 * already uses.
 */
const RANK_COLOR: Record<FindingGroup['severity'], string> = {
	critical: COLOR_PALETTE.red,
	high: COLOR_PALETTE.red,
	medium: COLOR_PALETTE.orange,
	low: COLOR_PALETTE.blue,
	info: COLOR_PALETTE.blue,
};

/**
 * Which real `CommerceTab.constants.ts` bucket a scanner_id falls
 * into — reused (not re-invented) to drive this row's icon and its
 * "Could help" line, same bucket vocabulary
 * CommerceIssuesTable.tsx's own tab bar already groups by. Falls back
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
 * shipping three near-duplicate sections: each row's rank circle (Zyra
 * `ListComponent`'s own `number`/`numberColor` — colored by real
 * severity), icon chip, and "Could help" line (`getBucketMeta()`, driven
 * by the same real scanner_id → bucket mapping CommerceIssuesTable.tsx
 * already uses) replace those three mockups' own icon/badge/impact-line
 * variants — rendered through `ListComponent`'s own row structure rather
 * than bespoke row markup, same "mini-card report" shape
 * NeedsAttentionWidget.tsx's own issue lists already use. The mockups'
 * extra top-of-card "N opportunities" count pill was dropped as a
 * duplicate of the "Important" tab's own count (CommerceIssuesTable.tsx)
 * rather than shown a second time here.
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
		<CardComponent
			title={__('What should I work on first?', 'vulopilot-pro')}
			titleIcon="star"
			desc={__('The 5 highest-impact open WooCommerce findings.', 'vulopilot-pro')}
			// Scopes Commerce.scss's shared `.admin-badge` red/orange/green/
			// blue color vocabulary (declared once for this whole
			// WooCommerce tab tree) onto this card's own impact badges —
			// unchanged from before this was a real `<ListComponent>` row.
			className="woocommerce-top-issues"
		>
			<ListComponent
				className="mini-card report"
				items={topFive.map((group, index) => {
					const bucket = getBucketMeta(group.scanner_id);

					return {
						id: group.scanner_id,
						number: index + 1,
						numberColor: RANK_COLOR[group.severity],
						icon: bucket.icon,
						title: group.label,
						desc: sprintf(
							/* translators: 1: pluralized open-finding count line, 2: this bucket's "Could help" impact line */
							__('%1$s %2$s', 'vulopilot'),
							sprintf(
								/* translators: %d is the number of open findings in this group. */
								_n(
									'%d open finding.',
									'%d open findings.',
									group.count,
									'vulopilot'
								),
								group.count
							),
							bucket.impact
						),
						tags: (
							<>
								<BadgeComponent
									color={IMPACT_COLOR[group.severity]}
									text={IMPACT_LABEL[group.severity]}
								/>
								<ButtonInput
									buttons={{
										text: __('Review', 'vulopilot'),
										color: 'text-purple',
										onClick: () => {
											window.location.href = `${appLocalizer.admin_url}#&tab=ai-assistant&subtab=issues&scanner_id=${encodeURIComponent(group.scanner_id)}`;
										},
									}}
								/>
							</>
						),
					};
				})}
			/>
			<ButtonInput
				buttons={{
					text: __('View all important issues →', 'vulopilot'),
					onClick: onViewAll,
				}}
			/>
		</CardComponent>
	);
};

export default TopIssuesToWorkOn;
