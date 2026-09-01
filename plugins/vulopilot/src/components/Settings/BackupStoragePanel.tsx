/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	BadgeComponent,
	ClipboardComponent,
	NoticeComponent,
	NoticeManager,
	FormGroupComponent,
	FormGroupWrapperComponent
} from '@zyra/components';
import { ButtonInput, TextInput } from '@zyra/inputs';
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
 * Neither section pretends a save/connect succeeded — every "Saved"/
 * "Connected" state and every "Test connection" result comes straight back
 * from a real REST call to Controllers\BackupStorage, which itself only
 * ever reports what S3Client/GoogleDriveClient's own real HTTP calls
 * actually returned.
 */
const BackupStoragePanel = () => {
	const [status, setStatus] = useState<BackupStorageStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const [isS3Open, setIsS3Open] = useState(true);
	const [isGoogleDriveOpen, setIsGoogleDriveOpen] = useState(true);

	const [accessKey, setAccessKey] = useState('');
	const [secretKey, setSecretKey] = useState('');
	const [bucket, setBucket] = useState('');
	const [region, setRegion] = useState('us-east-1');
	const [isSavingS3, setIsSavingS3] = useState(false);
	const [isTestingS3, setIsTestingS3] = useState(false);
	const [s3TestResult, setS3TestResult] = useState<TestResult | null>(null);

	const [clientId, setClientId] = useState('');
	const [clientSecret, setClientSecret] = useState('');
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
				setBucket(response.s3.bucket || '');
				setRegion(response.s3.region || 'us-east-1');
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

	const handleSaveS3 = () => {
		setIsSavingS3(true);
		setS3TestResult(null);

		sendApiResponse<S3Status>(
			appLocalizer,
			getApiLink(appLocalizer, 'backup-storage/s3'),
			{ access_key: accessKey, secret_key: secretKey, bucket, region }
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
					setAccessKey('');
					setSecretKey('');
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
		setIsSavingGoogleClient(true);
		setGoogleTestResult(null);

		sendApiResponse<GoogleDriveStatus>(
			appLocalizer,
			getApiLink(appLocalizer, 'backup-storage/google-drive/client'),
			{ client_id: clientId, client_secret: clientSecret }
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
					setClientId('');
					setClientSecret('');
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

	return (
		<CardComponent
			title={__('Cloud Storage', 'vulopilot')}
			titleIcon="plus"
			desc={__(
				'Credentials for the remote destinations "Storage destination" above can upload completed backups to. Every backup always saves to this server first regardless.',
				'vulopilot'
			)}
			isLoading={isLoading}
		>
			{!isLoading && status && (
				<div className="backup-storage-panel">
					<div className="backup-storage-section">
						<div
							className="backup-storage-header is-clickable"
							onClick={() => setIsS3Open((v) => !v)}
						>
							<i className="backup-storage-card-icon adminfont-cloud-upload red" />
							<div className="backup-storage-card-title">
								<strong>{__('Amazon S3', 'vulopilot')}</strong>
								<span className="desc">
									{__('Store backups in an Amazon S3 bucket.', 'vulopilot')}
								</span>
							</div>
							<span
								className={`admin-badge ${status.s3.configured ? 'green' : 'red'}`}
							>
								{status.s3.configured ? __('Configured', 'vulopilot') : __('Not configured', 'vulopilot')}
							</span>
							<i className={`adminfont-arrow-${isS3Open ? 'up' : 'down'} backup-storage-expand-icon`} />
						</div>

						{isS3Open && (
							<div className="backup-storage-card-body">
								{status.s3.configured && (
									<div className="backup-storage-status-row">
										<BadgeComponent color="green" text={__('Configured', 'vulopilot')} />
										<span className="desc">
											{sprintf(
												/* translators: 1: bucket name, 2: AWS region, 3: masked access key. */
												__('%1$s · %2$s · Access Key %3$s', 'vulopilot'),
												status.s3.bucket,
												status.s3.region,
												status.s3.access_key_masked
											)}
										</span>
										<button
											type="button"
											className="backup-storage-inline-action"
											onClick={handleTestS3}
											disabled={isTestingS3}
										>
											{isTestingS3
												? __('Testing…', 'vulopilot')
												: __('Test connection', 'vulopilot')}
										</button>
									</div>
								)}

								{s3TestResult && (
									<NoticeComponent
										displayPosition="inline"
										type={s3TestResult.success ? 'success' : 'error'}
										message={s3TestResult.message}
									/>
								)}

								<FormGroupWrapperComponent>
									<FormGroupComponent cols="6" label={__('Access Key ID', 'vulopilot')}>
										<TextInput
											name="s3_access_key"
											inputLabel={__('Access Key ID', 'vulopilot')}
											placeholder="AKIAIOSFODNN7EXAMPLE"
											value={accessKey}
											onChange={(value) => setAccessKey(value as string)}
										/>
									</FormGroupComponent>
									<FormGroupComponent cols="6" label={__('Secret Access Key', 'vulopilot')}>
										<TextInput
											name="s3_secret_key"
											inputLabel={__('Secret Access Key', 'vulopilot')}
											placeholder="••••••••••••••••••••••••"
											value={secretKey}
											onChange={(value) => setSecretKey(value as string)}
										/>
									</FormGroupComponent>
									<FormGroupComponent cols="6" label={__('Bucket', 'vulopilot')}>
										<TextInput
											name="s3_bucket"
											inputLabel={__('Bucket', 'vulopilot')}
											placeholder="my-backups-bucket"
											value={bucket}
											onChange={(value) => setBucket(value as string)}
										/>
									</FormGroupComponent>
									<FormGroupComponent cols="6" label={__('Region', 'vulopilot')}>
										<TextInput
											name="s3_region"
											inputLabel={__('Region', 'vulopilot')}
											placeholder="us-east-1"
											value={region}
											onChange={(value) => setRegion(value as string)}
										/>
									</FormGroupComponent>
									<FormGroupComponent label="">
										<ButtonInput
											buttons={{
												text: isSavingS3
													? __('Saving…', 'vulopilot')
													: status.s3.configured
														? __('Update', 'vulopilot')
														: __('Save', 'vulopilot'),
												onClick: handleSaveS3,
												disabled:
													isSavingS3 || !accessKey || !secretKey || !bucket,
											}}
										/>
									</FormGroupComponent>
								</FormGroupWrapperComponent>
							</div>
						)}
					</div>

					<div className="backup-storage-section">
						<div
							className="backup-storage-header is-clickable"
							onClick={() => setIsGoogleDriveOpen((v) => !v)}
						>
							<i className="backup-storage-card-icon adminfont-google yellow" />
							<div className="backup-storage-card-title">
								<strong>{__('Google Drive', 'vulopilot')}</strong>
								<span className="desc">
									{__('Store backups in a Google Drive folder.', 'vulopilot')}
								</span>
							</div>
							<span
								className={`admin-badge ${status.google_drive.connected ? 'green' : 'red'}`}
							>
								{status.google_drive.connected ? __('Connected', 'vulopilot') : __('Not connected', 'vulopilot')}
							</span>
							<i className={`adminfont-arrow-${isGoogleDriveOpen ? 'up' : 'down'} backup-storage-expand-icon`} />
						</div>

						{isGoogleDriveOpen && (
							<div className="backup-storage-card-body">
								<FormGroupWrapperComponent>
									{status.google_drive.connected ? (
										<div className="backup-storage-status-row">
											<BadgeComponent color="green" text={__('Connected', 'vulopilot')} />
											{status.google_drive.connected_at && (
												<span className="desc">
													{__('Since', 'vulopilot')} {formatWpDate(status.google_drive.connected_at)}
												</span>
											)}
											<button
												type="button"
												className="backup-storage-inline-action"
												onClick={handleTestGoogleDrive}
												disabled={isTestingGoogleDrive}
											>
												{isTestingGoogleDrive
													? __('Testing…', 'vulopilot')
													: __('Test connection', 'vulopilot')}
											</button>
											<button
												type="button"
												className="backup-storage-inline-action is-destructive"
												onClick={handleDisconnectGoogleDrive}
												disabled={isDisconnectingGoogleDrive}
											>
												{isDisconnectingGoogleDrive
													? __('Disconnecting…', 'vulopilot')
													: __('Disconnect', 'vulopilot')}
											</button>
										</div>
									) : status.google_drive.client_configured ? (
										<>
											<p className="desc">
												{__(
													'OAuth Client saved — connect your Google account to finish.',
													'vulopilot'
												)}
											</p>
											<ButtonInput
												buttons={{
													text: __('Connect Google Drive', 'vulopilot'),
													icon: 'admin-links',
													onClick: () => {
														if (status.google_drive.authorize_url) {
															window.location.href = status.google_drive.authorize_url;
														}
													},
													disabled: !status.google_drive.authorize_url,
												}}
											/>
										</>
									) : (
										<>
											<NoticeComponent
												displayPosition="inline-notice"
												type="info"
												message={__(
													'Register your own free Google Cloud OAuth Client (one-time setup) to connect Google Drive — VuloPilot never uses a shared account for this, only files it creates itself.',
													'vulopilot'
												)}
											/>
											<FormGroupComponent label={__('Authorized redirect URI to register on that Client:', 'vulopilot')}>
												<ClipboardComponent
													text={status.google_drive.redirect_uri}
													variant="code"
													copyButtonLabel={__('Copy', 'vulopilot')}
													copiedLabel={__('Copied!', 'vulopilot')}
												/>
											</FormGroupComponent>
											<FormGroupWrapperComponent>
												<FormGroupComponent cols="6" label={__('Client ID', 'vulopilot')}>
													<TextInput
														name="gdrive_client_id"
														inputLabel={__('Client ID', 'vulopilot')}
														placeholder="xxxxxxxx.apps.googleusercontent.com"
														value={clientId}
														onChange={(value) => setClientId(value as string)}
													/>
												</FormGroupComponent>
												<FormGroupComponent cols="6" label={__('Client Secret', 'vulopilot')}>
													<TextInput
														name="gdrive_client_secret"
														inputLabel={__('Client Secret', 'vulopilot')}
														placeholder="••••••••••••••••••••"
														value={clientSecret}
														onChange={(value) => setClientSecret(value as string)}
													/>
												</FormGroupComponent>
												<FormGroupComponent label="">
													<ButtonInput
														buttons={{
															text: isSavingGoogleClient
																? __('Saving…', 'vulopilot')
																: __('Save', 'vulopilot'),
															onClick: handleSaveGoogleClient,
															disabled:
																isSavingGoogleClient || !clientId || !clientSecret,
														}}
													/>
												</FormGroupComponent>
											</FormGroupWrapperComponent>
										</>
									)}

									{googleTestResult && (
										<NoticeComponent
											displayPosition="inline"
											type={googleTestResult.success ? 'success' : 'error'}
											message={googleTestResult.message}
										/>
									)}
								</FormGroupWrapperComponent>
							</div>
						)}
					</div>
				</div>
			)}
		</CardComponent>
	);
};

export default BackupStoragePanel;
