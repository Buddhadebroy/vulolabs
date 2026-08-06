import React from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';

/**
 * Replaces the mockup's whole "Running AI Agents" section (5 cards, each
 * with a live progress percentage for a named autonomous agent) — grepped
 * case-insensitively across all PHP/TS in both plugins and confirmed this
 * concept doesn't exist anywhere: no "SEO Agent"/"Security Agent"/etc, no
 * autonomous-agent runtime, no live progress tracking of any kind. One
 * honest card in its place, same shape ModuleGuardComponent already uses
 * for other not-built-yet sections this session.
 */
const AiAgentsPlaceholderCard = () => (
	<CardComponent className="ai-agents-placeholder-card">
		<ModuleGuardComponent
			icon="automation"
			title={__("Autonomous AI agents aren't available yet", 'vulopilot')}
			desc={__(
				'Automations run via the triggers, conditions, and actions you define below — not as independent agents working on their own.',
				'vulopilot'
			)}
		/>
	</CardComponent>
);

export default AiAgentsPlaceholderCard;
