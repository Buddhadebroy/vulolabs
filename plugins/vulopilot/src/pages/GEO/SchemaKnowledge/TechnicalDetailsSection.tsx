import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ToggleInput } from '@zyra/inputs';
import StructuredDataSection from './StructuredDataSection';

/**
 * "Technical Details (Schema & Markup)" — "Schema Summary"
 * (`StructuredDataSection.tsx`, unchanged: its own real Schema Status
 * stats + Schema Coverage table). Used to also hold a "Page Inspector" tab
 * (InspectorSection.tsx) inside the same card's own `TabsComponent` —
 * split out into its own separate section per direct instruction
 * ("firstly separate section the page inspector") — see
 * SchemaKnowledgeTab.tsx's own docblock for where it renders now. No
 * `TabsComponent` needed here anymore now that only one real tab's worth
 * of content is left.
 *
 * "Show for developers" is a real toggle — collapses/expands this card's
 * own content, default open. Not a Pro/module gate: this content is Free.
 */
const TechnicalDetailsSection = () => {
	const [showDeveloperContent, setShowDeveloperContent] = useState(true);

	return (
		<CardComponent
			title={__('Technical Details (Schema & Markup)', 'vulopilot')}
			titleIcon="coding"
			desc={__(
				'How your business information is technically implemented on your site.',
				'vulopilot'
			)}
			action={
				<ToggleInput
					options={[
						{
							key: 'show_for_developers',
							value: 'show_for_developers',
							label: __('Show for developers', 'vulopilot'),
						},
					]}
					value={showDeveloperContent ? ['show_for_developers'] : []}
					multiSelect
					modules={[]}
					onChange={() =>
						setShowDeveloperContent((current) => !current)
					}
				/>
			}
		>
			{showDeveloperContent && <StructuredDataSection />}
		</CardComponent>
	);
};

export default TechnicalDetailsSection;
