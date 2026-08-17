import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShowProPopup from '../Popup';

describe( 'ShowProPopup', () => {
	/**
	 * Regression: "Enable Now" used to call `window.open(url)` with no
	 * target. Real browsers (Chromium confirmed live) treat an omitted
	 * target as "open a new background tab," not "navigate here" — so
	 * clicking it silently opened a second tab while the user stayed on
	 * the still-locked widget with no visible feedback, looking exactly
	 * like the button did nothing. `'_self'` is what every other
	 * same-page hash-tab navigation in this plugin already uses.
	 */
	it( '"Enable Now" navigates the current tab, not a new one', async () => {
		const openSpy = jest.spyOn( window, 'open' ).mockImplementation( () => null );

		render( <ShowProPopup moduleName="advanced-reports" /> );

		await userEvent.click(
			screen.getByRole( 'button', { name: /enable now/i } )
		);

		expect( openSpy ).toHaveBeenCalledWith(
			expect.stringContaining( '#&tab=modules&module=advanced-reports' ),
			'_self'
		);

		openSpy.mockRestore();
	} );
} );
