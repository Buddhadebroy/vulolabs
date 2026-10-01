/* global vulopilotAppLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { AnalyticsComponent, ListComponent, CardComponent, TypographyComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import AutomationStatusWidget from './AutomationStatusWidget';
import { useGeoScore } from '../pages/GEO/useGeoScore';
import type { EntitiesResponse, Entity } from '../pages/GEO/SchemaKnowledge/KnowledgeGraphSection';
import { WidgetProps } from './types';

/** Same real gate BusinessProfileCard.tsx's own identical check already uses. */
const isEntityExtractionModuleActive = () =>
	vulopilotAppLocalizer.active_modules?.includes('knowledge-graph') ?? false;

const NOT_SET = '-';
/** `score`/`open_count` are `null` for a signal with no real data to compute from yet (GeoSignalScore's own docblock). */
const formatScore = (score: number | null): string =>
	null === score
		? NOT_SET
		: sprintf(/* translators: %d: real 0-100 score. */ __('%d/100', 'vulopilot'), score);

const formatCount = (count: number | null): string =>
	null === count ? NOT_SET : String(count);

/**
 * A public site's homepage screenshot from WordPress.com's mShots service (the same one WP.org
 * uses for plugin/theme previews).
 */
const getHomeScreenshotUrl = (siteUrl: string): string => {
	try {
		const { hostname } = new URL(siteUrl);
		const isPrivate =
			'localhost' === hostname ||
			/\.(local|localhost|test|invalid|example)$/i.test(hostname) ||
			/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname) ||
			!hostname.includes('.');

		return isPrivate
			? ''
			: `https://s0.wp.com/mshots/v1/${encodeURIComponent(siteUrl)}?w=560&h=350`;
	} catch {
		return '';
	}
};

/**
 * "Site snapshot" - real WordPress core counts (`summary.site_snapshot`, Dashboard controller's
 * own `build_site_snapshot()`).
 */
const SiteSnapshotWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading,
	onHide,
	isCustomizing,
	onRefreshSummary,
}) => {
	const snapshot = summary.site_snapshot;

	const [entities, setEntities] = useState<EntitiesResponse | null>(null);

	useEffect(() => {
		if (!isEntityExtractionModuleActive()) {
			return;
		}

		getApiResponse<EntitiesResponse>(getApiLink(vulopilotAppLocalizer, 'entities'), {
			headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce },
		}).then((response: EntitiesResponse | undefined) => {
			if (response) {
				setEntities(response);
			}
		});
	}, []);

	const { score: geoScore } = useGeoScore();

	const brandName = entities?.organizations[0]?.name || NOT_SET;
	const entityType = entities?.business_type || NOT_SET;
	const primaryTopics =
		entities && entities.services.length > 0
			? entities.services.map((service: Entity) => service.name).join(', ')
			: NOT_SET;

	/**
	 * Widget rows organised into six groups (Company Details, Content, SEO & Visibility, Users &
	 * Audience, Technology, Products & Services).
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
						value: snapshot.wp_version || '-',
					},
					{
						key: 'php-version',
						icon: 'coding purple',
						label: __('PHP', 'vulopilot'),
						value: snapshot.php_version || '-',
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

	const byId = Object.fromEntries(
		[...groups, ...groups2].map((group) => [group.id, group])
	);

	/** Mockup order, two per row - each header's arrow jumps to that area's real page. */
	const sections = [
		{ ...byId.content, link: '?page=vulopilot#&tab=content' },

		{
			...byId.products,
			title: __('Commerce', 'vulopilot'),
			link: '?page=vulopilot#&tab=commerce',
		},
		{
			...byId.users,
			rows: [...byId.users.rows, ...byId.additional.rows],
			link: null as string | null,
		},
	];
	const sections2 = [
		{ ...byId.seo, link: '?page=vulopilot#&tab=seo-visibility' },
		{
			...byId.company,
			title: __('Organization', 'vulopilot'),
			link: '?page=vulopilot#&tab=settings&subtab=business-information',
		},
	];

	const siteUrl = vulopilotAppLocalizer.site_url as string;
	const screenshotUrl = getHomeScreenshotUrl(siteUrl);
	const [screenshotFailed, setScreenshotFailed] = useState(false);
	const previewImage =
		screenshotUrl && !screenshotFailed
			? screenshotUrl
			: vulopilotAppLocalizer.home_preview_image;

	return (
		<>
			<DashboardWidget
				title={__('Site overview', 'vulopilot')}
				desc={__("Key details about your site's content, technology and audience.", 'vulopilot')}
				icon="global-community"
				isLoading={isLoading}
				onHide={onHide}
				isCustomizing={isCustomizing}
			>
				<div className="site-overview-intro">
					<div className="site-overview-identity-row">
						<div className="site-overview-preview">
							{previewImage ? (
								<img
									src={previewImage}
									alt={__('Your homepage', 'vulopilot')}
									onError={() => setScreenshotFailed(true)}
								/>
							) : (
								<i className="adminfont-global-community site-overview-preview-empty" />
							)}
						</div>
						<div className="site-overview-identity">
							<TypographyComponent variant="h4">
								{vulopilotAppLocalizer.site_title || brandName}
							</TypographyComponent>
							<a href={siteUrl} target="_blank" rel="noreferrer" className="site-overview-url">
								<TypographyComponent variant="desc" color="purple">
									{siteUrl.replace(/^https?:\/\//, '')}
								</TypographyComponent>
								<i className='adminfont-external'/>
							</a>
							{vulopilotAppLocalizer.site_description && (
								<div className="desc">{vulopilotAppLocalizer.site_description}</div>
							)}
							
						</div>
					</div>
					<AnalyticsComponent
						variant="small"
						cols={3}
						data={[
							{ icon: 'wordpress blue', number: snapshot.wp_version || NOT_SET, text: __('WordPress', 'vulopilot') },
							{ icon: 'coding purple', number: snapshot.php_version || NOT_SET, text: __('PHP', 'vulopilot') },
							{
								icon: 'module orange',
								number: `${snapshot.plugins_active} / ${snapshot.plugins_total}`,
								text: __('Plugins active', 'vulopilot'),
							},
						]}
					/>
				</div>
				<div className="site-overview-groups">
					<div className="group">
						{sections.map((group) => (
							<div key={group.id} className={`site-snapshot-group-card is-${group.id}`}>
								<CardComponent
									title={group.title}
									icon={group.icon}
								>
									<ListComponent
										className="mini-card report without-border site-snapshot-list"
										items={group.rows.map((row) => ({
											id: row.key,
											icon: row.icon,
											title: row.label,
											tags: <span className="desc">{row.value}</span>,
										}))}
									/>
								</CardComponent>
							</div>

						))}
					</div>
					<div className="group">
						{sections2.map((group) => (
							<div key={group.id} className={`site-snapshot-group-card is-${group.id}`}>
								<CardComponent
									title={group.title}
									icon={group.icon}
								>
									<ListComponent
										className="mini-card report without-border site-snapshot-list"
										items={group.rows.map((row) => ({
											id: row.key,
											icon: row.icon,
											title: row.label,
											tags: <span className="desc">{row.value}</span>,
										}))}
									/>
								</CardComponent>
							</div>
						))}
					</div>
				</div>
			</DashboardWidget>
			<AutomationStatusWidget
				summary={summary}
				isLoading={isLoading}
				onHide={onHide}
				isCustomizing={isCustomizing}
				onRefreshSummary={onRefreshSummary}
			/>
		</>
	);
};

export default SiteSnapshotWidget;
