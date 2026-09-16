/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { ListComponent, SectionComponent, CardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useGeoScore } from '../pages/GEO/useGeoScore';
import { useLastScanTime } from '../services/useLastScanTime';
import { formatWpDate } from '../services/formatWpDate';
import type { EntitiesResponse, Entity } from '../pages/GEO/SchemaKnowledge/KnowledgeGraphSection';
import { WidgetProps } from './types';

/** Same real gate BusinessProfileCard.tsx's own identical check already uses — EntityExtractor returns empty groups when this module is inactive, so a real `''`/`[]` here is a genuine "not set" state, not a broken fetch. */
const isEntityExtractionModuleActive = () =>
	appLocalizer.active_modules?.includes('entity-extraction') ?? false;

const NOT_SET = '—';

/** `score`/`open_count` are `null` for a signal with no real data to compute from yet (GeoSignalScore's own docblock) — shown honestly as "—", never a fabricated 0. */
const formatScore = (score: number | null): string =>
	null === score
		? NOT_SET
		: sprintf(/* translators: %d: real 0-100 signal score. */ __('%d/100', 'vulopilot'), score);

const formatCount = (count: number | null): string =>
	null === count ? NOT_SET : String(count);

/**
 * "Site snapshot" — real WordPress core counts (`summary.site_snapshot`,
 * Dashboard controller's own `build_site_snapshot()`), the one section of
 * this payload that isn't derived from scan findings at all: posts, pages,
 * comments, and users are real `wp_count_posts()`/`wp_count_comments()`/
 * `count_users()` results; plugin counts are real `get_plugins()`/
 * `active_plugins` option reads; WP/PHP version are real `get_bloginfo()`/
 * `PHP_VERSION`. `summary` already carries all of that.
 *
 * The Brand/Entity/GEO rows below it are this widget's own real fetches
 * (`GET /entities` — same real EntityExtractor endpoint BusinessProfileCard.tsx
 * uses, gated on the same `entity-extraction` module; `GET /geo/score` via
 * the shared `useGeoScore()` hook GeoScoreSection.tsx already uses, which
 * works regardless of module state) rather than `summary` — the shared
 * `/dashboard` payload has no brand/entity/GEO-signal fields of its own.
 * "Expertise signals" reads the real `other-geo-signals` bucket (E-E-A-T/
 * author-info/trust-signals — Geo.php's own `SIGNAL_SCANNER_IDS`),
 * "Entity confidence" the real `entity-clarity` signal, "Citation
 * opportunities" the real open-finding count for the `evidence-citations`
 * signal (`geo-citation-opportunities` scanner), and "Content gaps" the
 * same real count for `question-coverage` (`geo-faq-opportunity`) — every
 * value here is a genuine existing scanner/setting, not a second,
 * invented metric.
 */
const SiteSnapshotWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading,
	onHide,
	isCustomizing,
}) => {
	const snapshot = summary.site_snapshot;

	const [entities, setEntities] = useState<EntitiesResponse | null>(null);

	useEffect(() => {
		if (!isEntityExtractionModuleActive()) {
			return;
		}

		getApiResponse<EntitiesResponse>(getApiLink(appLocalizer, 'entities'), {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		}).then((response: EntitiesResponse | undefined) => {
			if (response) {
				setEntities(response);
			}
		});
	}, []);

	const { score: geoScore } = useGeoScore();

	// Real most recent completed scan, site-wide (same source
	// RunScanHeaderExtra's own "Last scan" caption already reads) — the
	// "Last updated" badge in the mockup header, not a fabricated
	// page-generation timestamp this payload has no field for.
	const { lastScanAt } = useLastScanTime();

	const brandName = entities?.organizations[0]?.name || NOT_SET;
	const entityType = entities?.business_type || NOT_SET;
	const primaryTopics =
		entities && entities.services.length > 0
			? entities.services.map((service: Entity) => service.name).join(', ')
			: NOT_SET;

	/**
	 * Same rows the widget always had, just reorganized into the mockup's
	 * six real groupings (Company Details/Content/SEO & Visibility/Users &
	 * Audience/Technology/Products & Services/Additional) instead of two
	 * arbitrary halves — no group here introduces a value that wasn't
	 * already one of this widget's own real fields.
	 */
	const groups: {
		id: string;
		title: string;
		icon: string;
		rows: { key: string; icon: string; label: string; value: React.ReactNode }[];
	}[] = [
			{
				id: 'company',
				title: __('Company Details', 'vulopilot'),
				icon: 'global-community',
				rows: [
					{
						key: 'brand',
						icon: 'global-community pink',
						label: __('Brand', 'vulopilot'),
						value: brandName,
					},
					{
						key: 'entity',
						icon: 'module indigo',
						label: __('Entity', 'vulopilot'),
						value: entityType,
					},
					{
						key: 'entity-organizations',
						icon: 'global-community pink',
						label: __('Organizations', 'vulopilot'),
						value: entities ? entities.organizations.length : NOT_SET,
					},
					{
						key: 'entity-locations',
						icon: 'location red',
						label: __('Locations', 'vulopilot'),
						value: entities ? entities.locations.length : NOT_SET,
					},
					{
						key: 'entity-categories',
						icon: 'category yellow',
						label: __('Categories', 'vulopilot'),
						value: entities ? entities.categories.length : NOT_SET,
					},
				],
			},
			{
				id: 'users',
				title: __('Users & Audience', 'vulopilot'),
				icon: 'person',
				rows: [
					{
						key: 'users',
						icon: 'person green',
						label: __('Users', 'vulopilot'),
						value: snapshot.users,
					},
				],
			},
			{
				id: 'products',
				title: __('Products & Services', 'vulopilot'),
				icon: 'product',
				rows: [
					{
						key: 'entity-products',
						icon: 'product orange',
						label: __('Products', 'vulopilot'),
						value: entities ? (entities.products?.length ?? 0) : NOT_SET,
					},
					{
						key: 'entity-services',
						icon: 'customer-service cyan',
						label: __('Services', 'vulopilot'),
						value: entities ? entities.services.length : NOT_SET,
					},
				],
			},
			{
				id: 'additional',
				title: __('Additional', 'vulopilot'),
				icon: 'person',
				rows: [
					{
						key: 'entity-people',
						icon: 'person blue',
						label: __('People', 'vulopilot'),
						value: entities ? entities.people.length : NOT_SET,
					},
				],
			},
		];
	const groups2: {
		id: string;
		title: string;
		icon: string;
		rows: { key: string; icon: string; label: string; value: React.ReactNode }[];
	}[] = [
			{
				id: 'content',
				title: __('Content', 'vulopilot'),
				icon: 'editor-list',
				rows: [
					{
						key: 'posts',
						icon: 'editor-list blue',
						label: __('Posts', 'vulopilot'),
						value: snapshot.posts,
					},
					{
						key: 'pages',
						icon: 'document purple',
						label: __('Pages', 'vulopilot'),
						value: snapshot.pages,
					},
					{
						key: 'comments',
						icon: 'submission-message teal',
						label: __('Comments', 'vulopilot'),
						value: snapshot.comments,
					},
				],
			},
			{
				id: 'technology',
				title: __('Technology', 'vulopilot'),
				icon: 'coding',
				rows: [
					{
						key: 'plugins',
						icon: 'module orange',
						label: __('Plugins', 'vulopilot'),
						value: sprintf(
							/* translators: 1: active plugin count, 2: total installed plugin count. */
							__('%1$d / %2$d active', 'vulopilot'),
							snapshot.plugins_active,
							snapshot.plugins_total
						),
					},
					{
						key: 'wp-version',
						icon: 'wordpress blue',
						label: __('WordPress', 'vulopilot'),
						value: snapshot.wp_version || '—',
					},
					{
						key: 'php-version',
						icon: 'coding purple',
						label: __('PHP', 'vulopilot'),
						value: snapshot.php_version || '—',
					},
				],
			},
			{
				id: 'seo',
				title: __('SEO & Visibility', 'vulopilot'),
				icon: 'search-discovery',
				rows: [
					{
						key: 'primary-topics',
						icon: 'customer-service cyan',
						label: __('Primary topics', 'vulopilot'),
						value: primaryTopics,
					},
					{
						key: 'expertise-signals',
						icon: 'module violet',
						label: __('Expertise signals', 'vulopilot'),
						value: formatScore(geoScore?.signals['other-geo-signals'].score ?? null),
					},
					{
						key: 'entity-confidence',
						icon: 'security green',
						label: __('Entity confidence', 'vulopilot'),
						value: formatScore(geoScore?.signals['entity-clarity'].score ?? null),
					},
					{
						key: 'citation-opportunities',
						icon: 'report orange',
						label: __('Citation opportunities', 'vulopilot'),
						value: formatCount(geoScore?.signals['evidence-citations'].open_count ?? null),
					},
					{
						key: 'content-gaps',
						icon: 'question yellow',
						label: __('Content gaps', 'vulopilot'),
						value: formatCount(geoScore?.signals['question-coverage'].open_count ?? null),
					},
				],
			},
			
		];

	return (
		<CardComponent
			title={__('Site snapshot', 'vulopilot')}
			desc={__('Which of your automations are enabled and running.', 'vulopilot')}
			icon="info"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			<>
				<div className='group-wrapper'>
					<div className="group">
						{groups.map((group) => (
							<div key={group.id} className="site-snapshot-group-card">
								<SectionComponent
									title={group.title}
									icon={group.icon}
								/>
								<ListComponent
									className="mini-card report without-border site-snapshot-list"
									items={group.rows.map((row) => ({
										id: row.key,
										icon: row.icon,
										title: row.label,
										tags: (
											<>
												<span className="desc">
													{row.value}
												</span>
											</>
										),
									}))}
								/>
							</div>
						))}
					</div>
					<div className="group">
						{groups2.map((group) => (
							<div key={group.id} className="site-snapshot-group-card">
								<SectionComponent
									title={group.title}
									icon={group.icon}
								/>
								<ListComponent
									className="mini-card report without-border site-snapshot-list"
									items={group.rows.map((row) => ({
										id: row.key,
										icon: row.icon,
										title: row.label,
										tags: (
											<>
												<span className="desc">
													{row.value}
												</span>
											</>
										),
									}))}
								/>
							</div>
						))}
					</div>
				</div>
			</>
		</CardComponent>
	);
};

export default SiteSnapshotWidget;
