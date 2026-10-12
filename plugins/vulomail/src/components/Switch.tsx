import { useId } from 'react';

interface SwitchProps {
	name: string;
	label: string;
	checked: boolean;
	// eslint-disable-next-line no-unused-vars
	onChange: (checked: boolean) => void;
}

/**
 * A real on/off slider for a single yes/no setting. zyra's ToggleInput renders a single option as a
 * button-styled pill that looks identical whether it is on or off (it is built for picking one of
 * several choices, not for a lone boolean) - this gives the setting a switch whose state is obvious
 * at a glance, the same shape WordPress core's own toggle uses.
 */
const Switch = ({ name, label, checked, onChange }: SwitchProps) => {
	const id = useId();

	return (
		<label className="vulomail-switch" htmlFor={id}>
			<input
				id={id}
				name={name}
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
			/>
			<span className="vulomail-switch-track" aria-hidden="true" />
			<span className="vulomail-switch-label">{label}</span>
		</label>
	);
};

export default Switch;
