/* global vulopilotAppLocalizer */
import { render } from '@wordpress/element';
import { BrowserRouter } from 'react-router-dom';
import { configureZyra, initializeModules } from '@zyra/core';
import App from './app';
import { syncActiveModulesWithModuleToggles } from './services/syncActiveModules';

configureZyra(vulopilotAppLocalizer);
initializeModules('vulopilot', 'free', 'modules');
syncActiveModulesWithModuleToggles();

const adminWrapper = document.getElementById('admin-main-wrapper');

if (adminWrapper) {
	render(
		<BrowserRouter>
			<App />
		</BrowserRouter>,
		adminWrapper
	);
}
