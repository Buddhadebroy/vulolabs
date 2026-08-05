/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ListComponent } from '@zyra/components';

interface WpRestPost {
	id: number;
	title: { rendered: string };
	status: string;
	date: string;
}

type ContentType = 'post' | 'page' | 'product';

interface ContentRow {
	id: number;
	type: ContentType;
	title: string;
	status: string;
	date: string;
}

const TYPE_LABELS: Record<ContentType, string> = {
	post: __('Post', 'vulopilot'),
	page: __('Page', 'vulopilot'),
	product: __('Product', 'vulopilot'),
};

/**
 * Relative "2h ago"/"3d ago" formatting — the mockup's own style. No
 * shared relative-time utility exists anywhere in this codebase yet
 * (only `formatWpDate`, an absolute-date formatter), and this is small
 * enough to keep local rather than add a new cross-page service for one
 * consumer.
 */
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
 * "Recent Content" — real WP core REST data (`GET /wp/v2/posts`,
 * `/wp/v2/pages`, zero new backend needed), plus WooCommerce's own
 * `wc/v3/products` when that request actually succeeds (no
 * active-plugin check — just tries the real endpoint and only shows the
 * Products tab if it responds). The mockup's own "Landing Pages" tab is
 * dropped — no matching post type exists anywhere in this codebase.
 * Each row's title links to the real `post.php?post={id}&action=edit`
 * WP edit screen; the mockup's row kebab-menu is dropped too since no
 * real duplicate/delete-from-here action exists to wire it to.
 */
const RecentContentCard = () => {
	const [rows, setRows] = useState<ContentRow[]>([]);
	const [hasProducts, setHasProducts] = useState(false);
	const [activeType, setActiveType] = useState<'all' | ContentType>('all');
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchType = (
			type: ContentType,
			endpoint: string,
			namespace: string
		) =>
			getApiResponse<WpRestPost[]>(
				getApiLink(
					appLocalizer,
					`${endpoint}?per_page=8&orderby=date&order=desc&_fields=id,title,status,date`,
					namespace
				),
				{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
			)
				.then((response) =>
					(response || []).map((row) => ({
						id: row.id,
						type,
						title: row.title.rendered,
						status: row.status,
						date: row.date,
					}))
				)
				.catch(() => [] as ContentRow[]);

		Promise.all([
			fetchType('post', 'posts', 'wp/v2'),
			fetchType('page', 'pages', 'wp/v2'),
			fetchType('product', 'products', 'wc/v3'),
		])
			.then(([posts, pages, products]) => {
				setHasProducts(products.length > 0);
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
		.filter((row) => activeType === 'all' || row.type === activeType)
		.slice(0, 8);

	const tabs: { id: 'all' | ContentType; label: string }[] = [
		{ id: 'all', label: __('All', 'vulopilot') },
		{ id: 'post', label: __('Blog Posts', 'vulopilot') },
		{ id: 'page', label: __('Pages', 'vulopilot') },
		...(hasProducts
			? [{ id: 'product' as const, label: __('Products', 'vulopilot') }]
			: []),
	];

	return (
		<CardComponent
			title={__('Recent Content', 'vulopilot')}
			isLoading={isLoading}
		>
			<div className="recent-content-tabs">
				{tabs.map((tab) => (
					<span
						key={tab.id}
						className={`recent-content-tab ${
							activeType === tab.id ? 'active' : ''
						}`}
						onClick={() => setActiveType(tab.id)}
					>
						{tab.label}
					</span>
				))}
			</div>
			{!isLoading && visibleRows.length === 0 ? (
				<div className="desc">
					{__('No content found yet.', 'vulopilot')}
				</div>
			) : (
				<ListComponent
					className="mini-card report"
					items={visibleRows.map((row) => ({
						id: `${row.type}-${row.id}`,
						title: row.title || __('(no title)', 'vulopilot'),
						link: `${appLocalizer.site_url}/wp-admin/post.php?post=${row.id}&action=edit`,
						tags: (
							<>
								<span className="admin-badge blue">
									{TYPE_LABELS[row.type]}
								</span>
								<span
									className={`admin-badge ${
										row.status === 'publish'
											? 'green'
											: 'yellow'
									}`}
								>
									{row.status === 'publish'
										? __('Published', 'vulopilot')
										: __('Draft', 'vulopilot')}
								</span>
								<span className="small desc">
									{timeAgo(row.date)}
								</span>
							</>
						),
					}))}
				/>
			)}
		</CardComponent>
	);
};

export default RecentContentCard;
