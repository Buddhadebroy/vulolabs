import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { FormGroupComponent } from '@zyra/components';
import { ExpandablePanelInput, MultiCheckboxInput } from '@zyra/inputs';

// Matches AiProvidersPanel.tsx's own `newProviderOptions` shape exactly
// (its own `ExpandablePanelInput`'s `addNewOptions` — a real per-provider
// `{ value, label, template }` triple, `template` being that new panel's
// own seed `formFields`/`icon`/`desc`) — not redeclared narrower here.
type NewProviderOption = Record<string, unknown>;

/**
 * Extracted from AiProvidersPanel.tsx's own render (per direct instruction)
 * — same "Other providers" card, now its own file since it carries real
 * state (`isOpen`) and a non-trivial amount of markup of its own. Every
 * piece of data/behavior it needs (`otherConfigured`, `otherPanelValues`,
 * `onChange`, ...) is still owned and computed by AiProvidersPanel.tsx
 * itself and passed straight through — this file only owns the collapse
 * toggle's own open/closed state, nothing about providers themselves.
 *
 * The Enabled/Disabled switch is a real `ChoiceToggleInput` now (per
 * direct instruction, matching the mockup screenshot) — not the plain
 * status text this card used before. `onToggleAll` (AiProvidersPanel.tsx's
 * own `handleToggleAllOtherProviders`) is a real, meaningful action: it
 * flips every currently-configured non-hero provider's own `is_active` at
 * once via the same real `PATCH /ai-providers/{id}` each row's individual
 * toggle already uses — not a switch that looks interactive but does
 * nothing. Disabled entirely when nothing is configured yet (`anyOtherActive`
 * is meaningless with zero rows to derive it from).
 */
interface OtherProvidersCardProps {
	otherConfiguredCount: number;
	newProviderOptionsCount: number;
	anyOtherActive: boolean;
	isTogglingAll: boolean;
	onToggleAll: () => void;
	panelKey: string;
	methods: unknown[];
	value: Record<string, Record<string, unknown>>;
	onChange: ( values: Record<string, Record<string, unknown>> ) => void;
	addNewOptions: NewProviderOption[];
}

const OtherProvidersCard = ( {
	otherConfiguredCount,
	newProviderOptionsCount,
	anyOtherActive,
	isTogglingAll,
	onToggleAll,
	panelKey,
	methods,
	value,
	onChange,
	addNewOptions,
}: OtherProvidersCardProps ) => {
	const [ isOpen, setIsOpen ] = useState( false );

	return (
		<div className="ai-provider-card ai-provider-other-card">
			<div
				className="ai-provider-card-header is-clickable"
				onClick={ () => setIsOpen( ( v ) => ! v ) }
			>
				<div className="ai-provider-card-icon">
					<i className="adminfont-ai" />
				</div>
				<div className="ai-provider-card-title">
					<strong>{ __( 'Other providers', 'vulopilot' ) }</strong>
					<span className="desc">
						{ __( 'Connect with other AI providers.', 'vulopilot' ) }
					</span>
				</div>
				{ /* stopPropagation — this whole header row also has its own
				 * onClick (expand/collapse); without this, using the real
				 * toggle switch below would also flip the card open/closed
				 * on every click. */ }
				<div onClick={ ( e ) => e.stopPropagation() }>
					{ /* MultiCheckboxInput's own `look="toggle"` — the real oval
					 * pill switch (SettingToggle's own docblock: "the same pill
					 * switch ModuleGridComponent's module activate/deactivate
					 * control already renders"), not ChoiceToggleInput's
					 * bordered button-group look. Has no real `disabled` prop
					 * either — this class is the only way to visually +
					 * functionally disable it while there's nothing configured
					 * yet to flip (see the `onClick` guard below, and this
					 * class's own CSS in Settings.scss). */ }
					<MultiCheckboxInput
						look="toggle"
						type="checkbox"
						wrapperClass={ `ai-provider-other-toggle${ 0 === otherConfiguredCount || isTogglingAll ? ' is-disabled' : '' }` }
						toggleStatusLabel={ { on: __( 'Enabled', 'vulopilot' ), off: __( 'Disabled', 'vulopilot' ) } }
						options={ [ { key: 'enabled', value: 'enabled' } ] }
						value={ anyOtherActive ? [ 'enabled' ] : [] }
						modules={ [] }
						onChange={ () => {
							if ( ! isTogglingAll && 0 < otherConfiguredCount ) {
								onToggleAll();
							}
						} }
					/>
				</div>
				<i className={ `adminfont-arrow-${ isOpen ? 'up' : 'down' } ai-provider-expand-icon` } />
			</div>

			{ isOpen && (
				<div className="ai-provider-card-body">
					<FormGroupComponent row label={ __( 'Add and configure other AI providers that are compatible with the OpenAI API format.', 'vulopilot' ) }>
						{ otherConfiguredCount > 0 || newProviderOptionsCount > 0 ? (
							<ExpandablePanelInput
								key={ panelKey }
								name="ai-providers-other"
								methods={ methods }
								value={ value }
								onChange={ onChange }
								canAccess
								addNewBtn={ newProviderOptionsCount > 0 }
								addNewTemplate={ {
									editableFields: { title: false, description: false },
								} }
								addNewOptions={ addNewOptions }
							/>
						) : (
							<div className="desc">{ __( 'No other providers configured yet.', 'vulopilot' ) }</div>
						) }
					</FormGroupComponent>
				</div>
			) }
		</div>
	);
};

export default OtherProvidersCard;
