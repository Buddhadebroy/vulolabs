import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';

/**
 * "Real-time Monitoring" — all 4 of the mockup's sub-metrics (page load
 * time, server response time, active users, bandwidth usage) have zero
 * real backing anywhere in this codebase — no telemetry/analytics
 * collection of this kind exists at all, unlike Content Stats where at
 * least the tile *shape* (a real findings count) was partially
 * reachable. One honest "not built yet" card for the whole section
 * rather than 4 individual dash-tiles, which would imply a partial
 * tracking capability that doesn't exist.
 */
const RealTimeMonitoringCard = () => {
	return (
		<CardComponent title={__('Real-time Monitoring', 'vulopilot')}>
			<ModuleGuardComponent
				icon="info"
				title={__('Real-time monitoring isn’t built yet', 'vulopilot')}
				desc={__(
					'Page load time, server response time, and bandwidth tracking aren’t built yet — flag if you want them scoped next.',
					'vulopilot'
				)}
			/>
		</CardComponent>
	);
};

export default RealTimeMonitoringCard;
