import type { ReactNode } from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import SectionedIssuesTable, {
	SectionedIssuesTab,
} from './SectionedIssuesTable';

export interface FindingsSection {
	key: string;
	title: string;
	description: string;
	/** adminfont icon name (no `adminfont-` prefix) shown next to this section's tab-bar title in SectionedIssuesTable's own header. */
	icon?: string;
	emptyMessage: string;
	scannerIds: string[];
	locked?: boolean;
	proModule?: string;
}

/** DOM anchor id the merged table below carries - what a `header`'s own "Review Issues"-style button scrolls to. */
export const SECTIONED_FINDINGS_TABLE_ID = 'protect-my-site-sectioned-issues-table';

interface SectionedFindingsTabProps {
	title: string;
	sections: FindingsSection[];
	activeTab: SectionedIssuesTab;
	onTabChange: (tab: SectionedIssuesTab) => void;
	header?: ReactNode;
	footer?: ReactNode;
}

/**
 * Shared "one real, unified findings table with a category tab bar" shell.
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
