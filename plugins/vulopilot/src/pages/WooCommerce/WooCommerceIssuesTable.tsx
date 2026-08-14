import { __, sprintf } from '@wordpress/i18n';
import FindingsTable from '../../components/FindingsTable';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import { sumGroupCounts } from './useWooCommerceFindingGroups';
import { SectionComponent, TabsComponent } from '@zyra/components';
import {
	PRODUCT_SCANNER_IDS,
	CHECKOUT_SCANNER_IDS,
	STORE_SCANNER_IDS,
	ALL_MAPPED_SCANNER_IDS,
} from './WooCommerceTab.constants';

export type WooCommerceIssueTab =
	| 'all'
	| 'important'
	| 'products'
	| 'checkout'
	| 'store';

interface WooCommerceIssuesTableProps {
	groups: FindingGroup[];
	activeTab: WooCommerceIssueTab;
	onTabChange: (tab: WooCommerceIssueTab) => void;
}

/**
 * "All WooCommerce Issues" — a real category-tab bar on top of the
 * existing, unmodified `FindingsTable` (its own `scannerIds` prop already
 * supports exactly this scoping — GEO.tsx's per-section tables already
 * use it the same way). Tab counts are real `/findings/groups` sums per
 * WooCommerceTab.constants.ts's scanner_id buckets — "Important" is the
 * one dynamic bucket, built from whichever groups are currently
 * critical/high severity rather than a fixed scanner_id list.
 */
const WooCommerceIssuesTable = ({
	groups,
	activeTab,
	onTabChange,
}: WooCommerceIssuesTableProps) => {
	const importantScannerIds = groups
		.filter((group) => 'critical' === group.severity || 'high' === group.severity)
		.map((group) => group.scanner_id);

	const tabs: { id: WooCommerceIssueTab; label: string; count: number }[] = [
		{
			id: 'all',
			label: __('All', 'vulopilot'),
			count: sumGroupCounts(groups, ALL_MAPPED_SCANNER_IDS),
		},
		{
			id: 'important',
			label: __('Important', 'vulopilot'),
			count: sumGroupCounts(groups, importantScannerIds),
		},
		{
			id: 'products',
			label: __('Products', 'vulopilot'),
			count: sumGroupCounts(groups, PRODUCT_SCANNER_IDS),
		},
		{
			id: 'checkout',
			label: __('Checkout', 'vulopilot'),
			count: sumGroupCounts(groups, CHECKOUT_SCANNER_IDS),
		},
		{
			id: 'store',
			label: __('Store', 'vulopilot'),
			count: sumGroupCounts(groups, STORE_SCANNER_IDS),
		},
	];

	const scannerIdsForTab: Record<WooCommerceIssueTab, string[] | undefined> = {
		all: undefined,
		important: importantScannerIds,
		products: PRODUCT_SCANNER_IDS,
		checkout: CHECKOUT_SCANNER_IDS,
		store: STORE_SCANNER_IDS,
	};
	const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
	const findingsTable = (tab: WooCommerceIssueTab) => (
		<FindingsTable
			title={__('WooCommerce', 'vulopilot')}
			description={__(
				'No WooCommerce findings yet — run a scan to check store settings, product data, and checkout health.',
				'vulopilot'
			)}
			category="woocommerce"
			scannerIds={scannerIdsForTab[tab]}
		/>
	);

	return (
		<div id="woocommerce-issues-table" className="woocommerce-issues-table">
			<SectionComponent title={__('All WooCommerce Issues', 'vulopilot')} />
			<TabsComponent
				className="woocommerce-issues-tabs"
				activeIndex={Math.max(activeIndex, 0)}
				onTabChange={(index) => onTabChange(tabs[index].id)}
				tabs={tabs.map((tab) => ({
					label: sprintf('%1$s (%2$d)', tab.label, tab.count),
					content: findingsTable(tab.id),
				}))}
			/>
		</div>
	);
};

export default WooCommerceIssuesTable;
