import { __ } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import EfficiencyHeroCard from './EfficiencyHeroCard';
import EfficiencySectionsList from './EfficiencySectionsList';
import EfficiencyThingsToReview from './EfficiencyThingsToReview';
import EfficiencyOverviewChart from './EfficiencyOverviewChart';
import EfficiencySpeedInsightsBanner from './EfficiencySpeedInsightsBanner';
import SpeedHistoryCard from '../Performance/SpeedHistoryCard';
import PluginOverlapCard from './PluginOverlapCard';
import { useEfficiencyChecks, THINGS_TO_REVIEW_ID } from './efficiencyChecks';
import './ProtectMySite.scss';

const SECTIONS_TOP_ID = 'protect-my-site-efficiency-sections';

const scrollTo = (id: string) => () =>
	document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/**
 * "Performance" tab of "Protect My Site" — matches the reference mockup:
 * a breadcrumb + title mini-header with a "Run Efficiency Test" button,
 * a hero summary card, 3 grouped check sections (Page Delivery/WordPress
 * Data Efficiency/Server Processing), a "Things to review" list, an
 * "Efficiency Overview" donut, a real related-page speed-score trend, and
 * a closing "Improve My Speed" cross-link banner.
 *
 * Deliberately NOT the same page as `pages/Performance/PerformanceTab.tsx`
 * (a different file, in a different top-level route — "Improve My
 * Speed", Core Web Vitals/PageSpeed/image-optimization findings). This
 * tab is about WordPress/server-side efficiency (caching, object cache,
 * OPcache), read live from `GET /efficiency-checks`
 * (Controllers\EfficiencyChecks.php) — no scanner, no Finding rows, no
 * persisted table behind these 4 checks (confirmed: no `efficiency`-named
 * table anywhere in Install.php), so — unlike Security/Site Health/Files &
 * Plugins/Accessibility — there's no `findings/groups` data this tab could
 * build a merged issues table or a real trend card from; a fabricated one
 * would violate the same no-fabrication rule every other tab this session
 * followed. `category_scores.performance` (GET /dashboard) isn't usable
 * as a substitute either — it's fed by the *other* page's own Core Web
 * Vitals findings, not these checks, so reusing it here would misrepresent
 * unrelated data as this tab's own (see efficiencyChecks.ts's own
 * docblock for the full reasoning).
 *
 * What honestly *is* addable: `pages/Performance/SpeedHistoryCard.tsx`
 * (real `GET /performance-score-snapshots?days=30`, already fully built
 * for the other page, including its own honest "no trend data yet" empty
 * state) — reused directly here, not duplicated, and clearly labeled as a
 * related-but-distinct signal rather than this tab's own metric, sitting
 * right before EfficiencySpeedInsightsBanner's own cross-link so that
 * banner's "View Speed Overview" CTA follows a real data preview instead
 * of just prose.
 *
 * Closes with PluginOverlapCard filtered to `category="caching"` —
 * promotes the same real cross-sell FilesPluginsTab.tsx introduced (e.g.
 * WP Rocket/W3 Total Cache/WP Super Cache/LiteSpeed Cache active →
 * these efficiency checks + Improve My Speed's own monitoring already
 * cover the same ground) into the tab a user reading about performance
 * is already on.
 */
const PerformanceTab = () => {
	const { data, isLoading, refetch } = useEfficiencyChecks();

	return (
		<>
			<div className="efficiency-page-header">
				<p className="efficiency-page-breadcrumb">
					{__('Protect My Site', 'vulopilot')}
					{' > '}
					<span>{__('Performance', 'vulopilot')}</span>
				</p>
				<div className="efficiency-page-header-row">
					<div>
						<h2 className="efficiency-page-title">
							{__('Performance', 'vulopilot')}
						</h2>
						<p className="efficiency-page-subtitle">
							{__('Is WordPress set up to run efficiently?', 'vulopilot')}
						</p>
					</div>
					<ButtonInput
						buttons={{
							text: __('Run Efficiency Test', 'vulopilot'),
							icon: 'refresh-bold',
							color: 'border-purple',
							onClick: refetch,
						}}
					/>
				</div>
			</div>

			<EfficiencyHeroCard
				summary={data?.summary ?? null}
				isLoading={isLoading}
				onReviewImprovements={scrollTo(THINGS_TO_REVIEW_ID)}
			/>

			<div id={SECTIONS_TOP_ID}>
				<EfficiencySectionsList
					sections={data?.sections ?? []}
					isLoading={isLoading}
				/>
			</div>

			<EfficiencyThingsToReview
				reviewItems={data?.review_items ?? []}
				summary={data?.summary ?? null}
				isLoading={isLoading}
				onViewAll={scrollTo(SECTIONS_TOP_ID)}
			/>

			<EfficiencyOverviewChart
				summary={data?.summary ?? null}
				isLoading={isLoading}
				onViewAll={scrollTo(SECTIONS_TOP_ID)}
			/>

			<div className="efficiency-related-speed">
				<p className="efficiency-related-speed-label">
					{__('Related: Front-end Speed', 'vulopilot')}
				</p>
				<SpeedHistoryCard />
			</div>

			<EfficiencySpeedInsightsBanner />

			<PluginOverlapCard category="caching" />
		</>
	);
};

export default PerformanceTab;
