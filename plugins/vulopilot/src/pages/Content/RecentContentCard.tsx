/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, NoticeManager } from '@zyra/components';

/**
 * `GenerateLandingPageAction::META_KEY`'s literal string — this plugin has
 * no localization pipeline exposing PHP action constants to this page's
 * JS bundle (`PostEditorAssets` only does that for the block editor
 * sidebar), so it's duplicated here as a plain string rather than adding
 * a whole new mechanism for one value. Must stay in sync with that
 * class's own `META_KEY` constant.
 */
const LANDING_PAGE_META_KEY = '_vulopilot_landing_page';

type ContentCategory = 'blog-post' | 'landing-page' | 'product' | 'other';
type Tab = 'all' | ContentCategory;

interface ContentRow {
	id: number;
	category: ContentCategory;
	title: string;
	status: string;
	date: string;
	wordCount: number;
	editLink: string;
	viewLink: string | null;
}

interface WpRestPost {
	id: number;
	title: { rendered: string };
	content: { rendered: string };
	status: string;
	date: string;
	link: string;
	meta?: Record<string, unknown>;
}

interface WcRestProduct {
	id: number;
	name: string;
	description: string;
	status: string;
	date_created: string;
	permalink: string;
}

const CATEGORY_LABELS: Record<ContentCategory, string> = {
	'blog-post': __('Blog Post', 'vulopilot'),
	'landing-page': __('Landing Page', 'vulopilot'),
	product: __('Product Description', 'vulopilot'),
	other: __('Page', 'vulopilot'),
};

const CATEGORY_ICONS: Record<ContentCategory, string> = {
	'blog-post': 'document',
	'landing-page': 'web-page-website',
	product: 'cart',
	other: 'document',
};

const CATEGORY_ICON_COLORS: Record<ContentCategory, string> = {
	'blog-post': 'blue',
	'landing-page': 'green',
	product: 'orange',
	other: 'grey',
};

const TABS: { id: Tab; label: string }[] = [
	{ id: 'all', label: __('All', 'vulopilot') },
	{ id: 'blog-post', label: __('Blog Posts', 'vulopilot') },
	{ id: 'landing-page', label: __('Landing Pages', 'vulopilot') },
	{ id: 'product', label: __('Products', 'vulopilot') },
	{ id: 'other', label: __('Other', 'vulopilot') },
];

/**
 * Real word count from real rendered HTML — the only honest way to show
 * "2,450 words" without a dedicated word-count column anywhere in this
 * schema (same reasoning ContentStatsCard.tsx's own docblock gives for
 * why "Words Generated" stays an honest "Not tracked yet" instead:
 * unlike that stat, which would need every historical generation summed,
 * a single row's word count is fully derivable right now from its own
 * real content).
 */
const countWords = (html: string): number => {
	const text = html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&[a-z0-9#]+;/gi, ' ')
		.trim();

	return text ? text.split(/\s+/).length : 0;
};

const timeAgo = (dateString: string): string => {
	const seconds = Math.max(
		0,
		Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
	);

	if (seconds < 60) {
		return __('just now', 'vulopilot');
	}
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
};

/**
 * "Recent Content" — real `wp/v2/posts`/`pages` + `wc/v3/products` data
 * (zero new backend needed for the list itself), categorized into 4 real
 * buckets: `post` → Blog Post; `product` → Product Description; a `page`
 * carrying the real `_vulopilot_landing_page` meta GenerateLandingPageAction
 * now sets on every page it creates → Landing Page; any other `page` →
 * the honest fallback "Other" (an "About Us"/"Contact" page has the
 * identical post_type to a landing page — this meta flag is the only
 * real signal telling them apart, see GenerateLandingPageAction's own
 * docblock). Word counts are computed client-side from each item's real
 * rendered content. Each row's kebab menu (Edit/View/Delete) is fully
 * real: Edit/View are real WP edit-screen/permalink links, Delete is a
 * real `DELETE` against the same REST route the row was read from
 * (trashes, recoverable — WP/WooCommerce's own default), removing the
 * row locally on success rather than a full refetch.
 */
const RecentContentCard = () => {
	const [rows, setRows] = useState<ContentRow[]>([]);
	const [activeTab, setActiveTab] = useState<Tab>('all');
	const [isLoading, setIsLoading] = useState(true);
	const [openMenuId, setOpenMenuId] = useState<number | null>(null);
	const [deletingId, setDeletingId] = useState<number | null>(null);

	useEffect(() => {
		if (null === openMenuId) {
			return;
		}

		const closeMenu = (event: MouseEvent) => {
			if (
				!(event.target as HTMLElement).closest(
					'.recent-content-row-menu'
				)
			) {
				setOpenMenuId(null);
			}
		};

		document.addEventListener('click', closeMenu);

		return () => document.removeEventListener('click', closeMenu);
	}, [openMenuId]);

	useEffect(() => {
		const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

		const fetchPosts = (endpoint: 'posts' | 'pages') =>
			getApiResponse<WpRestPost[]>(
				getApiLink(
					appLocalizer,
					`${endpoint}?per_page=10&orderby=date&order=desc&_fields=id,title,content,status,date,link,meta`,
					'wp/v2'
				),
				nonceHeaders
			)
				.then((response) =>
					(response || []).map((post): ContentRow => {
						const isLandingPage =
							'pages' === endpoint &&
							true ===
								post.meta?.[LANDING_PAGE_META_KEY];

						return {
							id: post.id,
							category: isLandingPage
								? 'landing-page'
								: 'posts' === endpoint
									? 'blog-post'
									: 'other',
							title: post.title.rendered,
							status: post.status,
							date: post.date,
							wordCount: countWords(post.content.rendered),
							editLink: `${appLocalizer.site_url}/wp-admin/post.php?post=${post.id}&action=edit`,
							viewLink:
								'publish' === post.status ? post.link : null,
						};
					})
				)
				.catch(() => [] as ContentRow[]);

		const fetchProducts = () =>
			getApiResponse<WcRestProduct[]>(
				getApiLink(
					appLocalizer,
					'products?per_page=10&orderby=date&order=desc&_fields=id,name,description,status,date_created,permalink',
					'wc/v3'
				),
				nonceHeaders
			)
				.then((response) =>
					(response || []).map(
						(product): ContentRow => ({
							id: product.id,
							category: 'product',
							title: product.name,
							status: product.status,
							date: product.date_created,
							wordCount: countWords(product.description),
							editLink: `${appLocalizer.site_url}/wp-admin/post.php?post=${product.id}&action=edit`,
							viewLink:
								'publish' === product.status
									? product.permalink
									: null,
						})
					)
				)
				.catch(() => [] as ContentRow[]);

		Promise.all([
			fetchPosts('posts'),
			fetchPosts('pages'),
			fetchProducts(),
		])
			.then(([posts, pages, products]) => {
				setRows(
					[...posts, ...pages, ...products].sort(
						(a, b) =>
							new Date(b.date).getTime() -
							new Date(a.date).getTime()
					)
				);
			})
			.finally(() => setIsLoading(false));
	}, []);

	const visibleRows = rows
		.filter((row) => 'all' === activeTab || row.category === activeTab)
		.slice(0, 8);

	const handleDelete = (row: ContentRow) => {
		setOpenMenuId(null);

		// Same native window.confirm() pattern RedirectsTab.tsx/
		// AiProvidersPanel.tsx already use for one-off destructive
		// confirmations, rather than building a bespoke confirm dialog
		// for a single call site.
		if (
			!window.confirm(
				__(
					'Move this to trash? You can restore it from Trash afterward.',
					'vulopilot'
				)
			)
		) {
			return;
		}

		setDeletingId(row.id);

		const endpoint =
			'product' === row.category
				? getApiLink(appLocalizer, `products/${row.id}`, 'wc/v3')
				: getApiLink(
						appLocalizer,
						`${'landing-page' === row.category || 'other' === row.category ? 'pages' : 'posts'}/${row.id}`,
						'wp/v2'
					);

		fetch(endpoint, {
			method: 'DELETE',
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (!response.ok) {
					throw new Error();
				}

				setRows((current) =>
					current.filter((r) => r.id !== row.id)
				);
				NoticeManager.add({
					uniqueKey: `recent-content-delete-${row.id}`,
					type: 'success',
					position: 'float',
					message: __('Moved to trash.', 'vulopilot'),
				});
			})
			.catch(() => {
				NoticeManager.add({
					uniqueKey: `recent-content-delete-${row.id}`,
					type: 'error',
					position: 'float',
					message: __(
						'Could not delete this item. Please try again.',
						'vulopilot'
					),
				});
			})
			.finally(() => setDeletingId(null));
	};

	return (
		<CardComponent
			className="recent-content-card"
			isLoading={isLoading}
		>
			<div className="recent-content-header">
				<h2>{__('Recent Content', 'vulopilot')}</h2>
				<div className="recent-content-tabs">
					{TABS.map((tab) => (
						<span
							key={tab.id}
							className={`recent-content-tab ${
								activeTab === tab.id ? 'active' : ''
							}`}
							onClick={() => setActiveTab(tab.id)}
						>
							{tab.label}
						</span>
					))}
				</div>
				<a
					className="recent-content-view-all"
					href={`${appLocalizer.site_url}/wp-admin/edit.php`}
				>
					{__('View All', 'vulopilot')}
					<i className="adminfont-arrow-right" />
				</a>
			</div>

			{!isLoading && visibleRows.length === 0 ? (
				<div className="desc">
					{__('No content found yet.', 'vulopilot')}
				</div>
			) : (
				<div className="recent-content-rows">
					{visibleRows.map((row) => (
						<div className="recent-content-row" key={row.id}>
							<i
								className={`recent-content-row-icon adminfont-${CATEGORY_ICONS[row.category]} icon-${CATEGORY_ICON_COLORS[row.category]}`}
							/>
							<div className="recent-content-row-text">
								<a
									className="recent-content-row-title"
									href={row.editLink}
								>
									{row.title ||
										__('(no title)', 'vulopilot')}
								</a>
								<div className="recent-content-row-meta">
									{CATEGORY_LABELS[row.category]}
									{' • '}
									{formatWordCount(row.wordCount)}
								</div>
							</div>
							<span
								className={`admin-badge ${
									'publish' === row.status
										? 'green'
										: 'grey'
								}`}
							>
								{'publish' === row.status
									? __('Published', 'vulopilot')
									: __('Draft', 'vulopilot')}
							</span>
							<span className="recent-content-row-time">
								{timeAgo(row.date)}
							</span>
							<div className="recent-content-row-menu">
								<i
									className="adminfont-more-vertical"
									role="button"
									tabIndex={0}
									onClick={() =>
										setOpenMenuId(
											openMenuId === row.id
												? null
												: row.id
										)
									}
								/>
								{openMenuId === row.id && (
									<div className="recent-content-row-menu-dropdown">
										<a href={row.editLink}>
											{__('Edit', 'vulopilot')}
										</a>
										{row.viewLink && (
											<a
												href={row.viewLink}
												target="_blank"
												rel="noreferrer"
											>
												{__('View', 'vulopilot')}
											</a>
										)}
										<span
											role="button"
											tabIndex={0}
											className="recent-content-row-menu-delete"
											onClick={() =>
												handleDelete(row)
											}
										>
											{deletingId === row.id
												? __(
														'Deleting…',
														'vulopilot'
													)
												: __(
														'Delete',
														'vulopilot'
													)}
										</span>
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</CardComponent>
	);
};

/**
 * "2,450 words"/"1 word" — real, locale-formatted (`toLocaleString()`
 * matches the mockup's own thousands-separator), singular-aware.
 */
const formatWordCount = (count: number): string =>
	1 === count
		? __('1 word', 'vulopilot')
		: `${count.toLocaleString()} ${__('words', 'vulopilot')}`;

export default RecentContentCard;
