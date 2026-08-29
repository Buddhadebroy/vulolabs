/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ListComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface BrandScoreResponse {
	trust_score: number;
	authority_score: number;
	entity_score: number;
}

/**
 * "Authority" — real data from `GET /brand-intelligence/score`
 * (BrandScoreCard.tsx's exact endpoint), condensed to the 3 sub-scores
 * that aren't already the headline Brand Presence number on the
 * Visibility Score card above. "Improve" navigates to the Brand
 * Visibility tab where the full breakdown lives.
 */
const AuthorityCard = () => {
	const [data, setData] = useState<BrandScoreResponse | null>(null);

	useEffect(() => {
		getApiResponse<BrandScoreResponse>(
			getApiLink(appLocalizer, 'brand-intelligence/score'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setData(response);
			}
		});
	}, []);

	return (
		<CardComponent
			title={__('Authority', 'vulopilot')}
			titleIcon="star"
			desc={__('Your entity, authority, and trust sub-scores.', 'vulopilot')}
		>
			{data && (
				<ListComponent
					className="mini-card"
					items={[
						{
							id: 'entity-score',
							title: __('Entity Score', 'vulopilot'),
							value: String(data.entity_score),
						},
						{
							id: 'authority-score',
							title: __('Authority Score', 'vulopilot'),
							value: String(data.authority_score),
						},
						{
							id: 'trust-score',
							title: __('Trust Score', 'vulopilot'),
							value: String(data.trust_score),
						},
					]}
				/>
			)}
			<ButtonInput
				buttons={{
					text: __('Improve', 'vulopilot'),
					icon: 'arrow-right',
					onClick: () => {
						window.location.href =
							'?page=vulopilot#&tab=seo-visibility&subtab=brand-visibility';
					},
				}}
			/>
		</CardComponent>
	);
};

export default AuthorityCard;
