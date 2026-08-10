import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse } from '@zyra/core';
import NeedsAttentionCard from '../NeedsAttentionCard';

describe( 'NeedsAttentionCard', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows an honest empty state when nothing needs attention', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			total: 0,
			priority_counts: { high: 0, medium: 0, low: 0 },
			groups: [],
		} );

		render( <NeedsAttentionCard onNavigateTab={ jest.fn() } /> );

		expect(
			await screen.findByText( /nothing needs attention right now/i )
		).toBeInTheDocument();
	} );

	it( 'shows a retry option when the summary request fails', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( null );

		render( <NeedsAttentionCard onNavigateTab={ jest.fn() } /> );

		expect(
			await screen.findByText( /could not load issues/i )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: /retry/i } )
		).toBeInTheDocument();
	} );

	it( 'renders the real total, priority pills, and grouped issue rows', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			total: 14,
			priority_counts: { high: 3, medium: 6, low: 5 },
			groups: [
				{
					scanner_id: 'meta-description',
					count: 8,
					severity: 'low',
					category: 'seo',
					object_type: 'post',
					label: 'Meta Descriptions',
				},
				{
					scanner_id: 'images',
					count: 12,
					severity: 'medium',
					category: 'images',
					object_type: 'attachment',
					label: 'Images',
				},
				{
					scanner_id: 'product-missing-description',
					count: 3,
					severity: 'medium',
					category: 'woocommerce',
					object_type: 'product',
					label: 'Product Descriptions',
				},
			],
		} );

		render( <NeedsAttentionCard onNavigateTab={ jest.fn() } /> );

		expect( await screen.findByText( '14' ) ).toBeInTheDocument();
		expect(
			screen.getByText( /things need attention/i )
		).toBeInTheDocument();
		expect( screen.getByText( '3 High priority' ) ).toBeInTheDocument();
		expect( screen.getByText( '6 Medium priority' ) ).toBeInTheDocument();
		expect( screen.getByText( '5 Low priority' ) ).toBeInTheDocument();

		expect(
			screen.getByText( '8 findings: Meta Descriptions' )
		).toBeInTheDocument();
		expect(
			screen.getByText( '12 findings: Images' )
		).toBeInTheDocument();
		expect(
			screen.getByText( '3 findings: Product Descriptions' )
		).toBeInTheDocument();

		// 'seo'/'images' both fold into the "Visibility" display category.
		expect( screen.getAllByText( /visibility • low impact/i ) ).toHaveLength( 1 );
		expect( screen.getByText( /visibility • medium impact/i ) ).toBeInTheDocument();
		expect( screen.getByText( /woocommerce • medium impact/i ) ).toBeInTheDocument();
	} );

	it( '"View all issues" navigates to the Issues tab unfiltered', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			total: 1,
			priority_counts: { high: 1, medium: 0, low: 0 },
			groups: [
				{
					scanner_id: 'meta-description',
					count: 1,
					severity: 'high',
					category: 'seo',
					object_type: 'post',
					label: 'Meta Descriptions',
				},
			],
		} );

		const onNavigateTab = jest.fn();
		render( <NeedsAttentionCard onNavigateTab={ onNavigateTab } /> );

		await userEvent.click(
			await screen.findByRole( 'button', { name: /view all issues/i } )
		);

		expect( onNavigateTab ).toHaveBeenCalledWith( 'issues' );
	} );

	/**
	 * Regression: clicking a specific group (e.g. "18 findings: Weak
	 * Password Detection") used to navigate exactly the same as "View all
	 * issues" — landing on the Issues tab's own unrelated top-20 list,
	 * which often didn't contain a single matching row. It must pass the
	 * group's real scanner_id/label through so the Issues tab can
	 * filter to the same set this card counted.
	 */
	it( 'clicking a group row navigates with that group\'s scanner_id filter', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			total: 18,
			priority_counts: { high: 18, medium: 0, low: 0 },
			groups: [
				{
					scanner_id: 'weak-password',
					count: 18,
					severity: 'high',
					category: 'security',
					object_type: 'user',
					label: 'Weak Password Detection',
				},
			],
		} );

		const onNavigateTab = jest.fn();
		render( <NeedsAttentionCard onNavigateTab={ onNavigateTab } /> );

		await userEvent.click(
			await screen.findByText( '18 findings: Weak Password Detection' )
		);

		expect( onNavigateTab ).toHaveBeenCalledWith( 'issues', {
			scannerId: 'weak-password',
			label: 'Weak Password Detection',
			category: 'security',
		} );
	} );
} );
