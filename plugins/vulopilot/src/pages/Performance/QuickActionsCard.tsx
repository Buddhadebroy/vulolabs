/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';
import { IconTile } from '../../components/ui';
import type { Tone } from '../../components/ui';

interface QuickAction {
	id: string;
	icon: string;
	tone: Tone;
	label: string;
	desc: string;
}

/** Each runs `POST /performance-actions/{id}` (classes/Performance/Rest/PerformanceActions.php). */
const QUICK_ACTIONS: QuickAction[] = [
	{ id: 'clear-caches', icon: 'refresh-bold', tone: 'blue', label: __('Clear all caches', 'vulopilot'), desc: __('Page, object and plugin caches', 'vulopilot') },
	{ id: 'minify-css-js', icon: 'coding', tone: 'violet', label: __('Minify CSS & JS', 'vulopilot'), desc: __('Through your optimization plugin', 'vulopilot') },
	{ id: 'optimize-images', icon: 'image', tone: 'green', label: __('Optimize images', 'vulopilot'), desc: __('Shrink large uploads', 'vulopilot') },
	{ id: 'database-cleanup', icon: 'database', tone: 'amber', label: __('Clean the database', 'vulopilot'), desc: __('Old revisions and expired data', 'vulopilot') },
	{ id: 'image-cleanup', icon: 'delete', tone: 'red', label: __('Remove unused images', 'vulopilot'), desc: __('Media nothing links to', 'vulopilot') },
	{ id: 'lazy-loading', icon: 'eye', tone: 'blue', label: __('Lazy-load images', 'vulopilot'), desc: __('Load images as visitors scroll', 'vulopilot') },
	{ id: 'preload-resources', icon: 'cloud-upload', tone: 'violet', label: __('Preload key files', 'vulopilot'), desc: __('Fonts and styles load first', 'vulopilot') },
	{ id: 'browser-caching', icon: 'global-community', tone: 'green', label: __('Browser caching', 'vulopilot'), desc: __('Returning visitors load less', 'vulopilot') },
];

/** "Quick fixes" in the rail: common speed fixes that run in one click, each reporting what it did. */
const QuickActionsCard = () => {
	const [runningId, setRunningId] = useState<string | null>(null);

	const run = (action: QuickAction) => {
		if (runningId) {
			return;
		}

		setRunningId(action.id);

		sendApiResponse<{ success: boolean; message: string }>(
			vulopilotAppLocalizer,
			getApiLink(vulopilotAppLocalizer, `performance-actions/${action.id}`),
			{}
		)
			.then((response) =>
				NoticeManager.add({
					uniqueKey: `speed-quick-action-${action.id}`,
					type: response?.success ? 'success' : 'info',
					position: 'float',
					message: response?.message ?? __('Could not run this fix - please try again.', 'vulopilot'),
				})
			)
			.finally(() => setRunningId(null));
	};

	return (
		<section className="vp-card vp-rail-card" id="performance-quick-actions-card">
			<header className="vp-rail-head">
				<div>
					<h3>{__('Quick fixes', 'vulopilot')}</h3>
					<p>{__('Common speed fixes, one click each.', 'vulopilot')}</p>
				</div>
			</header>
			<ul className="vp-quick">
				{QUICK_ACTIONS.map((action) => (
					<li key={action.id}>
						<button type="button" onClick={() => run(action)} disabled={Boolean(runningId)} aria-busy={runningId === action.id}>
							<IconTile icon={action.icon} tone={action.tone} size="sm" />
							<span className="vp-quick-text">
								<strong>{action.label}</strong>
								<span>{runningId === action.id ? __('Running…', 'vulopilot') : action.desc}</span>
							</span>
							<i className={`adminfont-${runningId === action.id ? 'refresh vp-spin' : 'arrow-right'}`} aria-hidden="true" />
						</button>
					</li>
				))}
			</ul>
		</section>
	);
};

export default QuickActionsCard;
