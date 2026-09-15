import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import './SeoVisibility.scss';

interface OffSiteMentionsDummyProps {
	badgeText: string;
	onClick: () => void;
}

/**
 * Dummy stand-in for vulopilot-pro's own BrandIntelligence module
 * OffSiteMentionsCard.tsx (the real Google News/Bing News/Reddit mention
 * tracker) — same PRO-tag-plus-immediate-popup treatment
 * AuthorityTrendsDummy.tsx/KnowledgePanelDummy.tsx (this tab's other two
 * Brand Intelligence cards) already use, replacing the previous plain
 * `ModuleGuardComponent` "not connected yet" fallback this footer slot had
 * — same module-dependency gate as the header's own two cards instead of
 * a differently-shaped lock state for the third.
 *
 * Every stat/row here is fabricated (no real fetch behind any of them) and
 * inert (`.brand-offsite-mentions-dummy-list { pointer-events: none }`,
 * SeoVisibility.scss) — the whole block is one clickable overlay that opens
 * the same Pro popup. Rows read as "(Example mention N)"/"r/example" per
 * direct instruction (KnowledgePanelDummy.tsx's own docblock) — a real
 * post/subreddit-shaped title risks being mistaken for genuine coverage of
 * this site the way "Hello world!"/"Sample Page" (WordPress's own default
 * posts) did on KnowledgePanelDummy's first pass.
 */
const DUMMY_MENTIONS: { title: string; source: string }[] = [
	{ title: __('(Example mention 1)', 'vulopilot'), source: 'r/example' },
	{ title: __('(Example mention 2)', 'vulopilot'), source: 'r/example' },
	{ title: __('(Example mention 3)', 'vulopilot'), source: 'r/example' },
	{ title: __('(Example mention 4)', 'vulopilot'), source: 'r/example' },
];

const OffSiteMentionsDummy = ({ badgeText, onClick }: OffSiteMentionsDummyProps) => (
	<>
		<span className="admin-tag pro-tag">
			<i className="adminfont-pro-tag" />
			{badgeText}
		</span>
		<CardComponent
			title={__('Off-site mentions', 'vulopilot')}
			titleIcon="web-page-website"
			desc={__(
				'Real mentions of your site, found via Google News, Bing News, and Reddit — 3 free, keyless sources. This covers what those 3 indexes surface, not the full web (blogs, other forums, other social platforms, review sites), so treat counts as a real but partial signal, not a comprehensive total the way a paid tool like Ahrefs Brand Radar would be.',
				'vulopilot'
			)}
		>
			<div
				className="brand-offsite-mentions-dummy"
				role="button"
				tabIndex={0}
				onClick={onClick}
				onKeyDown={(event) => {
					if ('Enter' === event.key || ' ' === event.key) {
						onClick();
					}
				}}
			>
				<div className="brand-offsite-mentions-dummy-summary">
					<div className="brand-offsite-mentions-dummy-stat">
						<span className="brand-offsite-mentions-dummy-value">
							12
						</span>
						<span className="desc">{__('mentions', 'vulopilot')}</span>
					</div>
					<div className="brand-offsite-mentions-dummy-stat">
						<span className="brand-offsite-mentions-dummy-value">
							5
						</span>
						<span className="desc">
							{__('citing domains', 'vulopilot')}
						</span>
					</div>
				</div>

				<ul className="brand-offsite-mentions-dummy-list">
					{DUMMY_MENTIONS.map((mention) => (
						<li
							key={mention.title}
							className="brand-offsite-mentions-dummy-item"
							aria-hidden="true"
						>
							<div className="brand-offsite-mentions-dummy-title">
								{mention.title}
							</div>
							<div className="desc brand-offsite-mentions-dummy-meta">
								{mention.source} · {__('today', 'vulopilot')}
							</div>
						</li>
					))}
				</ul>
			</div>
		</CardComponent>
	</>
);

export default OffSiteMentionsDummy;
