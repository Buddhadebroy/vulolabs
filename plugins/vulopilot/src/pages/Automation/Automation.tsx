/* global appLocalizer */
import { ComponentType, useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	ColumnComponent,
	ContainerComponent,
	NavigatorHeaderComponent,
	PopupComponent,
} from '@zyra/components';
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import AutomationStatsRow from './AutomationStatsRow';
import AutomationAttentionCard from './AutomationAttentionCard';
import AutomationPeriodStatsCard from './AutomationPeriodStatsCard';
import AutomationActivityCard from './AutomationActivityCard';
import AutomationSuggestions from './AutomationSuggestions';
import ManageAutomationsSection, { AutomationRow } from './ManageAutomationsSection';
import { AutomationTemplate, getAutomationTemplateById } from './automationTemplates';
import './AutomateWork.scss';

/** Mirrors vulopilot-pro's own `AutomationWizardProps` — Free can't import Pro's src/ tree, same small-matching-copy convention `automationLabels.ts` already establishes for its label sets. */
interface AutomationWizardComponentProps {
	openSignal?: number;
	initialName?: string;
	initialCategory?: string;
	initialTriggerType?: string;
	initialActionTypes?: string[];
	initialNotificationTypes?: string[];
	initialConditions?: { type: string; config: Record<string, unknown> }[];
	viewAutomation?: AutomationRow | null;
	onSaved?: () => void;
}

interface AutomationGenerateComponentProps {
	openSignal?: number;
	onSaved?: () => void;
}

interface AutomationSlotValue {
	Wizard: ComponentType<AutomationWizardComponentProps>;
	Generate: ComponentType<AutomationGenerateComponentProps>;
}

/**
 * "Automate Work" — flattened into one page per the redesign this was built
 * against: header (title + the two real primary actions, "Create Automation"
 * and "Build with AI" — never more than these two competing top-level CTAs)
 * → Suggested Automations (the real, already-curated
 * `AUTOMATION_TEMPLATES`) → Your Automations (`ManageAutomationsSection.tsx`,
 * the one real canonical list). Replaces the previous Overview/Automations
 * two-tab shell — `AutomationOverviewTab.tsx` and its ~9 cards (hero row,
 * overview grid, attention card, period stats, composer, AI foreman,
 * activity card, links row, explore banner) are retired: each was some
 * variant of "Create"/"Manage"/"Explore" competing with the two real CTAs
 * this header now owns, the exact duplication the redesign's own source
 * spec calls out to consolidate.
 *
 * Owns the real wizard/"Build with AI" popups' open-signal state and the
 * `vulopilot_automation_panel` filter-slot resolution directly (rather than
 * `ManageAutomationsSection.tsx`, their previous host) since the header's
 * own two buttons need to open them too, not just the table's row actions —
 * a single shared instance of each popup, not two independently-triggered
 * ones.
 */
const Automation = () => {
	const slot = useFilterSlot<AutomationSlotValue>('vulopilot_automation_panel');
	const Wizard = slot?.Wizard;
	const Generate = slot?.Generate;

	const [wizardOpenSignal, setWizardOpenSignal] = useState(0);
	const [generateOpenSignal, setGenerateOpenSignal] = useState(0);
	const [refetchSignal, setRefetchSignal] = useState(0);
	const [viewingRow, setViewingRow] = useState<AutomationRow | null>(null);
	const [pendingTemplate, setPendingTemplate] = useState<AutomationTemplate | null>(null);
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	const openProPopup = () => setIsProPopupOpen(true);

	const handleSaved = () => setRefetchSignal((n) => n + 1);

	const openCreateWizard = () => {
		if (!Wizard) {
			openProPopup();
			return;
		}

		setViewingRow(null);
		setPendingTemplate(null);
		setWizardOpenSignal((n) => n + 1);
	};

	const openGenerate = () => {
		if (!Generate) {
			openProPopup();
			return;
		}

		setGenerateOpenSignal((n) => n + 1);
	};

	const openTemplate = (template: AutomationTemplate) => {
		if (!Wizard) {
			openProPopup();
			return;
		}

		setViewingRow(null);
		setPendingTemplate(template);
		setWizardOpenSignal((n) => n + 1);
	};

	const openRow = (row: AutomationRow) => {
		if (!Wizard) {
			openProPopup();
			return;
		}

		setPendingTemplate(null);
		setViewingRow(row);
		setWizardOpenSignal((n) => n + 1);
	};

	// AI Copilot's Chat tab (ChatTab.tsx's own AutomationTemplatesCard
	// preview) deep-links here as `?...#tab=automation&automation_template=<id>`
	// — read once on mount, same as this page's previous tab-shell version.
	const firedInitialTemplateRef = useRef(false);

	useEffect(() => {
		if (firedInitialTemplateRef.current || !Wizard) {
			return;
		}

		const templateId = new URLSearchParams(window.location.hash.substring(1)).get(
			'automation_template'
		);
		const template = templateId ? getAutomationTemplateById(templateId) : null;

		if (!template) {
			return;
		}

		firedInitialTemplateRef.current = true;
		openTemplate(template);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately re-checks only when Wizard itself resolves (useFilterSlot's own real script-load-order race — see that hook's docblock); openTemplate is redefined every render and the ref guard already makes this safely re-runnable.
	}, [Wizard]);

	// "View all issues →" (AutomationAttentionCard) and "View automation
	// history →" (AutomationActivityCard) both jump to the same real
	// destination — the "Your Automations" table already shows every
	// automation's own real status/last-run outcome, and the wizard's own
	// read-only "Open" view already surfaces a filtered run history per
	// automation; there's no separate unfiltered history view to link to
	// instead.
	const scrollToTable = () =>
		document.getElementById('automation-manage')?.scrollIntoView({ behavior: 'smooth' });

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="automation"
				headerTitle={__('Automate Work', 'vulopilot')}
				headerDescription={__(
					'Create workflows that automatically handle repetitive work and keep you informed.',
					'vulopilot'
				)}
				buttons={[
					{
						label: __('Create Automation', 'vulopilot'),
						icon: 'plus',
						onClick: openCreateWizard,
					},
					{
						label: __('Build with AI', 'vulopilot'),
						icon: 'automation',
						onClick: openGenerate,
					},
				]}
			/>

			<ContainerComponent general>
				<ColumnComponent grid={7}>
					<AutomationStatsRow />
				</ColumnComponent>
				<ColumnComponent grid={5}>
					<AutomationPeriodStatsCard />
					<AutomationAttentionCard onViewAll={scrollToTable} refetchSignal={refetchSignal} />
				</ColumnComponent>
			</ContainerComponent>


			<AutomationSuggestions
				onUseTemplate={openTemplate}
				onOpenAutomation={openRow}
				refetchSignal={refetchSignal}
			/>

			<ManageAutomationsSection
				hasWizard={Boolean(Wizard)}
				onOpenRow={openRow}
				onRequireProUpsell={openProPopup}
				refetchSignal={refetchSignal}
			/>

			<AutomationActivityCard onViewHistory={scrollToTable} refetchSignal={refetchSignal} />

			{Wizard && (
				<Wizard
					openSignal={wizardOpenSignal}
					initialName={pendingTemplate?.category ? pendingTemplate.label : undefined}
					initialCategory={pendingTemplate?.category ?? undefined}
					initialTriggerType={pendingTemplate?.triggerType ?? undefined}
					initialActionTypes={pendingTemplate?.actionTypes ?? undefined}
					viewAutomation={viewingRow}
					onSaved={handleSaved}
				/>
			)}

			{Generate && <Generate openSignal={generateOpenSignal} onSaved={handleSaved} />}

			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="automation" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default Automation;
