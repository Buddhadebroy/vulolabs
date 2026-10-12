import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ColumnComponent } from '@zyra/components';
import { useContentGate } from '../../services/useContentGate';
import { useFilterSlot } from '../../services/useFilterSlot';
import type { ComponentType } from 'react';

interface AeoCitationCoverageCardProps {
	/** Whether GeoInsights' own Rest.php class is registered at all (either 'geo-insights' or 'aeo-insights' active - both register the same class, so either is enough). */
	isActive: boolean;
}

/** Card shell only - plugs in via the `vulopilot_aeo_citation_coverage_panel` filter, else inert placeholders render. */
const AeoCitationCoverageCard = ({ isActive }: AeoCitationCoverageCardProps) => {
	const Panel = useFilterSlot<ComponentType>('vulopilot_aeo_citation_coverage_panel');

	const badges = [
		{ text: __('Simulated Citation Checks', 'vulopilot'), color: 'purple' },
	];

	const { wrap } = useContentGate('answer-engine-optimization', isActive);

	const dummyContent = (
		<>
			<div className="crawler-stat-value">{sprintf('%1$d/%2$d', 3, 5)}</div>
			<div className="desc">
				{sprintf(
					/* translators: %d: percent of tested questions the AI service already recognized this site for. */
					__(
						'questions your AI service already recognized this site for (%d%%).',
						'vulopilot'
					),
					60
				)}
			</div>
		</>
	);

	return (
		<ColumnComponent grid={6} fullHeight>
			<CardComponent
				title={__('Answer Engine Coverage', 'vulopilot')}
				titleIcon="global-community"
				desc={__(
					"Asks your own configured AI service real questions from your content - without ever naming your site - and checks whether it already recognizes you as a source. A real, disclosed simulation of what that model already knows, not a live ChatGPT/Perplexity search.",
					'vulopilot'
				)}
				badges={badges}
			>
				{wrap(Panel ? <Panel /> : dummyContent, dummyContent)}
			</CardComponent>
		</ColumnComponent>
	);
};

export default AeoCitationCoverageCard;
