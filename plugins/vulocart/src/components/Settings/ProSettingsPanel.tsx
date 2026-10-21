import type { ReactNode } from 'react';
import { applyFilters } from '@wordpress/hooks';
import { ModuleRequired, type EngineView } from '../EngineScreen/EngineScreen';

interface ProSettingsPanelProps {
	/** The settings tab's id; the Pro module answers `vulocart_settings_panel_{id}` with its page. */
	id: string;
	/** What to show when nothing answered: the tab, and the module that provides it. */
	view: EngineView;
}

/**
 * A Settings sub-tab that a module provides. The tab is always listed, so a store sees everything VuloCart can do;
 * the module (vulocart-pro) fills it in through `vulocart_settings_panel_{id}`, and until it does - Pro not
 * installed, not licensed, or the module off - the panel says what to do and offers the one action that fixes it.
 */
export default function ProSettingsPanel( { id, view }: ProSettingsPanelProps ) {
	const content = applyFilters( `vulocart_settings_panel_${ id }`, null ) as ReactNode;

	// `.vulocart-engine-page` carries the button and card styles the prompt is drawn with.
	return <>{ content || (
		<div className="vulocart-engine-page">
			<ModuleRequired view={ view } />
		</div>
	) }</>;
}

/** A `PanelComponent` for a settings tab file (those are plain `.ts`, so they cannot write the JSX themselves). */
export const proSettingsPanel = ( id: string, view: EngineView ) =>
	function ProPanel() {
		return <ProSettingsPanel id={ id } view={ view } />;
	};
