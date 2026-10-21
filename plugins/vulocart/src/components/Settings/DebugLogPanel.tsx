import { __ } from '@wordpress/i18n';
import { LogViewerInputFieldComponent } from '@zyra/inputs';

/**
 * Settings → Advanced → Debug log: zyra's log viewer (the last entries, with Download, Copy and Clear) across the full
 * width of the page. Entries are only recorded while "Enable debug logging" is on (the Logging sub-tab).
 */
const DebugLogPanel = () => (
	<div className="vulocart-debug-log">
		<p className="vulocart-debug-log__desc">
			{ __( 'The most recent entries, newest last. Entries are only recorded while debug logging is on.', 'vulocart' ) }
		</p>
		{ LogViewerInputFieldComponent.render( {
			field: {
				key: 'vulocart_debug_log',
				type: 'log',
				apiLink: 'logs',
				fileName: 'vulocart-debug.log',
				downloadBtnText: __( 'Download', 'vulocart' ),
				copyBtnText: __( 'Copy', 'vulocart' ),
				deleteBtnText: __( 'Clear', 'vulocart' ),
			},
		} ) }
	</div>
);

export default DebugLogPanel;
