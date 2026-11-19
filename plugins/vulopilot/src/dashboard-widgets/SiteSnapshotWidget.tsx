/* global vulopilotAppLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import DashboardWidget from './DashboardWidget';
import { useGeoScore } from '../pages/GEO/useGeoScore';
import type { EntitiesResponse, Entity } from '../pages/GEO/SchemaKnowledge/KnowledgeGraphSection';
import { WidgetProps } from './types';

/** Same real gate BusinessProfileCard.tsx's own identical check already uses. */
const isEntityExtractionModuleActive = () =>
	vulopilotAppLocalizer.active_modules?.includes('knowledge-graph') ?? false;

const NOT_SET = '-';
/** `score`/`open_count` are `null` for a signal with no real data to compute from yet. */
const formatScore = (score: number | null): string =>
	null === score
		? NOT_SET
		: sprintf(/* translators: %d: real 0-100 score. */ __('%d/100', 'vulopilot'), score);

const formatCount = (count: number | null): string =>
	null === count ? NOT_SET : String(count);

/** A public site's homepage screenshot from WordPress.com's mShots service. */
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

/** "Site snapshot". */
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

		getApiResponse<EntitiesResponse>(getApiLink(vulopilotAppLocalizer, 'entities'), {
			headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce },
		}).then((response) => {
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

	/** Widget rows organised into six groups. */
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
				title={__('Site profile', 'vulopilot')}
				desc={__("Your site's content, technology, audience and the identity AI engines see.", 'vulopilot')}
				icon="website"
				isLoading={isLoading}
				onHide={onHide}
				isCustomizing={isCustomizing}
			>
				<div className="vp-site">
					<div className="vp-site-preview">
						{previewImage ? (
							<img
								src={previewImage}
								alt={__('Your homepage', 'vulopilot')}
								onError={() => setScreenshotFailed(true)}
							/>
						) : (
							<i className="adminfont-global-community" aria-hidden="true" />
						)}
					</div>
					<div className="vp-site-identity">
						<strong>{vulopilotAppLocalizer.site_title || brandName}</strong>
						<a href={siteUrl} target="_blank" rel="noreferrer">
							{siteUrl.replace(/^https?:\/\//, '')}
							<i className="adminfont-external" aria-hidden="true" />
						</a>
						{vulopilotAppLocalizer.site_description && <p>{vulopilotAppLocalizer.site_description}</p>}
					</div>
				</div>

				<div className="vp-mini-stats is-3">
					<div className="vp-mini-stat">
						<strong>{snapshot.wp_version || NOT_SET}</strong>
						<span>{__('WordPress', 'vulopilot')}</span>
					</div>
					<div className="vp-mini-stat">
						<strong>{snapshot.php_version || NOT_SET}</strong>
						<span>{__('PHP', 'vulopilot')}</span>
					</div>
					<a className="vp-mini-stat" href={vulopilotAppLocalizer.admin_url.replace(/admin\.php.*$/, 'plugins.php')}>
						<strong>{`${snapshot.plugins_active} / ${snapshot.plugins_total}`}</strong>
						<span>{__('Plugins active', 'vulopilot')}</span>
					</a>
				</div>

				<div className="vp-facts">
					{[...sections, ...sections2].map((group) => (
						<section key={group.id} className="vp-facts-group">
							<h4>
								<i className={`adminfont-${group.icon}`} aria-hidden="true" />
								{group.link ? (
									<a href={group.link}>
										{group.title}
										<i className="adminfont-arrow-right" aria-hidden="true" />
									</a>
								) : (
									group.title
								)}
							</h4>
							<dl>
								{group.rows.map((row) => (
									<div key={row.key}>
										<dt>{row.label}</dt>
										<dd>{row.value}</dd>
									</div>
								))}
							</dl>
						</section>
					))}
				</div>
			</DashboardWidget>
		</>
	);
};

export default SiteSnapshotWidget;
