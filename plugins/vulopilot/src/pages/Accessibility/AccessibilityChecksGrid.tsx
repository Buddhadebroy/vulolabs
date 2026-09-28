import { __, sprintf, _n } from '@wordpress/i18n';
import { ListComponent, TypographyComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { ACCESSIBILITY_CHECKS } from './accessibilityChecks';

interface AccessibilityFinding {
	id: number;
	page?: string;
}

/** Real distinct-pages-affected count from one check's own open-findings rows. */
const pagesAffectedIn = (rows: AccessibilityFinding[]): number =>
	new Set(rows.map((row) => row.page).filter(Boolean)).size;

interface AccessibilityChecksGridProps {
	/** Switches the merged issues table (SectionedIssuesTable.tsx, further down this tab) to this check's own tab and scrolls to it. */
	onReview: (checkKey: string) => void;
}

/**
 * The mockup's "Accessibility Checks" 5-tile grid, plus a real 6th "All Checks" tile combining the
 * other 5.
 */
const AccessibilityChecksGrid = ({ onReview }: AccessibilityChecksGridProps) => {
	const pageStructure = useApiList<AccessibilityFinding>('findings', {
		scanner_id: ACCESSIBILITY_CHECKS[0].scannerIds.join(','),
		status: 'open',
		per_page: 100,
	});
	const imagesMedia = useApiList<AccessibilityFinding>('findings', {
		scanner_id: ACCESSIBILITY_CHECKS[1].scannerIds.join(','),
		status: 'open',
		per_page: 100,
	});
	const linksForms = useApiList<AccessibilityFinding>('findings', {
		scanner_id: ACCESSIBILITY_CHECKS[2].scannerIds.join(','),
		status: 'open',
		per_page: 100,
	});
	const keyboardUse = useApiList<AccessibilityFinding>('findings', {
		scanner_id: ACCESSIBILITY_CHECKS[3].scannerIds.join(','),
		status: 'open',
		per_page: 100,
	});
	const visualReadability = useApiList<AccessibilityFinding>('findings', {
		scanner_id: ACCESSIBILITY_CHECKS[4].scannerIds.join(','),
		status: 'open',
		per_page: 100,
	});
	const allChecks = useApiList<AccessibilityFinding>('findings', {
		scanner_id: ACCESSIBILITY_CHECKS[5].scannerIds.join(','),
		status: 'open',
		per_page: 100,
	});

	const results = [
		pageStructure,
		imagesMedia,
		linksForms,
		keyboardUse,
		visualReadability,
		allChecks,
	];
	const isLoading = results.some((result) => result.isLoading);

	return (
		<ListComponent
			className="mini-card report list"
			loading={isLoading}
			skeletonCount={ACCESSIBILITY_CHECKS.length}
			items={ACCESSIBILITY_CHECKS.map((check, index) => {
				const result = results[index];
				const pagesAffected = pagesAffectedIn(result.data);

				return {
					id: check.key,
					icon: check.icon,
					title: check.title,
					tags: (
						<TypographyComponent
							variant="desc"
						>
							{sprintf(
								/* translators: %d: real number of open issues or findings. */
								_n('%d issue', '%d issues', result.total, 'vulopilot'),
								result.total
							)}
						</TypographyComponent>
					),
					desc:
						result.total > 0
							? sprintf(
									/* translators: %d: real number of pages this affects. */
									_n(
										'%d page affected',
										'%d pages affected',
										pagesAffected,
										'vulopilot'
									),
									pagesAffected
								)
							: check.description,
					action: () => onReview(check.key),
				};
			})}
		/>
	);
};

export default AccessibilityChecksGrid;