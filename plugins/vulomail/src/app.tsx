/* global vulomailAppLocalizer */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import { HeaderComponent } from '@zyra/components';
import { scrollToId } from '@zyra/core';
import Brand from './assets/images/brand-logo.png';
import { routes } from './routes';
import { searchIndex, SearchItem } from './searchIndex';

// Screens that have moved: old address => where they are now.
const MOVED: Record<string, string> = {
	connections: 'settings&subtab=connections',
	notifications: 'sms-alerts',
	'settings&subtab=notifications': 'sms-alerts',
	'settings&subtab=advanced': 'settings&subtab=uninstall',
};

/**
 * Every admin URL is `admin.php?page=vulomail`, so the active tab is read from the URL hash
 * (`#&tab=logs`), the same scheme the other VuloLabs admin apps use.
 */
const App = () => {
	const hash = new URLSearchParams(useLocation().hash);
	const requestedTab = hash.get('tab') || 'dashboard';
	const subtab = hash.get('subtab');
	const movedTo = MOVED[subtab ? `${requestedTab}&subtab=${subtab}` : requestedTab];
	const currentTab = movedTo ? movedTo.split('&')[0] : requestedTab;

	// Send an old link on to its new address, so the screen and the browser URL agree.
	useEffect(() => {
		if (movedTo) {
			window.location.hash = `&tab=${movedTo}`;
		}
	}, [movedTo]);
	const [results, setResults] = useState<SearchItem[]>([]);

	// Highlight the active tab in the WP admin sidebar submenu.
	useEffect(() => {
		document
			.querySelectorAll('#toplevel_page_vulomail > ul > li > a')
			.forEach((menuItem) => {
				const itemHash = new URL((menuItem as HTMLAnchorElement).href)
					.hash;
				const itemTab = new URLSearchParams(itemHash.substring(1)).get(
					'tab'
				);
				const parent = menuItem.parentNode as HTMLElement | null;

				parent?.classList.toggle('current', itemTab === currentTab);
			});
	}, [currentTab]);

	const handleQueryUpdate = ({
		searchValue,
		searchAction,
	}: {
		searchValue: string;
		searchAction?: string;
	}) => {
		const query = searchValue.trim().toLowerCase();

		if (!query) {
			setResults([]);
			return;
		}

		setResults(
			searchIndex.filter((item) => {
				// The dropdown category ('tabs'/'settings'/'sections').
				if (searchAction && 'all' !== searchAction && item.category !== searchAction) {
					return false;
				}

				return (
					item.name.toLowerCase().includes(query) ||
					Boolean(item.desc?.toLowerCase().includes(query))
				);
			})
		);
	};

	// A section result's screen may still be loading its data when the result is clicked.
	const scrollToSectionWhenReady = (sectionId: string, attempt = 0) => {
		if (document.getElementById(sectionId)) {
			scrollToId(sectionId);
			return;
		}

		if (attempt < 20) {
			setTimeout(() => scrollToSectionWhenReady(sectionId, attempt + 1), 100);
		}
	};

	const handleResultClick = (item: SearchItem) => {
		window.location.hash = item.link;

		if (item.sectionId) {
			scrollToSectionWhenReady(item.sectionId);
		}
	};

	const Page = (
		routes.find((route) => route.tab === currentTab) ?? routes[0]
	).component;

	return (
		<>
			<HeaderComponent
				brandImg={Brand}
				results={results}
				search={{
					placeholder: __('Search…', 'vulomail'),
					options: [
						{ value: 'all', label: __('Every Where', 'vulomail') },
						{ value: 'tabs', label: __('Tabs', 'vulomail') },
						{ value: 'settings', label: __('Settings', 'vulomail') },
						{ value: 'sections', label: __('Sections', 'vulomail') },
					],
				}}
				onQueryUpdate={handleQueryUpdate}
				onResultClick={handleResultClick}
				free={vulomailAppLocalizer.version}
				searchSize={7}
			/>
			<Page />
		</>
	);
};

export default App;
