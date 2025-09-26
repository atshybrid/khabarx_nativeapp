import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';

type ThemeCtx = {
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => Promise<void>;
};

const Ctx = createContext<ThemeCtx>({ themePref: 'system', setThemePref: async () => {} });

export function ThemeProviderLocal({ children }: { children: React.ReactNode }) {
  const [themePref, setThemePrefState] = useState<ThemePref>('system');

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem('pref_theme');
      if (t === 'light' || t === 'dark' || t === 'system') setThemePrefState(t);
    })();
  }, []);

  const setThemePref = useCallback(async (t: ThemePref) => {
    setThemePrefState(t);
    await AsyncStorage.setItem('pref_theme', t);
  }, []);

  const value = useMemo(() => ({ themePref, setThemePref }), [themePref, setThemePref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useThemePref() {
  return useContext(Ctx);
}
