/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';

/**
 * The mockup's closing "Looking for page speed insights?" banner — a real
 * link to VuloPilot's own separate "Improve My Speed" page
 * (`routes.ts`'s `tab: 'performance'` top-level route, Pages/Performance/
 * Performance.tsx — Core Web Vitals, PageSpeed Insights scores,
 * image/CSS/JS optimization findings). That page is deliberately a
 * different destination from this tab: this "Performance" tab (inside
 * "Protect My Site") is about *server/WordPress efficiency* (caching,
 * object cache, OPcache — Controllers\EfficiencyChecks.php), not
 * front-end loading speed — same distinction the mockup's own copy draws
 * ("This page checks whether WordPress is configured efficiently. See
 * loading speed, Core Web Vitals and individual slow pages in Improve My
 * Speed.").
 */
const EfficiencySpeedInsightsBanner = () => (
	<div className="efficiency-speed-banner">
		<i className="adminfont-analytics" />
		<div className="efficiency-speed-banner-body">
			<p className="efficiency-speed-banner-title">
				{__('Looking for page speed insights?', 'vulopilot')}
			</p>
			<p className="efficiency-speed-banner-desc">
				{__(
					'This page checks whether WordPress is configured efficiently. See loading speed, Core Web Vitals and individual slow pages in Improve My Speed.',
					'vulopilot'
				)}
			</p>
		</div>
		<ButtonInput
			buttons={{
				text: __('View Speed Overview', 'vulopilot'),
				rightIcon: 'pagination-right-arrow',
				color: 'purple-bg',
				onClick: () =>
					window.open(`${appLocalizer.admin_url}#&tab=performance`, '_self'),
			}}
		/>
	</div>
);

export default EfficiencySpeedInsightsBanner;
