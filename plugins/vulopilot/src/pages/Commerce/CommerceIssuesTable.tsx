/* global appLocalizer */
import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ModuleGuardComponent,
	PopupComponent,
	SectionComponent,
	TabsComponent,
} from '@zyra/components';
import { TableCard } from '@zyra/table';
import { useFindingsTable } from '../../services/useFindingsTable';
import ShowProPopup from '../../components/Popup/Popup';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import { sumGroupCounts } from './useWooCommerceFindingGroups';
import {
	PRODUCT_SCANNER_IDS,
	CHECKOUT_SCANNER_IDS,
	STORE_SCANNER_IDS,
	ALL_MAPPED_SCANNER_IDS,
} from './CommerceTab.constants';

export type CommerceIssueTab =
	| 'all'
	| 'important'
	| 'products'
	| 'checkout'
	| 'store';

interface WooCommerceFindingsTableProps {
	scannerIds?: string[];
}

/**
 * One tab panel's real findings table — a thin shell around
 * `useFindingsTable` + Zyra's own `<TableCard />`, kept as its own
 * component (rather than inlined straight into the `tabs` array below) so
 * each tab's table only mounts — and only fetches — when TabsComponent
 * actually renders it as the current tab's content (`tabs[activeIndex]`,
 * TabsComponent.tsx's own `currentTab`), same lazy per-tab-switch fetch
 * behavior a dedicated `<FindingsTable>` instance per tab used to give for
 * free before that component was removed in favor of every real table
 * being a real `<TableCard />`.
 */
const WooCommerceFindingsTable = ({ scannerIds }: WooCommerceFindingsTableProps) => {
	const { tableCardProps, error, refetch, isProPopupOpen, closeProPopup } =
		useFindingsTable({
			category: 'woocommerce',
			scannerIds,
			description: __(
				'No WooCommerce findings yet — run a scan to check store settings, product data, and checkout health.',
				'vulopilot'
			),
		});

	return (
		<>
			{error ? (
				<CardComponent title={__('WooCommerce', 'vulopilot')} titleIcon="error">
					<ModuleGuardComponent
						icon="error"
						title={__('Could not load findings', 'vulopilot')}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={refetch}
					/>
				</CardComponent>
			) : (
				<TableCard {...tableCardProps} />
			)}
			<PopupComponent
				open={isProPopupOpen}
				onClose={closeProPopup}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

interface CommerceIssuesTableProps {
	groups: FindingGroup[];
	activeTab: CommerceIssueTab;
	onTabChange: (tab: CommerceIssueTab) => void;
}

/**
 * "All WooCommerce Issues" — a real category-tab bar on top of a real
 * `<TableCard>` (via `useFindingsTable`'s own `scannerIds` scoping —
 * GEO.tsx's per-section tables already scope the same hook the same way).
 * Tab counts are real `/findings/groups` sums per CommerceTab.constants.ts's
 * scanner_id buckets — "Important" is the one dynamic bucket, built from
 * whichever groups are currently critical/high severity rather than a
 * fixed scanner_id list.
 */
const CommerceIssuesTable = ({
	groups,
	activeTab,
	onTabChange,
}: CommerceIssuesTableProps) => {
	const importantScannerIds = groups
		.filter((group) => 'critical' === group.severity || 'high' === group.severity)
		.map((group) => group.scanner_id);

	const tabs: { id: CommerceIssueTab; label: string; count: number }[] = [
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

	const scannerIdsForTab: Record<CommerceIssueTab, string[] | undefined> = {
		all: undefined,
		important: importantScannerIds,
		products: PRODUCT_SCANNER_IDS,
		checkout: CHECKOUT_SCANNER_IDS,
		store: STORE_SCANNER_IDS,
	};
	const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

	return (
		<div id="woocommerce-issues-table" className="woocommerce-issues-table">
			<SectionComponent title={__('All WooCommerce Issues', 'vulopilot')} />
			<TabsComponent
				activeIndex={Math.max(activeIndex, 0)}
				onTabChange={(index) => onTabChange(tabs[index].id)}
				tabs={tabs.map((tab) => ({
					label: sprintf('%1$s (%2$d)', tab.label, tab.count),
					content: (
						<WooCommerceFindingsTable
							scannerIds={scannerIdsForTab[tab.id]}
						/>
					),
				}))}
			/>
		</div>
	);
};

export default CommerceIssuesTable;
