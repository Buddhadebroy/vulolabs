/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ChartComponent, ColumnComponent, ModuleGuardComponent } from '@zyra/components';

const isBrandModuleActive = () =>
	appLocalizer.active_modules?.includes('brand-intelligence') ?? false;

const getRating = (score: number): string => {
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 40) {
		return __('Needs Work', 'vulopilot');
	}
	return __('Poor', 'vulopilot');
};

const ratingClass = (score: number): string => {
	if (score >= 70) {
		return 'is-good';
	}
	if (score >= 40) {
		return 'is-attention';
	}
	return 'is-poor';
};

/**
 * "Business Understanding Score" hero card — the page's own top section.
 * The gauge is the real `entity_score` (`GET /brand-intelligence/score`,
 * Controllers\BrandIntelligence — deterministic, no AI) that used to
 * render as its own separate "Entity Understanding" card further down
 * this page — moved up here to be the page's own real hero metric instead
 * of duplicating it as two cards showing the same number. See
 * KnowledgeGraphSection.tsx's own docblock for that earlier removal.
 *
 * Used to also render a 2nd, grid={8} "We understand your organization,
 * products, categories." headline+tiles half (Organization/Products/
 * Location/Categories found/missing) — removed per direct instruction to
 * replace it with 2 new real cards instead (`CriticalIssuesCard.tsx`/
 * `ValidSchemaCard.tsx`, rendered alongside this one by
 * SchemaKnowledgeTab.tsx), so this component is the gauge only now.
 */
const BusinessUnderstandingCard = () => {
	const [entityScore, setEntityScore] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!isBrandModuleActive()) {
			setIsLoading(false);
			return;
		}

		getApiResponse<{ entity_score: number }>(
			getApiLink(appLocalizer, 'brand-intelligence/score'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setEntityScore(response.entity_score);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<ColumnComponent grid={4}>
			<CardComponent
				title={__('Business Understanding Score', 'vulopilot')}
				titleIcon="info"
				isLoading={isLoading}
			>
				{!isLoading && null === entityScore ? (
					<ModuleGuardComponent
						icon="error"
						title={__(
							'Brand Intelligence module is turned off',
							'vulopilot'
						)}
						desc={__(
							'Turn it back on from Settings → Modules to see a real score here.',
							'vulopilot'
						)}
					/>
				) : (
					null !== entityScore && (
						<div className="business-score-gauge">
							<ChartComponent
								type="pie"
								height={160}
								centerLabel={
									<>
										<span className="score-ring-number">
											{entityScore}
										</span>
										<span className="score-ring-label">/100</span>
									</>
								}
								data={[
									{
										label: __('Score', 'vulopilot'),
										value: entityScore,
										color: '#16a34a',
									},
									{
										label: __('Remaining', 'vulopilot'),
										value: 100 - entityScore,
										color: '#e5e7eb',
									},
								]}
							/>
							<span
								className={`business-score-badge ${ratingClass(entityScore)}`}
							>
								{getRating(entityScore)}
							</span>
							<p className="desc business-score-caption">
								{sprintf(
									/* translators: %s is "good"/"needs work"/"poor". */
									__(
										'Google and AI have a %s understanding of your business.',
										'vulopilot'
									),
									getRating(entityScore).toLowerCase()
								)}
							</p>
						</div>
					)
				)}
			</CardComponent>
		</ColumnComponent>
	);
};

export default BusinessUnderstandingCard;
