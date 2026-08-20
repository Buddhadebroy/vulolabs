/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { CardComponent, ListComponent, NoticeManager } from '@zyra/components';

interface PageSpeedIssue {
	issue: string;
	affected_pages: number;
}

interface RecommendedFix {
	actionId: string;
	icon: string;
	label: string;
}

interface ActionResult {
	success: boolean;
	message: string;
}

/**
 * Real `POST /performance-actions/{id}` one-click fixes (same 7 actions,
 * same endpoint, `classes/RestAPI/Controllers/PerformanceActions.php` —
 * as QuickActionsCard.tsx on the Overview tab), matched here by keyword
 * against each real `top_issues[].issue` string (a real Google Lighthouse
 * opportunity-audit title, or a plain load-time label —
 * PageSpeedRepository::get_top_issues()'s own docblock) so only fixes
 * relevant to what was actually detected on THIS site's slow pages show
 * up, not the full fixed 7-item list Overview's own card always shows.
 */
const FIX_BY_KEYWORD: { keyword: string; actionId: string; icon: string; label: string }[] = [
	{ keyword: 'image', actionId: 'optimize-images', icon: 'image', label: __('Optimize Images', 'vulopilot') },
	{ keyword: 'cache', actionId: 'clear-caches', icon: 'refresh-bold', label: __('Clear All Caches', 'vulopilot') },
	{ keyword: 'css', actionId: 'minify-css-js', icon: 'coding', label: __('Minify CSS & JS', 'vulopilot') },
	{ keyword: 'javascript', actionId: 'minify-css-js', icon: 'coding', label: __('Minify CSS & JS', 'vulopilot') },
	{ keyword: 'render-blocking', actionId: 'preload-resources', icon: 'cloud-upload', label: __('Preload Critical Resources', 'vulopilot') },
	{ keyword: 'lazy', actionId: 'lazy-loading', icon: 'eye', label: __('Enable Lazy Loading', 'vulopilot') },
	{ keyword: 'offscreen', actionId: 'lazy-loading', icon: 'eye', label: __('Enable Lazy Loading', 'vulopilot') },
];

/**
 * "Recommended Fixes" — real, one-click actions tied to what this site's
 * own Slow Pages scan actually found, per direct instruction: replaces
 * "Why these pages matter" (SlowPagesTab.tsx, now removed) — a static,
 * always-identical educational bullet list ("Poor user experience"/"Lower
 * conversions"/"Search ranking impact") that never changed no matter what
 * the real data showed. This card only appears at all when at least one
 * real top issue keyword-matches a real fix; each button triggers the
 * exact same backend action QuickActionsCard.tsx's own "Quick Actions"
 * card uses on the Overview tab, so a fix run from here is a real fix,
 * not a link elsewhere.
 */
const RecommendedFixesCard = ({ topIssues }: { topIssues: PageSpeedIssue[] }) => {
	const [runningActionId, setRunningActionId] = useState<string | null>(null);

	const fixes = Array.from(
		new Map(
			topIssues
				.map((issue): RecommendedFix | null => {
					const match = FIX_BY_KEYWORD.find((entry) =>
						issue.issue.toLowerCase().includes(entry.keyword)
					);

					return match
						? { actionId: match.actionId, icon: match.icon, label: match.label }
						: null;
				})
				.filter((fix): fix is RecommendedFix => Boolean(fix))
				.map((fix) => [fix.actionId, fix])
		).values()
	);

	if (0 === fixes.length) {
		return null;
	}

	const runFix = (fix: RecommendedFix) => {
		if (runningActionId) {
			return;
		}

		setRunningActionId(fix.actionId);

		sendApiResponse<ActionResult>(
			appLocalizer,
			getApiLink(appLocalizer, `performance-actions/${fix.actionId}`),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: `slow-pages-recommended-fix-${fix.actionId}`,
					type: response && response.success ? 'success' : 'info',
					position: 'float',
					message: response
						? response.message
						: __('Could not run this fix — please try again.', 'vulopilot'),
				});
			})
			.finally(() => setRunningActionId(null));
	};

	return (
		<CardComponent title={__('Recommended Fixes', 'vulopilot')} titleIcon="light">
			<ListComponent
				className="mini-card"
				border
				items={fixes.map((fix) => ({
					id: fix.actionId,
					icon: fix.icon,
					title: fix.label,
					tags:
						runningActionId === fix.actionId ? (
							<i className="adminfont-refresh performance-quick-action-spinner" />
						) : (
							<i className="adminfont-arrow-right" />
						),
					action: () => runFix(fix),
				}))}
			/>
		</CardComponent>
	);
};

export default RecommendedFixesCard;
