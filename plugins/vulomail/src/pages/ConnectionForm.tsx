/* global vulomailAppLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { FormGroupComponent, FormGroupWrapperComponent, IconComponent } from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';
import Switch from '../components/Switch';
import { apiPost } from '../services/api';
import { errorMessage, notify } from '../services/notify';
import type {
	Connection,
	ConnectionsPayload,
	ProviderDefinition,
	ProviderField,
} from '../services/types';

interface ConnectionFormProps {
	channel: 'email' | 'sms';
	/** The connection being edited; omit to create one. */
	connection?: Connection;
	// eslint-disable-next-line no-unused-vars
	onSaved: (payload: ConnectionsPayload) => void;
	onCancel: () => void;
}

type Values = Record<string, string | number | boolean>;

const defaultsFor = (provider?: ProviderDefinition): Values => {
	const values: Values = {};

	provider?.fields.forEach((field) => {
		values[field.key] = field.default ?? ('toggle' === field.type ? false : '');
	});

	return values;
};

const ConnectionForm = ({ channel, connection, onSaved, onCancel }: ConnectionFormProps) => {
	const providers = vulomailAppLocalizer.providers.filter(
		(provider) => provider.channel === channel
	);

	const [providerId, setProviderId] = useState(connection?.provider ?? providers[0]?.id ?? '');
	const provider = providers.find((item) => item.id === providerId);

	const [label, setLabel] = useState(connection?.label ?? '');
	const [enabled, setEnabled] = useState(connection?.enabled ?? true);
	const [values, setValues] = useState<Values>(connection?.settings ?? defaultsFor(provider));
	const [isSaving, setIsSaving] = useState(false);

	const setValue = (key: string, value: string | number | boolean) =>
		setValues((current) => ({ ...current, [key]: value }));

	const isVisible = (field: ProviderField) =>
		!field.show_if ||
		Object.entries(field.show_if).every(([key, expected]) => Boolean(values[key]) === Boolean(expected));

	const handleSave = () => {
		setIsSaving(true);

		apiPost<ConnectionsPayload>('connections', {
			id: connection?.id,
			channel,
			provider: providerId,
			label,
			enabled,
			settings: values,
		})
			.then((payload) => {
				notify('success', __('Connection saved.', 'vulomail'));
				onSaved(payload);
			})
			.catch((error) => notify('error', errorMessage(error)))
			.finally(() => setIsSaving(false));
	};

	const renderField = (field: ProviderField) => {
		const value = values[field.key];

		if ('toggle' === field.type) {
			return (
				<Switch
					name={field.key}
					label={field.label}
					checked={Boolean(value)}
					onChange={(checked) => setValue(field.key, checked)}
				/>
			);
		}

		if ('select' === field.type) {
			return (
				<SelectInput
					type="single-select"
					name={field.key}
					options={field.options ?? []}
					value={String(value ?? '')}
					isClearable={false}
					onChange={(next) => setValue(field.key, next as string)}
				/>
			);
		}

		return (
			<TextInput
				id={`vulomail-field-${field.key}`}
				name={field.key}
				type={'text' === field.type ? 'text' : field.type}
				value={(value as string | number) ?? ''}
				// A saved secret comes back masked; typing a new value replaces it, leaving it keeps it.
				placeholder={field.secret && connection ? __('Leave unchanged to keep the saved value', 'vulomail') : ''}
				onFocus={() => {
					if (field.secret && String(value ?? '').startsWith('••••')) {
						setValue(field.key, '');
					}
				}}
				onChange={(next) => setValue(field.key, 'number' === field.type ? Number(next) : String(next))}
			/>
		);
	};

	return (
		<div className="vulomail-popup-body">
			{/* Chrome ignores autoComplete="off" on a text input immediately followed by a password
			    input and autofills a saved login into both - these absorb that instead of "Connection
			    name" and the real secret field below. Invisible and never focusable by a real visitor. */}
			<div className="vulomail-autofill-trap" aria-hidden="true">
				<input type="text" name="vulomail-decoy-user" tabIndex={-1} autoComplete="off" />
				<input type="password" name="vulomail-decoy-pass" tabIndex={-1} autoComplete="new-password" />
			</div>
			<div className="popup-header vulomail-connection-header">
				<div className="popup-title">
					<IconComponent name={'email' === channel ? 'mail' : 'send'} />
					{connection ? __('Edit connection', 'vulomail') : __('Add connection', 'vulomail')}
				</div>
				<Switch
					name="enabled"
					label={__('Connection enabled', 'vulomail')}
					checked={enabled}
					onChange={setEnabled}
				/>
			</div>
			<FormGroupWrapperComponent>
				{!connection && (
					<FormGroupComponent label={__('Provider', 'vulomail')} desc={provider?.desc}>
						<SelectInput
							type="single-select"
							name="provider"
							options={providers.map((item) => ({ value: item.id, label: item.label }))}
							value={providerId}
							isClearable={false}
							onChange={(next) => {
								setProviderId(next as string);
								setValues(defaultsFor(providers.find((item) => item.id === next)));
							}}
						/>
					</FormGroupComponent>
				)}
				<FormGroupComponent
					label={__('Connection name', 'vulomail')}
					desc={__('Only used to tell your connections apart.', 'vulomail')}
				>
					<TextInput
						name="label"
						value={label}
						placeholder={provider?.label ?? ''}
						onChange={(next) => setLabel(String(next))}
					/>
				</FormGroupComponent>
				{provider?.fields.filter(isVisible).map((field) => (
					<FormGroupComponent
						key={field.key}
						label={'toggle' === field.type ? undefined : field.label}
						htmlFor={`vulomail-field-${field.key}`}
						desc={field.help}
					>
						{renderField(field)}
					</FormGroupComponent>
				))}
			</FormGroupWrapperComponent>
			<div className="vulomail-form-footer">
				<ButtonInput
					buttons={[
						{
							text: __('Cancel', 'vulomail'),
							color: 'border-red',
							onClick: onCancel,
							disabled: isSaving,
						},
						{
							text: isSaving ? __('Saving…', 'vulomail') : __('Save connection', 'vulomail'),
							icon: 'check',
							onClick: handleSave,
							disabled: isSaving || !provider,
						},
					]}
				/>
			</div>
		</div>
	);
};

export default ConnectionForm;
