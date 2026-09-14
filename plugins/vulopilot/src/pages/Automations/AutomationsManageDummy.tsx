import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { MultiCheckboxInput } from '@zyra/inputs';

interface AutomationsManageDummyProps {
	badgeText: string;
	onClick: () => void;
}

/**
 * Dummy stand-in for vulopilot-pro's own ManageAutomationsSection.tsx (the
 * real "Your automations" list of everything beyond the 2 free built-in
 * automations) — same PRO-tag-plus-immediate-popup treatment
 * ContentToolsGrid.tsx/AutomationsTemplatesCard.tsx already use for their
 * own Pro-only tiles/rows, per direct instruction, rather than the section
 * being entirely absent from the DOM the way it used to be (Automations.tsx
 * used to gate its whole `<ColumnComponent>` on `{Wizard && (...)}`).
 *
 * `badgeText`/click both come from the host (Automations.tsx) so this stays
 * a plain, stateless presentational component — the real 2-tier Pro-then-
 * module distinction (generic "PRO" vs. the real module's own display name)
 * lives once, alongside `openProPopup`'s own matching popup content, not
 * duplicated here.
 *
 * Rows are entirely fabricated examples (real automation categories/
 * cadences from automationsLabels.ts, but no real row behind any of
 * them) — inert (`aria-hidden`, disabled toggles, no click handler of
 * their own): the click-through lives on the wrapping overlay instead, so
 * clicking anywhere in the dummy list opens the same popup.
 */
const DUMMY_ROWS: { title: string; desc: string }[] = [
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

const AutomationsManageDummy = ({ badgeText, onClick }: AutomationsManageDummyProps) => (
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
			{DUMMY_ROWS.map((row) => (
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
	</CardComponent>
	</>
);

export default AutomationsManageDummy;
