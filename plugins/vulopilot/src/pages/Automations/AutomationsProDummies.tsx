import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { MultiCheckboxInput } from '@zyra/inputs';
import DummyDataNotice from '../../components/DummyDataNotice';
import { BlurredProContent } from '../../components/UpgradeToProOverlay';

interface AutomationsDummyProps {
	onClick: () => void;
}

/**
 * Dummy stand-ins for the two real vulopilot-pro sections Automations.tsx's
 * own `vulopilot_automations_panel` filter slot resolves when Pro is active
 * - `AutomationsManageDummy` (real "Your automations" list,
 * ManageAutomationsSection.tsx) and `AutomationsActivityDummy` (real
 * "Recent automation activity" feed, AutomationsActivityCard.tsx). Same
 * blurred-content-behind-an-"Upgrade to Pro"-overlay treatment every other
 * Pro-gated dummy card in this plugin uses
 * (../../components/UpgradeToProOverlay.tsx - shared, not reimplemented
 * per file), rather than either section being entirely absent from the DOM
 * the way it used to be (Automations.tsx used to gate its whole
 * `<ColumnComponent>` on `{Wizard && (...)}`).
 *
 * The separate `.admin-tag.pro-tag` badge this file used to float over
 * each card (its own local `ProBadge`, picking "PRO" or the real module's
 * display name) was removed per direct instruction, same reasoning
 * BrandVisibilityProDummies.tsx's own docblock gives: the shared overlay's
 * `<UpgradeToProOverlay />` already says "Upgrade to Pro" the moment the
 * blurred content renders, so the badge was a second copy of the same
 * message on the same card. `onClick` alone is all either dummy needs
 * from the host now.
 *
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

/** Rows are entirely fabricated examples (real completed/status wording from vulopilot-pro's own AutomationsActivityCard.tsx, but no real run behind any of them) - inert (`aria-hidden`, no click handler of their own): the click-through lives on the wrapping overlay instead, so clicking anywhere in the dummy list opens the same popup. */
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
