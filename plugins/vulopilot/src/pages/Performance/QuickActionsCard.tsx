/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { CardComponent, ListComponent, NoticeManager } from '@zyra/components';
import './ImproveSpeed.scss';

interface QuickAction {
	id: string;
	icon: string;
	label: string;
}

interface ActionResult {
	success: boolean;
	message: string;
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
 * "Quick Actions" — each of the 6 buttons is a real
 * `POST /performance-actions/{id}` call (`classes/RestAPI/Controllers/
 * PerformanceActions.php`): cache flush, DB cleanup, and the two toggles
 * always genuinely happen; image optimization regenerates real
 * thumbnails; minify is the one action that honestly reports "nothing to
 * do" when no minification-capable plugin is active, rather than
 * pretending to have minified anything. The result toast always shows the
 * backend's own real, specific message.
 */
const QuickActionsCard = () => {
	const [runningActionId, setRunningActionId] = useState<string | null>(null);

	const runAction = (action: QuickAction) => {
		if (runningActionId) {
			return;
		}

		setRunningActionId(action.id);

		sendApiResponse<ActionResult>(
			appLocalizer,
			getApiLink(appLocalizer, `performance-actions/${action.id}`),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: `speed-quick-action-${action.id}`,
					type: response && response.success ? 'success' : 'info',
					position: 'float',
					message: response
						? response.message
						: __(
								'Could not run this action — please try again.',
								'vulopilot'
							),
				});
			})
			.finally(() => setRunningActionId(null));
	};

	return (
		<CardComponent title={__('Quick Actions', 'vulopilot')}>
			<ListComponent
				className="mini-card listool-grid"
				border
				items={QUICK_ACTIONS.map((action) => ({
					id: action.id,
					icon: action.icon,
					title: action.label,
					tags:
						runningActionId === action.id ? (
							<i className="adminfont-refresh performance-quick-action-spinner" />
						) : (
							<i className="adminfont-arrow-right" />
						),
					action: () => runAction(action),
				}))}
			/>
		</CardComponent>
	);
};

export default QuickActionsCard;
