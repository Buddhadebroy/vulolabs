/* global vulopilotAppLocalizer */
import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse, useModules } from '@zyra/core';
import { NoticeManager } from '@zyra/components';
import { MultiCheckboxInput } from '@zyra/inputs';

/**
 * Real backend module id - Modules/index.ts's own `id: 'automations'` entry
 * docblock: "Automation's folder name kebab-cased (no 'Engine' suffix in
 * the real folder name)". The 3 settings fields below this action (on the
 * Automation tab) mistakenly gated on `moduleEnabled: 'automation'`
 * (singular) - fixed alongside this, since a wrong id there means those
 * fields never actually detect the module as active.
 */
const AUTOMATION_MODULE_ID = 'workflow-automation';

/**
 * Settings → Automation's own header action - a real `MultiCheckboxInput`
 * toggle (per direct instruction, replacing the former "Enable Automation
 * Module"/"Go to Automations" button) that enables/disables the real
 * `automations` module (same `POST modules` `{ id, action: 'activate' |
 * 'deactivate' }` round trip ModuleGridComponent.tsx's own toggle switch
 * already makes) - switching it on turns the module on, switching it back
 * off turns it off, same real two-way control ModuleGridComponent's own
 * toggle already is, rather than a one-way "enable and navigate away"
 * button. The 3 fields on this tab do nothing without this module active,
 * so this toggle is the one real switch for that.
 *
 * `FormGroupComponent`/`FormGroupWrapperComponent` wrap the toggle rather
 * than `MultiCheckboxInput`'s own `option.label` carrying it directly -
 * confirmed by reading zyra's own compiled CSS: the `look="toggle"` switch
 * pill is styled onto the very `<label>` that text would render into,
 * silently swallowing it (same real reason `RecentContentCard.tsx`'s own
 * "Show ignored" toggle needs a sibling label instead) - this is the same
 * "real label, not a swallowed one" shape `BuiltinAutomationCards.tsx`'s
 * own "Enable this automation" row already establishes for an identical
 * single-toggle field.
 *
 * Never redirects, on or off, per direct instruction - this real toggle
 * activates/deactivates the module in place on this same page, same
 * `POST modules` round trip either way; a failed `activate` (e.g. no
 * active Pro license - the same real gate ModuleGridComponent.tsx's own
 * `isModuleAvailable()` applies before letting a toggle activate a Pro
 * module) surfaces as a real float error notice instead of navigating
 * anywhere.
 *
 * Also writes through to zyra's own `useModules()` zustand store
 * (`insertModule`/`removeModule`, same calls ModuleGridComponent.tsx's own
 * toggle makes) on a successful flip - the 3 fields below this action read
 * that same live store for their own `moduleEnabled: 'workflow-automation'` lock
 * (InputRenderer.tsx), so switching this toggle on/off unlocks/locks them
 * immediately, in place, rather than only reflecting the module's real
 * state after a full page reload.
 */
const EnableAutomationModuleAction: React.FC = () => {
	const [isActive, setIsActive] = useState(
		(vulopilotAppLocalizer.active_modules ?? []).includes(AUTOMATION_MODULE_ID)
	);
	const [isToggling, setIsToggling] = useState(false);
	// Same real zustand store ModuleGridComponent.tsx's own toggle already
	// writes to on activate/deactivate - the 3 fields below this action
	// (Automation.ts's own `moduleEnabled: 'workflow-automation'` fields) read this
	// same live store (InputRenderer's own `useModules()`), so updating it
	// here is what makes them unlock/lock immediately when this toggle
	// flips, instead of only reflecting the module's real state after a
	// full page reload.
	const { insertModule, removeModule } = useModules();

	const handleToggle = () => {
		const nextAction = isActive ? 'deactivate' : 'activate';
		setIsToggling(true);

		sendApiResponse(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, 'modules'), {
			id: AUTOMATION_MODULE_ID,
			action: nextAction,
		})
			.then((response) => {
				if (response) {
					setIsActive('activate' === nextAction);
					if ('activate' === nextAction) {
						insertModule?.(AUTOMATION_MODULE_ID);
					} else {
						removeModule?.(AUTOMATION_MODULE_ID);
					}
					NoticeManager.add({
						uniqueKey: 'vulopilot-toggle-automation-module',
						type: 'success',
						position: 'float',
						message:
							'activate' === nextAction
								? __('Automation module enabled.', 'vulopilot')
								: __('Automation module disabled.', 'vulopilot'),
					});
				} else {
					NoticeManager.add({
						uniqueKey: 'vulopilot-toggle-automation-module',
						type: 'error',
						position: 'float',
						message:
							'activate' === nextAction
								? __(
									'Could not enable the Automation module. Please try again.',
									'vulopilot'
								)
								: __(
									'Could not disable the Automation module. Please try again.',
									'vulopilot'
								),
					});
				}
			})
			.finally(() => setIsToggling(false));
	};

	return (
		<>
			<MultiCheckboxInput
				look="toggle"
				options={[
					{
						key: AUTOMATION_MODULE_ID,
						value: AUTOMATION_MODULE_ID,
						label: '',
					},
				]}
				value={isActive ? [AUTOMATION_MODULE_ID] : []}
				onChange={handleToggle}
				disabled={isToggling}
				// Real "Enabled"/"Disabled" status text next to the
				// switch - `MultiCheckboxInput`'s own native
				// `toggleStatusLabel` prop (only rendered for
				// `look="toggle"`), same real opt-in this codebase's
				// own declarative `type: 'checkbox'` fields already
				// use it for (e.g. Sitemap.ts's "Enable sitemap"
				// field).
				toggleStatusLabel={{
					on: __('Enabled', 'vulopilot'),
					off: __('Disabled' , 'vulopilot'),
				}}
				modules={[]}
			/>
		</>
	);
};

export default EnableAutomationModuleAction;
