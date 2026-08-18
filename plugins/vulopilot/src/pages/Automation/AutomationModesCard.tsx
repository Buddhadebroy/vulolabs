/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { CardComponent, PopupComponent, BadgeComponent, NoticeManager } from '@zyra/components';
import ShowProPopup from '../../components/Popup/Popup';
import { AUTOMATION_MODE_OPTIONS, AutomationMode } from './automationTemplates';

interface SettingsResponse {
	automation_mode?: AutomationMode;
	[key: string]: unknown;
}

/**
 * "Automation modes" — a real, persisted site-wide setting
 * (`Utill::VULOPILOT_SETTINGS_DEFAULTS['automation_mode']`) read/written
 * through the same `GET/POST /settings` endpoint every other Settings tab
 * already uses (`Settings.php::update_item()` merges `{ setting }` into the
 * stored option — no new endpoint). Selecting a mode has a real effect:
 * `vulopilot-pro`'s `RunAiActionAction::execute()` reads this exact key to
 * decide whether to skip proposing an AI fix (Monitor), propose and wait
 * for approval as it always has (Suggest), or propose and auto-approve
 * within an impact threshold (Auto-fix).
 *
 * Monitor and Auto-fix are Pro-only (confirmed with the user, overriding
 * the mockup's own "(Pro)" label which was only on Auto-fix) — gated with
 * the same `appLocalizer.khali_dabba`/`ShowProPopup` pattern
 * `ProLockedCard.tsx` already uses elsewhere, adapted to a selectable list
 * row rather than a standalone unlock button since that's this card's own
 * layout (mockup's 3-row selector, not a single locked panel).
 */
const AutomationModesCard: React.FC = () => {
	const [mode, setMode] = useState<AutomationMode>('suggest');
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	useEffect(() => {
		getApiResponse<SettingsResponse>(getApiLink(appLocalizer, 'settings'), {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (response?.automation_mode) {
					setMode(response.automation_mode);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	const selectMode = (nextMode: AutomationMode) => {
		const option = AUTOMATION_MODE_OPTIONS.find((o) => o.id === nextMode);

		if (option?.isPro && !appLocalizer.khali_dabba) {
			setIsProPopupOpen(true);
			return;
		}

		const previousMode = mode;
		setMode(nextMode);
		setIsSaving(true);

		sendApiResponse<{ success?: boolean }>(
			appLocalizer,
			getApiLink(appLocalizer, 'settings'),
			{ setting: { automation_mode: nextMode } }
		)
			.then((response) => {
				if (!response) {
					setMode(previousMode);
					NoticeManager.add({
						uniqueKey: 'vulopilot-automation-mode-save-failed',
						type: 'error',
						position: 'float',
						message: __(
							'Could not save the automation mode. Please try again.',
							'vulopilot'
						),
					});
				}
			})
			.finally(() => setIsSaving(false));
	};

	return (
		<CardComponent title={__('Automation modes', 'vulopilot')} titleIcon="automation">
			<p className="small desc">
				{__('Choose how VuloPilot should handle issues.', 'vulopilot')}
			</p>
			<div className="automation-modes-list">
				{AUTOMATION_MODE_OPTIONS.map((option) => {
					const locked = option.isPro && !appLocalizer.khali_dabba;
					const active = mode === option.id;

					return (
						<div
							key={option.id}
							className={`automation-mode-option${active ? ' active' : ''}${locked ? ' locked' : ''}`}
							role="button"
							tabIndex={0}
							aria-disabled={isLoading || isSaving}
							onClick={() =>
								!isLoading && !isSaving && selectMode(option.id)
							}
							onKeyDown={(event) => {
								if (
									('Enter' === event.key || ' ' === event.key) &&
									!isLoading &&
									!isSaving
								) {
									event.preventDefault();
									selectMode(option.id);
								}
							}}
						>
							<span className="automation-mode-icon">
								<i className={`adminfont-${option.icon}`} />
							</span>
							<span className="automation-mode-text">
								<strong>{option.label}</strong>
								<span className="small desc">
									{option.description}
								</span>
							</span>
							{locked ? (
								<BadgeComponent color="purple" text={__('Pro', 'vulopilot')} />
							) : active ? (
								<i className="adminfont-check automation-mode-active-icon" />
							) : null}
						</div>
					);
				})}
			</div>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="automation" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</CardComponent>
	);
};

export default AutomationModesCard;
