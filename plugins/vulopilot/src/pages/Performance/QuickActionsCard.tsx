/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ListComponent,
	NoticeManager,
	NoticeReceiverComponent,
} from '@zyra/components';
import './Performance.scss';

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
	{ id: 'image-cleanup', icon: 'delete', label: __('Image Cleanup', 'vulopilot') },
	{ id: 'lazy-loading', icon: 'eye', label: __('Enable Lazy Loading', 'vulopilot') },
	{ id: 'preload-resources', icon: 'cloud-upload', label: __('Preload Critical Resources', 'vulopilot') },
	{ id: 'browser-caching', icon: 'global-community', label: __('Enable Browser Caching', 'vulopilot') },
];

/**
 * "Quick Actions" — each of the 8 buttons is a real
 * `POST /performance-actions/{id}` call (`classes/RestAPI/Controllers/
 * PerformanceActions.php`): cache flush, DB cleanup, image cleanup, and the
 * three toggles (lazy loading, preload, browser caching) always genuinely
 * happen; image optimization regenerates real thumbnails; minify and
 * browser-caching are the two actions that honestly report "nothing to
 * do"/failure (no minification plugin active; `.htaccess` not writable)
 * rather than pretending to have succeeded. The result notice always shows
 * the backend's own real, specific message — rendered inline in this card
 * (`position: 'notice'` + `NoticeReceiverComponent`, the same boxed style
 * `NoticeComponent`'s own default `displayPosition="notice"` uses
 * elsewhere) per direct instruction, not as a floating toast. A finite
 * validity (`5000`) is passed explicitly since `NoticeManager.add()` only
 * auto-expires `position: 'float'` items by default — anything else is
 * `'lifetime'`, and a plain-string message here renders no close icon
 * (`renderNoticeContent()` only adds one for an array `message`), so
 * without an explicit validity the notice would never go away, and a
 * second click of the same action would silently no-op (`add()` skips a
 * still-queued `uniqueKey`).
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
				NoticeManager.add(
					{
						uniqueKey: `speed-quick-action-${action.id}`,
						type: response && response.success ? 'success' : 'info',
						position: 'notice',
						message: response
							? response.message
							: __(
									'Could not run this action — please try again.',
									'vulopilot'
								),
					},
					5000
				);
			})
			.finally(() => setRunningActionId(null));
	};

	return (
		<CardComponent title={__('Quick Actions', 'vulopilot')} titleIcon="ai">
			<ListComponent
				className="mini-card report without-border"
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
			<NoticeReceiverComponent position="notice" />
		</CardComponent>
	);
};

export default QuickActionsCard;
