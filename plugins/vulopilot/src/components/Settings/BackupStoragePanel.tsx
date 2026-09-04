/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	SectionComponent,
	FormGroupWrapperComponent,
	FormGroupComponent,
	NoticeManager,
} from '@zyra/components';
import { ExpandablePanelInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';

interface S3Status {
	configured: boolean;
	bucket: string;
	region: string;
	access_key_masked: string;
}

interface GoogleDriveStatus {
	client_configured: boolean;
	connected: boolean;
	connected_at: string;
	redirect_uri: string;
	authorize_url: string | null;
}

interface BackupStorageStatus {
	s3: S3Status;
	google_drive: GoogleDriveStatus;
}

interface TestResult {
	success: boolean;
	message: string;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Settings → Backups' own "Cloud Storage" section — real Amazon S3
 * credentials (Access Key ID/Secret Access Key/bucket/region, a real signed
 * `HeadBucket` "Test connection") and a real, direct-to-Google OAuth
 * connection for Google Drive (bring-your-own OAuth Client — see
 * Services\BackupGoogleDriveConnection's own docblock for why this isn't
 * the shared "Connect Google Services" flow). Backs the
 * `backup_storage_destination` select immediately above it
 * (Backups.ts/InputRenderer) — that field picks which one (if any) a
 * completed backup actually uploads to
 * (Services\BackupStorageManager); this panel is only where each
 * destination's own credentials/connection live. Same "hand-built
 * escape-hatch panel appended after InputRenderer's own fields" shape
 * Settings.tsx's own GetForm() already uses for `ai-visibility`'s llms.txt
 * card — see Backups.ts's own docblock for exactly where this is appended.
 *
 * Both destinations are now one real `ExpandablePanelInput` (per direct
 * instruction, matching AiProvidersPanel.tsx's own "Other providers"
 * list) instead of two hand-rolled `is-clickable` header divs — same real
 * zyra component, `isCustom`/`hideDeleteBtn`/`badgeColor`/`badgeText` rows
 * with no on/off `enable` semantics of their own (neither destination has
 * an "activate" concept, only "configured or not"/"connected or not"), and
 * expand/collapse is the panel's own built-in `activeTab` state rather
 * than the `isS3Open`/`isGoogleDriveOpen` state this file used to keep by
 * hand. Each row's live-typed fields (access key, client secret, ...) live
 * in `panelValues`, merged with real server state in `mergedValues` the
 * same way AiProvidersPanel.tsx's own `heroPanelValues` merges `heroValues`
 * with `configured` — `handleSaveS3`/`handleSaveGoogleClient` read off
 * `mergedValues` instead of the individual `accessKey`/`secretKey`/...
 * state this file used to keep per field.
 *
 * Neither section pretends a save/connect succeeded — every "Saved"/
 * "Connected" state and every "Test connection" result comes straight back
 * from a real REST call to Controllers\BackupStorage, which itself only
 * ever reports what S3Client/GoogleDriveClient's own real HTTP calls
 * actually returned.
 */
const BackupStoragePanel = () => {
	const [status, setStatus] = useState<BackupStorageStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const [panelValues, setPanelValues] = useState<Record<string, Record<string, unknown>>>({});

	const [isSavingS3, setIsSavingS3] = useState(false);
	const [isTestingS3, setIsTestingS3] = useState(false);
	const [s3TestResult, setS3TestResult] = useState<TestResult | null>(null);

	const [isSavingGoogleClient, setIsSavingGoogleClient] = useState(false);
	const [isTestingGoogleDrive, setIsTestingGoogleDrive] = useState(false);
	const [googleTestResult, setGoogleTestResult] = useState<TestResult | null>(null);
	const [isDisconnectingGoogleDrive, setIsDisconnectingGoogleDrive] = useState(false);

	const refreshStatus = () =>
		getApiResponse<BackupStorageStatus>(
			getApiLink(appLocalizer, 'backup-storage'),
			nonceHeaders
		).then((response) => {
			if (response) {
				setStatus(response);
			}
			return response;
		});

	useEffect(() => {
		setIsLoading(true);
		refreshStatus().finally(() => setIsLoading(false));

		// BackupGoogleDriveOAuthCallbackHandler.php's own real redirect
		// lands back on this exact URL carrying `gdrive_status=connected|error`
		// as a real signal, not a fabricated success message — same
		// convention useGoogleServicesConnection.ts's own `gsc_status`
		// handling already establishes.
		const params = new URLSearchParams(
			window.location.hash.split('?')[1] || window.location.hash.substring(1)
		);
		const gdriveStatus = params.get('gdrive_status');

		if (gdriveStatus === 'connected') {
			NoticeManager.add({
				uniqueKey: 'vulopilot-backup-gdrive-connected',
				type: 'success',
				position: 'float',
				message: __('Connected to Google Drive.', 'vulopilot'),
			});
		} else if (gdriveStatus === 'error') {
			NoticeManager.add({
				uniqueKey: 'vulopilot-backup-gdrive-connect-failed',
				type: 'error',
				position: 'float',
				message: __(
					'Could not connect to Google Drive. Please check the Client ID/Secret and try again.',
					'vulopilot'
				),
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Live-typed fields merged with real server state — `bucket`/`region`
	// fall back to the saved values until the user types their own, same
	// "live merged with saved" shape AiProvidersPanel.tsx's own
	// `heroPanelValues` uses.
	const mergedValues: Record<string, Record<string, unknown>> = {
		s3: {
			access_key: panelValues.s3?.access_key ?? '',
			secret_key: panelValues.s3?.secret_key ?? '',
			bucket: panelValues.s3?.bucket ?? status?.s3.bucket ?? '',
			region: panelValues.s3?.region ?? status?.s3.region ?? 'us-east-1',
		},
		google_drive: {
			client_id: panelValues.google_drive?.client_id ?? '',
			client_secret: panelValues.google_drive?.client_secret ?? '',
		},
	};

	const handleSaveS3 = () => {
		const { access_key, secret_key, bucket, region } = mergedValues.s3 as {
			access_key: string;
			secret_key: string;
			bucket: string;
			region: string;
		};

		setIsSavingS3(true);
		setS3TestResult(null);

		sendApiResponse<S3Status>(
			appLocalizer,
			getApiLink(appLocalizer, 'backup-storage/s3'),
			{ access_key, secret_key, bucket, region }
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-backup-s3-saved',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Amazon S3 credentials saved.', 'vulopilot')
						: __('Could not save these credentials. Please try again.', 'vulopilot'),
				});

				if (response) {
					setStatus((prev) => (prev ? { ...prev, s3: response } : prev));
					// Never left sitting in the form after a successful
					// save — the Secret Access Key is never returned by
					// the server either, so there's nothing to re-show.
					setPanelValues((prev) => ({
						...prev,
						s3: { ...prev.s3, access_key: '', secret_key: '' },
					}));
				}
			})
			.finally(() => setIsSavingS3(false));
	};

	const handleTestS3 = () => {
		setIsTestingS3(true);
		setS3TestResult(null);

		sendApiResponse<TestResult>(
			appLocalizer,
			getApiLink(appLocalizer, 'backup-storage/s3/test'),
			{}
		)
			.then((response) => setS3TestResult(response ?? null))
			.finally(() => setIsTestingS3(false));
	};

	const handleSaveGoogleClient = () => {
		const { client_id, client_secret } = mergedValues.google_drive as {
			client_id: string;
			client_secret: string;
		};

		setIsSavingGoogleClient(true);
		setGoogleTestResult(null);

		sendApiResponse<GoogleDriveStatus>(
			appLocalizer,
			getApiLink(appLocalizer, 'backup-storage/google-drive/client'),
			{ client_id, client_secret }
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-backup-gdrive-client-saved',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Google OAuth Client saved.', 'vulopilot')
						: __('Could not save this Client ID/Secret. Please try again.', 'vulopilot'),
				});

				if (response) {
					setStatus((prev) => (prev ? { ...prev, google_drive: response } : prev));
					setPanelValues((prev) => ({
						...prev,
						google_drive: { ...prev.google_drive, client_id: '', client_secret: '' },
					}));
				}
			})
			.finally(() => setIsSavingGoogleClient(false));
	};

	const handleTestGoogleDrive = () => {
		setIsTestingGoogleDrive(true);
		setGoogleTestResult(null);

		sendApiResponse<TestResult>(
			appLocalizer,
			getApiLink(appLocalizer, 'backup-storage/google-drive/test'),
			{}
		)
			.then((response) => setGoogleTestResult(response ?? null))
			.finally(() => setIsTestingGoogleDrive(false));
	};

	const handleDisconnectGoogleDrive = () => {
		setIsDisconnectingGoogleDrive(true);

		sendApiResponse<GoogleDriveStatus>(
			appLocalizer,
			getApiLink(appLocalizer, 'backup-storage/google-drive/disconnect'),
			{}
		)
			.then((response) => {
				if (response) {
					setStatus((prev) => (prev ? { ...prev, google_drive: response } : prev));
				}
				setGoogleTestResult(null);
			})
			.finally(() => setIsDisconnectingGoogleDrive(false));
	};

	const methods = status
		? [
			{
				id: 's3',
				icon: 'cloud-upload red',
				label: __('Amazon S3', 'vulopilot'),
				desc: __('Store backups in an Amazon S3 bucket.', 'vulopilot'),
				isCustom: true,
				hideDeleteBtn: true,
				badgeColor: status.s3.configured ? 'green' : 'red',
				badgeText: status.s3.configured
					? __('Configured', 'vulopilot')
					: __('Not configured', 'vulopilot'),
				formFields: [
					...(status.s3.configured
						? [
							{
								key: 's3_status',
								type: 'notice',
								label: '',
								noticeType: 'info',
								message: sprintf(
									/* translators: 1: bucket name, 2: AWS region, 3: masked access key. */
									__('%1$s · %2$s · Access Key %3$s', 'vulopilot'),
									status.s3.bucket,
									status.s3.region,
									status.s3.access_key_masked
								),
							},
							{
								key: 'test_s3',
								type: 'button',
								label: '',
								text: isTestingS3
									? __('Testing…', 'vulopilot')
									: __('Test connection', 'vulopilot'),
								onClick: handleTestS3,
								disabled: isTestingS3,
							},
						]
						: []),
					...(s3TestResult
						? [
							{
								key: 's3_test_result',
								type: 'notice',
								label: '',
								noticeType: s3TestResult.success ? 'success' : 'error',
								message: s3TestResult.message,
							},
						]
						: []),
					{
						key: 'access_key',
						type: 'text',
						label: __('Access Key ID', 'vulopilot'),
						placeholder: 'AKIAIOSFODNN7EXAMPLE',
					},
					{
						key: 'secret_key',
						type: 'password',
						label: __('Secret Access Key', 'vulopilot'),
						placeholder: '••••••••••••••••••••••••',
					},
					{
						key: 'bucket',
						type: 'text',
						label: __('Bucket', 'vulopilot'),
						placeholder: 'my-backups-bucket',
					},
					{
						key: 'region',
						type: 'text',
						label: __('Region', 'vulopilot'),
						placeholder: 'us-east-1',
					},
					{
						key: 'save_s3',
						type: 'button',
						label: '',
						text: isSavingS3
							? __('Saving…', 'vulopilot')
							: status.s3.configured
								? __('Update', 'vulopilot')
								: __('Save', 'vulopilot'),
						onClick: handleSaveS3,
						disabled:
							isSavingS3 ||
							!mergedValues.s3.access_key ||
							!mergedValues.s3.secret_key ||
							!mergedValues.s3.bucket,
					},
				],
			},
			{
				id: 'google_drive',
				icon: 'google yellow',
				label: __('Google Drive', 'vulopilot'),
				desc: __('Store backups in a Google Drive folder.', 'vulopilot'),
				isCustom: true,
				hideDeleteBtn: true,
				badgeColor: status.google_drive.connected ? 'green' : 'red',
				badgeText: status.google_drive.connected
					? __('Connected', 'vulopilot')
					: __('Not connected', 'vulopilot'),
				formFields: status.google_drive.connected
					? [
						{
							key: 'gdrive_status',
							type: 'notice',
							label: '',
							noticeType: 'success',
							message: status.google_drive.connected_at
								? `${__('Since', 'vulopilot')} ${formatWpDate(status.google_drive.connected_at)}`
								: __('Connected', 'vulopilot'),
						},
						{
							key: 'test_gdrive',
							type: 'button',
							label: '',
							text: isTestingGoogleDrive
								? __('Testing…', 'vulopilot')
								: __('Test connection', 'vulopilot'),
							onClick: handleTestGoogleDrive,
							disabled: isTestingGoogleDrive,
						},
						{
							key: 'disconnect_gdrive',
							type: 'button',
							label: '',
							text: isDisconnectingGoogleDrive
								? __('Disconnecting…', 'vulopilot')
								: __('Disconnect', 'vulopilot'),
							icon: 'disconnect',
							onClick: handleDisconnectGoogleDrive,
							disabled: isDisconnectingGoogleDrive,
						},
						...(googleTestResult
							? [
								{
									key: 'gdrive_test_result',
									type: 'notice',
									label: '',
									noticeType: googleTestResult.success ? 'success' : 'error',
									message: googleTestResult.message,
								},
							]
							: []),
					]
					: status.google_drive.client_configured
						? [
							{
								key: 'gdrive_client_saved',
								type: 'notice',
								label: '',
								noticeType: 'info',
								message: __(
									'OAuth Client saved — connect your Google account to finish.',
									'vulopilot'
								),
							},
							{
								key: 'connect_gdrive',
								type: 'button',
								label: '',
								text: __('Connect Google Drive', 'vulopilot'),
								icon: 'admin-links',
								onClick: () => {
									if (status.google_drive.authorize_url) {
										window.location.href = status.google_drive.authorize_url;
									}
								},
								disabled: !status.google_drive.authorize_url,
							},
						]
						: [
							{
								key: 'gdrive_setup_notice',
								type: 'notice',
								label: '',
								noticeType: 'info',
								message: __(
									'Register your own free Google Cloud OAuth Client (one-time setup) to connect Google Drive — VuloPilot never uses a shared account for this, only files it creates itself.',
									'vulopilot'
								),
							},
							{
								key: 'gdrive_redirect_uri',
								type: 'copy-to-clipboard',
								label: __('Authorized redirect URI to register on that Client:', 'vulopilot'),
								text: status.google_drive.redirect_uri,
								variant: 'code',
								copyButtonLabel: __('Copy', 'vulopilot'),
								copiedLabel: __('Copied!', 'vulopilot'),
							},
							{
								key: 'client_id',
								type: 'text',
								label: __('Client ID', 'vulopilot'),
								placeholder: 'xxxxxxxx.apps.googleusercontent.com',
							},
							{
								key: 'client_secret',
								type: 'password',
								label: __('Client Secret', 'vulopilot'),
								placeholder: '••••••••••••••••••••',
							},
							{
								key: 'save_gdrive_client',
								type: 'button',
								label: '',
								text: isSavingGoogleClient
									? __('Saving…', 'vulopilot')
									: __('Save', 'vulopilot'),
								onClick: handleSaveGoogleClient,
								disabled:
									isSavingGoogleClient ||
									!mergedValues.google_drive.client_id ||
									!mergedValues.google_drive.client_secret,
							},
						],
			},
		]
		: [];

	return (
		<div className="settings-section-group">
			<div className="settings-section">
				<SectionComponent
					icon="cloud-upload"
					title={__('Cloud Storage', 'vulopilot')}
					desc={__(
						'Credentials for the remote destinations "Storage destination" above can upload completed backups to. Every backup always saves to this server first regardless.',
						'vulopilot'
					)}
					isLoading={isLoading}
				/>
			</div>
			<FormGroupWrapperComponent>
				<FormGroupComponent>
					{!isLoading && status && (
						<ExpandablePanelInput
							name="backup-storage-destinations"
							methods={methods}
							value={mergedValues}
							onChange={setPanelValues}
							canAccess
						/>
					)}
				</FormGroupComponent>
			</FormGroupWrapperComponent>
		</div>
	);
};

export default BackupStoragePanel;
