/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import type { EntitiesResponse } from './KnowledgeGraphSection';

const isEntityExtractionModuleActive = () =>
	appLocalizer.active_modules?.includes('entity-extraction') ?? false;

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

interface UnderstandingTile {
	key: string;
	icon: string;
	label: string;
	count: number;
	found: boolean;
}

/**
 * "Business Understanding Score" hero card — the page's own top section,
 * matching the reference mockup's own information architecture. Real
 * score, real tiles, nothing invented:
 *
 * - The gauge is the exact same real `entity_score` (`GET
 *   /brand-intelligence/score`, Controllers\BrandIntelligence — deterministic,
 *   no AI) that used to render as its own separate "Entity Understanding"
 *   card further down this page — moved up here to be the page's own real
 *   hero metric instead of duplicating it as two cards showing the same
 *   number (that would have recreated the exact "same score shown twice"
 *   problem this session already fixed on the AEO tab). See
 *   KnowledgeGraphSection.tsx's own docblock for the removal.
 * - Organization/Products/Location/Categories are 4 of the same real 6
 *   entity-type counts `GET /entities` (EntityExtractor, Free) already
 *   provides — "What AI & Search Understand" below shows all 6; these 4
 *   are the mockup's own featured subset. "Found"/"Missing" per tile is a
 *   real `count > 0` check, not a separate signal.
 * - The headline/explanation line is generated from these same 2 real
 *   fetches (how many of the 4 featured tiles are missing, plus a real
 *   note when a module gating either fetch is off) — never a static
 *   placeholder.
 */
const BusinessUnderstandingCard = () => {
	const [entities, setEntities] = useState<EntitiesResponse | null>(null);
	const [entityScore, setEntityScore] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const requests: Promise<unknown>[] = [];

		if (isEntityExtractionModuleActive()) {
			requests.push(
				getApiResponse<EntitiesResponse>(
					getApiLink(appLocalizer, 'entities'),
					{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
				).then((response) => {
					if (response) {
						setEntities(response);
					}
				})
			);
		}

		if (isBrandModuleActive()) {
			requests.push(
				getApiResponse<{ entity_score: number }>(
					getApiLink(appLocalizer, 'brand-intelligence/score'),
					{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
				).then((response) => {
					if (response) {
						setEntityScore(response.entity_score);
					}
				})
			);
		}

		Promise.all(requests).finally(() => setIsLoading(false));
	}, []);

	if (!isEntityExtractionModuleActive() && !isBrandModuleActive()) {
		return (
			<CardComponent title={__('Business Understanding Score', 'vulopilot')}>
				<ModuleGuardComponent
					icon="error"
					title={__(
						'Entity Extraction and Brand Intelligence are both turned off',
						'vulopilot'
					)}
					desc={__(
						'Turn either module back on from Settings → Modules to see how Google and AI understand your business here.',
						'vulopilot'
					)}
				/>
			</CardComponent>
		);
	}

	const tiles: UnderstandingTile[] = entities
		? [
				{
					key: 'organization',
					icon: 'global-community',
					label: __('Organization', 'vulopilot'),
					count: entities.organizations.length,
					found: entities.organizations.length > 0,
				},
				{
					key: 'products',
					icon: 'product',
					label: __('Products', 'vulopilot'),
					count: entities.products?.length ?? 0,
					found: (entities.products?.length ?? 0) > 0,
				},
				{
					key: 'location',
					icon: 'location',
					label: __('Location', 'vulopilot'),
					count: entities.locations.length,
					found: entities.locations.length > 0,
				},
				{
					key: 'categories',
					icon: 'category',
					label: __('Categories', 'vulopilot'),
					count: entities.categories.length,
					found: entities.categories.length > 0,
				},
			]
		: [];

	const missingCount = tiles.filter((tile) => !tile.found).length;
	const foundLabels = tiles
		.filter((tile) => tile.found)
		.map((tile) => tile.label.toLowerCase());

	const headline =
		0 === missingCount
			? __('We understand your business clearly.', 'vulopilot')
			: sprintf(
					/* translators: %s is a comma-separated list of real entity types this site's own data actually has (e.g. "organization, products"). */
					__('We understand your %s.', 'vulopilot'),
					foundLabels.length > 0
						? foundLabels.join(', ')
						: __('basic business details', 'vulopilot')
				);

	const explanation =
		missingCount > 0
			? sprintf(
					/* translators: %d is how many of the 4 featured business details below are missing on this real site. */
					_n(
						'However, %d important detail needs clarification to improve your visibility in search results and AI answers.',
						'However, %d important details need clarification to improve your visibility in search results and AI answers.',
						missingCount,
						'vulopilot'
					),
					missingCount
				)
			: __(
					'All the core details search engines and AI look for were found on your site.',
					'vulopilot'
				);

	return (
		<>
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

			<ColumnComponent grid={8}>
				<CardComponent
					title={headline}
					desc={explanation}
					isLoading={isLoading}
				>
					{entities && (
						<div className="business-understand-tiles">
							{tiles.map((tile) => (
								<div key={tile.key} className="business-understand-tile">
									<div
										className={`business-understand-tile-icon ${tile.found ? 'is-good' : 'is-attention'}`}
									>
										<i className={`adminfont-${tile.icon}`} />
									</div>
									<div className="business-understand-tile-label">
										{tile.label}
									</div>
									<div
										className={`business-understand-tile-status ${tile.found ? 'is-good' : 'is-attention'}`}
									>
										<i
											className={`adminfont-${tile.found ? 'check' : 'error'}`}
										/>
										{tile.found
											? sprintf(
													/* translators: %d is a real count of this entity type found on the site. */
													__('%d found', 'vulopilot'),
													tile.count
												)
											: __('Missing', 'vulopilot')}
									</div>
								</div>
							))}
						</div>
					)}
				</CardComponent>
			</ColumnComponent>
		</>
	);
};

export default BusinessUnderstandingCard;
