import { __ } from '@wordpress/i18n';
import { AnalyticsComponent, BadgeComponent, CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import './SeoVisibility.scss';

interface KnowledgePanelDummyProps {
	badgeText: string;
	onClick: () => void;
}

/**
 * Dummy stand-in for vulopilot-pro's own BrandIntelligence module
 * KnowledgePanelCard.tsx (the real Organization/author Person schema
 * one-click optimizer) — same PRO-tag-plus-immediate-popup treatment
 * AuthorityTrendsDummy.tsx (this tab's other Brand Intelligence card) and
 * AutomationsManageDummy.tsx already use, so this section still shows on
 * BrandVisibilityTab.tsx when the module isn't active instead of being
 * absent from the DOM.
 *
 * Both the stat tile and the findings list are entirely fabricated (no
 * real scan behind any row) and inert
 * (`.brand-knowledge-panel-dummy-list { pointer-events: none }`,
 * SeoVisibility.scss) — the whole block plus the header's own "Optimize
 * Knowledge Panel" button all open the same Pro popup rather than any of
 * them doing something real.
 */
/**
 * Deliberately NOT plausible real post titles ("Hello world!"/"Sample
 * Page" — WordPress's own default posts, present on virtually every
 * install — were tried here first and read as real scan results about
 * this site's own content, the opposite of what a fabricated example
 * should do) — "(Example post N)" so this list can never be mistaken for
 * a real finding regardless of what's actually on the site it renders on.
 */
const DUMMY_FINDINGS: { title: string }[] = [
	{ title: __('No author schema found: (Example post 1)', 'vulopilot') },
	{ title: __('No author schema found: (Example post 2)', 'vulopilot') },
	{ title: __('No author schema found: (Example post 3)', 'vulopilot') },
	{ title: __('No author schema found: (Example post 4)', 'vulopilot') },
];

const KnowledgePanelDummy = ({ badgeText, onClick }: KnowledgePanelDummyProps) => (
	<>
		<span className="admin-tag pro-tag">
			<i className="adminfont-pro-tag" />
			{badgeText}
		</span>
		<CardComponent
			title={__('Knowledge Panel Optimization', 'vulopilot')}
			titleIcon="identity-verification"
			desc={__(
				'Adds Organization schema (homepage) and author Person schema (posts/pages) wherever missing — the structured data Google Knowledge Panels and AI answer engines read. Deterministic, no AI cost.',
				'vulopilot'
			)}
			action={
				<ButtonInput
					buttons={{
						text: __('Optimize Knowledge Panel', 'vulopilot'),
						rightIcon: 'pagination-right-arrow',
						color: 'text-purple',
						onClick,
					}}
				/>
			}
		>
			<div
				className="brand-knowledge-panel-dummy"
				role="button"
				tabIndex={0}
				onClick={onClick}
				onKeyDown={(event) => {
					if ('Enter' === event.key || ' ' === event.key) {
						onClick();
					}
				}}
			>
				<AnalyticsComponent
					variant="small-card"
					cols={3}
					data={[
						{
							icon: 'person',
							colorClass: 'yellow',
							number: 4,
							text: __(
								'pages missing an author schema',
								'vulopilot'
							),
						},
					]}
				/>
				<ul className="brand-knowledge-panel-dummy-list">
					{DUMMY_FINDINGS.map((finding) => (
						<li
							key={finding.title}
							className="brand-knowledge-panel-dummy-item"
							aria-hidden="true"
						>
							<span className="brand-knowledge-panel-dummy-icon">
								<i className="adminfont-error" />
							</span>
							<div className="brand-knowledge-panel-dummy-title">
								{finding.title}
							</div>
							<BadgeComponent
								text={__('Author Schema', 'vulopilot')}
								color="purple"
								variant="dot"
							/>
						</li>
					))}
				</ul>
			</div>
		</CardComponent>
	</>
);

export default KnowledgePanelDummy;
