/* global vulopilotAppLocalizer */
import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { FormGroupWrapperComponent, NoticeManager } from '@zyra/components';
import { TextInput } from '@zyra/inputs';
import { useSetting } from '../../contexts/SettingContext';
import CardHeader from '../CardHeader';

/** "Stop typing, then save" debounce - same shape SiteVerificationPanel.tsx's own `PlainCodeField`/`CustomTagsField` already use for a hand-built (non-InputRenderer) panel's plain text field. */
const AUTOSAVE_DEBOUNCE_MS = 1000;

/** A real GTM container ID, e.g. GTM-ABC1234. Blank is allowed (turns Tag Manager off). */
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;

const isValidContainerId = (value: string): boolean => {
	const trimmed = value.trim();

	return '' === trimmed || GTM_ID_PATTERN.test(trimmed);
};

const TagManagerPanel = () => {
	const { setting, updateSetting } = useSetting();
	const [containerId, setContainerId] = useState(
		(setting.tag_manager_container_id as string) || ''
	);
	// The settings context fills in after first render, so pick up the saved value when it arrives.
	useEffect(() => {
		setContainerId((setting.tag_manager_container_id as string) || '');
	}, [setting.tag_manager_container_id]);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Read-only until the user clicks in: Chrome's saved-login autofill skips read-only fields.
	const [isEditable, setIsEditable] = useState(false);
	// Latest typed value not yet saved - lets blur, unmount and page unload save it right away.
	const pendingRef = useRef<string | null>(null);

	const persist = (nextContainerId: string) => {
		pendingRef.current = null;

		// Never store a value that isn't a real GTM ID (e.g. browser autofill's "admin").
		if (!isValidContainerId(nextContainerId)) {
			return;
		}

		const nextEnabled = '' !== nextContainerId.trim() ? ['tag_manager_enabled'] : [];
		updateSetting('tag_manager_container_id', nextContainerId);
		updateSetting('tag_manager_enabled', nextEnabled);
		sendApiResponse(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, 'settings'), {
			setting: {
				tag_manager_container_id: nextContainerId,
				tag_manager_enabled: nextEnabled,
			},
		}).then((response) => {
			NoticeManager.add({
				uniqueKey: 'vulopilot-tag-manager-saved',
				type: response ? 'success' : 'error',
				position: 'float',
				message: response
					? __('Settings saved.', 'vulopilot')
					: __('Could not save settings. Please try again.', 'vulopilot'),
			});
		});
	};

	const flush = () => {
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
			saveTimerRef.current = null;
		}
		if (null !== pendingRef.current) {
			persist(pendingRef.current);
		}
	};

	const handleContainerIdChange = (value: string) => {
		setContainerId(value);
		pendingRef.current = value;
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
	};

	// Save on leaving the page (refresh/close) - keepalive so the request survives the unload.
	useEffect(() => {
		const saveOnUnload = () => {
			if (null === pendingRef.current) {
				return;
			}
			const value = pendingRef.current;

			if (!isValidContainerId(value)) {
				return;
			}

			fetch(getApiLink(vulopilotAppLocalizer, 'settings'), {
				method: 'POST',
				keepalive: true,
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': vulopilotAppLocalizer.nonce,
				},
				body: JSON.stringify({
					setting: {
						tag_manager_container_id: value,
						tag_manager_enabled: '' !== value.trim() ? ['tag_manager_enabled'] : [],
					},
				}),
			});
		};

		window.addEventListener('beforeunload', saveOnUnload);

		return () => {
			window.removeEventListener('beforeunload', saveOnUnload);
			flush();
		};
	}, []);

	return (
		<FormGroupWrapperComponent>
			<CardHeader
				icon="module"
				title={__('Container ID', 'vulopilot')}
				desc={__(
					'Your Google Tag Manager container ID',
					'vulopilot'
				)}
			>
				<TextInput
					id="tag-manager-container-id-input"
					placeholder={__('GTM-XXXXXXX', 'vulopilot')}
					size={25}
					value={containerId}
					onChange={(value) => handleContainerIdChange(String(value))}
					onBlur={flush}
					onFocus={() => setIsEditable(true)}
					readOnly={!isEditable}
				/>
				{!isValidContainerId(containerId) && (
					<p className="description" style={{ color: '#d63638' }}>
						{__('A Container ID looks like GTM-XXXXXXX. This value was not saved.', 'vulopilot')}
					</p>
				)}
			</CardHeader>
		</FormGroupWrapperComponent>
	);
};

export default TagManagerPanel;
