import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OverallScoreWidget from '../OverallScoreWidget';
import type { DashboardSummary } from '../types';

const summary: DashboardSummary = {
	overall_score: 82,
	open_findings: 5,
	critical_findings: 1,
	findings_by_severity: { critical: 1, high: 2, medium: 1, low: 1 },
	active_automations: 2,
	ai_jobs_used: 0,
	ai_jobs_quota: 0,
	category_scores: {
		seo: 80,
		performance: 70,
		security: 90,
		accessibility: 85,
		woocommerce: 60,
		geo: 75,
		content: 65,
		brand: 88,
	},
	category_scores_7d_ago: {
		seo: 75,
		performance: 70,
		security: 88,
		accessibility: 83,
		woocommerce: 58,
		geo: 70,
		content: 60,
		brand: 85,
	},
	new_findings_this_week: 3,
	fixed_findings_this_week: 5,
	quick_fixes: 0,
	pending_approvals: 0,
	automation_status: { enabled: 2, disabled: 0 },
	site_snapshot: {
		posts: 10,
		pages: 5,
		comments: 20,
		users: 3,
		plugins_active: 8,
		plugins_total: 10,
		wp_version: '6.7',
		php_version: '8.2',
	},
};

describe( 'OverallScoreWidget', () => {
	/**
	 * Regression test: this widget's <DashboardWidget> call once had every
	 * prop (title/icon/onHide/isCustomizing) commented out, so it silently
	 * rendered with no title/icon and could never be hidden or dragged in
	 * customize mode.
	 */
	it( 'renders its title and wires onHide through DashboardWidget', async () => {
		const onHide = jest.fn();

		render(
			<OverallScoreWidget
				summary={ summary }
				isLoading={ false }
				onHide={ onHide }
				isCustomizing
			/>
		);

		expect(
			await screen.findByText( 'Vital Pulse' )
		).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole( 'button', { name: /hide widget/i } )
		);
		expect( onHide ).toHaveBeenCalled();
	} );

	it( 'shows the real overall score and open/critical findings counts', () => {
		render(
			<OverallScoreWidget
				summary={ summary }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect( screen.getByText( '82' ) ).toBeInTheDocument();
		expect(
			screen.getByText( '5 issues found' )
		).toBeInTheDocument();
		expect( screen.getByText( '1 critical' ) ).toBeInTheDocument();
	} );

	it( 'shows the real net-change badge (fixed minus new) for this week', () => {
		render(
			<OverallScoreWidget
				summary={ summary }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		// fixed_findings_this_week (5) - new_findings_this_week (3) = +2
		expect( screen.getByText( /\+2 this week/ ) ).toBeInTheDocument();
		expect( screen.getByText( /3 new issues/ ) ).toBeInTheDocument();
		expect( screen.getByText( /5 fixed/ ) ).toBeInTheDocument();
	} );
} );
