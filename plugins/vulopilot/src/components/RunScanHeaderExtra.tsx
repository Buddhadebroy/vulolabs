import { __, sprintf } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { useRunScan } from '../services/useRunScan';
import { useLastScanTime } from '../services/useLastScanTime';
import { formatWpDate } from '../services/formatWpDate';
import './RunScanHeaderExtra.scss';

interface RunScanHeaderExtraProps {
	/** Same real category ids passed to `useRunScan`'s own `categories` — omit for a site-wide "Run scan" (Health.tsx/Reports.tsx). */
	categories?: string[];
	/** Real Settings → … subtab id this page's own scan settings live on (`?page=vulopilot#&tab=settings&subtab=<id>`) — powers the gear button beside "Run scan". */
	settingsSubtab: string;
	/** Overrides the button's own idle-state label (Performance.tsx's "Run Speed Test") — "Scanning…" while a scan is in progress is unaffected either way. */
	label?: string;
	/** Same real `onSuccess` `useRunScan` already supports — a page's own refetch after a scan completes. */
	onSuccess?: () => void;
}

/**
 * The "Run scan"/gear-icon/"Last scan: …" cluster every category page's own
 * header now shows, per direct instruction ("in every page where run scan
 * button show then show the last scan time … also beside run button show a
 * settings icon"). One shared component rather than duplicating this same
 * wiring across all 9 header call sites (Health/Security/Site Health/
 * Accessibility/Commerce/SEO & Visibility/Reports/Performance/Content).
 *
 * Passed as `NavigatorHeaderComponent`'s own `headerCustomContent` — not
 * its `buttons` prop — since `.title-section` lays `.title-wrapper` and
 * `headerCustomContent` out as side-by-side flex siblings (NavigatorComponent.scss),
 * not stacked; the only way to get the real button row above the "Last
 * scan" caption below it (matching the reference image) is to own that
 * whole 2-row layout here instead of splitting it across `buttons` +
 * `headerCustomContent`.
 *
 * The last-scan time itself is real — `useLastScanTime`, scoped to this
 * same page's own `categories` (via `GET /scans?category=…`, resolved
 * server-side to that category's real scanner ids, same mapping
 * `POST /scans`' own `category` param already uses to decide what to run).
 * Renders nothing for that line when nothing has ever completed for this
 * scope yet, rather than a fabricated date.
 */
const RunScanHeaderExtra = ({
	categories,
	settingsSubtab,
	label,
	onSuccess,
}: RunScanHeaderExtraProps) => {
	const { isScanning, runScanButton } = useRunScan({ categories, onSuccess });
	const { lastScanAt, isLoading } = useLastScanTime(undefined, categories);

	return (
		<div className="run-scan-header-extra">
			<div className="run-scan-header-extra-buttons">
				<ButtonInput
					buttons={{
						text:
							!isScanning && label ? label : runScanButton.label,
						icon: runScanButton.icon,
						color: runScanButton.color,
						onClick: runScanButton.onClick,
					}}
				/>
				<ButtonInput
					buttons={{
						text: '',
						icon: 'setting',
						color: 'text-purple',
						onClick: () => {
							window.location.href = `?page=vulopilot#&tab=settings&subtab=${settingsSubtab}`;
						},
					}}
				/>
			</div>
			{!isLoading && lastScanAt && (
				<div className="run-scan-header-extra-last-scan desc">
					{sprintf(
						/* translators: 1: formatted date, 2: formatted time. */
						__('Last scan: %1$s • %2$s', 'vulopilot'),
						formatWpDate(lastScanAt),
						new Date(lastScanAt).toLocaleTimeString(undefined, {
							hour: 'numeric',
							minute: '2-digit',
						})
					)}
				</div>
			)}
		</div>
	);
};

export default RunScanHeaderExtra;
