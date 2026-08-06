import React from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import StoreOverviewCards from './StoreOverviewCards';
import AiInsightBanner from './AiInsightBanner';
import WooCommerceMetricsGrid from './WooCommerceMetricsGrid';
import TopSellingProductsCard from './TopSellingProductsCard';
import AbandonedCartCard from './AbandonedCartCard';
import AiSalesAssistantCard from './AiSalesAssistantCard';
import ProTipBanner from './ProTipBanner';
import './SellMore.scss';

interface OverviewTabProps {
	onNavigateToWooCommerceTab: () => void;
}

/**
 * "Sell More"'s new default tab — see this folder's sibling files for
 * the per-section real-data mapping (StoreOverviewCards, AiInsightBanner,
 * WooCommerceMetricsGrid, TopSellingProductsCard, AbandonedCartCard,
 * AiSalesAssistantCard, ProTipBanner — each documents its own data
 * source and, where the mockup shows something with no real backend, its
 * honest fallback).
 */
const OverviewTab: React.FC<OverviewTabProps> = ({
	onNavigateToWooCommerceTab,
}) => {
	return (
		<ContainerComponent general>
			<ColumnComponent grid={8}>
				<StoreOverviewCards
					onNavigateToWooCommerceTab={onNavigateToWooCommerceTab}
				/>
				<AiInsightBanner
					onNavigateToWooCommerceTab={onNavigateToWooCommerceTab}
				/>
				<WooCommerceMetricsGrid />
				<ProTipBanner />
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<AiSalesAssistantCard
					onNavigateToWooCommerceTab={onNavigateToWooCommerceTab}
				/>
				<TopSellingProductsCard />
				<AbandonedCartCard />
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default OverviewTab;
