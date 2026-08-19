import { useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { ColumnComponent } from '@zyra/components';
import { scrollToId } from '@zyra/core';
import '../GrowMyTraffic.scss';
import StructuredDataSection from './StructuredDataSection';
import KnowledgeGraphSection from './KnowledgeGraphSection';
import InspectorSection from './InspectorSection';
import IssuesSection from './IssuesSection';

export type SchemaKnowledgeSectionId =
	| 'overview'
	| 'structured-data'
	| 'knowledge-graph'
	| 'inspector'
	| 'issues';

interface SchemaKnowledgeTabProps {
	initialSection?: SchemaKnowledgeSectionId;
}

const SECTIONS: {
	id: SchemaKnowledgeSectionId;
	icon: string;
	label: string;
}[] = [
	{ id: 'knowledge-graph', icon: 'centralized-connections', label: __('Entities & Relationships', 'vulopilot') },
	{ id: 'structured-data', icon: 'attachment', label: __('Structured Data (Schema)', 'vulopilot') },
	{ id: 'issues', icon: 'error', label: __('Issues', 'vulopilot') },
	{ id: 'inspector', icon: 'search', label: __('Inspector', 'vulopilot') },
];

/**
 * "Schema & Knowledge" tab of "Grow My Traffic" — merges the two former
 * standalone tabs "Schema" (SchemaTab.tsx, deleted) and "Knowledge Graph"
 * (KnowledgeGraphTab.tsx, moved to KnowledgeGraphSection.tsx unchanged)
 * into one module. Every section — Structured Data/Knowledge Graph/
 * Inspector/Issues — renders on one continuous page (per direct
 * instruction: no inner tab switcher), each exactly once, under its own
 * anchored heading, same "one real section heading per area, not a
 * second tab bar" pattern AI Copilot's ChatTab.tsx already uses for its
 * own inline Issues section.
 *
 * There is deliberately no separate "Overview"/summary area above these
 * — an earlier version had one (a header card repeating this tab's own
 * title/description, plus two preview cards titled "Structured Data" and
 * "Knowledge Graph" duplicating the real section headings and numbers
 * right below them). Per direct instruction, that whole layer was
 * removed rather than de-duplicated in place: now each area (title,
 * heading, stats) appears exactly once on the page, and this tab's own
 * outer nav label ("Schema & Knowledge" in GEO.tsx's tab bar) is the only
 * place the tab's name/description previously repeated is still shown.
 * `OverviewSection.tsx` and vulopilot-pro's `EntityCompletenessStat.tsx`
 * (its only consumer) were deleted along with it, not left orphaned.
 *
 * `GEO.tsx` still owns which OUTER tab is active (this component is one
 * `content` value in that tab bar). `initialSection` — set only when a
 * bookmarked `?subtab=schema`/`?subtab=knowledge-graph` link landed here
 * (GEO.tsx's own `SUBTAB_ALIASES`) — scrolls to the matching section on
 * mount; `'overview'` (the default) means "land at the top of the page,"
 * kept as a valid value so GEO.tsx's own alias-resolution logic doesn't
 * need to change.
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
			{SECTIONS.map((section) => (
				<div
					key={section.id}
					id={`schema-knowledge-${section.id}`}
					className="schema-knowledge-section"
				>
					<ColumnComponent grid={12}>
						<div className="schema-knowledge-inline-section-heading">
							<i className={`adminfont-${section.icon}`} />
							<h2>{section.label}</h2>
						</div>
					</ColumnComponent>
					{'structured-data' === section.id && <StructuredDataSection />}
					{'knowledge-graph' === section.id && <KnowledgeGraphSection />}
					{'inspector' === section.id && <InspectorSection />}
					{'issues' === section.id && <IssuesSection />}
				</div>
			))}
		</>
	);
};

export default SchemaKnowledgeTab;
