import { useThemePref } from '@/context/ThemeContext';
import { useColorScheme as useRNColorScheme } from 'react-native';

// Returns the effective color scheme for the app, honoring the user's preference
// set in Appearance (ThemeContext): 'system' | 'light' | 'dark'.
// Many components read Colors[scheme], so this must reflect the app's chosen theme.
export function useColorScheme(): 'light' | 'dark' {
	const system = useRNColorScheme() ?? 'light';
	const { themePref } = useThemePref();
	const effective = themePref === 'system' ? system : themePref;
	// Ensure we only return 'light' | 'dark'
	return effective === 'dark' ? 'dark' : 'light';
}
