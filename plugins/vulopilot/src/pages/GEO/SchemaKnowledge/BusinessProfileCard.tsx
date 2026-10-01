/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, COLOR_PALETTE } from '@zyra/core';
import { CardComponent, ChartComponent, ColumnComponent, ListComponent, ModuleGuardComponent, PopupComponent, TypographyComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import type { EntitiesResponse } from './KnowledgeGraphSection';
import { ENTITY_SETTINGS_URL } from './KnowledgeGraphSection';
import BusinessNameDetailsPanel from './BusinessNameDetailsPanel';
import ProductDetailsPanel from './ProductDetailsPanel';
import { ratingColor } from '../seoRating';
import { useFilterSlot } from '../../../services/useFilterSlot';
import { KnowledgeGraphDiagram } from './KnowledgeGraphDiagramCard';
import ShowProPopup from '../../../components/Popup/Popup';

const isBrandModuleActive = () =>
	vulopilotAppLocalizer.active_modules?.includes('brand-visibility') ?? false;

const isEntityExtractionModuleActive = () =>
	vulopilotAppLocalizer.active_modules?.includes('knowledge-graph') ?? false;

/**
 * Understanding-language labels for the real `entity_score` gauge.
 */
const getRating = (score: number): string => {
	if (score >= 90) {
		return __('Excellent', 'vulopilot');
	}

	if (score >= 70) {
		return __('Good', 'vulopilot');
	}

	if (score >= 40) {
		return __('Needs work', 'vulopilot');
	}

	return __('Incomplete', 'vulopilot');
};

interface ProfileRow {
	key: string;
	label: string;
	found: boolean;
	/** True only for Products with no WooCommerce active - a real "doesn't apply to this site" state. */
	notApplicable?: boolean;
	value: string;
	confidence: 'high' | 'medium' | 'n/a';
}

/**
 * Real "confidence" a site owner should place in each row, disclosed here rather than left
 * implicit: - Business name: always "high".
 */
const buildRows = (entities: EntitiesResponse): ProfileRow[] => {
	const businessName = entities.organizations[0]?.name ?? '';

	return [
		{
			key: 'business_name',
			label: __('Business name', 'vulopilot'),
			found: '' !== businessName,
			value: businessName || __('Not found', 'vulopilot'),
			confidence: '' !== businessName ? 'high' : 'n/a',
		},
		{
			key: 'business_type',
			label: __('Business type', 'vulopilot'),
			found: '' !== entities.business_type,
			value: entities.business_type || __('Not found', 'vulopilot'),
			confidence: '' !== entities.business_type ? 'high' : 'n/a',
		},
		{
			key: 'services',
			label: __('Services', 'vulopilot'),
			found: entities.services.length > 0,
			value:
				entities.services.length > 0
					? sprintf(
						/* translators: %d: real number of detected services. */
						_n('%d service', '%d services', entities.services.length, 'vulopilot'),
						entities.services.length
					)
					: __('Not found', 'vulopilot'),
			confidence: entities.services.length > 0 ? 'high' : 'n/a',
		},
		{
			key: 'locations',
			label: __('Locations', 'vulopilot'),
			found: entities.locations.length > 0,
			value:
				entities.locations.length > 0
					? sprintf(
						/* translators: %d: real number of detected locations. */
						_n('%d location', '%d locations', entities.locations.length, 'vulopilot'),
						entities.locations.length
					)
					: __('Not found', 'vulopilot'),
			confidence: entities.locations.length > 0 ? 'high' : 'n/a',
		},
		{
			key: 'people',
			label: __('People', 'vulopilot'),
			found: entities.people.length > 0,
			value:
				entities.people.length > 0
					? sprintf(
						/* translators: %d: real number of detected people. */
						_n('%d person', '%d people', entities.people.length, 'vulopilot'),
						entities.people.length
					)
					: __('Not found', 'vulopilot'),
			confidence: entities.people.length > 0 ? 'medium' : 'n/a',
		},
		{
			key: 'products',
			label: __('Products', 'vulopilot'),
			found: null !== entities.products && entities.products.length > 0,
			notApplicable: null === entities.products,
			value:
				null === entities.products
					? __('Not applicable', 'vulopilot')
					: entities.products.length > 0
						? sprintf(
							/* translators: %d: real number of detected products. */
							_n('%d product', '%d products', entities.products.length, 'vulopilot'),
							entities.products.length
						)
						: __('Not found', 'vulopilot'),
			confidence: null !== entities.products && entities.products.length > 0 ? 'medium' : 'n/a',
		},
		{
			key: 'categories',
			label: __('Categories', 'vulopilot'),
			found: entities.categories.length > 0,
			value:
				entities.categories.length > 0
					? sprintf(
						/* translators: %d: real number of detected categories. */
						_n('%d category', '%d categories', entities.categories.length, 'vulopilot'),
						entities.categories.length
					)
					: __('Not found', 'vulopilot'),
			confidence: entities.categories.length > 0 ? 'high' : 'n/a',
		},
		{
			key: 'contact_details',
			label: __('Contact details', 'vulopilot'),
			found: entities.contact_email.found,
			value: entities.contact_email.found
				? __('Found', 'vulopilot')
				: __('Not found', 'vulopilot'),
			confidence: entities.contact_email.found ? 'high' : 'n/a',
		},
	];
};

const CONFIDENCE_LABEL: Record<ProfileRow['confidence'], string> = {
	high: __('High', 'vulopilot'),
	medium: __('Medium', 'vulopilot'),
	'n/a': '-',
};

/** Same real per-entity-type icon KnowledgeGraphSection.tsx's own "What AI & Search Understand" card already uses for `organizations`/`categories`/`people`/`locations`/`services`/`products`. */
const ROW_ICON: Record<string, string> = {
	business_name: 'global-community blue',
	business_type: 'module green',
	people: 'person pink',
	services: 'customer-service yellow',
	products: 'product lime',
	categories: 'category orange',
	locations: 'location cyan',
	contact_details: 'mail indigo',
};

/**
 * "Business Information" / "Key Information Found by AI".
 */
const BusinessProfileCard = () => {
	const [entityScore, setEntityScore] = useState<number | null>(null);
	const [entities, setEntities] = useState<EntitiesResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	// The real "Business Name Details" side panel (BusinessNameDetailsPanel.tsx) is the only row
	// here with a real multi-source cross-check behind it.
	const [isNamePanelOpen, setIsNamePanelOpen] = useState(false);
	// The real "Product Details" side panel (ProductDetailsPanel.tsx).
	const [isProductsPanelOpen, setIsProductsPanelOpen] = useState(false);
	const [isCustomSchemaProPopupOpen, setIsCustomSchemaProPopupOpen] = useState(false);
	/** The "People" row's own real popup - same `PopupComponent` pattern `business_name`/`products` already use. */
	const [isPeopleDropdownOpen, setIsPeopleDropdownOpen] = useState(false);
	/** The "Categories" row's own real popup - same pattern as `isPeopleDropdownOpen` above. */
	const [isCategoriesPopupOpen, setIsCategoriesPopupOpen] = useState(false);

	const KnowledgeGraphVisualizationCard = useFilterSlot(
		'vulopilot_knowledge_graph_visualization_card'
	);

	useEffect(() => {
		const requests: Promise<unknown>[] = [];

		if (isBrandModuleActive()) {
			requests.push(
				getApiResponse<{ entity_score: number }>(
					getApiLink(vulopilotAppLocalizer, 'brand-intelligence/score'),
					{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
				).then((response) => {
					if (response) {
						setEntityScore(response.entity_score);
					}
				})
			);
		}

		if (isEntityExtractionModuleActive()) {
			requests.push(
				getApiResponse<EntitiesResponse>(getApiLink(vulopilotAppLocalizer, 'entities'), {
					headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce },
				}).then((response) => {
					if (response) {
						setEntities(response);
					}
				})
			);
		}

		Promise.all(requests).finally(() => setIsLoading(false));
	}, []);

	const rows = entities ? buildRows(entities) : [];
	// Excludes `notApplicable` rows (Products with no WooCommerce active).
	const missingCount = rows.filter((row) => !row.found && !row.notApplicable).length;
	// The "Products" row's own real "View" action opens `ProductDetailsPanel`, which has nothing
	// real to show without at least 1 real product.
	const visibleRows = rows.filter(
		(row) => 'products' !== row.key || row.found
	);

	if (!isLoading && null === entityScore && null === entities) {
		return (
			<ColumnComponent>
				<CardComponent
					title={__('Business Information', 'vulopilot')}
					titleIcon="info"
					desc={__('Overall completeness and accuracy.', 'vulopilot')}
				>
					<ModuleGuardComponent
						icon="error"
						title={__('Business Identity modules are turned off', 'vulopilot')}
						desc={__(
							'Turn Brand Intelligence and Entity Extraction back on from Settings → Modules to see your real business profile here.',
							'vulopilot'
						)}
					/>
				</CardComponent>
			</ColumnComponent>
		);
	}

	return (
		<>
			<ColumnComponent grid={5} fullHeight>
				<CardComponent
					title={__('Business Information', 'vulopilot')}
					titleIcon="info"
					desc={__('Overall completeness and accuracy.', 'vulopilot')}
					isLoading={isLoading}
				>
					{null === entityScore ? (
						<ModuleGuardComponent
							icon="error"
							title={__('Brand Intelligence is off', 'vulopilot')}
							desc={__('Turn it back on to see a real score here.', 'vulopilot')}
						/>
					) : (
						<div className="business-score-gauge">
							<ChartComponent
								type="ring"
								height={200}
								color={
									COLOR_PALETTE[
									ratingColor(entityScore) as keyof typeof COLOR_PALETTE
									]
								}
								// Same `TypographyComponent` h1/h4 centerLabel shape every other
								// real score ring in this plugin uses
								// (OverallScoreWidget.tsx/SeoTab.tsx/ GeoScoreSection.tsx/etc.).
								centerLabel={
									<>
										<TypographyComponent
											variant={'h1'}
											color={ratingColor(entityScore)}
										>
											{entityScore}
										</TypographyComponent>
										<TypographyComponent variant={'h4'}>
											{getRating(entityScore)}
										</TypographyComponent>
									</>
								}
								data={[
									{
										label: __('Score', 'vulopilot'),
										value: entityScore,
										// Same real rating color the ring's own label above
										// already uses (`ratingColor()`/`getRating()`).
										color: COLOR_PALETTE[
											ratingColor(entityScore) as keyof typeof COLOR_PALETTE
										],
									},
									{
										label: __('Remaining', 'vulopilot'),
										value: 100 - entityScore,
										color: '#e5e7eb',
									},
								]}
							/>
							<div className="desc">
								{missingCount > 0
									? sprintf(
										/* translators: %d is how many of the 7 real profile fields below have no real data yet. */
										_n(
											'Your business information is mostly complete, but %d important detail is missing.',
											'Your business information is mostly complete, but %d important details are missing.',
											missingCount,
											'vulopilot'
										),
										missingCount
									)
									: __('Your business information is fully filled in.', 'vulopilot')}
							</div>
						</div>
					)}
					{KnowledgeGraphVisualizationCard ? (
						<KnowledgeGraphVisualizationCard />
					) : (
						entities && <KnowledgeGraphDiagram entities={entities} />
					)}
				</CardComponent>
			</ColumnComponent>

			<ColumnComponent grid={7} fullHeight>
				<CardComponent
					title={__('Key Information Found by AI', 'vulopilot')}
					titleIcon="module"
					desc={__(
						'Here’s what we found about your business and what needs attention.',
						'vulopilot'
					)}
					isLoading={isLoading}
					action={
						<ButtonInput
							buttons={{
								text: __('Add custom schema', 'vulopilot'),
								icon: 'plus',
								onClick: () => setIsCustomSchemaProPopupOpen(true),
							}}
						/>
					}
				>
					{null === entities ? (
						<ModuleGuardComponent
							icon="error"
							title={__('Entity Extraction is off', 'vulopilot')}
							desc={__('Turn it back on to see real detected fields here.', 'vulopilot')}
						/>
					) : (
						<ListComponent
							className="mini-card report business-profile-list"
							items={visibleRows.map((row) => ({
								id: row.key,
								icon: ROW_ICON[row.key],
								title: row.label,
								desc: row.value,
								tags: (
									<div className="business-profile-list-tags">
										{'n/a' !== row.confidence && (
											<span className={`admin-badge ${row.notApplicable ? 'info' : row.found ? 'green' : 'red'}`}>
												{CONFIDENCE_LABEL[row.confidence]}
											</span>
										)}

										{row.notApplicable ? (
											<span className="business-profile-na">-</span>
										) : 'business_name' === row.key ? (
											<ButtonInput
												buttons={{
													text: __('View', 'vulopilot'),
													color: 'text-blue',
													icon: 'eye',
													onClick: () => setIsNamePanelOpen(true),
												}}
											/>
										) : 'products' === row.key && row.found ? (
											<ButtonInput
												buttons={{
													text: __('View', 'vulopilot'),
													color: 'text-blue',
													icon: 'eye',
													onClick: () => setIsProductsPanelOpen(true),
												}}
											/>
										) : 'people' === row.key && row.found ? (
											<ButtonInput
												buttons={{
													text: __('View', 'vulopilot'),
													color: 'text-blue',
													icon: 'eye',
													onClick: () => setIsPeopleDropdownOpen(true),
												}}
											/>
										) : 'categories' === row.key && row.found ? (
											<ButtonInput
												buttons={{
													text: __('View', 'vulopilot'),
													icon: 'eye',
													color: 'text-blue',
													onClick: () => setIsCategoriesPopupOpen(true),
												}}
											/>
										) : 'contact_details' === row.key ? (
											// Always "View" (never "Add Details") regardless of
											// `row.found`.
											entities.contact_email.edit_url && (
												<ButtonInput
													buttons={{
														text: __('View', 'vulopilot'),
														color: 'text-blue',
														icon: 'eye',
														onClick: () =>
															window.open(
																entities.contact_email.edit_url as string,
																'_self'
															),
													}}
												/>
											)
										) : (
											<ButtonInput
												buttons={{
													text: row.found
														? __('View', 'vulopilot')
														: __('Add Details', 'vulopilot'),
													icon: row.found
														? __('eye', 'vulopilot')
														: __('plus', 'vulopilot'),
													// Was 'text-purple', which rendered darker than the explicit branches above (all 'text-blue').
													color: 'text-blue',
													onClick: () =>
														window.open(ENTITY_SETTINGS_URL, '_self'),
												}}
											/>
										)}
									</div>
								),
							}))}
						/>
					)}
				</CardComponent>
				<PopupComponent
					open={isPeopleDropdownOpen}
					onClose={() => setIsPeopleDropdownOpen(false)}
					width={28}
					height={"65%"}
					header={{
						title: __('People', 'vulopilot'),
						description: __(
							'Every real Administrator and post author detected on your site.',
							'vulopilot'
						),
					}}
				>

					{entities && 0 === entities.people.length ? (
						<p className="desc">
							{__('No people detected yet.', 'vulopilot')}
						</p>
					) : (
						<ListComponent
							className="mini-card report"
							items={
								entities?.people.map((person) => {

									const editUrl =
										'string' === typeof person.meta?.edit_url
											? person.meta.edit_url
											: null;

									return {
										id: String(person.id),
										title: person.name,
										icon: 'person green',
										tags: (
											<>
												{editUrl && (
													<ButtonInput
														buttons={{
															text: __('Edit', 'vulopilot'),
															rightIcon: 'edit',
															color: 'text-purple',
															onClick: () =>
																window.open(editUrl, '_self'),
														}}
													/>
												)}
											</>
										),
									};
								}) || []
							}
						/>
					)}
				</PopupComponent>
				<PopupComponent
					open={isCategoriesPopupOpen}
					onClose={() => setIsCategoriesPopupOpen(false)}
					width={28}
					height={"65%"}
					header={{
						title: __('Categories', 'vulopilot'),
						description: __(
							'Every real category (and product category, when WooCommerce is active) detected on your site.',
							'vulopilot'
						),
					}}
				>

					{entities && 0 === entities.categories.length ? (
						<p className="desc">
							{__('No categories detected yet.', 'vulopilot')}
						</p>
					) : (
						<ListComponent
							className="mini-card report"
							items={
								entities?.categories.map((category) => {
									const editUrl =
										'string' === typeof category.meta?.edit_url
											? category.meta.edit_url
											: null;

									return {
										id: String(category.id),
										title: category.name,
										tags: (
											<>
												{editUrl && (
													<ButtonInput
														buttons={{
															text: __('Edit', 'vulopilot'),
															rightIcon: 'edit',
															color: 'text-purple',
															onClick: () => window.open(editUrl, '_self'),
														}}
													/>
												)}
											</>
										),
									};
								}) || []
							}
						/>
					)}
				</PopupComponent>
				<BusinessNameDetailsPanel
					open={isNamePanelOpen}
					onClose={() => setIsNamePanelOpen(false)}
				/>
				<ProductDetailsPanel
					open={isProductsPanelOpen}
					onClose={() => setIsProductsPanelOpen(false)}
				/>
				<PopupComponent
					open={isCustomSchemaProPopupOpen}
					onClose={() => setIsCustomSchemaProPopupOpen(false)}
					width={31.25}
					height="auto"
					position="lightbox"
				>
					<ShowProPopup />
				</PopupComponent>
			</ColumnComponent>
		</>
	);
};

export default BusinessProfileCard;
