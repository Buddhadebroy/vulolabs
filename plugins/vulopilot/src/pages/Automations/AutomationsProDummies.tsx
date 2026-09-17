import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { MultiCheckboxInput } from '@zyra/inputs';
import DummyDataNotice from '../../components/DummyDataNotice';

interface AutomationsDummyProps {
	badgeText: string;
	onClick: () => void;
}

/**
 * Dummy stand-ins for the two real vulopilot-pro sections Automations.tsx's
 * own `vulopilot_automations_panel` filter slot resolves when Pro is active
 * — `AutomationsManageDummy` (real "Your automations" list,
 * ManageAutomationsSection.tsx) and `AutomationsActivityDummy` (real
 * "Recent automation activity" feed, AutomationsActivityCard.tsx). Same
 * PRO-tag-plus-immediate-popup treatment ContentToolsGrid.tsx/
 * AutomationsTemplatesCard.tsx already use for their own Pro-only tiles/
 * rows, per direct instruction, rather than either section being entirely
 * absent from the DOM the way it used to be (Automations.tsx used to gate
 * its whole `<ColumnComponent>` on `{Wizard && (...)}`).
 *
 * `badgeText`/`onClick` both come from the host (Automations.tsx) so these
 * stay plain, stateless presentational components — the real 2-tier
 * Pro-then-module distinction (generic "PRO" vs. the real module's own
 * display name) lives once, alongside `openProPopup`'s own matching popup
 * content, not duplicated here.
 *
 * Merged into one file since both are the same small "PRO badge +
 * fabricated example rows + click-through overlay" shape for the same
 * page, not two genuinely different concerns.
 */
const ProBadge = ({ badgeText }: { badgeText: string }) => (
	// Docks against `.card-wrapper` (ColumnComponent's own root div, always
	// `position: relative` in zyra) rather than a wrapper div of its own —
	// CardComponent's `badges` prop can't be used here since it only
	// forwards `color`/`text` into its own internal `BadgeComponent` call,
	// dropping any custom class, so the real "admin-tag pro-tag" markup has
	// to render as a sibling instead.
	<span className="admin-tag pro-tag">
		<i className="adminfont-pro-tag" />
		{badgeText}
	</span>
);

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

/** Rows are entirely fabricated examples (plausible-looking category/cadence text, but no real row behind any of them) — inert (`aria-hidden`, disabled toggles, no click handler of their own): the click-through lives on the wrapping overlay instead, so clicking anywhere in the dummy list opens the same popup. */
export const AutomationsManageDummy = ({ badgeText, onClick }: AutomationsDummyProps) => (
	<>
		<ProBadge badgeText={badgeText} />
		<CardComponent
			id="automation-manage"
			title={__('Your automations', 'vulopilot')}
			titleIcon="automation"
			desc={__(
				'React to scan findings automatically — enable, pause, or run an automation, and see when it last ran.',
				'vulopilot'
			)}
		>
		<div
			className="automations-manage-dummy"
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={(event) => {
				if ('Enter' === event.key || ' ' === event.key) {
					onClick();
				}
			}}
		>
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
		</div>
		<DummyDataNotice />
	</CardComponent>
	</>
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

/** Rows are entirely fabricated examples (real completed/status wording from vulopilot-pro's own AutomationsActivityCard.tsx, but no real run behind any of them) — inert (`aria-hidden`, no click handler of their own): the click-through lives on the wrapping overlay instead, so clicking anywhere in the dummy list opens the same popup. */
export const AutomationsActivityDummy = ({ badgeText, onClick }: AutomationsDummyProps) => (
	<>
		<ProBadge badgeText={badgeText} />
		<CardComponent
			title={__('Recent automation activity', 'vulopilot')}
			titleIcon="clock"
			desc={__('The last 5 automation runs and what they did.', 'vulopilot')}
		>
		<ul
			className="activity-log automations-activity-dummy"
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={(event) => {
				if ('Enter' === event.key || ' ' === event.key) {
					onClick();
				}
			}}
		>
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
		<DummyDataNotice />
	</CardComponent>
	</>
);
