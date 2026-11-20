import React from 'react';
import { __ } from '@wordpress/i18n';
import ProSample from '../../components/ProSample/ProSample';

/**
 * What Workflow Automation (VuloPilot Pro) adds to this page, as samples: made-up content in the Pro screens' shape,
 * inside ProSample ("Sample data", one button, the Pro popup). Free ships no automation-builder code - only these
 * pictures of it. With Pro, its own Automations page replaces this one.
 */

/** Sample custom automations: what starts each one, what it does, whether it is on, and its last run. */
const SAMPLE_RULES = [
	{
		icon: 'error',
		tone: 'is-red',
		name: __('Critical issue alert', 'vulopilot'),
		when: __('A scan finds a critical issue', 'vulopilot'),
		then: __('Email me · Fix with AI', 'vulopilot'),
		on: true,
		last: __('2h ago', 'vulopilot'),
	},
	{
		icon: 'edit',
		tone: 'is-violet',
		name: __('Weekly content review', 'vulopilot'),
		when: __('Every Monday, 09:00', 'vulopilot'),
		then: __('AI reviews new posts', 'vulopilot'),
		on: true,
		last: __('3 days ago', 'vulopilot'),
	},
	{
		icon: 'woocommerce',
		tone: 'is-amber',
		name: __('Out-of-stock watch', 'vulopilot'),
		when: __('A product sells out', 'vulopilot'),
		then: __('Notify the store team', 'vulopilot'),
		on: true,
		last: __('Yesterday', 'vulopilot'),
	},
	{
		icon: 'link',
		tone: 'is-blue',
		name: __('Broken link sweep', 'vulopilot'),
		when: __('Every day, 02:00', 'vulopilot'),
		then: __('Find and fix broken links', 'vulopilot'),
		on: false,
		last: __('Paused', 'vulopilot'),
	},
];

/** Sample agents and what they last did. */
const SAMPLE_AGENTS = [
	{ name: __('Content agent', 'vulopilot'), task: __('Drafting 3 blog posts', 'vulopilot'), progress: '64%' },
	{ name: __('Security agent', 'vulopilot'), task: __('Checking 12 plugins', 'vulopilot'), progress: '88%' },
	{ name: __('SEO agent', 'vulopilot'), task: __('Rewriting 9 meta titles', 'vulopilot'), progress: '42%' },
];

const SAMPLE_DONE = [
	{ text: __('Compressed 128 images', 'vulopilot'), time: __('10 min ago', 'vulopilot') },
	{ text: __('Fixed 14 missing meta descriptions', 'vulopilot'), time: __('1 hour ago', 'vulopilot') },
	{ text: __('Published "Spring sale" draft', 'vulopilot'), time: __('2 hours ago', 'vulopilot') },
];

export const CustomAutomationsSample = () => (
	<ProSample
		feature={{
			title: __('Custom automations', 'vulopilot'),
			description: __('Build your own: pick what starts it, then what it does - alerts, reports or AI fixes.', 'vulopilot'),
			icon: 'automation',
		}}
		text={__('Build your own: when something happens, VuloPilot handles it.', 'vulopilot')}
		cta={__('Unlock custom automations', 'vulopilot')}
	>
		<ul className="vp-rules">
			{SAMPLE_RULES.map((rule) => (
				<li key={rule.name} className={rule.on ? '' : 'is-off'}>
					<span className={`vp-icon is-sm ${rule.tone}`}>
						<i className={`adminfont-${rule.icon}`} />
					</span>
					<div className="vp-rule-main">
						<strong>{rule.name}</strong>
						<span className="vp-rule-flow">
							<em>{__('When', 'vulopilot')}</em>
							{rule.when}
							<i className="adminfont-arrow-right" />
							{rule.then}
						</span>
					</div>
					<span className={`vp-pill ${rule.on ? 'is-good' : 'is-off'}`}>
						{rule.on ? __('On', 'vulopilot') : __('Off', 'vulopilot')}
					</span>
					<span className="vp-rule-last">{rule.last}</span>
				</li>
			))}
		</ul>
	</ProSample>
);

export const AiAgentsSample = () => (
	<ProSample
		feature={{
			title: __('AI agents', 'vulopilot'),
			description: __('Agents that keep working on content, security and SEO, with every change logged and undoable.', 'vulopilot'),
			icon: 'ai',
		}}
		text={__('AI agents that keep working on your site, and every change can be undone.', 'vulopilot')}
		cta={__('Unlock AI agents', 'vulopilot')}
	>
		<div className="vp-agents">
			{SAMPLE_AGENTS.map((agent) => (
				<div key={agent.name} className="vp-agent">
					<span className="vp-agent-name">
						<i className="vp-agent-live" />
						{agent.name}
					</span>
					<span className="vp-agent-task">{agent.task}</span>
					<span className="vp-agent-bar">
						<i style={{ width: agent.progress }} />
					</span>
				</div>
			))}
		</div>
		<ul className="vp-agent-done">
			{SAMPLE_DONE.map((item) => (
				<li key={item.text}>
					<i className="adminfont-check" />
					<span>{item.text}</span>
					<em>{item.time}</em>
					<b>{__('Undo', 'vulopilot')}</b>
				</li>
			))}
		</ul>
	</ProSample>
);
