import { useEffect, useState } from 'react';
import { scrollToId } from '@zyra/core';
import { ContainerComponent } from '@zyra/components';
import '../SeoVisibility.scss';
import BusinessProfileCard from './BusinessProfileCard';
import KnowledgeGraphSection from './KnowledgeGraphSection';
import StructuredDataSection from './StructuredDataSection';
import InspectorSection from './InspectorSection';
import { useSchemaCoverage } from './useSchemaCoverage';
import type { SchemaPageFilter } from './useSchemaCoverage';

export type SchemaKnowledgeSectionId =
	| 'overview'
	| 'structured-data'
	| 'knowledge-graph'
	| 'inspector'
	| 'issues';

interface SchemaKnowledgeTabProps {
	initialSection?: SchemaKnowledgeSectionId;
}

/**
 * "Business Identity & Schema" tab of "SEO & Visibility".
 */
const SchemaKnowledgeTab = ({
	initialSection = 'overview',
}: SchemaKnowledgeTabProps) => {
	const coverage = useSchemaCoverage();
	const [pageFilter, setPageFilter] = useState<SchemaPageFilter>('all');

	useEffect(() => {
		if ('overview' !== initialSection) {
			scrollToId(`schema-knowledge-${initialSection}`);
		}
		// Only the initial mount-time value matters - this never re-runs
		// on a later, unrelated re-render.
	}, []);

	return (
		<ContainerComponent>
			<BusinessProfileCard />

			<KnowledgeGraphSection />

			<StructuredDataSection coverage={coverage} />

			<InspectorSection
				snapshot={coverage.snapshot}
				pageFilter={pageFilter}
				onPageFilterChange={setPageFilter}
			/>
		</ContainerComponent>
	);
};

export default SchemaKnowledgeTab;
