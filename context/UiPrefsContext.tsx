import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type UiPrefs = {
  fontScale: number;
  readingMode: boolean;
  setFontScale: (n: number) => Promise<void>;
  setReadingMode: (v: boolean) => Promise<void>;
};

const Ctx = createContext<UiPrefs>({
  fontScale: 1,
  readingMode: false,
  setFontScale: async () => {},
  setReadingMode: async () => {},
});

export function UiPrefsProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScaleState] = useState(1);
  const [readingMode, setReadingModeState] = useState(false);

  useEffect(() => {
    (async () => {
      const fs = await AsyncStorage.getItem('pref_font_scale');
      const rm = await AsyncStorage.getItem('pref_reading_mode');
      if (fs) setFontScaleState(Number(fs) || 1);
      setReadingModeState(rm === '1');
    })();
  }, []);

  const setFontScale = useCallback(async (n: number) => {
    setFontScaleState(n);
    await AsyncStorage.setItem('pref_font_scale', String(n));
  }, []);
  const setReadingMode = useCallback(async (v: boolean) => {
    setReadingModeState(v);
    await AsyncStorage.setItem('pref_reading_mode', v ? '1' : '0');
  }, []);

  const value = useMemo(() => ({ fontScale, readingMode, setFontScale, setReadingMode }), [fontScale, readingMode, setFontScale, setReadingMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUiPrefs() {
  return useContext(Ctx);
}
