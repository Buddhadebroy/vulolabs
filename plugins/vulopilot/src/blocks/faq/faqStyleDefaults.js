/**
 * Real default values for every `vulopilot/faq` style/settings attribute - the single source of
 * truth both the editor's own Style tab (index.js) and FaqRenderer.php's own PHP mirror read, so
 * "unset" always means the same thing on both sides. An accent color left as `''` here falls
 * through to `var(--color-primary, #002991)` in blocks.scss, not a hardcoded value - this site's
 * own theme primary color wins when it's set, `#002991` only when nothing else is.
 */
export const DEFAULT_FAQ_STYLE = {
	layout: {
		width: '',
		maxWidth: '',
		align: 'left', // left | center | right
		itemGap: '1rem',
	},
	container: {
		background: '',
		padding: { top: '', right: '', bottom: '', left: '' },
		border: { color: '', width: '', style: 'solid' },
		radius: '',
		shadow: '',
	},
	item: {
		background: '#ffffff',
		border: { color: '#e6e9f2', width: '0.0625rem', style: 'solid' },
		radius: '0.75rem',
		shadow: '',
	},
	question: {
		fontFamily: '',
		fontSize: '1.125rem',
		fontWeight: '600',
		lineHeight: '1.4',
		letterSpacing: '',
		textAlign: 'left',
		color: '#1f2937',
		background: '',
		padding: { top: '1.25rem', right: '1.25rem', bottom: '1.25rem', left: '1.25rem' },
	},
	answer: {
		fontFamily: '',
		fontSize: '1rem',
		fontWeight: '400',
		lineHeight: '1.6',
		color: '#1f2937',
		background: '',
		padding: { top: '1.25rem', right: '1.25rem', bottom: '1.25rem', left: '1.25rem' },
		linkColor: '',
	},
	icon: {
		size: '1.75rem',
		color: '',
		spacing: '0.813rem',
		background: '#f2f5ff',
		radius: '0.4375rem',
	},
	states: {
		hoverBorderColor: '#cbd4f5',
		expandedBorderColor: '#b8c6f2',
		expandedShadow: '0 0.25rem 1rem rgba(0, 41, 145, 0.06)',
		expandedBackground: '#f8faff',
		expandedQuestionColor: '',
		expandedIconBackground: '',
		expandedIconColor: '#ffffff',
		focusColor: '',
	},
	responsive: {
		tablet: {
			questionFontSize: '',
			answerFontSize: '',
			itemPadding: '',
			itemGap: '',
			iconSize: '',
		},
		mobile: {
			questionFontSize: '0.9375rem',
			answerFontSize: '0.875rem',
			itemPadding: '',
			itemGap: '0.5rem',
			iconSize: '1.625rem',
		},
	},
};

/**
 * 3 real `style.item`/`style.question` bundles - picking a preset writes these straight into the
 * block's own `style` attribute (same `setAttributes()` path a manual Spacing & Borders edit
 * uses), so the result is a real, inspectable value rather than a CSS-only "look" that manual
 * fine-tuning afterward could silently fight with. `appearance` itself just remembers which
 * preset button is shown selected - re-picking the same one is a no-op, picking a different one
 * overwrites `item`/`question` again.
 */
export const APPEARANCE_PRESETS = [
	{
		value: 'cards',
		label: 'Cards',
		desc: 'Each question its own bordered, shadowed card.',
		style: {
			item: {
				background: '#ffffff',
				border: { color: '#e6e9f2', width: '0.0625rem', style: 'solid' },
				radius: '0.75rem',
				shadow: '',
			},
		},
	},
	{
		value: 'dividers',
		label: 'Dividers',
		desc: 'A flat list, separated by a thin line.',
		style: {
			item: {
				background: 'transparent',
				border: { color: '#e6e9f2', width: '0.0625rem', style: 'solid' },
				radius: '0',
				shadow: '',
			},
		},
	},
	{
		value: 'minimal',
		label: 'Minimal',
		desc: 'No borders or backgrounds - just spacing.',
		style: {
			item: {
				background: 'transparent',
				border: { color: 'transparent', width: '0', style: 'solid' },
				radius: '0',
				shadow: '',
			},
		},
	},
];

export const ICON_STYLE_OPTIONS = [
	{ label: 'Plus / Minus', value: 'plus-minus' },
	{ label: 'Chevron', value: 'chevron' },
	{ label: 'Arrow', value: 'arrow' },
];

export const ICON_POSITION_OPTIONS = [
	{ label: 'Right', value: 'right' },
	{ label: 'Left', value: 'left' },
];

export const LAYOUT_MODE_OPTIONS = [
	{ label: 'Accordion', value: 'accordion' },
	{ label: 'Always expanded', value: 'expanded' },
];

export const HEADING_LEVEL_OPTIONS = [
	{ label: 'None (not a heading)', value: 0 },
	{ label: 'H2', value: 2 },
	{ label: 'H3', value: 3 },
	{ label: 'H4', value: 4 },
	{ label: 'H5', value: 5 },
	{ label: 'H6', value: 6 },
];
