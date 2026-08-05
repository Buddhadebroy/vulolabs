import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent, NoticeManager } from '@zyra/components';

interface QuickAction {
	id: string;
	icon: string;
	label: string;
}

const QUICK_ACTIONS: QuickAction[] = [
	{ id: 'clear-caches', icon: 'refresh-bold', label: __('Clear All Caches', 'vulopilot') },
	{ id: 'minify-css-js', icon: 'coding', label: __('Minify CSS & JS', 'vulopilot') },
	{ id: 'optimize-images', icon: 'image', label: __('Optimize Images', 'vulopilot') },
	{ id: 'database-cleanup', icon: 'database', label: __('Database Cleanup', 'vulopilot') },
	{ id: 'lazy-loading', icon: 'eye', label: __('Enable Lazy Loading', 'vulopilot') },
	{ id: 'preload-resources', icon: 'cloud-upload', label: __('Preload Critical Resources', 'vulopilot') },
];

/**
 * "Quick Actions" — none of these 6 operations have a real backend
 * anywhere in this codebase (confirmed: no Clear Cache/Minify/Optimize
 * Images/DB Cleanup/Lazy Load/Preload endpoint or WP action exists, and
 * Pro's OneClickFix module's own fix maps don't cover any of the 5
 * `performance`-category scanners either). Same honest "not connected
 * yet" click pattern Create Content's `ContentToolsGrid.tsx`/
 * `QuickStartCard.tsx` already established, written as its own local
 * copy here rather than a shared cross-page helper.
 */
const QuickActionsCard = () => {
	const notifyNotConnected = (action: QuickAction) => {
		NoticeManager.add({
			uniqueKey: `speed-quick-action-${action.id}`,
			type: 'info',
			position: 'float',
			message: __(
				"Not connected yet — this action isn't wired up in this build.",
				'vulopilot'
			),
		});
	};

	return (
		<CardComponent title={__('Quick Actions', 'vulopilot')}>
			<ListComponent
				className="mini-card list"
				border
				items={QUICK_ACTIONS.map((action) => ({
					id: action.id,
					icon: action.icon,
					title: action.label,
					tags: <i className="adminfont-arrow-right" />,
					action: () => notifyNotConnected(action),
				}))}
			/>
		</CardComponent>
	);
};

export default QuickActionsCard;
