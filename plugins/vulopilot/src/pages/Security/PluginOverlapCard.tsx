/* global appLocalizer */
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ListComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';

interface PluginOverlapMatch {
	plugin_file: string;
	plugin_name: string;
	category: string;
	vulopilot_feature: string;
	module_id: string | null;
	link_tab: string;
}

interface PluginOverlapCardProps {
	/**
	 * Restricts this instance to one `PluginOverlap::KNOWN_OVERLAPS`
	 * category (`seo`/`security`/`accessibility`/`automation`/`caching`)
	 * so the card can be promoted into each theme's own tab — e.g. only
	 * `security` matches on the Security tab. Omit to show every category
	 * — no current call site does this; the one that used to
	 * (Files & Plugins' own unfiltered "what plugins do I have" complete
	 * list) was removed along with that tab per direct instruction, and
	 * this prop was left as-is rather than deleted in case a future tab
	 * wants the unfiltered view back.
	 */
	category?: string;
}

/**
 * "VuloPilot already covers this" — real, currently-*active* plugins
 * (checked server-side via `is_plugin_active()`, `GET /plugin-overlap`,
 * PluginOverlap.php) whose category (SEO/security/accessibility/
 * automation/caching) overlaps with a real VuloPilot feature. Deliberately
 * NOT tied to any vulnerability finding or claim — this repo's own
 * documented policy (LocalSeedVulnerabilityFeed.php's docblock) is to
 * never name a real, currently-maintained third-party plugin as
 * vulnerable, so this card only ever says "you have two tools doing the
 * same job," never "this plugin is unsafe." Each row links to either the
 * Modules page (a real Pro module toggle, `module_id`) or the Performance
 * tab (the caching category, which isn't gated behind a module toggle).
 * Renders nothing at all when no known plugin is active (or none match
 * this instance's `category`) — same "don't show an empty teaser for a
 * comparison that found nothing" posture as this page's other real-data
 * cards.
 *
 * Promoted into every page whose category has real matches — SecurityTab
 * (`category="security"`), Accessibility.tsx (`category="accessibility"`,
 * its own top-level page, `../Security/PluginOverlapCard` imported
 * cross-folder), PerformanceTab (`category="caching"`) — so the
 * cross-sell surfaces in the context a user is already reading about
 * that exact category. No current instance covers the `seo`/`automation`
 * categories — those matches went unsurfaced once FilesPluginsTab.tsx's
 * own unfiltered, complete-list instance was removed along with that tab.
 */
const PluginOverlapCard = ({ category }: PluginOverlapCardProps) => {
	const { data, isLoading } = useApiList<PluginOverlapMatch>('plugin-overlap');
	const matches = category
		? data.filter((match) => match.category === category)
		: data;

	if (isLoading || 0 === matches.length) {
		return null;
	}

	return (
		<CardComponent
			title={__('VuloPilot already covers this', 'vulopilot')}
			titleIcon="module"
			desc={__(
				'These active plugins overlap with a feature already built into VuloPilot — you may be able to simplify your plugin list.',
				'vulopilot'
			)}
		>
			<ListComponent
				className="mini-card list"
				border
				items={matches.map((match) => {
					const hash = match.module_id
						? `#&tab=${match.link_tab}&module=${match.module_id}`
						: `#&tab=${match.link_tab}`;

					return {
						id: match.plugin_file,
						title: match.plugin_name,
						desc: sprintf(
							/* translators: %s is the name of the overlapping VuloPilot feature, e.g. "SEO Copilot". */
							__('VuloPilot feature: %s', 'vulopilot'),
							match.vulopilot_feature
						),
						tags: (
							<ButtonInput
								buttons={{
									text: __('View in VuloPilot →', 'vulopilot'),
									color: 'text-purple',
									onClick: () =>
										window.open(
											`${appLocalizer.admin_url}${hash}`,
											'_self'
										),
								}}
							/>
						),
					};
				})}
			/>
		</CardComponent>
	);
};

export default PluginOverlapCard;
