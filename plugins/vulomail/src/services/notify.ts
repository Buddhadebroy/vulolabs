import { NoticeManager } from '@zyra/components';

/**
 * Floating notice, shown by the receiver zyra's HeaderComponent mounts on every screen.
 */
export const notify = (
	type: 'success' | 'error' | 'info',
	message: string,
	uniqueKey = 'vulomail-notice'
) => {
	NoticeManager.add({ uniqueKey, type, position: 'float', message });
};

export const errorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error);
