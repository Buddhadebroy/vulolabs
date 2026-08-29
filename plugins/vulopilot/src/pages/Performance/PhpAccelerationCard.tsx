import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { useEfficiencyChecks } from '../Security/efficiencyChecks';
import '../Security/ProtectMySite.scss';

/**
 * "PHP acceleration" (OPcache) status — the one `GET /efficiency-checks`
 * (Controllers\EfficiencyChecks.php) check rendered as its own full card
 * rather than folded into MetricsGrid.tsx's own 3 efficiency tiles (page/
 * browser caching, persistent object cache): those 3 are single-badge
 * facts, while this one also carries a real technical-details list
 * (OPcache enabled/status) that doesn't fit a tile's plain description.
 * Moved here from "Protect My Site" → Site Health per direct instruction.
 * Reads the same live endpoint MetricsGrid.tsx's efficiency tiles and
 * `useEfficiencyChecks()`'s other callers already read — no new endpoint.
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
			desc={__('Whether OPcache is enabled and speeding up PHP execution.', 'vulopilot')}
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
