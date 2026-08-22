import { useEffect } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { scrollToId } from '@zyra/core';
import { ColumnComponent, NoticeComponent, SectionComponent } from '@zyra/components';
import '../SeoVisibility.scss';
import BusinessUnderstandingCard from './BusinessUnderstandingCard';
import CriticalIssuesCard from './CriticalIssuesCard';
import ValidSchemaCard from './ValidSchemaCard';
import KnowledgeGraphSection from './KnowledgeGraphSection';
import IssuesSection from './IssuesSection';
import TechnicalDetailsSection from './TechnicalDetailsSection';
import InspectorSection from './InspectorSection';

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
 * The real "In plain English" `NoticeComponent` above item 1 is wrapped in
 * its own `ColumnComponent grid={12}` — every card row on this page shares
 * one implicit `.container-wrapper` flex-wrap context (there's no local
 * `ContainerComponent` per row), and `NoticeComponent` itself has no real
 * width of its own (sized to its own text content). Left unwrapped, it
 * silently shared a row with whatever `data-cols` card came right after it
 * instead of always starting a fresh row — invisible while that next card
 * was wide (the former grid=8 headline card below), but broke visibly the
 * moment 3 narrower grid=4 cards needed a clean row of their own.
 *
 * 1. `BusinessUnderstandingCard.tsx` — the page's own real hero score gauge
 *    (the same real `entity_score` that briefly lived as its own "Entity
 *    Understanding" card inside KnowledgeGraphSection.tsx — moved up here
 *    instead of shown twice), plus `CriticalIssuesCard.tsx`/
 *    `ValidSchemaCard.tsx` beside it — real top-severity findings and real
 *    schema-coverage stats, replacing this row's former 2nd, wider
 *    "We understand your organization, products, categories." headline+
 *    tiles card per direct instruction to remove that and build these 2
 *    cards from a reference mockup instead. See those 2 files' own
 *    docblocks for exactly which real data each shows.
 * 2. `KnowledgeGraphSection.tsx` — "What AI & Search Understand" (all 6
 *    real entity-type counts + vulopilot-pro's real relationship diagram,
 *    moved up from that section's own sidebar to sit beside the list),
 *    then its own existing real detail cards/Pro slots. That section used
 *    to also have its own "What should you check?" heuristic-checks panel
 *    — removed per direct instruction ("remove redundant content"): it was
 *    a 2nd, less-real "What Needs Fixing"-shaped card duplicating the real
 *    Issues table below, which already covers the same concept with real
 *    backend findings. See that section's own docblock. A 3rd such card —
 *    `WhatNeedsFixingCard.tsx`'s own top-3 findings preview, which used to
 *    render here between this section and the Issues table — was removed
 *    outright per direct instruction ("remove the card - What Needs
 *    Fixing"); `CriticalIssuesCard.tsx` above now covers the same
 *    "preview of real findings, link to the full table" role.
 * 3. `TechnicalDetailsSection.tsx` (NEW) — "Technical Details (Schema &
 *    Markup)", a real "Show for developers" toggle over
 *    `StructuredDataSection.tsx` (Schema Status stats + Schema Coverage
 *    table), unchanged internally.
 * 4. `InspectorSection.tsx` — "Page Inspector", its own separate section
 *    now (own `SectionComponent` heading, own anchor id
 *    `schema-knowledge-inspector`) rather than a 2nd tab inside item 3's
 *    own card — split out per direct instruction ("firstly separate
 *    section the page inspector"). Used to live nested inside
 *    KnowledgeGraphSection.tsx's own sidebar before that, then briefly a
 *    tab inside TechnicalDetailsSection.tsx — moved out both times since
 *    it's a schema concern with its own real, self-contained page-picker
 *    workflow, not a natural sub-tab of either. Internally unchanged.
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

			<ColumnComponent grid={12}>
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
			</ColumnComponent>

			<BusinessUnderstandingCard />
			<CriticalIssuesCard />
			<ValidSchemaCard />

			<KnowledgeGraphSection />

			<SectionComponent
				title={__('All Business Identity Issues', 'vulopilot')}
				desc={__(
					'Every open schema/entity finding behind the preview above, filterable by priority.',
					'vulopilot'
				)}
			/>
			<IssuesSection />

			<div id="schema-knowledge-structured-data">
				<TechnicalDetailsSection />
			</div>

			<div id="schema-knowledge-inspector">
				<SectionComponent
					title={__('Page Inspector', 'vulopilot')}
					desc={__(
						'Check one specific page’s real structured data — its detected schema, problems, JSON-LD, and conflicts.',
						'vulopilot'
					)}
				/>
				<InspectorSection />
			</div>
		</>
	);
};

export default SchemaKnowledgeTab;
