import { useEffect, useState } from 'react';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';

export const useFilterSlot = <T = ComponentType>(
	hookName: string
): T | null => {
	const [component, setComponent] = useState<T | null>(
		() => applyFilters(hookName, null) as T | null
	);

	useEffect(() => {
		const recheck = () => {
			const resolved = applyFilters(hookName, null) as T | null;
			setComponent(() => resolved);
		};

		recheck();

		window.addEventListener('vulopilot_pro_modules_loaded', recheck);
		return () =>
			window.removeEventListener(
				'vulopilot_pro_modules_loaded',
				recheck
			);
	}, [hookName]);

	return component;
};
