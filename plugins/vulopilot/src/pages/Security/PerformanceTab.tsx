import { __ } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import EfficiencyHeroCard from './EfficiencyHeroCard';
import EfficiencySectionsList from './EfficiencySectionsList';
import EfficiencyThingsToReview from './EfficiencyThingsToReview';
import EfficiencyOverviewChart from './EfficiencyOverviewChart';
import EfficiencySpeedInsightsBanner from './EfficiencySpeedInsightsBanner';
import SpeedHistoryCard from '../Performance/SpeedHistoryCard';
import PluginOverlapCard from './PluginOverlapCard';
import LiveSiteInsightsCard from './LiveSiteInsightsCard';
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
 * related-but-distinct signal rather than this tab's own metric. It sits
 * left-middle-right (grid={4}/grid={4}/grid={4}) alongside EfficiencyHeroCard
 * and EfficiencyOverviewChart, per direct instruction, rather than each
 * stacked full-width in its old top-to-bottom order.
 *
 * Closes with PluginOverlapCard filtered to `category="caching"` —
 * promotes the same real cross-sell FilesPluginsTab.tsx introduced (e.g.
 * WP Rocket/W3 Total Cache/WP Super Cache/LiteSpeed Cache active →
 * these efficiency checks + Improve My Speed's own monitoring already
 * cover the same ground) into the tab a user reading about performance
 * is already on.
 *
 * LiveSiteInsightsCard (moved here from AI Copilot's ChatTab.tsx, its
 * original home — see that card's own docblock for what each of its 3-4
 * rows actually reads) sits between the review list and the closing
 * banner: it's a snapshot of the same live signals (security score, AI
 * crawler traffic, Core Web Vitals) a "how's my site doing right now"
 * reader on this tab would want, not something specific to the AI chat
 * experience it used to live under.
 */
const PerformanceTab = () => {
	const { data, isLoading, refetch } = useEfficiencyChecks();

	return (
		<>
			<ContainerComponent>
				<ColumnComponent fullHeight grid={4}>
					<EfficiencyHeroCard
						summary={data?.summary ?? null}
						isLoading={isLoading}
						onReviewImprovements={scrollTo(THINGS_TO_REVIEW_ID)}
					/>
				</ColumnComponent>
				<ColumnComponent fullHeight grid={4}>
						<SpeedHistoryCard />
				</ColumnComponent>
				<ColumnComponent fullHeight grid={4}>
					<EfficiencyOverviewChart
						summary={data?.summary ?? null}
						isLoading={isLoading}
						onViewAll={scrollTo(SECTIONS_TOP_ID)}
					/>
				</ColumnComponent>
			</ContainerComponent>

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

			<LiveSiteInsightsCard />

			<EfficiencySpeedInsightsBanner />

			<PluginOverlapCard category="caching" />
		</>
	);
};

export default PerformanceTab;
