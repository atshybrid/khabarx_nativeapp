
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  jwt: string | null;
  refreshToken: string | null;
  setAuthTokens: (jwt: string, refreshToken: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jwt, setJwt] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  const setAuthTokens = (newJwt: string, newRefreshToken: string) => {
    setJwt(newJwt);
    setRefreshToken(newRefreshToken);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedJwt = await AsyncStorage.getItem('jwt');
        const storedRefresh = await AsyncStorage.getItem('refreshToken');
        if (storedJwt && storedRefresh) {
          setAuthTokens(storedJwt, storedRefresh);
        }
      } catch (error) {
        console.error('Auth init failed', error);
      }
    };
    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ jwt, refreshToken, setAuthTokens }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
