/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { GUIDED_FLOWS, GuidedOption } from './copilotGuidedFlows';
import { FindingGroup } from '../components/Issues/issuesTypes';

/** One line already shown in the guided flow - a question, the real findings that stood in for one, or the user's picked answer. */
export interface GuidedTurn {
	role: 'assistant' | 'user';
	content: string;
}

/**
 * Walks one `GUIDED_FLOWS` tree entirely client-side - every question and option is static copy
 * or real site data (`findings/groups`), never an AI call. AI is called exactly once, by
 * `onComplete`, after the last step, with every collected answer folded into one message - the
 * "ask the fixed questions first, only call AI at the end" behaviour the whole panel now follows.
 */
export const useGuidedCopilotFlow = (
	// eslint-disable-next-line no-unused-vars
	onComplete: (message: string) => void
) => {
	const [flowId, setFlowId] = useState<string | null>(null);
	const [stepIndex, setStepIndex] = useState(0);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [turns, setTurns] = useState<GuidedTurn[]>([]);
	const [findings, setFindings] = useState<FindingGroup[]>([]);
	const [isLoadingFindings, setIsLoadingFindings] = useState(false);

	const flow = flowId ? GUIDED_FLOWS[flowId] : null;
	const steps = flow?.steps ?? [];

	/** The few branches the step tables call out - skipped by id, not a generic rule engine. */
	const shouldSkip = (stepId: string, allAnswers: Record<string, string>): boolean => {
		if ('checkout' === flowId && 'payment_method' === stepId) {
			return 'payment_fails' !== allAnswers.symptom;
		}

		if ('security' === flowId && 'noticed' === stepId) {
			return 'routine' === allAnswers.reason;
		}

		return false;
	};

	const loadFindingsStep = (category: string) => {
		setIsLoadingFindings(true);
		setFindings([]);

		getApiResponse<{ data?: FindingGroup[] } | FindingGroup[]>(
			getApiLink(vulopilotAppLocalizer, `findings/groups?category=${encodeURIComponent(category)}&per_page=5`),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		)
			.then((response) => {
				const list = Array.isArray(response) ? response : (response?.data ?? []);
				setFindings(list);
			})
			.finally(() => setIsLoadingFindings(false));
	};

	const presentStep = (index: number, allAnswers: Record<string, string>) => {
		if (index >= steps.length) {
			const finishedFlow = flow;
			setFlowId(null);

			if (finishedFlow) {
				const summaryLines = finishedFlow.steps
					.filter((step) => allAnswers[step.id])
					.map((step) => `${step.question} ${allAnswers[step.id]}`);

				const closingLine = sprintf(
					/* translators: %s: what the final step should produce, e.g. "a prioritised homepage improvement plan". */
					__('Please put together %s.', 'vulopilot'),
					finishedFlow.resultSummary
				);

				onComplete(`${finishedFlow.title}\n\n${summaryLines.join('\n')}\n\n${closingLine}`);
			}

			return;
		}

		const step = steps[index];

		if (shouldSkip(step.id, allAnswers)) {
			presentStep(index + 1, allAnswers);
			return;
		}

		setStepIndex(index);
		setTurns((current) => [...current, { role: 'assistant', content: step.question }]);

		if ('findings' === step.kind && step.findingsCategory) {
			loadFindingsStep(step.findingsCategory);
		}
	};

	const startFlow = (id: string) => {
		const nextFlow = GUIDED_FLOWS[id];

		if (!nextFlow) {
			return;
		}

		setFlowId(id);
		setAnswers({});
		setFindings([]);
		setTurns(
			nextFlow.openingMessage ? [{ role: 'assistant', content: nextFlow.openingMessage }] : []
		);
		setStepIndex(0);

		// presentStep reads `steps`/`flow` off state, which hasn't committed yet this tick - call
		// it straight off `nextFlow` instead for the very first step.
		const firstStep = nextFlow.steps[0];
		setTurns((current) => [...current, { role: 'assistant', content: firstStep.question }]);

		if ('findings' === firstStep.kind && firstStep.findingsCategory) {
			loadFindingsStep(firstStep.findingsCategory);
		}
	};

	const answerStep = (option: GuidedOption) => {
		const step = steps[stepIndex];

		if (!step) {
			return;
		}

		const nextAnswers = { ...answers, [step.id]: option.label };
		setAnswers(nextAnswers);
		setTurns((current) => [...current, { role: 'user', content: option.label }]);
		presentStep(stepIndex + 1, nextAnswers);
	};

	const answerFinding = (group: FindingGroup) => answerStep({ value: group.scanner_id, label: group.label });

	const cancelFlow = () => {
		setFlowId(null);
		setTurns([]);
		setAnswers({});
		setFindings([]);
	};

	return {
		activeFlow: flow,
		activeStep: flow ? steps[stepIndex] : null,
		turns,
		findings,
		isLoadingFindings,
		startFlow,
		answerStep,
		answerFinding,
		cancelFlow,
	};
};
