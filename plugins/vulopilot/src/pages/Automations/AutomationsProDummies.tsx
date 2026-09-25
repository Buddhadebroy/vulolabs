import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { MultiCheckboxInput } from '@zyra/inputs';
import DummyDataNotice from '../../components/DummyDataNotice';
import { BlurredProContent } from '../../components/UpgradeToProOverlay';

interface AutomationsDummyProps {
	onClick: () => void;
}

/**
 * Merged into one file since both are the same small "fabricated example
 * rows behind a blurred click-through overlay" shape for the same page,
 * not two genuinely different concerns.
 */
const MANAGE_DUMMY_ROWS: { title: string; desc: string }[] = [
	{
		title: __('Security Monitoring', 'vulopilot'),
		desc: __('Daily • Create notification', 'vulopilot'),
	},
	{
		title: __('WooCommerce Monitor', 'vulopilot'),
		desc: __('Daily • Create notification', 'vulopilot'),
	},
	{
		title: __('SEO Optimization', 'vulopilot'),
		desc: __('Weekly • Run AI action, Create notification', 'vulopilot'),
	},
];

/** Rows are entirely fabricated examples (plausible-looking category/cadence text, but no real row behind any of them) - inert (`aria-hidden`, disabled toggles, no click handler of their own): the click-through lives on the wrapping overlay instead, so clicking anywhere in the dummy list opens the same popup. */
export const AutomationsManageDummy = ({ onClick }: AutomationsDummyProps) => (
	<CardComponent
		id="automation-manage"
		title={__('Your automations', 'vulopilot')}
		titleIcon="automation"
		desc={__(
			'React to scan findings automatically - enable, pause, or run an automation, and see when it last ran.',
			'vulopilot'
		)}
	>
		<BlurredProContent contentClassName="automations-manage-dummy" onClick={onClick}>
			{MANAGE_DUMMY_ROWS.map((row) => (
				<div className="automations-manage-dummy-row" key={row.title} aria-hidden="true">
					<div className="automations-manage-dummy-info">
						<div className="title">{row.title}</div>
						<div className="desc">{row.desc}</div>
					</div>
					<MultiCheckboxInput
						look="toggle"
						options={[{ value: 'enabled', label: '' }]}
						value={['enabled']}
						onChange={() => {}}
						modules={[]}
					/>
				</div>
			))}
		</BlurredProContent>
		<DummyDataNotice />
	</CardComponent>
);

const ACTIVITY_DUMMY_ROWS: { title: string; desc: string; time: string }[] = [
	{
		title: __('Run Full Site Scan completed', 'vulopilot'),
		desc: __('No changes needed.', 'vulopilot'),
		time: __('Today, 10:29', 'vulopilot'),
	},
	{
		title: __('Security Monitoring completed', 'vulopilot'),
		desc: __('1 change made.', 'vulopilot'),
		time: __('Yesterday, 16:01', 'vulopilot'),
	},
	{
		title: __('Send Visibility Report completed', 'vulopilot'),
		desc: __('No changes needed.', 'vulopilot'),
		time: __('Sept 10, 16:00', 'vulopilot'),
	},
];

export const AutomationsActivityDummy = ({ onClick }: AutomationsDummyProps) => (
	<CardComponent
		title={__('Recent automation activity', 'vulopilot')}
		titleIcon="clock"
		desc={__('The last 5 automation runs and what they did.', 'vulopilot')}
	>
		<BlurredProContent contentClassName="automations-activity-dummy" onClick={onClick}>
			<ul className="activity-log">
				{ACTIVITY_DUMMY_ROWS.map((row) => (
					<li key={row.title} className="activity" aria-hidden="true">
						<div className="title">
							{row.title}
							<div className="admin-badge green">{__('Completed', 'vulopilot')} </div>
						</div>
						<div className="desc">{row.desc}</div>
						<span>{row.time}</span>
					</li>
				))}
			</ul>
		</BlurredProContent>
		<DummyDataNotice />
	</CardComponent>
);
