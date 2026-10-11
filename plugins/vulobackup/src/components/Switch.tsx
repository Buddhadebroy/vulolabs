interface SwitchProps {
	name: string;
	label: string;
	desc?: string;
	checked: boolean;
	// eslint-disable-next-line no-unused-vars
	onChange: (checked: boolean) => void;
}

/**
 * An on/off setting on one line: what it is on the left, the switch on the right.
 */
const Switch = ({ name, label, desc, checked, onChange }: SwitchProps) => (
	<label className="vulobackup-switch-row" htmlFor={`vulobackup-switch-${name}`}>
		<span className="vulobackup-switch-text">
			<span className="vulobackup-control-label">{label}</span>
			{desc && <span className="vulobackup-control-desc">{desc}</span>}
		</span>
		<button
			type="button"
			role="switch"
			id={`vulobackup-switch-${name}`}
			aria-checked={checked}
			className={`vulobackup-switch${checked ? ' is-on' : ''}`}
			onClick={() => onChange(!checked)}
		>
			<span aria-hidden="true" />
		</button>
	</label>
);

export default Switch;
