/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, BadgeComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { AUTOMATION_TEMPLATES, AutomationTemplate } from './automationsTemplates';
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from './automationsLabels';
import { formatWpDate } from '../../services/formatWpDate';
import type { AutomationRow } from './ManageAutomationsSection';

interface AutomationsSuggestionsProps {
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onUseTemplate: (template: AutomationTemplate) => void;
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onOpenAutomation: (row: AutomationRow) => void;
	/** Bumped by the host after the wizard saves/changes something, same convention `ManageAutomationsSection.tsx`'s own `refetchSignal` prop uses — this section's own "already running" cards need to reflect a status change (e.g. Pause) or a newly-created automation too. */
	refetchSignal: number;
}

const STATUS_META: Record<
	AutomationRow['status'],
	{ label: string; color: string }
> = {
	enabled: { label: __('Active', 'vulopilot'), color: 'green' },
	disabled: { label: __('Paused', 'vulopilot'), color: 'grey' },
	draft: { label: __('Draft', 'vulopilot'), color: 'yellow' },
};

const CRON_TRIGGER_TYPES = ['hourly', 'daily', 'weekly', 'monthly'];

/**
 * A template's own real "What it does" line, from its `actionTypes` — same
 * label lookup `describeAutomationActions()` (automationLabels.ts) uses for
 * a saved automation's own `actions` JSON, just against the template's
 * static list instead.
 */
const describeTemplateActions = (template: AutomationTemplate): string =>
	template.actionTypes && template.actionTypes.length > 0
		? template.actionTypes.map((type) => ACTION_TYPE_LABELS[type] ?? type).join(', ')
		: template.description;

/**
 * A real automation's own "Last check" line — same real outcome logic
 * `ManageAutomationsSection.tsx`'s own `renderLastRunCell()` uses (a small
 * duplicated copy, this codebase's own established convention for per-file
 * small render helpers — see e.g. `automationLabels.ts`'s own docblock).
 */
const describeLastCheck = (row: AutomationRow): string => {
	if ('draft' === row.status) {
		return __('Not activated yet', 'vulopilot');
	}

	if (!row.last_run_status) {
		return __('Never run yet', 'vulopilot');
	}

	if ('failed' === row.last_run_status) {
		return __('Run failed', 'vulopilot');
	}

	if ((row.last_run_changes_made ?? 0) > 0) {
		return 1 === row.last_run_changes_made
			? __('1 change made', 'vulopilot')
			: sprintf(
					/* translators: %d is the real number of changes this automation's own last run made. */
					__('%d changes made', 'vulopilot'),
					row.last_run_changes_made
				);
	}

	return __('No changes needed', 'vulopilot');
};

/**
 * "Suggested automations" (spec section 10), restyled per direct
 * instruction: a template whose category+trigger already matches a real
 * automation the user has created shows that automation's own real,
 * running status (icon/name/status badge/real schedule/real last-check
 * outcome) instead of the static template pitch — "what VuloPilot is
 * doing for you," not just "here's an idea." A template with no matching
 * real automation still shows today's plain pitch card
 * (label/description/"Use this automation"/"Preview").
 *
 * The match is category+trigger_type equality — the closest real signal
 * available without a schema addition tracking "created from template X"
 * (out of scope here); with several real automations sharing one category,
 * this picks the first real match, same "good enough, not exact" honesty
 * this component's own docblock already accepts for the template set
 * itself (automationTemplates.ts's own docblock: no real 'seo' category
 * exists either, mapped to the closest real one).
 */
const AutomationsSuggestions = ({
	onUseTemplate,
	onOpenAutomation,
	refetchSignal,
}: AutomationsSuggestionsProps) => {
	const [automations, setAutomations] = useState<AutomationRow[]>([]);
	const [previewId, setPreviewId] = useState<string | null>(null);
	const suggestions = AUTOMATION_TEMPLATES.filter(
		(template) => 'from-scratch' !== template.id
	);

	useEffect(() => {
		getApiResponse<{ data: AutomationRow[] } | AutomationRow[]>(
			`${getApiLink(appLocalizer, 'automations')}?per_page=100`,
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			const list = Array.isArray(response) ? response : (response?.data ?? []);
			setAutomations(list);
		});
	}, [refetchSignal]);

	// A real automation is matched to at most one template slot — several
	// templates can share the same category+trigger combination (e.g.
	// "SEO optimization" and "Content optimizer" are both category
	// 'content'/trigger 'weekly'), and without this a single real
	// automation would otherwise render under two different suggestion
	// cards at once, each showing its same real name.
	const claimedIds = new Set<number>();
	const matches = suggestions.map((template) => {
		const match =
			template.category && template.triggerType
				? automations.find(
						(row) =>
							row.category === template.category &&
							row.trigger_type === template.triggerType &&
							!claimedIds.has(row.id)
					)
				: undefined;

		if (match) {
			claimedIds.add(match.id);
		}

		return { template, match };
	});

	return (
		<CardComponent
			title={__('Suggested automations', 'vulopilot')}
			titleIcon="lightbulb"
		>
			<div className="automation-suggestions-grid">
				{matches.map(({ template, match }) => {

					if (match) {
						const status = STATUS_META[match.status];
						const isCron = CRON_TRIGGER_TYPES.includes(match.trigger_type);

						return (
							<div className="automation-suggestion-card is-real" key={template.id}>
								<div className="automation-suggestion-card-header">
									<div className="automation-suggestion-icon">
										<i className={`adminfont-${template.icon.split(' ')[0]}`} />
									</div>
									<strong>{match.name}</strong>
									<BadgeComponent variant="dot" color={status.color} text={status.label} />
								</div>
								<p className="small desc">{describeTemplateActions(template)}</p>
								<div className="automation-suggestion-schedule">
									<span>
										{sprintf(
											/* translators: %s is the real trigger label, e.g. "Every day". */
											__('Runs: %s', 'vulopilot'),
											TRIGGER_TYPE_LABELS[match.trigger_type] ?? match.trigger_type
										)}
									</span>
									<span>
										{isCron && match.next_run_at
											? sprintf(
													/* translators: %s is the real next scheduled run date/time. */
													__('Next check: %s', 'vulopilot'),
													formatWpDate(match.next_run_at)
												)
											: __('Runs when triggered', 'vulopilot')}
									</span>
								</div>
								<div className="automation-suggestion-footer">
									<span className="automation-suggestion-last-check">
										{sprintf(
											/* translators: %s is the real outcome of this automation's own last run. */
											__('Last check: %s', 'vulopilot'),
											describeLastCheck(match)
										)}
									</span>
									<button
										type="button"
										className="automation-suggestion-manage"
										onClick={() => onOpenAutomation(match)}
									>
										{(match.last_run_changes_made ?? 0) > 0
											? __('View results →', 'vulopilot')
											: __('Manage →', 'vulopilot')}
									</button>
								</div>
							</div>
						);
					}

					return (
						<div className="automation-suggestion-card" key={template.id}>
							<div className="automation-suggestion-icon">
								<i className={`adminfont-${template.icon.split(' ')[0]}`} />
							</div>
							<strong>{template.label}</strong>
							<p className="small desc">{template.description}</p>

							{previewId === template.id && (
								<p className="automation-suggestion-preview">
									{__('When:', 'vulopilot')}{' '}
									{template.triggerType
										? (TRIGGER_TYPE_LABELS[template.triggerType] ?? template.triggerType)
										: '—'}
									{' · '}
									{__('Then:', 'vulopilot')} {describeTemplateActions(template)}
								</p>
							)}

							<div className="automation-suggestion-actions">
								<ButtonInput
									buttons={{
										text: __('Use this automation', 'vulopilot'),
										icon: 'plus',
										onClick: () => onUseTemplate(template),
									}}
								/>
								<ButtonInput
									buttons={{
										text:
											previewId === template.id
												? __('Hide preview', 'vulopilot')
												: __('Preview', 'vulopilot'),
										icon: 'visibility',
										onClick: () =>
											setPreviewId((current) =>
												current === template.id ? null : template.id
											),
									}}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</CardComponent>
	);
};

export default AutomationsSuggestions;
