import { __, sprintf } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { useRunScan } from '../services/useRunScan';
import { useLastScanTime } from '../services/useLastScanTime';
import { formatWpDate, formatWpTime } from '../services/formatWpDate';
import './RunScanHeaderExtra.scss';

interface RunScanHeaderExtraProps {
	/** Same real category ids passed to `useRunScan`'s own `categories` - omit for a site-wide "Run scan" (Health.tsx/Reports.tsx). */
	categories?: string[];
	/** Real Settings → … subtab id this page's own scan settings live on (`?page=vulopilot#&tab=settings&subtab={id}`). */
	settingsSubtab: string;
	/** Drops the gear/settings button beside "Run scan" - Dashboard.tsx's own header. */
	hideSettingsButton?: boolean;
	/** Drops the "Run scan" button itself (the settings gear, "Last scan: …" caption, and any `trailingButtons` stay). */
	hideRunScanButton?: boolean;
	/**
	 * Renders in "Run scan"'s own place - same slot in this component's single button row.
	 */
	replaceRunScanButton?: {
		text: string;
		icon: string;
		color?: string;
		onClick: () => void;
	};
	/** Overrides the button's own idle-state label (Performance.tsx's "Run Speed Test"). */
	label?: string;
	/** Same real `onSuccess` `useRunScan` already supports - a page's own refetch after a scan completes. */
	onSuccess?: () => void;
	/** Extra icon-only buttons appended after "Run scan"/the settings gear, in the same row. */
	trailingButtons?: {
		icon: string;
		color?: string;
		text?: string;
		tooltip?: string;
		onClick: () => void;
	}[];
}

/**
 * The "Run scan"/gear-icon/"Last scan: …" cluster every category page's own header now shows ("in
 * every page where run scan button show then show the last scan time … also beside run button show
 * a settings icon").
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
