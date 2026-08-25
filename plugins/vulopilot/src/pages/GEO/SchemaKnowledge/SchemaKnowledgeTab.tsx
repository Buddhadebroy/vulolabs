import { useEffect } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { scrollToId } from '@zyra/core';
import { ColumnComponent, NoticeComponent, SectionComponent, ContainerComponent } from '@zyra/components';
import '../SeoVisibility.scss';
import BusinessProfileCard from './BusinessProfileCard';
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
 * its own `ColumnComponent ` — every card row on this page shares
 * one implicit `.container-wrapper` flex-wrap context (there's no local
 * `ContainerComponent` per row), and `NoticeComponent` itself has no real
 * width of its own (sized to its own text content). Left unwrapped, it
 * silently shared a row with whatever `data-cols` card came right after it
 * instead of always starting a fresh row — invisible while that next card
 * was wide (the former grid=8 headline card below), but broke visibly the
 * moment 3 narrower grid=4 cards needed a clean row of their own.
 *
 * 1. `BusinessProfileCard.tsx` — "Business Profile", per a newer reference
 *    mockup: the same real `entity_score` gauge the former, narrower
 *    `BusinessUnderstandingCard.tsx` showed alone (now removed — this
 *    replaces it), beside a real per-field table of exactly what
 *    Services\EntityExtractor detected (business name/type, people,
 *    services, products, locations, contact details) and a real "Update
 *    Information" deep link. `CriticalIssuesCard.tsx`/`ValidSchemaCard.tsx`
 *    still render beside it, unchanged — real top-severity findings and
 *    real schema-coverage stats. See those 3 files' own docblocks for
 *    exactly which real data each shows.
 * 2. `KnowledgeGraphSection.tsx` — "What AI & Search Understand" (all 6
 *    real entity-type counts + a real hub-and-spoke diagram in the middle
 *    pane, moved up from that section's own sidebar to sit beside the
 *    list), then its own existing real detail cards/Pro slots. That
 *    diagram used to also render a 2nd time as its own standalone
 *    `KnowledgeGraphDiagramCard.tsx` card here — removed per direct
 *    instruction ("remove this section"), since it was the exact same
 *    real diagram (`KnowledgeGraphDiagramCard.tsx`'s own exported
 *    `KnowledgeGraphDiagram`) KnowledgeGraphSection.tsx's own middle pane
 *    already renders at `compact` size; that file itself still exists
 *    (and is still imported from) purely for that shared component, not
 *    as a standalone card any more — see its own docblock. That section
 *    used to also have its own "What should you check?" heuristic-checks
 *    panel — removed per direct instruction ("remove redundant content"):
 *    it was a 2nd, less-real "What Needs Fixing"-shaped card duplicating
 *    the real Issues table below, which already covers the same concept
 *    with real backend findings. See that section's own docblock. A 3rd
 *    such card — `WhatNeedsFixingCard.tsx`'s own top-3 findings preview,
 *    which used to render here between this section and the Issues
 *    table — was removed outright per direct instruction ("remove the
 *    card - What Needs Fixing"); `CriticalIssuesCard.tsx` above now
 *    covers the same "preview of real findings, link to the full table"
 *    role.
 * 3. `TechnicalDetailsSection.tsx` (NEW) — "Technical Details (Schema &
 *    Markup)", a real "Show for developers" toggle over
 *    `StructuredDataSection.tsx` (Schema Status stats + Schema Coverage
 *    table), unchanged internally.
 * 4. `InspectorSection.tsx` — "Page Inspector", its own separate section
 *    now (own `SectionComponent` heading, own anchor id
 *    `schema-knowledge-inspector`) rather than a 2nd tab inside item 2's
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
		<ContainerComponent>
			{/*
			 * NavigatorHeaderComponent above the tab bar always reads "Grow
			 * My Traffic" for every tab (by design — every other tab here
			 * follows that same shared-header convention, see GEO.tsx's own
			 * docblock), so this page's own distinct title/subtitle
			 * (matching the reference mockup) renders as its own real
			 * heading here instead of fighting that shared architecture —
			 * zyra's own `SectionComponent` (same real title+icon+desc
			 * component NavigatorComponent's own `renderSettingHeaderInfo()`
			 * already uses internally) instead of hand-rolled markup.
			 */}
			<SectionComponent
				icon="centralized-connections"
				title={__('Business Identity & Schema', 'vulopilot')}
				desc={__(
					'See how Google and AI understand your business — and whether your site communicates it correctly.',
					'vulopilot'
				)}
			/>

			<ColumnComponent >
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

			<BusinessProfileCard />
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
		</ContainerComponent>
	);
};

export default SchemaKnowledgeTab;
