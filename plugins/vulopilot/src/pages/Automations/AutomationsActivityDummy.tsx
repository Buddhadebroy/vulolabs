import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';

interface AutomationsActivityDummyProps {
	badgeText: string;
	onClick: () => void;
}

/**
 * Dummy stand-in for vulopilot-pro's own AutomationsActivityCard.tsx (the
 * real "Recent automation activity" feed of the last 5 runs across every
 * automation) — same PRO-tag-plus-immediate-popup treatment
 * AutomationsManageDummy.tsx already uses for "Your automations", per direct
 * instruction, rather than the section being entirely absent from the DOM.
 *
 * `badgeText`/`onClick` both come from the host (Automations.tsx) so this
 * stays a plain, stateless presentational component — the real 2-tier
 * Pro-then-module distinction (generic "PRO" vs. the real module's own
 * display name) lives once, alongside `openProPopup`'s own matching popup
 * content, not duplicated here.
 *
 * Rows are entirely fabricated examples (real completed/status wording from
 * AutomationsActivityCard.tsx, but no real run behind any of them) — inert
 * (`aria-hidden`, no click handler of their own): the click-through lives on
 * the wrapping overlay instead, so clicking anywhere in the dummy list opens
 * the same popup.
 */
const DUMMY_ROWS: { title: string; desc: string; time: string }[] = [
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

const AutomationsActivityDummy = ({ badgeText, onClick }: AutomationsActivityDummyProps) => (
	<>
		{/* Docks against `.card-wrapper` (ColumnComponent's own root div,
		 * always `position: relative` in zyra) rather than a wrapper div of
		 * its own — CardComponent's `badges` prop can't be used here since it
		 * only forwards `color`/`text` into its own internal `BadgeComponent`
		 * call, dropping any custom class, so the real "admin-tag pro-tag"
		 * markup has to render as a sibling instead. */}
		<span className="admin-tag pro-tag">
			<i className="adminfont-pro-tag" />
			{badgeText}
		</span>
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
			{DUMMY_ROWS.map((row) => (
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
	</CardComponent>
	</>
);

export default AutomationsActivityDummy;
