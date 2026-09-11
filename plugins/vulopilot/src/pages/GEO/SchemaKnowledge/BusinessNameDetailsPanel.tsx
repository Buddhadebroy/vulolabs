/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { BadgeComponent, PopupComponent, SkeletonComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { ENTITY_SETTINGS_URL } from './KnowledgeGraphSection';

interface BusinessNameSource {
	key: string;
	label: string;
	value: string | null;
	found: boolean;
}

interface BusinessNameSourcesResponse {
	business_name: string;
	confidence: 'high' | 'medium' | 'n/a';
	sources: BusinessNameSource[];
	sources_checked: number;
	is_consistent: boolean;
	consistent_count: number;
}

/** Real per-source icon — same convention every other per-row icon in this tab already uses (a name string, e.g. `SIGNAL_META`'s own `icon` field). */
const SOURCE_ICON: Record<string, string> = {
	homepage: 'home',
	website_title: 'document',
	organization_schema: 'shortcode',
	about_page: 'document',
};

/**
 * "Business Name Details" — the reference mockup's own slide-in panel for
 * `BusinessProfileCard.tsx`'s "Business name" row, backed by the real
 * `GET /entities/business-name-sources` cross-check
 * (`EntityExtractor::get_business_name_sources()`'s own docblock has the
 * full "what counts as a real source" design). Every other row on that
 * card (People/Services/Locations/…) still only has the one real value +
 * confidence EntityExtractor already reports — there's no equivalent
 * real multi-source cross-check for those yet, so this panel is
 * deliberately Business-name-specific rather than a generic "details for
 * any row" panel that would have to fabricate the same breadth for
 * fields that don't have it.
 */
const BusinessNameDetailsPanel = ({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) => {
	const [data, setData] = useState<BusinessNameSourcesResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const load = (refresh = false) => {
		setIsLoading(true);
		getApiResponse<BusinessNameSourcesResponse>(
			`${getApiLink(appLocalizer, 'entities/business-name-sources')}${refresh ? '?refresh=1' : ''}`,
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => response && setData(response))
			.finally(() => setIsLoading(false));
	};

	useEffect(() => {
		if (open) {
			load();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	return (
		<PopupComponent
			open={open}
			onClose={onClose}
			width={35}
			header={{
				title: __('Business Name Details', 'vulopilot'),
				description: __(
					'See what we found, where we found it, and whether it’s consistent.',
					'vulopilot'
				),
			}}
			footer={
				<ButtonInput
					buttons={[
						{
							text: __('View Source/Evidence', 'vulopilot'),
							icon: 'external',
							color: 'border-purple',
							onClick: () => window.open(appLocalizer.site_url, '_blank'),
						},
						{
							text: __('Edit Business Information', 'vulopilot'),
							icon: 'edit',
							onClick: () => window.open(ENTITY_SETTINGS_URL, '_self'),
						},
					]}
				/>
			}
		>
			{isLoading || !data ? (
				<>
					<SkeletonComponent width="100%" height={4} />
					<SkeletonComponent width="100%" height={10} />
					<SkeletonComponent width="100%" height={8} />
				</>
			) : (
				<div className="business-name-panel">
					<div className="business-name-panel-summary">
						<div className="business-name-panel-summary-left">
							<i className="adminfont-storefront business-name-panel-summary-icon" />
							<div>
								<div className="business-name-panel-summary-label">
									{__('Business name', 'vulopilot')}
								</div>
								<div className="business-name-panel-summary-value">
									{data.business_name || __('Not found', 'vulopilot')}
								</div>
							</div>
						</div>
						{'high' === data.confidence && (
							<div className="business-name-panel-summary-right">
								<BadgeComponent
									color="green"
									icon="check"
									text={__('High confidence', 'vulopilot')}
								/>
								<p className="desc">
									{__(
										'We are confident this is your business name.',
										'vulopilot'
									)}
								</p>
							</div>
						)}
					</div>

					<div className="business-name-panel-section">
						<h4>
							{__('What we found', 'vulopilot')}
							<i className="adminfont-info" />
						</h4>
						<p className="desc">
							{sprintf(
								/* translators: %s: the real business name VuloPilot resolved. */
								__(
									'VuloPilot identified "%s" as your business name from multiple sources across your website.',
									'vulopilot'
								),
								data.business_name
							)}
						</p>
					</div>

					<div className="business-name-panel-section">
						<h4>
							{__('Found on', 'vulopilot')}
							<BadgeComponent
								color=""
								text={sprintf(
									/* translators: %d: how many real sources were checked. */
									__('%d sources checked', 'vulopilot'),
									data.sources_checked
								)}
							/>
						</h4>
						<div className="business-name-panel-sources">
							{data.sources.map((source: BusinessNameSource) => (
								<div key={source.key} className="business-name-panel-source-row">
									<i className={`adminfont-${SOURCE_ICON[source.key] ?? 'document'}`} />
									<span className="business-name-panel-source-label">
										{source.label}
									</span>
									<span className="business-name-panel-source-value">
										{source.found
											? source.value
											: __('Not found', 'vulopilot')}
									</span>
									<i
										className={`adminfont-${source.found ? 'check' : 'setting'} business-name-panel-source-status ${source.found ? 'is-good' : 'is-muted'}`}
									/>
								</div>
							))}
						</div>
					</div>

					<div className="business-name-panel-section">
						<h4>
							{__('Consistency', 'vulopilot')}
							<BadgeComponent
								color={data.is_consistent ? 'green' : 'red'}
								icon="check"
								text={
									data.is_consistent
										? __('Consistent', 'vulopilot')
										: __('Inconsistent', 'vulopilot')
								}
							/>
						</h4>
						<p className="desc">
							{data.is_consistent
								? sprintf(
										/* translators: %d: how many real sources agree on the same business name. */
										__('%d sources use the same business name.', 'vulopilot'),
										data.consistent_count
									)
								: __(
										'These real sources don’t all agree on your business name — update them to match.',
										'vulopilot'
									)}
						</p>
					</div>

					<div className="business-name-panel-tip">
						<i className="adminfont-info" />
						<div>
							<strong>{__('Why this matters?', 'vulopilot')}</strong>
							<p className="desc">
								{__(
									'Consistent business information helps Google and AI tools understand and identify your business correctly.',
									'vulopilot'
								)}
							</p>
						</div>
					</div>

					<div className="business-name-panel-recommendation">
						<i className="adminfont-setting" />
						<div>
							<strong>{__('Recommendation', 'vulopilot')}</strong>
							<p className="desc">
								{data.is_consistent
									? __(
											'No changes needed. Your business name is consistent across the sources we checked.',
											'vulopilot'
										)
									: __(
											'Update your business name so every real source above matches.',
											'vulopilot'
										)}
							</p>
						</div>
					</div>
				</div>
			)}
		</PopupComponent>
	);
};

export default BusinessNameDetailsPanel;
