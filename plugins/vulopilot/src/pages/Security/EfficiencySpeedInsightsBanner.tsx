/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { NoticeComponent } from '@zyra/components';

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
	<NoticeComponent
		type="info"
		displayPosition="inline-notice"
		title={__('Looking for page speed insights?', 'vulopilot')}
		message={__(
			'This page checks whether WordPress is configured efficiently. See loading speed, Core Web Vitals and individual slow pages in Improve My Speed.',
			'vulopilot'
		)}
		actionLabel={`${__('View Speed Overview', 'vulopilot')} →`}
		onAction={() =>
			window.open(`${appLocalizer.admin_url}#&tab=performance`, '_self')
		}
	/>
);

export default EfficiencySpeedInsightsBanner;
