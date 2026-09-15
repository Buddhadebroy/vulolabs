import { render, screen } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';
import IssueDetailPanel from '../IssueDetailPanel';
import { FindingGroup } from '../issuesTypes';

const GROUP: FindingGroup = {
	scanner_id: 'weak-passwords',
	category: 'security',
	count: 18,
	severity: 'critical',
	object_type: 'user',
	label: 'Weak Password Detection',
	sample: {
		id: 474,
		title: 'Administrator "admin" is using a common, easily guessed password',
		description: 'This account\'s password matched an entry in a small dictionary.',
		object_type: 'user',
		object_ref: '1',
		created_at: '2026-08-10 07:40:46',
		page: 'Site-wide',
	},
};

describe( 'IssueDetailPanel', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows an honest empty state when nothing is selected', () => {
		render( <IssueDetailPanel group={ null } onActionComplete={ jest.fn() } /> );

		expect( screen.getByText( /select an issue/i ) ).toBeInTheDocument();
	} );

	it( 'shows the real severity, category, affected count, and example finding', () => {
		render(
			<IssueDetailPanel group={ GROUP } onActionComplete={ jest.fn() } />
		);

		expect( screen.getByText( 'Critical Priority' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Weak Password Detection' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Security' ) ).toBeInTheDocument();
		expect( screen.getByText( '18 accounts' ) ).toBeInTheDocument();
		expect(
			screen.getByText(
				'Administrator "admin" is using a common, easily guessed password'
			)
		).toBeInTheDocument();
		expect( screen.getByText( 'Site-wide' ) ).toBeInTheDocument();
	} );
} );
