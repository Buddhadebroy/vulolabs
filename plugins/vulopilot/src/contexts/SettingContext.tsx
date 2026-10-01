import React, { createContext, useReducer, useContext, ReactNode } from 'react';

/**
 * Small reducer-backed context holding per-tab settings state, which zyra does not export.
 */
type SettingState = {
	settingName: string;
	setting: Record<string, unknown>;
};

type SettingAction =
	| {
			type: 'SET_SETTINGS';
			payload: { settingName: string; setting: Record<string, unknown> };
	  }
	| { type: 'UPDATE_SETTINGS'; payload: { key: string; value: unknown } }
	| { type: 'CLEAR_SETTINGS' };

 
type SettingContextType = SettingState & {
	// eslint-disable-next-line no-unused-vars
	setSetting: (name: string, setting: Record<string, unknown>) => void;
	// eslint-disable-next-line no-unused-vars
	updateSetting: (key: string, value: unknown) => void;
	clearSetting: () => void;
};
 

const initialState: SettingState = {
	settingName: '',
	setting: {},
};

const SettingContext = createContext<SettingContextType | undefined>(undefined);

const settingReducer = (
	state: SettingState,
	action: SettingAction
): SettingState => {
	switch (action.type) {
		case 'SET_SETTINGS': {
			return { ...action.payload };
		}
		case 'UPDATE_SETTINGS': {
			const { key, value } = action.payload;
			const setting = { ...state.setting, [key]: value };
			return { ...state, setting };
		}
		case 'CLEAR_SETTINGS': {
			return { settingName: '', setting: {} };
		}
		default:
			return state;
	}
};

type SettingProviderProps = {
	children: ReactNode;
};

const SettingProvider: React.FC<SettingProviderProps> = ({ children }) => {
	const [state, dispatch] = useReducer(settingReducer, initialState);

	const setSetting = (
		settingName: string,
		setting: Record<string, unknown>
	) => {
		dispatch({ type: 'SET_SETTINGS', payload: { settingName, setting } });
	};

	const updateSetting = (key: string, value: unknown) => {
		dispatch({ type: 'UPDATE_SETTINGS', payload: { key, value } });
	};

	const clearSetting = () => {
		dispatch({ type: 'CLEAR_SETTINGS' });
	};

	return (
		<SettingContext.Provider
			value={{
				...state,
				setSetting,
				updateSetting,
				clearSetting,
			}}
		>
			{children}
		</SettingContext.Provider>
	);
};

const useSetting = (): SettingContextType => {
	const context = useContext(SettingContext);
	if (!context) {
		throw new Error('useSetting must be used within a SettingProvider');
	}
	return context;
};

export { SettingProvider, useSetting };
