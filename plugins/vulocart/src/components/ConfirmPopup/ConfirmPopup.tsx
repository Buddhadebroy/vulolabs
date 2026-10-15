import { __ } from '@wordpress/i18n';
import { PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface ConfirmPopupProps {
	open: boolean;
	title: string;
	message: string;
	confirmText?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

/**
 * The lightbox confirmation VuloPilot shows (its `ShowProPopup` `confirmMode`) in place of
 * `window.confirm()`. Same markup/classes, so the shared popup stylesheet applies.
 */
export function ConfirmPopup( { open, title, message, confirmText, onConfirm, onCancel }: ConfirmPopupProps ) {
	return (
		<PopupComponent position="lightbox" open={ open } onClose={ onCancel } width={ 31.25 } height="auto">
			<div className="popup-confirm">
				<i className="popup-icon adminfont-suspended admin-badge red"></i>
				<div className="title">{ title }</div>
				<div className="desc">{ message }</div>
				<ButtonInput
					position="center"
					buttons={ [
						{ icon: 'close', text: __( 'Cancel', 'vulocart' ), color: 'red', onClick: onCancel },
						{ icon: 'delete', text: confirmText ?? __( 'Delete', 'vulocart' ), onClick: onConfirm },
					] }
				/>
			</div>
		</PopupComponent>
	);
}

export default ConfirmPopup;
