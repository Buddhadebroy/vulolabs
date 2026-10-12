/* global vulobackupAppLocalizer */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import { HeaderComponent } from '@zyra/components';
import Brand from './assets/images/brand-logo.svg';
import { routes } from './routes';
import { searchIndex, SearchItem } from './searchIndex';
import { JobProvider } from './services/JobContext';

/**
 * Every admin URL is `admin.php?page=vulobackup`, so the active tab is read from the URL hash
 * (`#&tab=backups`), the same scheme the other VuloLabs admin apps use.
 */
const App = () => {
	const hash = new URLSearchParams(useLocation().hash);
	const currentTab = hash.get('tab') || 'overview';
	const [results, setResults] = useState<SearchItem[]>([]);

	// Highlight the active tab in the WP admin sidebar submenu.
	useEffect(() => {
		document.querySelectorAll('#toplevel_page_vulobackup > ul > li > a').forEach((menuItem) => {
			const itemTab = new URLSearchParams(new URL((menuItem as HTMLAnchorElement).href).hash.substring(1)).get('tab');

			(menuItem.parentNode as HTMLElement | null)?.classList.toggle('current', itemTab === currentTab);
		});
	}, [currentTab]);

	const handleQueryUpdate = ({ searchValue, searchAction }: { searchValue: string; searchAction?: string }) => {
		const query = searchValue.trim().toLowerCase();

		if (!query) {
			setResults([]);
			return;
		}

		setResults(
			searchIndex.filter((item) => {
				if (searchAction && 'all' !== searchAction && item.category !== searchAction) {
					return false;
				}

				return item.name.toLowerCase().includes(query) || Boolean(item.desc?.toLowerCase().includes(query));
			})
		);
	};

	const Page = (routes.find((route) => route.tab === currentTab) ?? routes[0]).component;

	return (
		<JobProvider>
			<HeaderComponent
				brandImg={Brand}
				results={results}
				search={{
					placeholder: __('Search…', 'vulobackup'),
					options: [
						{ value: 'all', label: __('All', 'vulobackup') },
						{ value: 'tabs', label: __('Tabs', 'vulobackup') },
						{ value: 'settings', label: __('Settings', 'vulobackup') },
					],
				}}
				onQueryUpdate={handleQueryUpdate}
				onResultClick={(item: SearchItem) => {
					window.location.hash = item.link;
				}}
				free={vulobackupAppLocalizer.version}
				searchSize={7}
			/>
			<Page />
		</JobProvider>
	);
};

export default App;
