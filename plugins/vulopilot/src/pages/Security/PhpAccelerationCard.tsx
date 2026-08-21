import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { useEfficiencyChecks } from './efficiencyChecks';
import './ProtectMySite.scss';

/**
 * "PHP acceleration" (OPcache) status — the one `GET /efficiency-checks`
 * (Controllers\EfficiencyChecks.php) check that stayed on this page
 * rather than moving with its 3 siblings into "Performance"'s own
 * Overview tab (EfficiencyHeroCard.tsx/EfficiencySectionsList.tsx/etc,
 * pages/Performance/OverviewTab.tsx) — OPcache is a server-config fact,
 * the same category as this tab's other Server-section checks
 * (ServerHealthScanner), not a page-delivery one. Reads the same live
 * endpoint as those moved components rather than a stored finding, since
 * that's still the only place this check exists.
 */
const PhpAccelerationCard = () => {
	const { data, isLoading } = useEfficiencyChecks();
	const check = data?.sections.find(
		(section) => section.key === 'server-processing'
	)?.checks[0];

	return (
		<CardComponent
			title={__('PHP acceleration', 'vulopilot')}
			titleIcon="coding"
			isLoading={isLoading}
		>
			{!isLoading && check && (
				<>
					<div className="php-acceleration-status">
						<span className={`efficiency-check-badge is-${check.status}`}>
							{check.badge}
						</span>
						<p className="efficiency-check-desc">{check.description}</p>
					</div>
					{check.technical_details.length > 0 && (
						<ul className="efficiency-check-details">
							{check.technical_details.map((detail) => (
								<li key={detail.label} className={`is-${detail.status}`}>
									<span className="efficiency-check-detail-dot" />
									<span className="efficiency-check-detail-text">
										<strong>{detail.label}:</strong> {detail.value}
									</span>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</CardComponent>
	);
};

export default PhpAccelerationCard;
