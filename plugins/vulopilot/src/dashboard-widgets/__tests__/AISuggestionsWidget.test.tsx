import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse } from '@zyra/core';
import AISuggestionsWidget from '../AISuggestionsWidget';

describe( 'AISuggestionsWidget', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
		delete ( window as unknown as { location: unknown } ).location;
		( window as unknown as { location: Location } ).location = {
			href: '',
		} as Location;
	} );

	it( 'shows an honest empty state when there are no open findings', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [] );

		render(
			<AISuggestionsWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /nothing to suggest right now/i )
		).toBeInTheDocument();
	} );

	it( 'shows a retry option when the findings request fails', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( null );

		render(
			<AISuggestionsWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /could not load suggestions/i )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: /retry/i } )
		).toBeInTheDocument();
	} );

	it( 'navigates to the finding\'s category tab when "Fix with AI" is clicked', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [
			{ id: 1, title: 'Missing meta description', severity: 'high', category: 'seo' },
		] );

		render(
			<AISuggestionsWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( 'Missing meta description' )
		).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole( 'button', { name: /fix with ai/i } )
		);

		// Regression: this used to send 'seo'-category findings to
		// '?tab=seo', a route that doesn't exist (routes.ts has no 'seo'
		// tab — SeoTab.tsx only exists as a subtab of GEO). The real
		// route for 'seo' findings is GEO's own SEO subtab.
		expect( window.location.href ).toBe(
			'?page=vulopilot#&tab=geo&subtab=seo'
		);
	} );

	it( 'sends an \'accessibility\'-category finding to Security\'s Accessibility subtab, not the nonexistent \'?tab=accessibility\'', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [
			{ id: 2, title: 'Form input missing a label', severity: 'medium', category: 'accessibility' },
		] );

		render(
			<AISuggestionsWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		await userEvent.click(
			await screen.findByRole( 'button', { name: /fix with ai/i } )
		);

		expect( window.location.href ).toBe(
			'?page=vulopilot#&tab=security&subtab=accessibility'
		);
	} );
} );
