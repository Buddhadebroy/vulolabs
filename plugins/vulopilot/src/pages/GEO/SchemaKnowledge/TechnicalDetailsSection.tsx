import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, TabsComponent } from '@zyra/components';
import { ToggleInput } from '@zyra/inputs';
import StructuredDataSection from './StructuredDataSection';
import InspectorSection from './InspectorSection';

/**
 * "Technical Details (Schema & Markup)" — a real tabbed panel, not a flat
 * scroll, matching the reference mockup's own shape (direct instruction:
 * "not at all matching the reference image"). 2 real tabs, not the
 * mockup's literal 4 (Schema Summary/JSON-LD/Validation/Conflicts): this
 * codebase's real "JSON-LD viewer"/"Schema Validator"/"Conflict Detection"
 * tools (InspectorSection.tsx) are genuinely one connected real workflow
 * around a single selected page — its own JSON-LD viewer, validator link,
 * and conflict list all key off the SAME real inspection result and cross-
 * navigate between each other via `scrollToId()`. Splitting that into 3
 * independent tab panes would have meant either breaking that real
 * cross-navigation or duplicating the page-picker/fetch 3 times; grouping
 * them as this tab's own single "Page Inspector" tab keeps everything
 * real and working. "Schema Summary" is `StructuredDataSection.tsx`,
 * unchanged (its own real Schema Status stats + Schema Coverage table).
 *
 * "Show for developers" is a real toggle — collapses/expands this whole
 * card's own content, default open. Not a Pro/module gate: both real tabs
 * are Free.
 */
const TechnicalDetailsSection = () => {
	const [activeTabIndex, setActiveTabIndex] = useState(0);
	const [showDeveloperContent, setShowDeveloperContent] = useState(true);

	return (
		<CardComponent
			title={__('Technical Details (Schema & Markup)', 'vulopilot')}
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
			{showDeveloperContent && (
				<TabsComponent
					className="schema-technical-details-tabs"
					activeIndex={activeTabIndex}
					onTabChange={setActiveTabIndex}
					tabs={[
						{
							label: __('Schema Summary', 'vulopilot'),
							content: <StructuredDataSection />,
						},
						{
							label: __('Page Inspector', 'vulopilot'),
							content: <InspectorSection />,
						},
					]}
				/>
			)}
		</CardComponent>
	);
};

export default TechnicalDetailsSection;
