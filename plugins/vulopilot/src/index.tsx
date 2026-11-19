/* global vulopilotAppLocalizer */
import { createRoot } from '@wordpress/element';
import { BrowserRouter } from 'react-router-dom';
import { configureZyra, initializeModules } from '@zyra/core';
import App from './app';
import './components/admin.scss';
import { syncActiveModulesWithModuleToggles } from './services/syncActiveModules';

configureZyra(vulopilotAppLocalizer);
initializeModules('vulopilot', 'free', 'modules');
syncActiveModulesWithModuleToggles();

const adminWrapper = document.getElementById('admin-main-wrapper');

// The React 18 root API: `render()` of @wordpress/element is deprecated and logs a warning on every load.
if (adminWrapper) {
	createRoot(adminWrapper).render(
		<BrowserRouter>
			<App />
		</BrowserRouter>
	);
}
