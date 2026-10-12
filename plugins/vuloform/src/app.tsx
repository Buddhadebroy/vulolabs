/* global vuloformAppLocalizer */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import { HeaderComponent } from '@zyra/components';
import Brand from './assets/images/brand-logo.png';
import Forms from './pages/Forms';
import Builder from './builder/Builder';
import Submissions from './pages/Submissions';
import Settings from './pages/Settings';
import { adminTabs } from './services/slots';
import { staticIndex } from './searchIndex';
import type { SearchItem } from './searchIndex';
import { apiGet } from './services/api';

/**
 * Every admin URL is `admin.php?page=vuloform`, so the screen is read from the URL hash
 * (`#&tab=forms&form=12`), the same scheme the other VuloLabs admin apps use.
 */
const App = () => {
	const hash = new URLSearchParams(useLocation().hash);
	const currentTab = hash.get('tab') || 'forms';
	const formId = Number(hash.get('form')) || 0;
	const [results, setResults] = useState<SearchItem[]>([]);

	// Highlight the active tab in the WP admin sidebar submenu.
	useEffect(() => {
		document.querySelectorAll('#toplevel_page_vuloform > ul > li > a').forEach((menuItem) => {
			const itemTab = new URLSearchParams(new URL((menuItem as HTMLAnchorElement).href).hash.substring(1)).get('tab');

			(menuItem.parentNode as HTMLElement | null)?.classList.toggle('current', itemTab === currentTab);
		});
	}, [currentTab]);

	const extraTab = adminTabs().find((item) => item.tab === currentTab);

	// The site's forms, fetched when something is searched for and kept for half a minute, so a
	// form created or renamed a moment ago is found.
	const forms = useRef<SearchItem[] | null>(null);
	const fetchedAt = useRef(0);
	const latest = useRef(0);

	const search = ({ searchValue, searchAction }: { searchValue: string; searchAction?: string }) => {
		const query = searchValue.trim().toLowerCase();
		const run = ++latest.current;

		if (!query) {
			setResults([]);
			return;
		}

		const show = () => {
			// A slower, older lookup must not replace the results of a newer one.
			if (run !== latest.current) {
				return;
			}

			setResults(
				[...(forms.current ?? []), ...staticIndex()].filter(
					(item) =>
						(!searchAction || 'all' === searchAction || item.category === searchAction) &&
						`${item.name} ${item.desc ?? ''}`.toLowerCase().includes(query)
				)
			);
		};

		if (forms.current && Date.now() - fetchedAt.current < 30000) {
			show();
			return;
		}

		apiGet<{ data: { id: number; title: string; status: string }[] }>('forms', { per_page: 100 })
			.then((list) => {
				fetchedAt.current = Date.now();
				forms.current = list.data.map((form) => ({
					id: `form-${form.id}`,
					category: 'forms' as const,
					name: form.title || __('(no name)', 'vuloform'),
					desc: 'published' === form.status ? __('Form · Published', 'vuloform') : __('Form · Draft', 'vuloform'),
					link: `&tab=forms&form=${form.id}`,
					icon: 'form',
				}));
			})
			.catch(() => {
				forms.current = forms.current ?? [];
			})
			.finally(show);
	};

	let page = <Forms />;

	if ('forms' === currentTab && formId) {
		// Keyed by id so opening another form starts from a clean builder.
		page = <Builder key={formId} formId={formId} />;
	} else if ('submissions' === currentTab) {
		page = <Submissions />;
	} else if ('settings' === currentTab) {
		page = <Settings />;
	} else if (extraTab) {
		page = <extraTab.Component />;
	}

	return (
		<>
			<HeaderComponent
				brandImg={Brand}
				results={results}
				search={{
					placeholder: __('Search…', 'vuloform'),
					options: [
						{ value: 'all', label: __('All', 'vuloform') },
						{ value: 'forms', label: __('Forms', 'vuloform') },
						{ value: 'settings', label: __('Settings', 'vuloform') },
						{ value: 'tabs', label: __('Tabs', 'vuloform') },
					],
				}}
				onQueryUpdate={search}
				onResultClick={(item: SearchItem) => {
					window.location.hash = item.link;
				}}
				searchSize={7}
				free={vuloformAppLocalizer.version}
			/>
			{page}
		</>
	);
};

export default App;
