import { useEffect } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { scrollToId } from '@zyra/core';
import { NoticeComponent, SectionComponent } from '@zyra/components';
import '../SeoVisibility.scss';
import BusinessUnderstandingCard from './BusinessUnderstandingCard';
import KnowledgeGraphSection from './KnowledgeGraphSection';
import WhatNeedsFixingCard from './WhatNeedsFixingCard';
import IssuesSection from './IssuesSection';
import TechnicalDetailsSection from './TechnicalDetailsSection';

export type SchemaKnowledgeSectionId =
	| 'overview'
	| 'structured-data'
	| 'knowledge-graph'
	| 'inspector'
	| 'issues';

interface SchemaKnowledgeTabProps {
	initialSection?: SchemaKnowledgeSectionId;
}

/**
 * "Business Identity & Schema" tab of "SEO & Visibility" (renamed from
 * "Schema & Knowledge" — direct instruction, rebuilt to match a newer
 * reference mockup's own information architecture). Every section here
 * still renders on one continuous scrolling page under its own anchored
 * heading, same "no inner tab switcher" precedent this merge already
 * established (see this file's own earlier history) — the mockup's own
 * layout doesn't call for real inner tabs the way "Crawl & URLs" needed
 * them (CrawlUrlsTab.tsx), just a clearer visual order:
 *
 * 1. `BusinessUnderstandingCard.tsx` (NEW) — the page's own real hero: a
 *    score gauge (the same real `entity_score` that briefly lived as its
 *    own "Entity Understanding" card inside KnowledgeGraphSection.tsx —
 *    moved up here instead of shown twice) plus 4 featured real entity-
 *    type tiles (Organization/Products/Location/Categories).
 * 2. `KnowledgeGraphSection.tsx` — "What AI & Search Understand" (all 6
 *    real entity-type counts + vulopilot-pro's real relationship diagram,
 *    moved up from that section's own sidebar to sit beside the list),
 *    then its own existing real detail cards/checks/Pro slots, unchanged.
 * 3. `WhatNeedsFixingCard.tsx` (NEW) — a real top-3 preview of the exact
 *    same findings `IssuesSection.tsx`'s own full table below already
 *    fetches, per the mockup's own compact "top issues + View all" shape.
 *    "View all issues" and "Review" both scroll down to that real table
 *    (`schema-knowledge-issues`) rather than re-implementing it twice.
 * 4. `TechnicalDetailsSection.tsx` (NEW) — "Technical Details (Schema &
 *    Markup)" as a real tabbed panel with a real "Show for developers"
 *    toggle, not a flat scroll — see that file's own docblock for why it's
 *    2 real tabs (Schema Summary/Page Inspector) rather than the mockup's
 *    literal 4. `StructuredDataSection.tsx`/`InspectorSection.tsx` are
 *    unchanged internally, just tabbed now. InspectorSection.tsx used to
 *    live nested inside KnowledgeGraphSection.tsx's own sidebar; moved
 *    out since it's a schema concern, not an entity/knowledge-graph one
 *    (see that file's own docblock).
 *
 * `initialSection` — set only when a bookmarked `?subtab=schema`/
 * `?subtab=knowledge-graph` link landed here (GEO.tsx's own
 * `SUBTAB_ALIASES`) — scrolls to the matching section on mount;
 * `'overview'` (the default) means "land at the top of the page."
 */
const SchemaKnowledgeTab = ({
	initialSection = 'overview',
}: SchemaKnowledgeTabProps) => {
	useEffect(() => {
		if ('overview' !== initialSection) {
			scrollToId(`schema-knowledge-${initialSection}`);
		}
		// Only the initial mount-time value matters — this never re-runs
		// on a later, unrelated re-render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<>
			<div className="schema-page-header">
				<div className="schema-page-header-title">
					<i className="adminfont-centralized-connections" />
					<h2>{__('Business Identity & Schema', 'vulopilot')}</h2>
				</div>
				<p className="desc">
					{__(
						'See how Google and AI understand your business — and whether your site communicates it correctly.',
						'vulopilot'
					)}
				</p>
			</div>

			<NoticeComponent
				// type="banner"
				displayPosition="inline"
				message={sprintf(
					'<strong>%1$s</strong> %2$s',
					__('In plain English:', 'vulopilot'),
					__(
						'This shows what search engines know about your business, how those things connect, and what’s missing or unclear.',
						'vulopilot'
					)
				)}
			/>

			<BusinessUnderstandingCard />

			<KnowledgeGraphSection />

			<WhatNeedsFixingCard />
			
			<SectionComponent
				title={__('All Business Identity Issues', 'vulopilot')}
				desc={__(
					'Every open schema/entity finding behind the preview above, filterable by priority.',
					'vulopilot'
				)}
			/>
			<IssuesSection />

			<div id="schema-knowledge-structured-data">
				<div id="schema-knowledge-inspector">
					<TechnicalDetailsSection />
				</div>
			</div>
		</>
	);
};

export default SchemaKnowledgeTab;
