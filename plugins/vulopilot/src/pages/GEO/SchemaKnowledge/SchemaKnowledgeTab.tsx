import { useEffect } from 'react';
import { scrollToId } from '@zyra/core';
import { ContainerComponent } from '@zyra/components';
import '../SeoVisibility.scss';
import BusinessProfileCard from './BusinessProfileCard';
import CriticalIssuesCard from './CriticalIssuesCard';
import ValidSchemaCard from './ValidSchemaCard';
import KnowledgeGraphSection from './KnowledgeGraphSection';
import IssuesSection from './IssuesSection';
import StructuredDataSection from './StructuredDataSection';
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
 * An "In plain English" `NoticeComponent` intro banner and a 5th
 * `IssuesSection.tsx` section (`SchemaKnowledgeSectionId`'s own `'issues'`
 * member, and this file's own `IssuesSection` import, both still reflect
 * it) are described by older layers of this docblock and by this file's
 * own types as if still present, but neither is actually rendered below —
 * confirmed via lint (both totally unreferenced) and by reading the
 * current return value, not just this comment. Unlike every other section
 * change documented here, there's no "removed per direct instruction" note
 * for either, so this reads as an unintentional gap rather than a
 * deliberate one — flagged rather than silently deleted (`IssuesSection`
 * is a real, substantial, working component, same "leave real code before
 * assuming it should be deleted" posture BrokenLinksSection.tsx's own
 * docblocks establish elsewhere in this folder) or silently re-added
 * (restoring a whole missing tab section is a product call, not a
 * lint-cleanup one).
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
 * 3. `StructuredDataSection.tsx` — "Technical Details (Schema & Markup)",
 *    real Schema Status stats + Schema Coverage table, unchanged
 *    internally. Used to be wrapped in its own `TechnicalDetailsSection.tsx`
 *    "Show for developers" toggle — that toggle's own `useState` had no
 *    control anywhere that ever called its setter, so the section was
 *    unconditionally visible regardless; removed as dead code (single
 *    consumer, this file) rather than kept as an inert always-on wrapper.
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
			<BusinessProfileCard />
			<CriticalIssuesCard />
			<ValidSchemaCard />

			<KnowledgeGraphSection />

			<div id="schema-knowledge-structured-data">
				<StructuredDataSection />
			</div>

			<InspectorSection />
		</ContainerComponent>
	);
};

export default SchemaKnowledgeTab;
