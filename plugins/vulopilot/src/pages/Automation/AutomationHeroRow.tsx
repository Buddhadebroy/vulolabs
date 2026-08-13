import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';

interface AutomationRow {
	id: number;
	status: 'enabled' | 'disabled';
	last_triggered_at: string | null;
}

interface AutomationHeroRowProps {
	onManageAutomations: () => void;
}

/**
 * The mockup's "Your website is being watched" + "Sit back and relax."
 * intro row. Real: active/"need setup" counts are enabled/disabled
 * automations from the same `GET /automations` list every other card on
 * this page already fetches (own copy — this codebase's established
 * "duplicate small per-file hooks" convention, see e.g.
 * UpcomingJobsCard.tsx). "Last check" is the most recent
 * `last_triggered_at` across those same rows — no separate call. A site
 * with zero automations at all gets an honest "nothing set up yet" state
 * rather than falsely claiming to be watched. The sub-captions under each
 * stat are plain descriptive copy, not data claims, except "Last check"'s
 * own — that one only says "Everything up to date" when the most recent
 * run genuinely happened today.
 */
const AutomationHeroRow = ({ onManageAutomations }: AutomationHeroRowProps) => {
	const { data, isLoading } = useApiList<AutomationRow>('automations', {
		per_page: 100,
	});

	const activeCount = data.filter((a) => 'enabled' === a.status).length;
	const needSetupCount = data.filter((a) => 'disabled' === a.status).length;

	const lastRun = data.reduce<string | null>((latest, automation) => {
		if (!automation.last_triggered_at) {
			return latest;
		}

		return !latest || automation.last_triggered_at > latest
			? automation.last_triggered_at
			: latest;
	}, null);

	const isToday =
		!!lastRun &&
		new Date(lastRun).toDateString() === new Date().toDateString();

	const lastCheckLabel = lastRun
		? sprintf(
				/* translators: 1: "Today" or a formatted date, 2: formatted time. */
				__('%1$s, %2$s', 'vulopilot'),
				isToday ? __('Today', 'vulopilot') : formatWpDate(lastRun),
				new Date(lastRun).toLocaleTimeString(undefined, {
					hour: 'numeric',
					minute: '2-digit',
				})
			)
		: __('Not checked yet', 'vulopilot');

	const isWatching = !isLoading && activeCount > 0;

	return (
		<ContainerComponent>
			<ColumnComponent grid={8}>
				<CardComponent
					className="automation-watch-card"
					isLoading={isLoading}
				>
					<div className="automation-watch-header">
						<span
							className={`automation-watch-icon ${isWatching ? 'is-good' : 'is-idle'}`}
						>
							<i className="adminfont-automation" />
						</span>
						<div>
							<div className="automation-watch-title-row">
								<strong>
									{isWatching
										? __('Your website is being watched', 'vulopilot')
										: __('No automations are active yet', 'vulopilot')}
								</strong>
								{isWatching && (
									<span className="automation-watch-check">
										<i className="adminfont-check" />
									</span>
								)}
							</div>
							<p className="automation-watch-sub">
								{isWatching
									? sprintf(
											/* translators: %d is the number of active automations. */
											__(
												'%d automations are working for you.',
												'vulopilot'
											),
											activeCount
										)
									: __(
											'Create an automation below and VuloPilot will start watching your site for you.',
											'vulopilot'
										)}
							</p>
						</div>
					</div>
					{!isLoading && data.length > 0 && (
						<div className="automation-watch-stats">
							<div className="automation-watch-stat">
								<strong>{activeCount}</strong>
								<span>{__('Active', 'vulopilot')}</span>
								<small>{__('Running smoothly', 'vulopilot')}</small>
							</div>
							<div className="automation-watch-stat">
								<strong>{needSetupCount}</strong>
								<span>{__('Need setup', 'vulopilot')}</span>
								<small>
									{needSetupCount > 0
										? __('Almost ready', 'vulopilot')
										: __('All set', 'vulopilot')}
								</small>
							</div>
							<div className="automation-watch-stat">
								<strong>{lastCheckLabel}</strong>
								<span>{__('Last check', 'vulopilot')}</span>
								<small>
									{isToday
										? __('Everything up to date', 'vulopilot')
										: ''}
								</small>
							</div>
						</div>
					)}
				</CardComponent>
			</ColumnComponent>
			<ColumnComponent grid={4}>
				<CardComponent className="automation-relax-card">
					<span className="automation-relax-icon">
						<i className="adminfont-shield" />
					</span>
					<strong>{__('Sit back and relax.', 'vulopilot')}</strong>
					<p>
						{__(
							'VuloPilot handles the monitoring, so you can focus on growing your business.',
							'vulopilot'
						)}
					</p>
					<ButtonInput
						buttons={{
							text: __('Manage Automations', 'vulopilot'),
							color: 'secondary',
							onClick: onManageAutomations,
						}}
					/>
				</CardComponent>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default AutomationHeroRow;
