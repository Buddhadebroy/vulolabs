/* global appLocalizer */
import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

/**
 * Real backend module id — Modules/index.ts's own `id: 'automations'` entry
 * docblock: "Automation's folder name kebab-cased (no 'Engine' suffix in
 * the real folder name)". The 3 settings fields below this action (on the
 * Automation tab) mistakenly gated on `moduleEnabled: 'automation'`
 * (singular) — fixed alongside this, since a wrong id there means those
 * fields never actually detect the module as active.
 */
const AUTOMATION_MODULE_ID = 'automations';

const goToAutomations = () => {
	window.location.href = '?page=vulopilot#&tab=automations';
};

/**
 * Settings → Automation's own header action — enables the real
 * `automations` module (same `POST modules` `{ id, action: 'activate' }`
 * round trip ModuleGridComponent.tsx's own toggle switch already makes)
 * and then takes the admin straight to the real Automations page, instead
 * of only deep-linking to Settings → Modules for a manual toggle
 * (GettingStartedCard.tsx's own established pattern elsewhere) — the 3
 * fields on this tab do nothing without this module active, so one click
 * both unlocks and lands on the real destination.
 *
 * `proModule: true` for this module (Modules/index.ts) — same
 * `khali_dabba` (real, active Pro license) gate ModuleGridComponent.tsx's
 * own `isModuleAvailable()` already applies before letting a click
 * activate a Pro module. Without a real license this button just deep-links
 * to Settings → Modules instead of posting an activation call the backend
 * would reject anyway — that page's own real `ModuleGridComponent` already
 * has the license-upsell popup this shortcut doesn't try to reproduce.
 */
const EnableAutomationModuleAction: React.FC = () => {
	const isActive = (appLocalizer.active_modules ?? []).includes(AUTOMATION_MODULE_ID);
	const isLicensed = appLocalizer.khali_dabba ?? false;
	const [isEnabling, setIsEnabling] = useState(false);

	const handleClick = () => {
		if (isActive) {
			goToAutomations();
			return;
		}

		if (!isLicensed) {
			window.location.href = '?page=vulopilot#&tab=settings&subtab=modules';
			return;
		}

		setIsEnabling(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'modules'), {
			id: AUTOMATION_MODULE_ID,
			action: 'activate',
		})
			.then((response) => {
				if (response) {
					goToAutomations();
				} else {
					NoticeManager.add({
						uniqueKey: 'vulopilot-enable-automation-module',
						type: 'error',
						position: 'float',
						message: __(
							'Could not enable the Automation module. Please try again.',
							'vulopilot'
						),
					});
				}
			})
			.finally(() => setIsEnabling(false));
	};

	return (
		<ButtonInput
			buttons={{
				text: isEnabling
					? __('Enabling…', 'vulopilot')
					: isActive
						? __('Go to Automations', 'vulopilot')
						: __('Enable Automation Module', 'vulopilot'),
				color: 'purple-bg',
				disabled: isEnabling,
				onClick: handleClick,
			}}
		/>
	);
};

export default EnableAutomationModuleAction;
