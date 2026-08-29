import { __, sprintf } from '@wordpress/i18n';
import { NoticeComponent } from '@zyra/components';

/**
 * The mockup's closing WCAG banner — rewritten from its own literal
 * wording ("VuloPilot follows WCAG 2.2 Level AA as the standard for our
 * automated tests") since that overstates real coverage: this page's 7
 * scanners each check one specific, well-defined WCAG success criterion
 * (WcagScanner.php cites 2.4.4, KeyboardAccessibilityScanner.php cites
 * 2.4.3, etc. — see each scanner's own docblock), not full WCAG 2.2 AA
 * conformance (~50 success criteria) — the same reasoning
 * AccessibilityManualTestingPanel.tsx's own panel already makes explicit
 * ("automated tests can find many technical issues, but real user
 * experiences need to be checked manually"). Links to the real WCAG 2.2
 * spec for readers who want the full standard this page's checks
 * reference a slice of.
 *
 * `type="banner"` + `displayPosition="inline"` — same shared NoticeComponent
 * conversion GEO's own "In plain English:" banners already went through
 * (see GeoTab.tsx/SeoTab.tsx/etc.). `message` carries the trailing
 * "Learn more" link as real embedded HTML (NoticeComponent renders a
 * plain-string `message` via `dangerouslySetInnerHTML`), same technique
 * those banners' `<strong>` prefixes already rely on.
 */
const AccessibilityWcagNotice = () => (
	<NoticeComponent
		displayPosition="inline-notice"
		message={sprintf(
			'%1$s <a href="%2$s" target="_blank" rel="noopener noreferrer">%3$s</a>',
			__(
				'These automated checks reference specific WCAG 2.2 success criteria (e.g. Focus Order, Link Purpose) — they cover common technical issues, not full WCAG 2.2 AA conformance. Automated tools alone can’t judge everything; see "Some accessibility checks need a person" above.',
				'vulopilot'
			),
			'https://www.w3.org/TR/WCAG22/',
			__('Learn more', 'vulopilot')
		)}
	/>
);

export default AccessibilityWcagNotice;
