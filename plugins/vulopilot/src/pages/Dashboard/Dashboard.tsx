/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';
import DashboardGrid from '../../dashboard-widgets/DashboardGrid';
import GettingStartedCard from './GettingStartedCard';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import { DashboardSummary } from '../../dashboard-widgets/types';

/**
 * Zero-filled shape so DashboardGrid always has a real DashboardSummary
 * to pass to widgets while the first `/dashboard` request is in flight —
 * widgets render their own skeleton via the `isLoading` prop rather than
 * the page needing a separate "loading" screen state.
 */
const EMPTY_SUMMARY: DashboardSummary = {
	overall_score: 0,
	open_findings: 0,
	critical_findings: 0,
	findings_by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
	active_automations: 0,
	ai_jobs_used: 0,
	ai_jobs_quota: 0,
	category_scores: {
		seo: 0,
		performance: 0,
		security: 0,
		accessibility: 0,
		woocommerce: null,
		geo: 0,
		content: 0,
		brand: 0,
	},
	category_scores_7d_ago: {
		seo: 0,
		performance: 0,
		security: 0,
		accessibility: 0,
		woocommerce: null,
		geo: 0,
		content: 0,
		brand: 0,
	},
	new_findings_this_week: 0,
	fixed_findings_this_week: 0,
	quick_fixes: 0,
	pending_approvals: 0,
	automation_status: { enabled: 0, disabled: 0 },
	site_snapshot: {
		posts: 0,
		pages: 0,
		comments: 0,
		users: 0,
		plugins_active: 0,
		plugins_total: 0,
		wp_version: '',
		php_version: '',
	},
};

/**
 * Real time-of-day greeting, computed from the visitor's own local clock
 * (`new Date().getHours()`) — not a fabricated business number, the same
 * kind of real-computed-value convention this codebase already applies to
 * `timeAgo()`/relative-timestamp helpers elsewhere.
 */
const getGreeting = (): string => {
	const hour = new Date().getHours();

	if (hour < 12) {
		return __('Good morning', 'vulopilot');
	}
	if (hour < 18) {
		return __('Good afternoon', 'vulopilot');
	}
	return __('Good evening', 'vulopilot');
};

/**
 * Personalized "Good morning, {name}!" header — matches the Dashboard
 * mockup's own greeting, using the real `wp_get_current_user()->display_name`
 * (`appLocalizer.current_user_display_name`, already localized in
 * FrontendScripts.php and already used the same way by
 * AiContentAssistantSidebar.tsx) rather than a generic page title.
 * `getGreeting()`'s time-of-day text is a real computed value from the
 * visitor's own clock, not a fabricated one.
 *
 * `headerCustomContent` carries the mockup's "Run complete audit" button +
 * real "Last scan: …" line — the exact same `RunScanHeaderExtra` cluster
 * every other category page's header already uses (site-wide scope here,
 * same as Health.tsx, since Dashboard has no one category of its own),
 * relabeled via its own `label` prop rather than a new component. Refetches
 * this page's own summary on a successful scan via `onSuccess`. Sits
 * alongside (not instead of) the existing Customize/Reset/Save `buttons` —
 * `NavigatorHeaderComponent` renders both as sibling flex children
 * (confirmed reading its source), so Customize-dashboard mode isn't lost.
 */
const Dashboard = () => {
	const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	// Local UI state only, never persisted — every fresh page load starts
	// read-only, so a user can't accidentally drag/hide a widget just by
	// having left customization mode on last time (DashboardGrid.tsx's
	// own drag/hide REST calls already persist the *layout*; this only
	// gates whether those controls are reachable at all).
	const [isCustomizing, setIsCustomizing] = useState(false);
	// See DashboardGrid.tsx's own comment on why this is a counter, not a
	// boolean — every "Reset to default" click has to re-trigger the reset
	// effect there even if a previous click already left it at the same
	// value.
	const [restoreDefaultSignal, setRestoreDefaultSignal] = useState(0);

	const loadDashboard = () => {
		setIsLoading(true);
		setError(null);

		getApiResponse<DashboardSummary>(
			getApiLink(appLocalizer, 'dashboard'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (!response) {
					setError(
						__(
							'Could not load the dashboard summary.',
							'vulopilot'
						)
					);
					return;
				}

				setSummary(response);
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(loadDashboard, []);

	const pageHeader = (
		<NavigatorHeaderComponent
			headerTitle={sprintf(
				/* translators: %s: the logged-in admin's real display name. */
				__('%s, %s! \u{1F44B}', 'vulopilot'),
				getGreeting(),
				appLocalizer.current_user_display_name
			)}
			headerIcon="module"
			headerDescription={__(
				"Here's how your site is doing.",
				'vulopilot'
			)}
			headerCustomContent={
				<RunScanHeaderExtra
					label={__('Run complete audit', 'vulopilot')}
					settingsSubtab="general"
					onSuccess={loadDashboard}
				/>
			}
			buttons={
				isCustomizing
					? [
							{
								label: __('Reset to default', 'vulopilot'),
								icon: 'refresh',
								color: 'border-purple',
								onClick: () =>
									setRestoreDefaultSignal(
										(signal) => signal + 1
									),
							},
							{
								label: __('Save changes', 'vulopilot'),
								icon: 'form-checkboxes',
								color: 'border-green',
								onClick: () => setIsCustomizing(false),
							},
					  ]
					: [
							{
								label: __('Customize dashboard', 'vulopilot'),
								icon: 'edit',
								color: 'border-purple',
								onClick: () => setIsCustomizing(true),
							},
					  ]
			}
		/>
	);

	if (error) {
		return (
			<>
				{pageHeader}
				<ColumnComponent>
					<ModuleGuardComponent
						icon="error"
						title={__(
							'Could not load the dashboard',
							'vulopilot'
						)}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={loadDashboard}
					/>
				</ColumnComponent>
			</>
		);
	}

	return (
		<>
			{pageHeader}
			<ContainerComponent general>
				<GettingStartedCard />
				<DashboardGrid
					summary={summary}
					isLoading={isLoading}
					isCustomizing={isCustomizing}
					restoreDefaultSignal={restoreDefaultSignal}
				/>
			</ContainerComponent>
		</>
	);
};

export default Dashboard;
