import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';

/**
 * "Speed History" — no per-category performance score history exists
 * anywhere in this codebase. The only score-history table
 * (`vulopilot_site_health_snapshots`, Pro's AdvancedReports module) tracks
 * the *overall* dashboard score, a different metric than performance
 * alone — reusing it here mislabeled as "Speed History" would
 * misrepresent what it measures, same reasoning that ruled out reusing
 * `ai-history` for Create Content's "Content Created" stat. Honest empty
 * state instead of a fabricated trend line or "+12 points this week".
 */
const SpeedHistoryCard = () => {
	return (
		<CardComponent title={__('Speed History', 'vulopilot')} titleIcon="analytics">
			<ModuleGuardComponent
				icon="info"
				title={__('Speed history isn’t tracked yet', 'vulopilot')}
				desc={__(
					'A dedicated performance score history isn’t built yet — flag if you want it scoped next.',
					'vulopilot'
				)}
			/>
		</CardComponent>
	);
};

export default SpeedHistoryCard;
