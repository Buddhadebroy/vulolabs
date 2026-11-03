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
		border: { color: '', width: '0', style: 'solid' },
		radius: '0',
		shadow: '',
	},
	item: {
		background: 'transparent',
		border: { color: 'transparent', width: '0', style: 'solid' },
		radius: '0',
		shadow: '',
	},
	question: {
		fontFamily: '',
		fontSize: '1rem',
		fontWeight: '500',
		lineHeight: '1.5',
		letterSpacing: '',
		textAlign: 'left',
		color: '#1e1e1e',
		background: '',
		padding: { top: '1.25rem', right: '1.5rem', bottom: '1.25rem', left: '1.5rem' },
	},
	answer: {
		fontFamily: '',
		fontSize: '1rem',
		fontWeight: '400',
		lineHeight: '1.5',
		color: '#50575e',
		background: '',
		padding: { top: '0', right: '1.5rem', bottom: '1.25rem', left: '1.5rem' },
		linkColor: '',
	},
	icon: {
		size: '1.125rem',
		color: '',
		spacing: '1rem',
		background: 'transparent',
		radius: '0',
	},
	states: {
		hoverBorderColor: '',
		expandedBorderColor: '',
		expandedShadow: '',
		expandedBackground: '',
		expandedQuestionColor: '',
		expandedIconBackground: '',
		expandedIconColor: '',
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
			itemGap: '0',
			iconSize: '1.625rem',
		},
	},
};

/**
 * 2 real `style.layout`/`style.container`/`style.item` bundles - picking a preset writes these
 * straight into the block's own `style` attribute (same `setAttributes()` path a manual Spacing &
 * Borders edit uses), so the result is a real, inspectable value rather than a CSS-only "look"
 * that manual fine-tuning afterward could silently fight with. `appearance` itself just remembers
 * which preset button is shown selected - re-picking the same one is a no-op, picking a different
 * one overwrites `layout`/`container`/`item` again.
 */
export const APPEARANCE_PRESETS = [
	{
		value: 'minimal',
		label: 'Default',
		desc: 'No borders or backgrounds - just spacing.',
		style: {
			layout: { itemGap: '1rem' },
			container: DEFAULT_FAQ_STYLE.container,
			item: DEFAULT_FAQ_STYLE.item,
		},
	},
	{
		value: 'card',
		label: 'Card',
		desc: 'One bordered panel, rows separated by a thin line.',
		style: {
			layout: { itemGap: '0rem' },
			container: {
				background: '#ffffff',
				border: { color: '#e1e6f2', width: '0.0625rem', style: 'solid' },
				radius: '0.125rem',
				shadow: '',
			},
			item: {
				background: 'transparent',
				border: { color: '#e1e6f2', width: '0.0625rem', style: 'solid' },
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
