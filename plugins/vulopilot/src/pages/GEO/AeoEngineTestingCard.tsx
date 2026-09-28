/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { ButtonInput, SelectInput } from '@zyra/inputs';
import { useContentGate } from '../../services/useContentGate';
import type { CitationCheckResult } from './AeoCitationCoverageCard';
import type { AeoPageRow } from './useAeoPageAnalysis';

interface AeoEngineTestingCardProps {
	/** Same real "is GeoInsights' Rest.php class even registered" gate AeoCitationCoverageCard.tsx uses - see that prop's own docblock. */
	isActive: boolean;
	/** The same real published-pages list AeoTab.tsx already fetched for "Pages Ready"/"Questions Answered" (useAeoPageAnalysis.ts). */
	pages: AeoPageRow[];
}

/**
 * "Engine Testing" - the exact same real check AeoCitationCoverageCard.tsx's "Answer Engine
 * Coverage" runs.
 */
const AeoEngineTestingCard = ({ isActive, pages }: AeoEngineTestingCardProps) => {
	const [selectedPostId, setSelectedPostId] = useState<string>('');
	const [result, setResult] = useState<CitationCheckResult | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleTest = () => {
		if (!selectedPostId) {
			return;
		}

		setIsRunning(true);
		setError(null);
		setResult(null);

		sendApiResponse<CitationCheckResult>(
			vulopilotAppLocalizer,
			getApiLink(vulopilotAppLocalizer, `aeo-citation-coverage/${selectedPostId}`),
			{}
		)
			.then((response) => {
				// 'question' - not 'cited' - is what actually distinguishes this endpoint's real
				// flat single-result shape from check_sitewide()'s wrapped {generated_at, tested,
				// cited.
				if (response && 'object' === typeof response && 'question' in response) {
					setResult(response);
				} else {
					setError(
						__(
							'Could not test this page - make sure this site is connected to VuloCloud under Settings → Connections.',
							'vulopilot'
						)
					);
				}
			})
			.finally(() => setIsRunning(false));
	};

	// Same real OR-of-two-modules override as AeoCitationCoverageCard.tsx.
	const { wrap } = useContentGate('answer-engine-optimization', isActive);

	const dummyContent = (
		<div className="aeo-engine-testing-controls">
			<SelectInput
				name="engine_testing_post_id_dummy"
				value=""
				placeholder={__('Select a page…', 'vulopilot')}
				options={[]}
				onChange={() => {}}
				size="16rem"
				disabled
			/>
			<ButtonInput
				buttons={{ text: __('Test this page', 'vulopilot'), icon: 'search-discovery', disabled: true, onClick: () => {} }}
			/>
		</div>
	);

	return (
		<CardComponent
			title={__('Engine Testing', 'vulopilot')}
			titleIcon="intelligence"
			desc={
				isActive
					? __(
							'Pick a page you’ve just fixed and re-run the same real citation check against it right now, instead of waiting for the next full scan.',
							'vulopilot'
						)
					: __(
							'Re-verifies a previously-flagged finding against an AI answer engine once you’ve fixed it, instead of waiting for the next full scan.',
							'vulopilot'
						)
			}
		>
			{wrap(
				<>
					<div className="aeo-engine-testing-controls">
						<SelectInput
							name="engine_testing_post_id"
							value={selectedPostId}
							placeholder={__('Select a page…', 'vulopilot')}
							options={pages.map((page) => ({
								label: page.title,
								value: String(page.post_id),
							}))}
							onChange={(newValue) => setSelectedPostId(newValue as string)}
							size="16rem"
						/>
						<ButtonInput
							buttons={{
								text: isRunning
									? __('Testing…', 'vulopilot')
									: __('Test this page', 'vulopilot'),
								icon: 'search-discovery',
								onClick: handleTest,
								disabled: isRunning || !selectedPostId,
							}}
						/>
					</div>

					{error && (
						<ModuleGuardComponent
							icon="error"
							title={__('Could not run this test', 'vulopilot')}
							desc={error}
						/>
					)}

					{!error && !result && !isRunning && (
						<ModuleGuardComponent
							icon="info"
							title={__('Not tested yet', 'vulopilot')}
							desc={__(
								'Pick a page above and click "Test this page" to run a real, single-page citation check.',
								'vulopilot'
							)}
						/>
					)}

					{result && (
						<div
							className={`geo-four-checks-tile ${result.cited ? 'is-good' : 'is-attention'}`}
						>
							<div className="geo-four-checks-title">{result.question}</div>
							<p className="desc">
								{result.from_content
									? __('Question taken from this page’s own content.', 'vulopilot')
									: __('Question built from this page’s title.', 'vulopilot')}
							</p>
							<p className="desc">
								{result.cited
									? __('Your configured AI service already recognizes this site for this question.', 'vulopilot')
									: __('Your configured AI service does not yet recognize this site for this question.', 'vulopilot')}
							</p>
							{/* The real generated text the judgment above was made from. */}
							<p className="desc aeo-engine-testing-answer-label">
								{__('What your configured AI service actually said, live:', 'vulopilot')}
							</p>
							<blockquote className="aeo-engine-testing-answer">
								{result.answer}
							</blockquote>
						</div>
					)}
				</>,
				dummyContent
			)}
		</CardComponent>
	);
};

export default AeoEngineTestingCard;
