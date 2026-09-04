import { __ } from '@wordpress/i18n';
import { SectionComponent } from '@zyra/components';
import { ExpandablePanelInput } from '@zyra/inputs';

// Matches AiProvidersPanel.tsx's own `newProviderOptions` shape exactly
// (its own `ExpandablePanelInput`'s `addNewOptions` — a real per-provider
// `{ value, label, template }` triple, `template` being that new panel's
// own seed `formFields`/`icon`/`desc`) — not redeclared narrower here.
type NewProviderOption = Record<string, unknown>;

/**
 * Extracted from AiProvidersPanel.tsx's own render (per direct instruction)
 * — same "Other providers" section, still its own file since it carries a
 * non-trivial amount of markup of its own. Every piece of data/behavior it
 * needs (`otherConfigured`, `otherPanelValues`, `onChange`, ...) is still
 * owned and computed by AiProvidersPanel.tsx itself and passed straight
 * through.
 *
 * No hand-rolled collapsible card/header anymore (per direct instruction,
 * "use expandable add new concept") — the custom clickable header,
 * expand/collapse chevron, and bulk Enable/Disable-all switch this used to
 * wrap `ExpandablePanelInput` in are gone. `ExpandablePanelInput` already
 * has its own real per-provider open/close accordion (each row's own
 * header, same as AiProvidersPanel.tsx's hero panel now uses) and its own
 * real "Add New" button (`addNewBtn`/`addNewOptions`, select-driven since
 * there's more than one addable provider) — this file's only job now is to
 * label the section and hand real props straight through to that native
 * behavior instead of duplicating it.
 */
interface OtherProvidersCardProps {
	otherConfiguredCount: number;
	newProviderOptionsCount: number;
	panelKey: string;
	methods: unknown[];
	value: Record<string, Record<string, unknown>>;
	onChange: ( values: Record<string, Record<string, unknown>> ) => void;
	addNewOptions: NewProviderOption[];
}

const OtherProvidersCard = ( {
	otherConfiguredCount,
	newProviderOptionsCount,
	panelKey,
	methods,
	value,
	onChange,
	addNewOptions,
}: OtherProvidersCardProps ) => (
	<>
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
	</>
);

export default OtherProvidersCard;
