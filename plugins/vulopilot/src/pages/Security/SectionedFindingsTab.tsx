import type { ReactNode } from 'react';
import { CardComponent, ColumnComponent, ContainerComponent } from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';

export interface FindingsSection {
	key: string;
	title: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
}

interface SectionedFindingsTabProps {
	sections: FindingsSection[];
	/** Rendered above every section — e.g. a Pro-registered dashboard card. */
	header?: ReactNode;
	/** Rendered below every section — e.g. a Pro-registered panel. */
	footer?: ReactNode;
}

/**
 * Shared "N sections, each its own independent scanner_id-scoped
 * FindingsTable" shell — the exact pattern GEO/SeoTab.tsx already
 * established (own fetch, own status pills, own pagination per section,
 * rather than one combined table). "Protect My Site"'s Security/Site
 * Health/Files & Plugins/Accessibility tabs all share this one component
 * rather than each re-implementing the same map-over-sections JSX 4
 * times — genuine repetition across 4 real call sites, unlike the
 * "don't prematurely abstract" calls this codebase makes elsewhere for
 * things that only look similar once.
 *
 * `layout="compact"` — each row a title/description/category+severity-
 * badge list item (same shape GEO's own per-section tables and the
 * Overview tab's "Issues that need your attention" glimpse both already
 * use), rather than the default spreadsheet-style grid. Same underlying
 * `/findings` fetch, filters, search, bulk actions, and row actions
 * either way — this only changes how each row renders.
 */
const SectionedFindingsTab = ({
	sections,
	header,
	footer,
}: SectionedFindingsTabProps) => (
	<ContainerComponent general>
		<ColumnComponent>
			{header}
			{sections.map((section) => (
				<CardComponent
					key={section.key}
					// Lets a `header` (e.g. SecurityDetailTab's hero card
					// "Review Issues First" button) scroll straight to one
					// specific section instead of just the top of the tab —
					// same anchor-id/scrollIntoView idea OpenIssuesGlimpse's
					// own `anchorPrefix` already uses, just page-scoped here
					// rather than per-component-instance.
					id={`protect-my-site-section-${section.key}`}
					title={section.title}
					desc={section.description}
				>
					<FindingsTable
						title={section.title}
						description={section.emptyMessage}
						scannerIds={section.scannerIds}
						layout="compact"
					/>
				</CardComponent>
			))}
			{footer}
		</ColumnComponent>
	</ContainerComponent>
);

export default SectionedFindingsTab;
