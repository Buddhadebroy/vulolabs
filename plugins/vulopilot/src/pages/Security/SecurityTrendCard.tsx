import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';

/**
 * "Security Trend" — no per-category security score history exists
 * anywhere in this codebase. The `vulopilot_site_health_snapshot` table
 * does have a `security_score` column in its schema, but
 * `SiteHealthSnapshotRepository::upsert_today()` never writes it — only
 * `overall_score` is ever populated. Reusing the overall-score history
 * here mislabeled as "Security Trend" would misrepresent what it
 * measures, same reasoning that ruled out reusing it for Performance's
 * "Speed History". Honest empty state instead of a fabricated trend line.
 */
const SecurityTrendCard = () => {
	return (
		<CardComponent title={__('Security Trend', 'vulopilot')} titleIcon="security">
			<ModuleGuardComponent
				icon="info"
				title={__('Security trend isn’t tracked yet', 'vulopilot')}
				desc={__(
					'A dedicated security score history isn’t built yet — flag if you want it scoped next.',
					'vulopilot'
				)}
			/>
		</CardComponent>
	);
};

export default SecurityTrendCard;
