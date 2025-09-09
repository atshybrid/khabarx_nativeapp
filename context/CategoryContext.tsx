import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type CategoryContextType = {
  selectedCategory: string | null;
  setSelectedCategory: (key: string | null) => void;
  ready: boolean;
};

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCategory, setSelectedCategoryState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('selectedCategory');
        if (saved) setSelectedCategoryState(saved);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setSelectedCategory = (key: string | null) => {
    setSelectedCategoryState(key);
    // Fire and forget persistence
    if (key) AsyncStorage.setItem('selectedCategory', key);
    else AsyncStorage.removeItem('selectedCategory');
  };

  const value = useMemo(
    () => ({ selectedCategory, setSelectedCategory, ready }),
    [selectedCategory, ready]
  );

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
};

export const useCategory = () => {
  const ctx = useContext(CategoryContext);
  if (!ctx) throw new Error('useCategory must be used within a CategoryProvider');
  return ctx;
};
