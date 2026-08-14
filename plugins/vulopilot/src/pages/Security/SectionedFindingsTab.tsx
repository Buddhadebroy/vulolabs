import type { ReactNode } from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import SectionedIssuesTable, {
	SectionedIssuesTab,
} from './SectionedIssuesTable';

export interface FindingsSection {
	key: string;
	title: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
	/**
	 * Set (by the caller, using whatever its own real gating check is —
	 * this generic shell doesn't know about specific module slugs) when
	 * this section's findings only exist while a specific Pro module is
	 * active. Real GEO/AEO precedent: the module that actually gates the
	 * data isn't always the same string as `proModule` below — see
	 * AeoTab.tsx's own crawlability section, gated on GeoInsights being
	 * active but deep-linking its popup to a differently-named 'aeo-insights'
	 * module for more relevant messaging — so `locked` is resolved
	 * externally, not inferred from `proModule` here.
	 */
	locked?: boolean;
	/** Pro module slug passed to ProLockedCard's popup when `locked` is true — see that component's own docblock. */
	proModule?: string;
}

/** DOM anchor id the merged table below carries — what a `header`'s own "Review Issues"-style button scrolls to. */
export const SECTIONED_FINDINGS_TABLE_ID = 'protect-my-site-sectioned-issues-table';

interface SectionedFindingsTabProps {
	title: string;
	sections: FindingsSection[];
	activeTab: SectionedIssuesTab;
	onTabChange: (tab: SectionedIssuesTab) => void;
	/** Rendered above the table — e.g. a hero card or a Pro-registered dashboard card. */
	header?: ReactNode;
	/** Rendered below the table — e.g. a Pro-registered panel. */
	footer?: ReactNode;
}

/**
 * Shared "one real, unified findings table with a category tab bar" shell
 * — SectionedIssuesTable.tsx (same merge pattern WooCommerce's own "All
 * WooCommerce Issues" already established), replacing what used to be N
 * separate independent scanner_id-scoped FindingsTable cards stacked one
 * per section. "Protect My Site"'s Site Health/Files & Plugins tabs both
 * share this one component (SecurityTab.tsx/AccessibilityTab.tsx
 * use SectionedIssuesTable directly instead, since each already has its
 * own extra above-the-table content this shell doesn't need to know
 * about) rather than each re-implementing the same tab-state wiring twice.
 *
 * `activeTab`/`onTabChange` are threaded straight through from the caller
 * (not owned here) so a `header` hero card's own "Review Issues" button
 * can jump straight to a specific tab of the table below it.
 */
const SectionedFindingsTab = ({
	title,
	sections,
	activeTab,
	onTabChange,
	header,
	footer,
}: SectionedFindingsTabProps) => (
	<ContainerComponent>
		<ColumnComponent>
			{header}
			<SectionedIssuesTable
				id={SECTIONED_FINDINGS_TABLE_ID}
				title={title}
				sections={sections}
				activeTab={activeTab}
				onTabChange={onTabChange}
			/>
			{footer}
		</ColumnComponent>
	</ContainerComponent>
);

export default SectionedFindingsTab;
