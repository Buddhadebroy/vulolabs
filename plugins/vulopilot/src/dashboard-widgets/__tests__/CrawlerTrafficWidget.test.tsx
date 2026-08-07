import { render, screen } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';
import CrawlerTrafficWidget from '../CrawlerTrafficWidget';

describe( 'CrawlerTrafficWidget', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows an honest empty state when no AI crawler has visited yet', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			bot_last_seen: [],
			most_crawled_pages: [],
			daily_volume: [],
		} );

		render(
			<CrawlerTrafficWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /no ai crawler visits yet/i )
		).toBeInTheDocument();
	} );

	it( 'renders the real total visit count and top bots by last-seen', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			bot_last_seen: [
				{ bot_name: 'GPTBot', last_seen_at: '2026-01-01T00:00:00' },
			],
			most_crawled_pages: [],
			daily_volume: [
				{ date: '2026-01-01', total: 12 },
				{ date: '2026-01-02', total: 8 },
			],
		} );

		render(
			<CrawlerTrafficWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( '20 visits, last 30 days' )
		).toBeInTheDocument();
		expect( screen.getByText( 'GPTBot' ) ).toBeInTheDocument();
	} );
} );
