import { __ } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import IssuesList from './IssuesList';
import { IssuesFilter } from './NeedsAttentionCard';

interface IssuesTabProps {
	filter: IssuesFilter | null;
}

/**
 * "Issues" (AI Copilot's former "Suggested Actions" tab) — a real,
 * grouped-by-issue-type view of every open finding (`GET /findings/groups`),
 * replacing the old flat top-20-by-severity list. `filter` arrives from
 * NeedsAttentionCard.tsx's own group rows (a real scanner_id/category/label)
 * so IssuesList can preset the matching category tab and auto-select that
 * exact group, instead of landing on an unrelated default.
 */
const IssuesTab = ({ filter }: IssuesTabProps) => (
	<ContainerComponent>
		<IssuesList
			initialScannerId={filter?.scannerId}
			initialCategory={filter?.category}
		/>
	</ContainerComponent>
);

export default IssuesTab;
