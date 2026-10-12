/**
 * Where in a form's builder the admin is, kept in the URL hash so a place can be linked to,
 * reloaded and reached with the browser's Back button:
 * `#&tab=forms&form=12&subtab=settings&section=integrations`.
 */
export type BuilderTab = 'fields' | 'settings' | 'share';

const TABS: BuilderTab[] = ['fields', 'settings', 'share'];

const params = (hash: string) => new URLSearchParams(hash.replace(/^#/, ''));

/** The builder tab a URL hash asks for; Fields when it names none. */
export const tabFromHash = (hash: string): BuilderTab => {
	const tab = params(hash).get('subtab') as BuilderTab;

	return TABS.includes(tab) ? tab : 'fields';
};

/** The settings group a URL hash asks for, as written in the URL, or ''. */
export const sectionFromHash = (hash: string) => params(hash).get('section') ?? '';

/** The hash for a place in the builder of the form now open. Fields is the plain form address. */
export const builderHash = (tab: BuilderTab, section = '') => {
	const form = params(window.location.hash).get('form') ?? '';
	const place = 'fields' === tab ? '' : `&subtab=${tab}${'settings' === tab && section ? `&section=${encodeURIComponent(section)}` : ''}`;

	return `&tab=forms&form=${form}${place}`;
};

/** Goes to a place in the builder of the form now open. */
export const openBuilder = (tab: BuilderTab, section = '') => {
	const hash = builderHash(tab, section);

	if (window.location.hash.replace(/^#/, '') !== hash) {
		window.location.hash = hash;
	}
};
