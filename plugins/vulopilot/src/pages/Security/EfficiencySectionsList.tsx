import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import type { EfficiencyCheck, EfficiencySection } from './efficiencyChecks';
import { THINGS_TO_REVIEW_ID } from './efficiencyChecks';

const SECTION_ICONS: Record<string, string> = {
	'page-delivery': 'document',
	'data-efficiency': 'database',
	'server-processing': 'coding',
};

interface CheckRowProps {
	check: EfficiencyCheck;
	isLast: boolean;
}

/**
 * One check within a section — icon, title, status badge, description,
 * then its own "Technical details" bullets. Only the first bullet of a
 * check that still needs attention gets an inline "Review →" button (the
 * mockup's own "Page cache: Not detected [Review →]" row) — it jumps down
 * to that same check's row in EfficiencyThingsToReview.tsx rather than
 * duplicating a fix flow here, since a technical-detail bullet isn't its
 * own actionable object the way a Finding row is.
 */
const CheckRow = ({ check, isLast }: CheckRowProps) => (
	<div className={`efficiency-check-row${isLast ? ' is-last' : ''}`}>
		<div className={`efficiency-check-icon efficiency-check-icon--${check.status}`}>
			<i className={`adminfont-${check.icon}`} />
		</div>
		<div className="efficiency-check-body">
			<div className="efficiency-check-heading">
				<span className="efficiency-check-title">{check.title}</span>
				<span className={`efficiency-check-badge is-${check.status}`}>
					{check.badge}
				</span>
			</div>
			<p className="efficiency-check-desc">{check.description}</p>
			{check.technical_details.length > 0 && (
				<>
					<p className="efficiency-check-details-label">
						{__('Technical details', 'vulopilot')}
					</p>
					<ul className="efficiency-check-details">
						{check.technical_details.map((detail, index) => (
							<li key={detail.label} className={`is-${detail.status}`}>
								<span className="efficiency-check-detail-dot" />
								<span className="efficiency-check-detail-text">
									<strong>{detail.label}:</strong> {detail.value}
								</span>
								{index === 0 && check.status === 'attention' && (
									<ButtonInput
										wrapperClass="efficiency-check-detail-review"
										buttons={{
											text: __('Review', 'vulopilot'),
											rightIcon: 'pagination-right-arrow',
											color: 'border-yellow',
											onClick: () =>
												document
													.getElementById(THINGS_TO_REVIEW_ID)
													?.scrollIntoView({
														behavior: 'smooth',
														block: 'start',
													}),
										}}
									/>
								)}
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	</div>
);

interface EfficiencySectionsListProps {
	sections: EfficiencySection[];
	isLoading: boolean;
}

/**
 * The mockup's 3 grouped sections ("Page Delivery"/"WordPress Data
 * Efficiency"/"Server Processing") — each an eyebrow icon+label, a bold
 * question subtitle, then its own checks stacked with a divider between
 * them. Section/check membership comes straight from
 * `GET /efficiency-checks` (Controllers\EfficiencyChecks.php) rather than
 * being re-decided here.
 */
const EfficiencySectionsList = ({
	sections,
	isLoading,
}: EfficiencySectionsListProps) => {
	if (isLoading) {
		return <CardComponent isLoading className="efficiency-section-card" />;
	}

	return (
		<>
			{sections.map((section) => (
				<CardComponent
					key={section.key}
					title={section.label}
					titleIcon={SECTION_ICONS[section.key] || 'document'}
					className="efficiency-section-card"
				>
					<p className="efficiency-section-question">{section.question}</p>
					<div className="efficiency-check-list">
						{section.checks.map((check, index) => (
							<CheckRow
								key={check.id}
								check={check}
								isLast={index === section.checks.length - 1}
							/>
						))}
					</div>
				</CardComponent>
			))}
		</>
	);
};

export default EfficiencySectionsList;
