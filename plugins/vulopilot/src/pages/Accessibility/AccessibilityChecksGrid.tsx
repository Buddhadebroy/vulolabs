import { __, sprintf, _n } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { MetricTileComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { ACCESSIBILITY_CHECKS } from './accessibilityChecks';

interface AccessibilityFinding {
	id: number;
	page?: string;
}

/** Real distinct-pages-affected count from one check's own open-findings rows — same `Set` technique this file's own previous `CheckTile` sub-component already used. */
const pagesAffectedIn = (rows: AccessibilityFinding[]): number =>
	new Set(rows.map((row) => row.page).filter(Boolean)).size;

interface AccessibilityChecksGridProps {
	/** Switches the merged issues table (SectionedIssuesTable.tsx, further down this tab) to this check's own tab and scrolls to it. */
	onReview: (checkKey: string) => void;
}

/**
 * The mockup's "Accessibility Checks" 5-tile grid, plus a real 6th "All
 * Checks" tile (direct instruction) combining the other 5 — one real
 * scanner_id-scoped open-findings count + distinct-pages-affected count
 * per tile (ACCESSIBILITY_CHECKS.tsx's own shared definitions), each
 * "Review" switching the merged issues table further down this tab to
 * that check's own tab.
 *
 * Real `<MetricTileComponent>` (@zyra/components), not the now-removed
 * local `components/MetricTile/MetricTile.tsx` shell — that component
 * only ever wrapped this same real one, one grid/one item shape behind an
 * extra layer, per direct instruction to delete it and call the shared
 * component directly everywhere it was used.
 *
 * `useApiList()` is called once per real check below, unrolled rather
 * than inside `ACCESSIBILITY_CHECKS.map()` — same fixed-tile-list
 * pattern SecurityMetricsGrid.tsx's own `useSectionStatus()` calls
 * already use, since a hook call inside a `.map()` callback is a real
 * rules-of-hooks violation regardless of the array being static. This
 * also gives every tile its own real per-check loading state, which
 * `MetricTileComponent`'s own `isLoading` can't (it's one flag for the
 * whole grid, not per item) — this grid instead treats "all 6 real
 * fetches have resolved" as the whole grid's loading state.
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
		<MetricTileComponent
			cols={3}
			isLoading={isLoading}
			data={ACCESSIBILITY_CHECKS.map((check, index) => {
				const result = results[index];
				const pagesAffected = pagesAffectedIn(result.data);

				return {
					id: check.key,
					icon: check.icon,
					iconColor: check.color,
					title: check.title,
					// `status`'s own `color` expects a semantic class-name
					// suffix (`admin-badge {color}`), not the arbitrary real
					// hex `check.color` carries — so the colored issue count
					// (this tile's own real headline number) is an
					// inline-styled span inside `desc` instead, same literal
					// hex this tile's own icon/border already use.
					desc: (
						<>
							<span
								className="accessibility-check-count"
								style={{ color: check.color }}
							>
								{sprintf(
									/* translators: %d is the number of open findings. */
									_n('%d issue', '%d issues', result.total, 'vulopilot'),
									result.total
								)}
							</span>
							<div className="accessibility-check-desc">
								{check.description}
							</div>
						</>
					),
					stat:
						result.total > 0
							? sprintf(
									/* translators: %d is the number of distinct pages affected. */
									_n(
										'%d page affected',
										'%d pages affected',
										pagesAffected,
										'vulopilot'
									),
									pagesAffected
								)
							: undefined,
					footer: (
						<ButtonInput
							buttons={{
								text: __('Review', 'vulopilot'),
								rightIcon: 'pagination-right-arrow',
								color: 'border-purple',
								onClick: () => onReview(check.key),
							}}
						/>
					),
				};
			})}
		/>
	);
};

export default AccessibilityChecksGrid;
