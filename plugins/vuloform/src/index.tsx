/* global vuloformAppLocalizer */
import { render } from '@wordpress/element';
import { BrowserRouter } from 'react-router-dom';
import { configureZyra } from '@zyra/core';
import App from './app';
import { apiDelete, apiGet, apiPost } from './services/api';
import { errorMessage, notify } from './services/notify';
import './components/common.scss';

configureZyra(vuloformAppLocalizer);

// What extensions use instead of bundling their own REST client and notices: the notice receiver
// lives in this app, so a notice raised from another bundle has to go through here to be seen.
window.vuloform = { apiGet, apiPost, apiDelete, notify, errorMessage };

const mount = () => {
	const adminWrapper = document.getElementById('admin-main-wrapper');

	if (adminWrapper) {
		render(
			<BrowserRouter>
				<App />
			</BrowserRouter>,
			adminWrapper
		);
	}
};

// Scripts of extensions load after this one. Waiting for the document lets them register their
// screens (services/slots.ts) before the first render.
if ('loading' === document.readyState) {
	document.addEventListener('DOMContentLoaded', mount);
} else {
	mount();
}
