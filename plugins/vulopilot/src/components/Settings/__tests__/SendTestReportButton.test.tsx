import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse, sendApiResponse } from '@zyra/core';
import SendTestReportButton from '../SendTestReportButton';

declare const appLocalizer: { khali_dabba?: boolean };

const POPUP_HEADING = /unlock the full vulopilot toolkit/i;

describe( 'SendTestReportButton', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {} );
		// Resolves with nothing so the component takes its early-return path
		// (the Notice it would otherwise render isn't part of the zyra test double).
		( sendApiResponse as jest.Mock ).mockReset().mockResolvedValue( undefined );
	} );

	afterEach( () => {
		delete appLocalizer.khali_dabba;
	} );

	/**
	 * Settings → Reports is a Pro feature: without Pro the header button
	 * carries a "Pro" tag, and clicking it opens the upgrade popup instead
	 * of sending a real test report.
	 */
	it( 'without Pro shows a Pro tag and opens the Pro popup instead of sending', async () => {
		appLocalizer.khali_dabba = false;

		render( <SendTestReportButton /> );

		expect( screen.getByText( 'Pro' ) ).toBeInTheDocument();
		expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();

		await userEvent.click(
			screen.getByRole( 'button', { name: /send test report/i } )
		);

		expect( screen.getByRole( 'dialog' ) ).toBeInTheDocument();
		expect( screen.getByText( POPUP_HEADING ) ).toBeInTheDocument();
		expect( sendApiResponse ).not.toHaveBeenCalled();
	} );

	it( 'with Pro has no Pro tag and sends the test report', async () => {
		appLocalizer.khali_dabba = true;

		render( <SendTestReportButton /> );

		expect( screen.queryByText( 'Pro' ) ).not.toBeInTheDocument();

		await userEvent.click(
			screen.getByRole( 'button', { name: /send test report/i } )
		);

		expect( sendApiResponse ).toHaveBeenCalledTimes( 1 );
		expect( sendApiResponse ).toHaveBeenCalledWith(
			expect.anything(),
			'settings/test-report',
			{}
		);
		expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
	} );
} );
