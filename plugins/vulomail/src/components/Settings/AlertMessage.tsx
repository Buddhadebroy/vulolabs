import { useEffect, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import { TextAreaInput } from '@zyra/inputs';
import { useSetting } from '../../contexts/SettingContext';
import { apiPost } from '../../services/api';
import { errorMessage, notify } from '../../services/notify';
import type { SmsTriggerDefinition } from '../../services/types';

/** Prefix of the per-alert message template values on the SMS Alerts screen. */
export const TEMPLATE_PREFIX = 'sms_template_';

interface AlertMessageProps {
	/** Key of the toggle group the alert's switch belongs to. */
	groupKey: string;
	trigger: SmsTriggerDefinition;
}

/**
 * The body of one alert's row: its description and, while the alert is switched on, the message it
 * sends. zyra's setting rows have no text control, so the message is saved from here, a moment
 * after typing stops.
 */
const AlertMessage = ({ groupKey, trigger }: AlertMessageProps) => {
	const { setting, updateSetting } = useSetting();
	const key = `${TEMPLATE_PREFIX}${trigger.id}`;
	const group = (setting[groupKey] ?? {}) as Record<string, { enable?: boolean }>;
	const isOn = Boolean(group[trigger.id]?.enable);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pending = useRef<string | null>(null);

	const save = () => {
		if (null === pending.current) {
			return;
		}

		const value = pending.current;

		pending.current = null;

		apiPost<{ success?: boolean; message?: string }>('settings', { setting: { [key]: value } })
			.then((response) => {
				if (response.message) {
					notify(false === response.success ? 'error' : 'success', response.message);
				}
			})
			.catch((error) => notify('error', errorMessage(error)));
	};

	// A message still waiting to be saved is sent when the row goes away.
	useEffect(
		() => () => {
			if (timer.current) {
				clearTimeout(timer.current);
			}

			save();
		},
		[]
	);

	const change = (value: string) => {
		updateSetting(key, value);
		pending.current = value;

		if (timer.current) {
			clearTimeout(timer.current);
		}

		timer.current = setTimeout(save, 800);
	};

	return (
		<>
			{trigger.desc}
			{isOn && (
				<div className="vulomail-alert-message">
					<label htmlFor={key}>{__('Message', 'vulomail')}</label>
					<TextAreaInput
						id={key}
						name={key}
						usePlainText
						rowNumber={2}
						value={String(setting[key] ?? '')}
						placeholder={trigger.template}
						onChange={(value: string) => change(String(value))}
					/>
					<span className="vulomail-alert-message-hint">
						{__('Leave empty to use the default. Placeholders:', 'vulomail')}{' '}
						{trigger.placeholders.map((name) => `{${name}}`).join('  ')}
					</span>
				</div>
			)}
		</>
	);
};

export default AlertMessage;
