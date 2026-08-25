/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ChartComponent, ColumnComponent, ModuleGuardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import type { EntitiesResponse } from './KnowledgeGraphSection';
import { ENTITY_SETTINGS_URL } from './KnowledgeGraphSection';

const isBrandModuleActive = () =>
	appLocalizer.active_modules?.includes('brand-intelligence') ?? false;

const isEntityExtractionModuleActive = () =>
	appLocalizer.active_modules?.includes('entity-extraction') ?? false;

/**
 * Understanding-language labels for the real `entity_score` gauge —
 * BusinessUnderstandingCard.tsx's own former "Good"/"Needs Work"/"Poor"
 * labels, renamed to match the reference mockup's own "Mostly understood"
 * phrasing (same real 0-100 score, same real thresholds otherwise — only
 * a >=90 "Fully understood" tier is new, since the mockup's own single
 * real example (76) only ever showed the >=70 tier and never a perfect
 * score to infer that top tier's own real wording from).
 */
const getRating = (score: number): string => {
	if (score >= 90) {
		return __('Fully understood', 'vulopilot');
	}
	if (score >= 70) {
		return __('Mostly understood', 'vulopilot');
	}
	if (score >= 40) {
		return __('Partially understood', 'vulopilot');
	}
	return __('Poorly understood', 'vulopilot');
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

interface ProfileRow {
	key: string;
	label: string;
	found: boolean;
	/** True only for Products with no WooCommerce active — a real "doesn't apply to this site" state, told apart from `found: false` (a real, fixable gap) so the gauge's own "N details missing" caption below doesn't count a row nobody can actually fill in. */
	notApplicable?: boolean;
	value: string;
	confidence: 'high' | 'medium' | 'n/a';
}

/**
 * Real "confidence" a site owner should place in each row, disclosed here
 * rather than left implicit:
 * - Business name: always "high" — Services\EntityExtractor::extract_organizations()
 *   always returns a real value (the site's own title, at minimum).
 * - Business type: "high" once set — a real, owner-typed value (Settings →
 *   Scanning → AI Visibility), never guessed.
 * - People: "medium" — real, but auto-detected from post authorship, not
 *   an explicit "these are our team" declaration.
 * - Services/Locations: "high" once set — real, owner-curated lists
 *   (same settings tab), a deliberate confirmation, not an inference.
 * - Products: "medium" — real WooCommerce data, but auto-detected, not
 *   explicitly confirmed as public-facing "what we sell" copy.
 * - Contact details: "high" — a real, deterministic published-page check
 *   (Services\EntityExtractor::find_contact_page()).
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
			key: 'people',
			label: __('People', 'vulopilot'),
			found: entities.people.length > 0,
			value:
				entities.people.length > 0
					? sprintf(
							_n('%d person', '%d people', entities.people.length, 'vulopilot'),
							entities.people.length
						)
					: __('Not found', 'vulopilot'),
			confidence: entities.people.length > 0 ? 'medium' : 'n/a',
		},
		{
			key: 'services',
			label: __('Services', 'vulopilot'),
			found: entities.services.length > 0,
			value:
				entities.services.length > 0
					? sprintf(
							_n('%d service', '%d services', entities.services.length, 'vulopilot'),
							entities.services.length
						)
					: __('Not found', 'vulopilot'),
			confidence: entities.services.length > 0 ? 'high' : 'n/a',
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
								_n('%d product', '%d products', entities.products.length, 'vulopilot'),
								entities.products.length
							)
						: __('Not found', 'vulopilot'),
			confidence: null !== entities.products && entities.products.length > 0 ? 'medium' : 'n/a',
		},
		{
			key: 'locations',
			label: __('Locations', 'vulopilot'),
			found: entities.locations.length > 0,
			value:
				entities.locations.length > 0
					? sprintf(
							_n('%d location', '%d locations', entities.locations.length, 'vulopilot'),
							entities.locations.length
						)
					: __('Not found', 'vulopilot'),
			confidence: entities.locations.length > 0 ? 'high' : 'n/a',
		},
		{
			key: 'contact_details',
			label: __('Contact details', 'vulopilot'),
			found: entities.has_contact_page,
			value: entities.has_contact_page
				? __('Found', 'vulopilot')
				: __('Not found', 'vulopilot'),
			confidence: entities.has_contact_page ? 'high' : 'n/a',
		},
	];
};

const CONFIDENCE_LABEL: Record<ProfileRow['confidence'], string> = {
	high: __('High', 'vulopilot'),
	medium: __('Medium', 'vulopilot'),
	'n/a': '—',
};

/**
 * "Business Profile" — replaces the former, narrower
 * `BusinessUnderstandingCard.tsx` (a score gauge alone) with the reference
 * mockup's own wider 3-up layout: the same real `entity_score` gauge
 * (`GET /brand-intelligence/score`, unchanged), a real per-field table of
 * what Services\EntityExtractor actually found (`GET /entities`, the same
 * real endpoint KnowledgeGraphSection.tsx already uses), and a real "Update
 * Information" deep link to where every owner-curated field on that table
 * (`entity_business_type`/`entity_service_pages`/`entity_business_locations`)
 * actually lives. Nothing here is fabricated — a "Not found" row is a real
 * absence of data, not a placeholder; see `buildRows()`'s own docblock for
 * exactly what each row's "confidence" is based on.
 */
const BusinessProfileCard = () => {
	const [entityScore, setEntityScore] = useState<number | null>(null);
	const [entities, setEntities] = useState<EntitiesResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const requests: Promise<unknown>[] = [];

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

		if (isEntityExtractionModuleActive()) {
			requests.push(
				getApiResponse<EntitiesResponse>(getApiLink(appLocalizer, 'entities'), {
					headers: { 'X-WP-Nonce': appLocalizer.nonce },
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
	// Excludes `notApplicable` rows (Products with no WooCommerce active) —
	// those aren't a real, fixable gap, so counting them here would
	// overstate how much is actually missing.
	const missingCount = rows.filter((row) => !row.found && !row.notApplicable).length;

	return (
		<ColumnComponent >
			<CardComponent
				title={__('Business Profile', 'vulopilot')}
				titleIcon="info"
				desc={__('What VuloPilot understands about your business.', 'vulopilot')}
				isLoading={isLoading}
			>
				{!isLoading && null === entityScore && null === entities ? (
					<ModuleGuardComponent
						icon="error"
						title={__('Business Identity modules are turned off', 'vulopilot')}
						desc={__(
							'Turn Brand Intelligence and Entity Extraction back on from Settings → Modules to see your real business profile here.',
							'vulopilot'
						)}
					/>
				) : (
					<div className="business-profile-grid">
						<div className="business-profile-gauge-col">
							{null === entityScore ? (
								<ModuleGuardComponent
									icon="error"
									title={__('Brand Intelligence is off', 'vulopilot')}
									desc={__('Turn it back on to see a real score here.', 'vulopilot')}
								/>
							) : (
								<div className="business-score-gauge">
									<ChartComponent
										type="pie"
										height={140}
										centerLabel={
											<>
												<span className="score-ring-number">{entityScore}</span>
												<span className="score-ring-label">/100</span>
											</>
										}
										data={[
											{ label: __('Score', 'vulopilot'), value: entityScore, color: '#16a34a' },
											{ label: __('Remaining', 'vulopilot'), value: 100 - entityScore, color: '#e5e7eb' },
										]}
									/>
									<span className={`business-score-badge ${ratingClass(entityScore)}`}>
										{getRating(entityScore)}
									</span>
									<p className="desc business-score-caption">
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
									</p>
								</div>
							)}
						</div>

						<div className="business-profile-table-col">
							{null === entities ? (
								<ModuleGuardComponent
									icon="error"
									title={__('Entity Extraction is off', 'vulopilot')}
									desc={__('Turn it back on to see real detected fields here.', 'vulopilot')}
								/>
							) : (
								<table className="crawler-table business-profile-table">
									<thead>
										<tr>
											<th>{__('Information', 'vulopilot')}</th>
											<th>{__('VuloPilot Found', 'vulopilot')}</th>
											<th>{__('Confidence', 'vulopilot')}</th>
										</tr>
									</thead>
									<tbody>
										{rows.map((row) => (
											<tr key={row.key}>
												<td>{row.label}</td>
												<td>{row.value}</td>
												<td>
													<span className="business-profile-confidence">
														{CONFIDENCE_LABEL[row.confidence]}
													</span>
													<i
														className={`adminfont-${row.notApplicable ? 'info' : row.found ? 'check' : 'close'} business-profile-status-icon ${row.notApplicable ? '' : row.found ? 'is-good' : 'is-poor'}`}
													/>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>

						<div className="business-profile-side-col">
							<i className="adminfont-security business-profile-side-icon" />
							<p className="desc">
								{__(
									'Clear business information helps AI engines and search engines identify and trust your business.',
									'vulopilot'
								)}
							</p>
							<ButtonInput
								position="full-width"
								buttons={{
									text: __('Update Information', 'vulopilot'),
									onClick: () => {
										window.open(ENTITY_SETTINGS_URL, '_self');
									},
								}}
							/>
						</div>
					</div>
				)}
			</CardComponent>
		</ColumnComponent>
	);
};

export default BusinessProfileCard;
