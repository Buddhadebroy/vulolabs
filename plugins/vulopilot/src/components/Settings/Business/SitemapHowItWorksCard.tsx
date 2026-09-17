import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import './SitemapHowItWorksCard.scss';

/**
 * Sitemap tab's own right-side "How it works" explainer card, per direct
 * instruction (a reference mockup showing this exact 4-step card). Same
 * real numbered-circle-step markup Issues/IssueDetailPanel.tsx's own
 * "Recommended fix" steps already use (`<ol>`/`<li>`/a
 * `step-number`/`step-text` span pair), scoped to this card's own class
 * names rather than reusing that file's classes directly, since the two
 * aren't otherwise related.
 *
 * All 4 steps describe real, already-implemented behavior — nothing
 * fabricated:
 * 1. SitemapManager.php narrows WordPress core's own native sitemap to
 *    whichever post types/taxonomies `sitemap_xml_post_types`/
 *    `sitemap_xml_taxonomies` include (Sitemap.ts's own "Post types &
 *    taxonomies in sitemap" section, just above this card).
 * 2. Same real `/sitemap.xml` URL this tab's own "Enable sitemap" field
 *    and "Active & up to date" notice already reference (RobotsSitemap.php's
 *    own real `/wp-sitemap.xml` → `/sitemap.xml` discovery-order fallback).
 * 3. `maybe_ping_search_engines()` fires on WordPress's own `save_post`
 *    hook — covers publish AND update, not delete (no `delete_post`/
 *    `trashed_post` hook exists), so this step says "publish or update"
 *    rather than the mockup's own "publish, update, or delete" wording,
 *    which isn't real here.
 * 4. A general, true statement about focused sitemaps — not a specific
 *    metric this plugin measures, so kept as the same plain claim the
 *    mockup itself makes rather than inventing a number.
 *
 * No "View documentation →" link — same "omit rather than fabricate a
 * destination" posture TitleFormatsPanel.tsx's own docblock already
 * documents for its own "How it works?"/"Need Help" mockup elements; this
 * codebase has no real sitemap documentation page to link to.
 */
const SITEMAP_STEPS: string[] = [
	__("VuloPilot builds an XML sitemap from the content you've selected.", 'vulopilot'),
	__("It's published at yoursite.com/sitemap.xml once enabled.", 'vulopilot'),
	__('Search engines are notified automatically on publish or update.', 'vulopilot'),
	__('Cleaner sitemaps get crawled and indexed faster.', 'vulopilot'),
];

const SitemapHowItWorksCard = () => (
	<CardComponent title={__('How it works', 'vulopilot')}>
		<ol className="sitemap-how-it-works-steps">
			{SITEMAP_STEPS.map((step, index) => (
				<li key={index} className="sitemap-how-it-works-step">
					<span className="sitemap-how-it-works-step-number">
						{index + 1}
					</span>
					<span className="sitemap-how-it-works-step-text">
						{step}
					</span>
				</li>
			))}
		</ol>
	</CardComponent>
);

export default SitemapHowItWorksCard;
