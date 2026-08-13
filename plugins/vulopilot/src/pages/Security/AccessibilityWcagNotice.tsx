import { __ } from '@wordpress/i18n';

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
 */
const AccessibilityWcagNotice = () => (
	<div className="accessibility-wcag-notice">
		<i className="adminfont-check" />
		<p>
			{__(
				'These automated checks reference specific WCAG 2.2 success criteria (e.g. Focus Order, Link Purpose) — they cover common technical issues, not full WCAG 2.2 AA conformance. Automated tools alone can’t judge everything; see "Some accessibility checks need a person" above.',
				'vulopilot'
			)}{' '}
			<a
				href="https://www.w3.org/TR/WCAG22/"
				target="_blank"
				rel="noopener noreferrer"
			>
				{__('Learn more', 'vulopilot')}
			</a>
		</p>
	</div>
);

export default AccessibilityWcagNotice;
