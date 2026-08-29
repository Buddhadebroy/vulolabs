import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

/**
 * "Site snapshot" — real WordPress core counts (`summary.site_snapshot`,
 * Dashboard controller's own `build_site_snapshot()`), the one section of
 * this payload that isn't derived from scan findings at all: posts, pages,
 * comments, and users are real `wp_count_posts()`/`wp_count_comments()`/
 * `count_users()` results; plugin counts are real `get_plugins()`/
 * `active_plugins` option reads; WP/PHP version are real `get_bloginfo()`/
 * `PHP_VERSION`. No fetch of its own — `summary` already carries this,
 * same as every other widget on this page.
 */
const SiteSnapshotWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading,
	onHide,
	isCustomizing,
}) => {
	const snapshot = summary.site_snapshot;

	const rows = [
		{
			key: 'posts',
			icon: 'post',
			label: __('Posts', 'vulopilot'),
			value: snapshot.posts,
		},
		{
			key: 'pages',
			icon: 'pages',
			label: __('Pages', 'vulopilot'),
			value: snapshot.pages,
		},
		{
			key: 'comments',
			icon: 'comment',
			label: __('Comments', 'vulopilot'),
			value: snapshot.comments,
		},
		{
			key: 'users',
			icon: 'person',
			label: __('Users', 'vulopilot'),
			value: snapshot.users,
		},
		{
			key: 'plugins',
			icon: 'plugins',
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
			icon: 'wordpress',
			label: __('WordPress', 'vulopilot'),
			value: snapshot.wp_version || '—',
		},
		{
			key: 'php-version',
			icon: 'coding',
			label: __('PHP', 'vulopilot'),
			value: snapshot.php_version || '—',
		},
	];

	return (
		<DashboardWidget
			title={__('Site snapshot', 'vulopilot')}
			icon="info"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			<ul className="site-snapshot-list">
				{rows.map((row) => (
					<li key={row.key} className="site-snapshot-row">
						<span className="site-snapshot-row-label">
							<i className={`adminfont-${row.icon}`} />
							{row.label}
						</span>
						<span className="site-snapshot-row-value">
							{row.value}
						</span>
					</li>
				))}
			</ul>
		</DashboardWidget>
	);
};

export default SiteSnapshotWidget;
