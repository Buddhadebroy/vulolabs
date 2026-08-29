import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';
import type { AiVisibilityCheck, CategoryPanel, SpeedSummary } from './reportsOverview';

interface SearchPerformancePanelProps {
	panel: CategoryPanel | null;
	isLoading: boolean;
}

/**
 * The mockup's "Search performance" panel shows Google Search Console
 * metrics (impressions/clicks/CTR/average position, top pages gaining/
 * losing visibility) — no Search Console (or any search-analytics)
 * integration exists anywhere in this codebase. Real substitute, same
 * shape as SecurityPerformancePanel below: real SEO-category fixed/new/
 * still-open findings counts, plus the real pages those open findings
 * reference — "what's affecting search visibility right now", not
 * fabricated traffic numbers.
 */
export const SearchPerformancePanel = ({
	panel,
	isLoading,
}: SearchPerformancePanelProps) => (
	<CardComponent
		className="reports-panel"
		titleIcon="search-discovery"
		title={__('Search Performance', 'vulopilot')}
		desc={__('Fixed, new, and still-open SEO findings this period.', 'vulopilot')}
		isLoading={isLoading}
	>
		{!isLoading && panel && (
			<>
				<div className="reports-panel-stats">
					<div className="reports-panel-stat is-good">
						<span>{panel.fixed}</span>
						{__('Fixed', 'vulopilot')}
					</div>
					<div className="reports-panel-stat is-attention">
						<span>{panel.new}</span>
						{__('New', 'vulopilot')}
					</div>
					<div className="reports-panel-stat is-neutral">
						<span>{panel.still_open}</span>
						{__('Still open', 'vulopilot')}
					</div>
				</div>
				{panel.top_open.length > 0 ? (
					<>
						<p className="reports-panel-list-label">
							{__('Needs review', 'vulopilot')}
						</p>
						<ul className="reports-panel-list">
							{panel.top_open.map((item) => (
								<li key={item.id}>
									<BadgeComponent
										color={`badge-${item.severity}`}
										text={item.severity}
									/>
									{item.title}
								</li>
							))}
						</ul>
					</>
				) : (
					<ModuleGuardComponent
						icon="check"
						title={__('All caught up', 'vulopilot')}
						desc={__('No open SEO findings right now.', 'vulopilot')}
					/>
				)}
			</>
		)}
	</CardComponent>
);

interface AiVisibilityPanelProps {
	checks: AiVisibilityCheck[];
	isLoading: boolean;
}

/**
 * The mockup's "AI visibility" panel — its 5 named rows (AI-friendly
 * answers/Evidence & citations/AI-readable structure/Brand understanding/
 * AI crawler access) map to 5 real GEO/AEO scanners
 * (Controllers\ReportsOverview::AI_VISIBILITY_CHECKS), genuinely real,
 * not a substitute.
 */
export const AiVisibilityPanel = ({
	checks,
	isLoading,
}: AiVisibilityPanelProps) => {
	const needsWork = checks.filter((c) => c.status === __('Needs work', 'vulopilot'));

	return (
		<CardComponent
			className="reports-panel"
			titleIcon="ai"
			title={__('AI Visibility', 'vulopilot')}
			desc={__('Real GEO checks for how easy your site is for AI to find and understand.', 'vulopilot')}
			isLoading={isLoading}
		>
			{!isLoading && (
				<>
					<div
						className={`reports-panel-badge ${needsWork.length > 0 ? 'is-attention' : 'is-good'}`}
					>
						{needsWork.length > 0
							? sprintf(
									/* translators: %d is the number of checks needing work. */
									__('%d checks need work', 'vulopilot'),
									needsWork.length
								)
							: __('All checks look good', 'vulopilot')}
					</div>
					<ul className="reports-ai-visibility-list">
						{checks.map((check) => (
							<li key={check.scanner_id}>
								<span>{check.label}</span>
								<span
									className={`reports-ai-visibility-status ${
										check.status === __('Needs work', 'vulopilot')
											? 'is-attention'
											: 'is-good'
									}`}
								>
									{check.status}
								</span>
							</li>
						))}
					</ul>
				</>
			)}
		</CardComponent>
	);
};

interface SpeedPerformancePanelProps {
	speed: SpeedSummary | null;
	isLoading: boolean;
}

/**
 * The mockup's "Website speed" panel — real page-speed data
 * (PageSpeedRepository::get_summary(), extended with a real average
 * desktop score for the device comparison — see that method's own
 * docblock). No fabricated "78/100 Mobile · +10" trend claim — the delta
 * shown is nothing, just the two real current averages side by side.
 */
export const SpeedPerformancePanel = ({
	speed,
	isLoading,
}: SpeedPerformancePanelProps) => (
	<CardComponent
		className="reports-panel"
		titleIcon="analytics"
		title={__('Website Speed', 'vulopilot')}
		desc={__('Your real average mobile and desktop speed scores.', 'vulopilot')}
		isLoading={isLoading}
	>
		{!isLoading && speed && (
			<>
				{speed.total_pages === 0 ? (
					<ModuleGuardComponent
						icon="analytics"
						title={__('No page speed data yet', 'vulopilot')}
						desc={__(
							'Run a page speed scan from Improve My Speed to see real numbers here.',
							'vulopilot'
						)}
					/>
				) : (
					<>
						<div className="reports-panel-stats">
							<div className="reports-panel-stat is-good">
								<span>{speed.pages_improved}</span>
								{__('Pages good', 'vulopilot')}
							</div>
							<div className="reports-panel-stat is-attention">
								<span>{speed.pages_need_attention}</span>
								{__('Need attention', 'vulopilot')}
							</div>
						</div>
						<div className="reports-speed-device-bars">
							<div className="reports-speed-device-row">
								<span>{__('Desktop', 'vulopilot')}</span>
								<div className="reports-speed-device-track">
									<div
										className="reports-speed-device-fill"
										style={{ width: `${speed.avg_score ?? 0}%` }}
									/>
								</div>
								<span>{speed.avg_score ?? '—'}/100</span>
							</div>
							<div className="reports-speed-device-row">
								<span>{__('Mobile', 'vulopilot')}</span>
								<div className="reports-speed-device-track">
									<div
										className="reports-speed-device-fill"
										style={{
											width: `${speed.avg_mobile_score ?? 0}%`,
										}}
									/>
								</div>
								<span>{speed.avg_mobile_score ?? '—'}/100</span>
							</div>
						</div>
					</>
				)}
			</>
		)}
	</CardComponent>
);
