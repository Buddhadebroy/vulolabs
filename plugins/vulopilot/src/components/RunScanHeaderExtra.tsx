import { __, sprintf } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { useRunScan } from '../services/useRunScan';
import { useLastScanTime } from '../services/useLastScanTime';
import { formatWpDate, formatWpTime } from '../services/formatWpDate';
import './RunScanHeaderExtra.scss';

interface RunScanHeaderExtraProps {
	/** Same real category ids passed to `useRunScan`'s own `categories` - omit for a site-wide "Run scan" (Health.tsx/Reports.tsx). */
	categories?: string[];
	/** Real Settings → … subtab id this page's own scan settings live on (`?page=vulopilot#&tab=settings&subtab=<id>`) - powers the gear button beside "Run scan". Ignored when `hideSettingsButton` is set. */
	settingsSubtab: string;
	/** Drops the gear/settings button beside "Run scan" - Dashboard.tsx's own header, per direct instruction, since its "Run scan" is a real site-wide scan with no single matching Settings subtab of its own (unlike every category page's own scoped scan settings) rather than the gear silently pointing at a generic tab. Every other call site keeps the gear (default false). */
	hideSettingsButton?: boolean;
	/** Drops the "Run scan" button itself (the settings gear, "Last scan: …" caption, and any `trailingButtons` stay) - Dashboard.tsx's own header while "Customize dashboard" mode is on, per direct instruction: starting a real scan mid-layout-edit doesn't make sense there, and the row already has "Reset to default"/the save checkmark to act on instead. Every other call site keeps the button (default false). */
	hideRunScanButton?: boolean;
	/**
	 * Renders in "Run scan"'s own place - same slot in this component's
	 * single button row - instead of leaving it empty when
	 * `hideRunScanButton` is set. Dashboard.tsx's own "Reset to default"
	 * while customizing: it used to render as a second, separate
	 * `run-scan-header-extra` box before this component, which visibly
	 * broke the row's layout (two competing button clusters fighting for
	 * the same space) rather than reading as one continuous header row.
	 * Ignored while `hideRunScanButton` is false.
	 */
	replaceRunScanButton?: {
		text: string;
		icon: string;
		color?: string;
		onClick: () => void;
	};
	/** Overrides the button's own idle-state label (Performance.tsx's "Run Speed Test") - "Scanning…" while a scan is in progress is unaffected either way. */
	label?: string;
	/** Same real `onSuccess` `useRunScan` already supports - a page's own refetch after a scan completes. */
	onSuccess?: () => void;
	/** Extra icon-only buttons appended after "Run scan"/the settings gear, in the same row - Dashboard.tsx's own "Customize dashboard"/"Save changes" edit toggle, per direct instruction, rather than that caller rendering a second, separate `ButtonInput` beside this component. Omit for every call site that has no such extra action (every other page). */
	trailingButtons?: {
		icon: string;
		color?: string;
		text?: string;
		tooltip?: string;
		onClick: () => void;
	}[];
}

/**
 * The "Run scan"/gear-icon/"Last scan: …" cluster every category page's own
 * header now shows, per direct instruction ("in every page where run scan
 * button show then show the last scan time … also beside run button show a
 * settings icon"). One shared component rather than duplicating this same
 * wiring across all 9 header call sites (Health/Security/Site Health/
 * Accessibility/Commerce/SEO & Visibility/Reports/Performance/Content).
 *
 * Passed as `NavigatorHeaderComponent`'s own `headerCustomContent` - not
 * its `buttons` prop - since `.title-section` lays `.title-wrapper` and
 * `headerCustomContent` out as side-by-side flex siblings (NavigatorComponent.scss),
 * not stacked; the only way to get the real button row above the "Last
 * scan" caption below it (matching the reference image) is to own that
 * whole 2-row layout here instead of splitting it across `buttons` +
 * `headerCustomContent`.
 *
 * The last-scan time itself is real - `useLastScanTime`, scoped to this
 * same page's own `categories` (via `GET /scans?category=…`, resolved
 * server-side to that category's real scanner ids, same mapping
 * `POST /scans`' own `category` param already uses to decide what to run).
 * Renders nothing for that line when nothing has ever completed for this
 * scope yet, rather than a fabricated date.
 */
const RunScanHeaderExtra = ({
	categories,
	settingsSubtab,
	hideSettingsButton = false,
	hideRunScanButton = false,
	replaceRunScanButton,
	label,
	onSuccess,
	trailingButtons = [],
}: RunScanHeaderExtraProps) => {
	const { isScanning, runScanButton } = useRunScan({ categories, onSuccess });
	const { lastScanAt, isLoading } = useLastScanTime(undefined, categories);

	return (
		<div className="run-scan-header-extra">
				<ButtonInput
					buttons={[
						...(hideRunScanButton
							? replaceRunScanButton
								? [
										{
											text: replaceRunScanButton.text,
											icon: replaceRunScanButton.icon,
											color: replaceRunScanButton.color ?? 'purple-bg',
											onClick: replaceRunScanButton.onClick,
										},
									]
								: []
							: [
									{
										text:
											!isScanning && label
												? label
												: runScanButton.label,
										icon: runScanButton.icon,
										color: 'purple-bg',
										onClick: runScanButton.onClick,
									},
								]),
						...(hideSettingsButton
							? []
							: [
									{
										text: '',
										icon: 'setting',
										color: 'text-purple icon',
										tooltip: __('Scan settings', 'vulopilot'),
										onClick: () => {
											window.location.href = `?page=vulopilot#&tab=settings&subtab=${settingsSubtab}`;
										},
									},
								]),
						...trailingButtons.map((button) => ({
							text: button.text ?? '',
							icon: button.icon,
							color: button.color,
							tooltip: button.tooltip,
							onClick: button.onClick,
						})),
					]}
				/>
			{!isLoading && lastScanAt && (
				<div className="run-scan-header-extra-last-scan desc">
					{sprintf(
						/* translators: 1: formatted date, 2: formatted time. */
						__('Last scan: %1$s • %2$s', 'vulopilot'),
						formatWpDate(lastScanAt),
						formatWpTime(lastScanAt)
					)}
				</div>
			)}
		</div>
	);
};

export default RunScanHeaderExtra;
