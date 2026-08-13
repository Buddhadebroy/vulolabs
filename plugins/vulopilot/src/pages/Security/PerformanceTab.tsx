import { __ } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import EfficiencyHeroCard from './EfficiencyHeroCard';
import EfficiencySectionsList from './EfficiencySectionsList';
import EfficiencyThingsToReview from './EfficiencyThingsToReview';
import EfficiencyOverviewChart from './EfficiencyOverviewChart';
import EfficiencySpeedInsightsBanner from './EfficiencySpeedInsightsBanner';
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
 * "Efficiency Overview" donut, and a closing "Improve My Speed" cross-link
 * banner.
 *
 * Deliberately NOT the same page as `pages/Performance/PerformanceTab.tsx`
 * (a different file, in a different top-level route — "Improve My
 * Speed", Core Web Vitals/PageSpeed/image-optimization findings). This
 * tab is about WordPress/server-side efficiency (caching, object cache,
 * OPcache), read live from `GET /efficiency-checks`
 * (Controllers\EfficiencyChecks.php) — see that hook's own docblock
 * (efficiencyChecks.ts) for why this data isn't stored Findings the way
 * every sibling tab's data is.
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

			<EfficiencySpeedInsightsBanner />
		</>
	);
};

export default PerformanceTab;
