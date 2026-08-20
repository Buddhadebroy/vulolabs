import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface ManualCheck {
	key: string;
	icon: string;
	title: string;
	description: string;
}

const MANUAL_CHECKS: ManualCheck[] = [
	{
		key: 'keyboard-navigation',
		icon: 'coding',
		title: __('Keyboard navigation', 'vulopilot'),
		description: __(
			'Can you reach and use everything without a mouse?',
			'vulopilot'
		),
	},
	{
		key: 'screen-reader',
		icon: 'person',
		title: __('Screen-reader experience', 'vulopilot'),
		description: __(
			'Does the content make sense when read aloud?',
			'vulopilot'
		),
	},
	{
		key: 'zoom-resizing',
		icon: 'text-fields',
		title: __('Zoom & text resizing', 'vulopilot'),
		description: __(
			'Does the page still work when text is enlarged?',
			'vulopilot'
		),
	},
];

/**
 * The mockup's "Some accessibility checks need a person" panel — real,
 * honest framing (automated scanners genuinely can't judge any of these
 * three), not a fabricated internal feature: "Open Manual Checklist"
 * links out to the W3C's own real WCAG 2 Quick Reference checklist
 * rather than a dead button or an invented internal checklist page that
 * doesn't exist yet.
 */
const AccessibilityManualTestingPanel = () => (
	<CardComponent
		title={__('Some accessibility checks need a person', 'vulopilot')}
		desc={__(
			'Automated tests can find many technical issues, but real user experiences need to be checked manually.',
			'vulopilot'
		)}
		badges={[
			{
				text: __('Manual testing recommended', 'vulopilot'),
				color: 'blue',
			},
		]}
	>
		<ListComponent
			className="mini-card report accessibility-manual-checks"
			items={MANUAL_CHECKS.map((check) => ({
				id: check.key,
				icon: check.icon,
				title: check.title,
				desc: check.description,
			}))}
		/>
		<div className="accessibility-manual-actions">
			<ButtonInput
				buttons={{
					text: __('Open Manual Checklist', 'vulopilot'),
					rightIcon: 'pagination-right-arrow',
					color: 'purple-bg',
					onClick: () =>
						window.open(
							'https://www.w3.org/WAI/WCAG21/quickref/',
							'_blank'
						),
				}}
			/>
			<a
				href="https://www.w3.org/WAI/fundamentals/accessibility-intro/"
				target="_blank"
				rel="noopener noreferrer"
				className="admin-btn btn-text-purple"
			>
				{__('Learn more about accessibility', 'vulopilot')}
			</a>
		</div>
	</CardComponent>
);

export default AccessibilityManualTestingPanel;
