/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ListComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface TopPagesResponse {
	top: unknown[];
	bottom: unknown[];
}

/**
 * "Discover" — the mockup's card names ("Keyword Opportunities",
 * "Questions People Ask", "Trending Topics") have no real backend
 * anywhere in this codebase. Repurposed honestly using the real
 * `GET /geo-analysis/top-pages` data already powering TopPagesCard.tsx
 * (same endpoint, a second small fetch — same tradeoff
 * useSectionStatus.ts's own docblock already documents elsewhere on this
 * page): how many pages are ranked, and how many of those need attention.
 * "Explore" scrolls down to the real Top Pages card already rendered on
 * the GEO tab.
 */
const DiscoverCard = ({
	onNavigateTab,
}: {
	onNavigateTab: (tab: 'geo' | 'aeo') => void;
}) => {
	const [counts, setCounts] = useState<{ tracked: number; needsWork: number } | null>(
		null
	);

	useEffect(() => {
		getApiResponse<TopPagesResponse>(
			getApiLink(appLocalizer, 'geo-analysis/top-pages'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setCounts({
					tracked: response.top.length,
					needsWork: response.bottom.length,
				});
			}
		});
	}, []);

	const goToTopPages = () => {
		onNavigateTab('geo');
		setTimeout(() => {
			document
				.getElementById('geo-top-pages')
				?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 150);
	};

	return (
		<CardComponent title={__('Discover', 'vulopilot')} titleIcon="search-discovery">
			{counts && (
				<ListComponent
					className="mini-card"
					items={[
						{
							id: 'tracked',
							title: __('Pages tracked', 'vulopilot'),
							value: sprintf('%d', counts.tracked),
						},
						{
							id: 'needs-work',
							title: __('Pages needing attention', 'vulopilot'),
							value: sprintf('%d', counts.needsWork),
						},
					]}
				/>
			)}
			<ButtonInput
				buttons={{
					text: __('Explore', 'vulopilot'),
					icon: 'arrow-right',
					onClick: goToTopPages,
				}}
			/>
		</CardComponent>
	);
};

export default DiscoverCard;
