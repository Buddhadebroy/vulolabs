/* global vuloformAppLocalizer */
import { Link, useLocation } from 'react-router-dom';
import { FormBuilder } from '@zyra/builderform';
import type { FormBuilderRoute } from '@zyra/builderform';
import { apiGet, apiPost } from '../services/api';
import { errorMessage, notify } from '../services/notify';
import { formSettingsSections, inspectorSections } from '../services/slots';

const params = (hash: string) => new URLSearchParams(hash.replace(/^#/, ''));

/**
 * Where in a form's builder the admin is, kept in the URL hash so a place can be linked to,
 * reloaded and reached with the browser's Back button:
 * `#&tab=forms&form=12&subtab=settings&section=integrations`.
 */
const hashFor: FormBuilderRoute['hashFor'] = (tab, section = '') => {
	const form = params(window.location.hash).get('form') ?? '';
	const place = 'fields' === tab ? '' : `&subtab=${tab}${'settings' === tab && section ? `&section=${encodeURIComponent(section)}` : ''}`;

	return `&tab=forms&form=${form}${place}`;
};

const setHash = (hash: string) => {
	if (window.location.hash.replace(/^#/, '') !== hash) {
		window.location.hash = hash;
	}
};

const route: FormBuilderRoute = {
	useHash: () => useLocation().hash,
	hashFor,
	urlFor: (tab, section) => `?page=vuloform#${hashFor(tab, section)}`,
	go: (tab, section) => setHash(hashFor(tab, section)),
	setHash,
	goToList: () => setHash('&tab=forms'),
	listHref: '#&tab=forms',
	spamSettingsHref: '#&tab=settings&subtab=spam',
	Link,
};

/**
 * The form builder is zyra's `FormBuilder`; this hands it what is VuloForm's own: its REST client,
 * notices, address scheme, localized data and the extension points VuloForm Pro uses.
 */
const Builder = ({ formId }: { formId: number }) => (
	<FormBuilder
		formId={formId}
		api={{ get: apiGet, post: apiPost }}
		notify={notify}
		route={route}
		data={vuloformAppLocalizer}
		slots={{ inspectorSections, formSettingsSections }}
		onPreviewReady={(root) => window.vuloformInit?.(root)}
	/>
);

export default Builder;
