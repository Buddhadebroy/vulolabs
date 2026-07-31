/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';
import type { EntitiesResponse } from '../pages/KnowledgeGraph/KnowledgeGraph';

/**
 * A Dashboard-level teaser for the Knowledge Graph page — same "small
 * independently fetched summary" pattern CrawlerTrafficWidget.tsx already
 * uses, condensed to a per-type count row.
 */
const KnowledgeGraphWidget: React.FC<WidgetProps> = ({
	onHide,
	isCustomizing,
}) => {
	const [entities, setEntities] = useState<EntitiesResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<EntitiesResponse>(getApiLink(appLocalizer, 'entities'), {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (response) {
					setEntities(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	const counts = entities
		? [
				{ label: __('People', 'vulopilot'), total: entities.people.length },
				{
					label: __('Organizations', 'vulopilot'),
					total: entities.organizations.length,
				},
				{
					label: __('Products', 'vulopilot'),
					total: entities.products?.length ?? 0,
				},
				{
					label: __('Services', 'vulopilot'),
					total: entities.services.length,
				},
				{
					label: __('Locations', 'vulopilot'),
					total: entities.locations.length,
				},
				{
					label: __('Categories', 'vulopilot'),
					total: entities.categories.length,
				},
			]
		: [];

	const totalEntities = counts.reduce((sum, row) => sum + row.total, 0);

	return (
		<DashboardWidget
			title={__('Knowledge Graph', 'vulopilot')}
			icon="share-alt2"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			{!isLoading && totalEntities === 0 ? (
				<ModuleGuardComponent
					icon="share-alt2"
					title={__('No entities extracted yet', 'vulopilot')}
					desc={__(
						'Publish some content, or configure services/locations under Settings → Entity Extraction.',
						'vulopilot'
					)}
				/>
			) : (
				<ul className="dashboard-widget-list">
					{counts.map((row) => (
						<li key={row.label} className="dashboard-widget-list-row">
							<span className="dashboard-widget-list-message">
								{row.label}
							</span>
							<span className="dashboard-widget-list-meta">
								{row.total}
							</span>
						</li>
					))}
				</ul>
			)}
		</DashboardWidget>
	);
};

export default KnowledgeGraphWidget;
