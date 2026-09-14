/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { BadgeComponent, CardComponent, ListComponent, PopupComponent } from '@zyra/components';
import ShowProPopup, { resolveModuleDisplayName } from '../../components/Popup/Popup';
import { getAutomationTemplates, AutomationTemplate } from './automationsTemplates';

const AUTOMATIONS_MODULE_ID = 'automations';

interface AutomationsTemplatesCardProps {
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onSelectTemplate: (template: AutomationTemplate) => void;
	/**
	 * Whether Automations Pro's own real wizard is actually wired up
	 * (`vulopilot_automations_panel` filter slot's `Wizard`) — the second,
	 * "module" tier of the real per-item gate below (checked only once
	 * `isProInstalled` already passed — see `handleItemClick`), same
	 * "module dependency" shape ContentToolsGrid.tsx's own
	 * `useContentToolsEnabled()` gate uses, just passed in as a prop here
	 * since this card's own "is it active" check isn't a plain
	 * `active_modules.includes('automations')` lookup (a wizard-slot
	 * presence check catches a real edge case a plain module-id lookup
	 * wouldn't — see ChatTab.tsx's own `automationsPanelSlot` docblock).
	 */
	isAutomationsActive: boolean;
}

/**
 * "Create new automation" — a real entry point into Automate Work's
 * existing create-automation flow, not a decorative mockup.
 *
 * Per direct instruction, this list is a real free/Pro split, not one
 * uniform gate: the first 2 rows (`linkOnly`, no `pro` — "Run Full Site
 * Scan"/"Send Visibility Report") are the exact same 2 real, free,
 * built-in automations BuiltinAutomationCards.tsx already renders on the
 * Automations page itself (BuiltinAutomationSeeder.php's own
 * `free_full_site_scan`/`free_visibility_report` rows) — clicking one just
 * navigates there rather than opening any wizard, since neither is a
 * wizard template to begin with (no category/trigger/actionTypes to
 * prefill). The other 6 rows (`pro: true`) prefill Automate Work's own
 * Pro-only wizard as before; a row click with the `automations` module
 * inactive opens ShowProPopup immediately instead of calling
 * `onSelectTemplate`, and shows a small "PRO" badge in its own row so
 * which rows need Pro is visible before clicking — same
 * badge-in-row-plus-immediate-popup shape ContentToolsGrid.tsx's own
 * `handleToolClick()` uses, replacing this card's previous whole-list
 * useContentGate.tsx blur (which locked all 6 templates alike behind
 * "Connect to VuloCloud to use this" regardless of any of them being
 * free).
 *
 * Per direct instruction, the Pro rows' own lock is a real 2-tier check,
 * Pro first then module — the same order/shape useContentGate.tsx's own
 * `isProLocked`/`isModuleLocked` derivation uses (minus its first
 * VuloCloud tier, since no automation template here needs an AI
 * provider): `appLocalizer.khali_dabba` (Pro plugin installed at all) is
 * checked first — not installed shows the generic "PRO" badge and opens
 * the plain `<ShowProPopup />` upgrade pitch; installed-but-this-module-off
 * is a DIFFERENT, second state — shows the real module's own name as the
 * badge (`resolveModuleDisplayName('automations')`, the exact same name
 * `<ShowProPopup moduleName="automations" />`'s own "Activate {name}"
 * heading uses) rather than a second, generic "PRO" tag that would read
 * the same for two genuinely different problems (no Pro vs. Pro-but-this-
 * one-module-off).
 *
 * The 3 Pro rows' real recipe values (`category`/`triggerType`/
 * `actionTypes`) come from vulopilot-pro's own filter callback, not this
 * plugin — see automationsTemplates.ts's own `getAutomationTemplates()`
 * docblock for why that's a live, re-checked call (same
 * `vulopilot_pro_modules_loaded` re-check `useFilterSlot.ts` uses) rather
 * than a plain import of a precomputed constant: Pro's script can still be
 * loading over the network on this component's first render.
 */
const AutomationsTemplatesCard: React.FC<AutomationsTemplatesCardProps> = ({
	onSelectTemplate,
	isAutomationsActive,
}) => {
	const [templates, setTemplates] = useState<AutomationTemplate[]>(() =>
		getAutomationTemplates()
	);

	useEffect(() => {
		const recheck = () => setTemplates(getAutomationTemplates());

		recheck();

		window.addEventListener('vulopilot_pro_modules_loaded', recheck);
		return () =>
			window.removeEventListener('vulopilot_pro_modules_loaded', recheck);
	}, []);

	const isProInstalled = Boolean(appLocalizer.khali_dabba);
	const moduleDisplayName = resolveModuleDisplayName(AUTOMATIONS_MODULE_ID);

	/**
	 * Which lock a Pro row's click just hit — `null` means unlocked.
	 * `'pro'`: Pro isn't installed at all. `'module'`: Pro is installed but
	 * the `automations` module itself isn't active. Reset via
	 * `dismissLock()`. Kept as one 2-value state (not two booleans) since
	 * exactly one popup renders at a time and the two are mutually
	 * exclusive by construction (see `handleItemClick` below).
	 */
	const [lockReason, setLockReason] = useState<'pro' | 'module' | null>(null);
	const dismissLock = () => setLockReason(null);

	const handleItemClick = (template: AutomationTemplate) => {
		if (template.linkOnly) {
			window.location.href = `${appLocalizer.admin_url}#&tab=automations`;
			return;
		}

		if (!template.pro) {
			onSelectTemplate(template);
			return;
		}

		if (!isProInstalled) {
			setLockReason('pro');
			return;
		}

		if (!isAutomationsActive) {
			setLockReason('module');
			return;
		}

		onSelectTemplate(template);
	};

	return (
		<div id="create-new-automation-card">
			<CardComponent
				title={ __( 'Create new automation', 'vulopilot-pro' ) } titleIcon="analytics"
				desc={ __( 'Start from a ready-made template instead of building one from scratch.', 'vulopilot-pro' ) }
			>
				<ListComponent
					className="mini-card report"
					items={templates.map((template) => ({
						id: template.id,
						icon: template.icon,
						title: template.label,
						desc: template.description,
						tags: (
							<>
								{template.pro && !isProInstalled && (
									<span className="admin-tag pro-tag pro-tag-inline">
										<i className="adminfont-pro-tag" />
										{__('Pro', 'vulopilot')}
									</span>
								)}
								{template.pro && isProInstalled && !isAutomationsActive && (
									<BadgeComponent color="purple" text={moduleDisplayName} />
								)}
								<i className="adminfont-plus ai-copilot-row-arrow" />
							</>
						),
						action: () => handleItemClick(template),
					}))}
				/>
			</CardComponent>
			<PopupComponent
				open={null !== lockReason}
				onClose={dismissLock}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{'module' === lockReason ? (
					<ShowProPopup moduleName={AUTOMATIONS_MODULE_ID} />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</div>
	);
};

export default AutomationsTemplatesCard;
