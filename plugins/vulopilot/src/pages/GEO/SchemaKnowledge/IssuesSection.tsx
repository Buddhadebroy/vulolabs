/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent, PopupComponent } from '@zyra/components';
import { TableCard } from '@zyra/table';
import { useFindingsTable } from '../../../services/useFindingsTable';
import ShowProPopup from '../../../components/Popup/Popup';

/**
 * Real scanner ids behind every schema/entity-adjacent finding this
 * codebase already produces — `schema` (category `schema`),
 * `structured-data`/`sitewide-structured-data` (category `seo`),
 * `organization-schema`/`author-schema` (category `brand`). Deliberately
 * NOT passed alongside a `category` filter to useFindingsTable(): these 5
 * scanners do not share one category, and FindingRepository/
 * AbstractRepository::find_all() ANDs `category` + `scanner_id` as
 * separate WHERE clauses, so a `category` here would silently drop the
 * `schema`- and `brand`-category findings from this list. Same
 * no-`category` shape CrawlerTrafficTab.tsx's own
 * `useFindingsTable({ scannerIds: [...] })` call already uses.
 */
const SCHEMA_ISSUE_SCANNER_IDS = [
	'schema',
	'structured-data',
	'sitewide-structured-data',
	'organization-schema',
	'author-schema',
];

/**
 * "Issues" section of the merged "Schema & Knowledge" tab — "Schema
 * Problems", a real unified view over every open finding those 5 real
 * scanners produce, reusing the same shared findings system every other
 * category page already uses (`useFindingsTable`), with the Critical/
 * Important/Minor pill bar opted into via `pillDimension="priority"`
 * (Findings.php's own real `priority`/`priority_counts` handling) instead
 * of the default Open/Resolved/Ignored/Snoozed status pills. Row
 * rendering and the Fix/Resolve/Ignore action set are entirely unchanged
 * from every other findings table in this codebase.
 */
const IssuesSection = () => {
	const { tableCardProps, error, refetch, isProPopupOpen, closeProPopup } =
		useFindingsTable({
			scannerIds: SCHEMA_ISSUE_SCANNER_IDS,
			layout: 'compact',
			pillDimension: 'priority',
			description: __(
				'No schema/structured-data findings yet — run a scan to check.',
				'vulopilot'
			),
		});

	return (
		<>
			<CardComponent title={__('Schema Problems', 'vulopilot')} titleIcon="error">
				{error ? (
					<ModuleGuardComponent
						icon="error"
						title={__('Could not load findings', 'vulopilot')}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={refetch}
					/>
				) : (
					<TableCard {...tableCardProps} />
				)}
			</CardComponent>

			<PopupComponent
				open={isProPopupOpen}
				onClose={closeProPopup}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default IssuesSection;
