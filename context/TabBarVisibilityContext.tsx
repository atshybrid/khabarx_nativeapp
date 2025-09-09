import React, { createContext, useContext, useState } from 'react';

type TabBarVisibilityContextType = {
  isTabBarVisible: boolean;
  setTabBarVisible: (visible: boolean) => void;
};

export const TabBarVisibilityContext = createContext<TabBarVisibilityContextType | undefined>(
  undefined
);

export const TabBarVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Start hidden by default
  const [isTabBarVisible, setTabBarVisible] = useState(false);

  return (
    <TabBarVisibilityContext.Provider value={{ isTabBarVisible, setTabBarVisible }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
};

export const useTabBarVisibility = () => {
  const context = useContext(TabBarVisibilityContext);
  if (context === undefined) {
    throw new Error('useTabBarVisibility must be used within a TabBarVisibilityProvider');
  }
  return context;
};
