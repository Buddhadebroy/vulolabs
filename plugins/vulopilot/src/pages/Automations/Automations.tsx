/* global appLocalizer */
import { ComponentType, useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	ColumnComponent,
	ContainerComponent,
	NavigatorHeaderComponent,
	NoticeComponent,
	PopupComponent,
} from '@zyra/components';
import ShowProPopup, { resolveModuleDisplayName } from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import AutomationsStatsRow from './AutomationsStatsRow';
import AutomationsAttentionCard from './AutomationsAttentionCard';
import AutomationsPeriodStatsCard from './AutomationsPeriodStatsCard';
import BuiltinAutomationCards from './BuiltinAutomationCards';
import AutomationsManageDummy from './AutomationsManageDummy';
import AutomationsActivityDummy from './AutomationsActivityDummy';
import { AutomationRow } from './automationRow';
import { AutomationTemplate, getAutomationTemplateById } from './automationsTemplates';
import './Automations.scss';

const AUTOMATIONS_MODULE_ID = 'automations';

/** Mirrors vulopilot-pro's own ManageAutomationsSection.tsx props exactly (that file's own real definition) — Free can't import Pro's src/ tree, same small-matching-copy convention every other cross-plugin component prop type in this file already uses. */
interface ManageAutomationsSectionComponentProps {
	hasWizard: boolean;
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onOpenRow: (row: AutomationRow) => void;
	onRequireProUpsell: () => void;
	refetchSignal: number;
}

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

/** Mirrors vulopilot-pro's own AutomationsActivityCard.tsx props exactly — Free can't import Pro's src/ tree, same small-matching-copy convention every other cross-plugin component prop type in this file already uses. */
interface AutomationsActivityCardComponentProps {
	onViewHistory: () => void;
	refetchSignal: number;
}

interface AutomationSlotValue {
	Wizard: ComponentType<AutomationWizardComponentProps>;
	Generate: ComponentType<AutomationGenerateComponentProps>;
	Templates: ComponentType<AutomationGenerateComponentProps>;
	/** Real "Your automations" list (vulopilot-pro's own ManageAutomationsSection.tsx) — see AutomationsManageDummy.tsx's own docblock for the Free-side stand-in shown when this hasn't resolved. */
	Manage: ComponentType<ManageAutomationsSectionComponentProps>;
	/** Real "Recent automation activity" feed (vulopilot-pro's own AutomationsActivityCard.tsx) — see AutomationsActivityDummy.tsx's own docblock for the Free-side stand-in shown when this hasn't resolved. */
	Activity: ComponentType<AutomationsActivityCardComponentProps>;
}

/**
 * "Automate Work" — Free gets exactly 2 fixed, schedule-only automations
 * (`BuiltinAutomationCards.tsx` — "Run Full Site Scan"/"Send Visibility
 * Report", no template picker, no wizard) always shown at the top.
 *
 * Per direct instruction, the header's 3 buttons ("Build with AI", "Create
 * Automation", "Browse Templates") always render, in Free too — a real
 * 2-tier Pro-then-module gate on click rather than being absent from the
 * DOM entirely: `openProPopup()` below opens the plain `<ShowProPopup />`
 * upgrade pitch when Pro isn't installed (`!appLocalizer.khali_dabba`), or
 * the real module-specific `<ShowProPopup moduleName="automations" />`
 * ("Activate {name}") when Pro is installed but this page's own
 * `vulopilot_automations_panel` filter slot hasn't resolved (`Wizard`/
 * `Generate`/`Templates` below) — same order/shape
 * AutomationsTemplatesCard.tsx's own `handleItemClick` uses for its 3 Pro
 * rows. Each button's own click handler
 * (`openCreateWizard`/`openGenerate`/`openTemplatesLibrary`) already had
 * this exact guard-then-popup logic; only the header's own `buttons` prop
 * used to also hide the buttons outright whenever `Wizard` was missing,
 * short-circuiting that logic before it ever ran.
 *
 * Same real 2-tier treatment for the "Your automations" section
 * (vulopilot-pro's own ManageAutomationsSection.tsx — Pro users' own list
 * of any *additional* automations they've built beyond the 2 built-in
 * ones, already excluding those 2 rows, see that file's own docblock) and
 * for "Recent automation activity" (vulopilot-pro's own
 * AutomationsActivityCard.tsx — the last 5 runs across every automation):
 * when their own `Manage`/`Activity` filter-slot members haven't resolved,
 * `manageBadge` below picks "PRO" or the real module's own display name (same
 * `isProInstalled` order every other gate on this page uses) and
 * `AutomationsManageDummy` renders in its place — fabricated example rows,
 * same PRO-badge-plus-immediate-popup shape as the header buttons above,
 * instead of the section being entirely absent from the DOM the way it
 * used to be.
 *
 * Owns the real wizard/"Build with AI" popups' open-signal state and the
 * `vulopilot_automations_panel` filter-slot resolution directly (rather than
 * `ManageAutomationsSection.tsx`, their previous host) since the header's
 * own buttons need to open them too, not just the table's row actions — a
 * single shared instance of each popup, not two independently-triggered
 * ones.
 */
const Automations = () => {
	const slot = useFilterSlot<AutomationSlotValue>('vulopilot_automations_panel');
	const Wizard = slot?.Wizard;
	const Generate = slot?.Generate;
	const Templates = slot?.Templates;
	const Manage = slot?.Manage;
	const Activity = slot?.Activity;

	const isProInstalled = Boolean(appLocalizer.khali_dabba);
	const manageBadge = isProInstalled
		? resolveModuleDisplayName(AUTOMATIONS_MODULE_ID)
		: __('Pro', 'vulopilot');

	const [wizardOpenSignal, setWizardOpenSignal] = useState(0);
	const [generateOpenSignal, setGenerateOpenSignal] = useState(0);
	const [templatesOpenSignal, setTemplatesOpenSignal] = useState(0);
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

	const openTemplatesLibrary = () => {
		if (!Templates) {
			openProPopup();
			return;
		}

		setTemplatesOpenSignal((n) => n + 1);
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

	// AI Copilot's Chat tab (ChatTab.tsx's own AutomationsTemplatesCard
	// preview) deep-links here as `?...#tab=automations&automation_template=<id>`
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
				headerTitle={__('Automations', 'vulopilot')}
				headerDescription={__(
					'Create workflows that automatically handle repetitive work and keep you informed.',
					'vulopilot'
				)}
				buttons={[
					{
						label: __('Build with AI', 'vulopilot'),
						icon: 'automation',
						color: 'border-purple',
						onClick: openGenerate,
					},
					{
						// Secondary — "Make templates the preferred starting point in
						// Pro. Allow 'Create from scratch' as a secondary Pro option" —
						// this button keeps working exactly as before, just no longer
						// the rightmost/most prominent one.
						label: __('Create Automation', 'vulopilot'),
						icon: 'plus',
						color: 'border-purple',
						onClick: openCreateWizard,
					},
					{
						// Preferred/rightmost — same "templates first, from-scratch
						// second" ordering as above.
						label: __('Browse Templates', 'vulopilot'),
						icon: 'search',
						onClick: openTemplatesLibrary,
					},
				]}
			/>

			<ContainerComponent general>
				<ColumnComponent grid={12}>
					<BuiltinAutomationCards refetchSignal={refetchSignal} onChanged={handleSaved} />
					{!Wizard && (
						<NoticeComponent
							displayPosition="inline"
							type="info"
							message={__(
								'Need custom triggers, conditions, actions or notifications? Available with VuloPilot Pro.',
								'vulopilot'
							)}
						/>
					)}
				</ColumnComponent>

				<ColumnComponent grid={6}>
					<AutomationsStatsRow />
				</ColumnComponent>
				<ColumnComponent grid={6}>
					<AutomationsPeriodStatsCard />
					<AutomationsAttentionCard onViewAll={scrollToTable} refetchSignal={refetchSignal} />
				</ColumnComponent>

				<ColumnComponent grid={7} fullHeight>
					{Manage ? (
						<Manage
							hasWizard={Boolean(Wizard)}
							onOpenRow={openRow}
							onRequireProUpsell={openProPopup}
							refetchSignal={refetchSignal}
						/>
					) : (
						<AutomationsManageDummy badgeText={manageBadge} onClick={openProPopup} />
					)}
				</ColumnComponent>
				<ColumnComponent grid={5} fullHeight>
					{Activity ? (
						<Activity onViewHistory={scrollToTable} refetchSignal={refetchSignal} />
					) : (
						<AutomationsActivityDummy badgeText={manageBadge} onClick={openProPopup} />
					)}
				</ColumnComponent>
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

				{Templates && <Templates openSignal={templatesOpenSignal} onSaved={handleSaved} />}

				<PopupComponent
					open={isProPopupOpen}
					onClose={() => setIsProPopupOpen(false)}
					width={31.25}
					height="auto"
					position="lightbox"
				>
					{appLocalizer.khali_dabba ? (
						<ShowProPopup moduleName="automations" />
					) : (
						<ShowProPopup />
					)}
				</PopupComponent>
			</ContainerComponent>
		</>
	);
};

export default Automations;
