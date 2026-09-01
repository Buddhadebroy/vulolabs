/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { FormGroupWrapperComponent, NoticeManager } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import CardHeader from '../CardHeader';

/**
 * Hand-built rather than InputRenderer-driven — same escape hatch
 * AiProvidersPanel.tsx/IndexNowPanel.tsx already use (Settings.tsx's
 * GetForm() special-cases `currentTab === 'developer-tools'`). "Clear
 * cache" (`POST /settings/clear-cache`, Controllers\Settings::clear_cache())
 * clears every real content cache both this plugin and vulopilot-pro (if
 * active) own — Knowledge Graph's own extracted entities, the Schema
 * Coverage snapshot, the robots.txt bot-group parse, and Pro's own
 * Knowledge Graph recommendations. Deliberately does NOT touch AI-provider
 * rate-limit counters, Pro's security-alert-already-sent dedup marker, or
 * the license status cache — see that controller method's own docblock for
 * why those aren't "stale data" the same way.
 */
const DeveloperToolsPanel = () => {
	const [isClearing, setIsClearing] = useState(false);

	const handleClearCache = () => {
		setIsClearing(true);

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, 'settings/clear-cache'),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-clear-cache',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Cache cleared.', 'vulopilot')
						: __(
								'Could not clear the cache. Please try again.',
								'vulopilot'
							),
				});
			})
			.finally(() => setIsClearing(false));
	};

	return (
		<FormGroupWrapperComponent>
			<CardHeader
				icon="refresh pink"
				title={__('Cache', 'vulopilot')}
				desc={__(
					'Clears every real cached result VuloPilot computes — the Knowledge Graph’s extracted entities, the Schema Coverage snapshot, the robots.txt bot-access parse, and (if active) vulopilot-pro’s own Knowledge Graph recommendations. Everything is rebuilt fresh automatically the next time it’s needed — nothing is deleted permanently.',
					'vulopilot'
				)}
			>
				<ButtonInput
					buttons={{
						text: isClearing
							? __('Clearing…', 'vulopilot')
							: __('Clear cache', 'vulopilot'),
						onClick: handleClearCache,
						disabled: isClearing,
					}}
				/>
			</CardHeader>
		</FormGroupWrapperComponent>
	);
};

export default DeveloperToolsPanel;
