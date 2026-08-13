import { __, sprintf, _n } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import {
	ACCESSIBILITY_CHECKS,
	type AccessibilityCheck,
} from './accessibilityChecks';

interface AccessibilityFinding {
	id: number;
	page?: string;
}

interface CheckTileProps {
	check: AccessibilityCheck;
	onReview: (checkKey: string) => void;
}

const CheckTile = ({ check, onReview }: CheckTileProps) => {
	const { data, total, isLoading } = useApiList<AccessibilityFinding>(
		'findings',
		{
			scanner_id: check.scannerIds.join(','),
			status: 'open',
			per_page: 100,
		}
	);

	const pagesAffected = new Set(
		data.map((row) => row.page).filter(Boolean)
	).size;

	return (
		<CardComponent
			className="accessibility-check-tile"
			isLoading={isLoading}
		>
			<i
				className={`adminfont-${check.icon} accessibility-check-icon`}
				style={{ color: check.color }}
			/>
			<div className="accessibility-check-title">{check.title}</div>
			{!isLoading && (
				<span
					className="accessibility-check-count"
					style={{ color: check.color }}
				>
					{sprintf(
						/* translators: %d is the number of open findings. */
						_n('%d issue', '%d issues', total, 'vulopilot'),
						total
					)}
				</span>
			)}
			<div className="accessibility-check-desc">{check.description}</div>
			{!isLoading && total > 0 && (
				<div className="accessibility-check-pages">
					{sprintf(
						/* translators: %d is the number of distinct pages affected. */
						_n(
							'%d page affected',
							'%d pages affected',
							pagesAffected,
							'vulopilot'
						),
						pagesAffected
					)}
				</div>
			)}
			<ButtonInput
				wrapperClass="accessibility-check-review"
				buttons={{
					text: __('Review', 'vulopilot'),
					rightIcon: 'pagination-right-arrow',
					color: 'border-purple',
					onClick: () => onReview(check.key),
				}}
			/>
		</CardComponent>
	);
};

interface AccessibilityChecksGridProps {
	/** Switches the merged issues table (SectionedIssuesTable.tsx, further down this tab) to this check's own tab and scrolls to it. */
	onReview: (checkKey: string) => void;
}

/**
 * The mockup's "Accessibility Checks" 5-tile grid — one real
 * scanner_id-scoped open-findings count + distinct-pages-affected count
 * per tile (ACCESSIBILITY_CHECKS.tsx's own shared definitions), each
 * "Review" switching the merged issues table further down this tab to
 * that check's own tab.
 */
const AccessibilityChecksGrid = ({ onReview }: AccessibilityChecksGridProps) => (
	<div className="accessibility-checks-grid">
		{ACCESSIBILITY_CHECKS.map((check) => (
			<CheckTile key={check.key} check={check} onReview={onReview} />
		))}
	</div>
);

export default AccessibilityChecksGrid;
