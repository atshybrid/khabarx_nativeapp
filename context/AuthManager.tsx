import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { clearTokens, isExpired, loadTokens, refreshTokens, saveTokens, type Tokens } from '../services/auth';
import { AuthErrorCode, AuthErrorHandler } from '../services/authErrors';
import { registerPushTokenWithBackend } from '../services/notifications';

// Auth state types
export interface User {
  id: string;
  role: string;
  languageId?: string;
  name?: string;
  email?: string;
  mobileNumber?: string;
}

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  tokens: Tokens | null;
  error: string | null;
  lastRefreshAttempt: number | null;
}

// Auth actions
type AuthAction =
  | { type: 'LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: { tokens: Tokens; user: User } }
  | { type: 'LOGIN_ERROR'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'TOKEN_REFRESH_SUCCESS'; payload: Tokens }
  | { type: 'TOKEN_REFRESH_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

// Initial state
const initialState: AuthState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  tokens: null,
  error: null,
  lastRefreshAttempt: null,
};

// Auth reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        tokens: action.payload.tokens,
        error: null,
      };
    
    case 'LOGIN_ERROR':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        tokens: null,
        error: action.payload,
      };
    
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    
    case 'TOKEN_REFRESH_SUCCESS':
      return {
        ...state,
        tokens: action.payload,
        error: null,
        lastRefreshAttempt: Date.now(),
      };
    
    case 'TOKEN_REFRESH_ERROR':
      return {
        ...state,
        error: action.payload,
        lastRefreshAttempt: Date.now(),
      };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
}

// Auth context interface
interface AuthContextType extends AuthState {
  login: (tokens: Tokens, user: User) => Promise<void>;
  logout: (reason?: string) => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
  isTokenExpired: () => boolean;
  getValidToken: () => Promise<string | null>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastBackgroundTime = useRef<number>(0);

  // Clear any existing timeout
  const clearRefreshTimeout = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = undefined;
    }
  }, []);

  // Logout function
  const logout = useCallback(async (reason?: string) => {
    try {
      clearRefreshTimeout();
      await clearTokens();
      await AsyncStorage.removeItem('profile_role');
      
      dispatch({ type: 'LOGOUT' });
      
      console.log('[AUTH] Logout completed', { reason });
      
      // Navigate to appropriate screen
      try {
        router.replace('/');
      } catch (error) {
        console.warn('[AUTH] Navigation after logout failed:', error);
      }
      
    } catch (error) {
      console.error('[AUTH] Logout error:', error);
      // Still dispatch logout even if cleanup fails
      dispatch({ type: 'LOGOUT' });
    }
  }, [clearRefreshTimeout]);

  // Refresh token function
  const refreshTokenFn = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[AUTH] Refreshing token...');
      
      const newTokens = await refreshTokens();
      
      dispatch({ type: 'TOKEN_REFRESH_SUCCESS', payload: newTokens });
      
      // Update user info if provided in refresh response
      if (newTokens.user && state.user) {
        const updatedUser: User = { ...state.user, ...newTokens.user };
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { tokens: newTokens, user: updatedUser },
        });
      }
      
      console.log('[AUTH] Token refresh successful');
      return true;
      
    } catch (error) {
      console.error('[AUTH] Token refresh failed:', error);
      
      const authError = AuthErrorHandler.handle(error, 'token_refresh');
      dispatch({ type: 'TOKEN_REFRESH_ERROR', payload: authError.userMessage });
      
      // If refresh fails with auth error, logout user
      if (authError.code === AuthErrorCode.TOKEN_INVALID || 
          authError.code === AuthErrorCode.REFRESH_FAILED) {
        await logout('Token refresh failed');
      }
      
      return false;
    }
  }, [state.user, logout]);

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback((expiresAt?: number) => {
    clearRefreshTimeout();
    
    if (!expiresAt) return;
    
    // Refresh token 5 minutes before expiry
    const refreshTime = expiresAt - (5 * 60 * 1000);
    const delay = Math.max(0, refreshTime - Date.now());
    
    if (delay > 0) {
      refreshTimeoutRef.current = setTimeout(() => {
        console.log('[AUTH] Scheduled token refresh triggered');
        refreshTokenFn();
      }, delay);
      
      console.log(`[AUTH] Token refresh scheduled in ${Math.round(delay / 1000)}s`);
    }
  }, [clearRefreshTimeout, refreshTokenFn]);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: 'LOADING', payload: true });
        
        const tokens = await loadTokens();
        if (!tokens) {
          dispatch({ type: 'LOADING', payload: false });
          return;
        }

        // Check if token is expired
        if (isExpired(tokens.expiresAt)) {
          console.log('[AUTH] Token expired, attempting refresh');
          const refreshSuccess = await refreshTokenFn();
          if (!refreshSuccess) {
            return; // refreshTokenFn handles logout internally
          }
          return; // refreshTokenFn will update the state
        }

        // Token is valid, set authenticated state
        const user: User = {
          id: tokens.user?.id || tokens.user?.userId || 'unknown',
          role: tokens.user?.role || 'Guest',
          languageId: tokens.languageId,
          ...tokens.user,
        };

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { tokens, user },
        });

  // Schedule refresh for valid token
  scheduleTokenRefresh(tokens.expiresAt);
  // Best-effort: register device push token with backend (async, non-blocking)
  try { registerPushTokenWithBackend().catch(() => {}); } catch {}
        
      } catch (error) {
        console.error('[AUTH] Initialization failed:', error);
        const authError = AuthErrorHandler.handle(error, 'auth_initialization');
        dispatch({ type: 'LOGIN_ERROR', payload: authError.userMessage });
        await clearTokens();
      }
    };

    initializeAuth();
  }, [refreshTokenFn, scheduleTokenRefresh]);

  // Handle app state changes for background/foreground token validation
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        lastBackgroundTime.current = Date.now();
      } else if (nextAppState === 'active' && lastBackgroundTime.current > 0) {
        const backgroundDuration = Date.now() - lastBackgroundTime.current;
        
        // If app was in background for more than 5 minutes, validate token
        if (backgroundDuration > 5 * 60 * 1000 && state.isAuthenticated) {
          console.log('[AUTH] App returned from background, validating token');
          
          if (isExpired(state.tokens?.expiresAt)) {
            const refreshSuccess = await refreshTokenFn();
            if (!refreshSuccess) {
              await logout('Session expired while app was in background');
            }
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [state.isAuthenticated, state.tokens?.expiresAt, refreshTokenFn, logout]);

  // Login function
  const login = useCallback(async (tokens: Tokens, user: User) => {
    try {
      await saveTokens(tokens);
      
      // Save role to AsyncStorage for persistence
      if (user.role) {
        await AsyncStorage.setItem('profile_role', user.role);
      }

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { tokens, user },
      });

  // Schedule token refresh
  scheduleTokenRefresh(tokens.expiresAt);
  // After login, register device push token with backend (async, non-blocking)
  try { registerPushTokenWithBackend().catch(() => {}); } catch {}
      
      console.log('[AUTH] Login successful', { role: user.role, userId: user.id });
      
    } catch (error) {
      const authError = AuthErrorHandler.handle(error, 'login');
      dispatch({ type: 'LOGIN_ERROR', payload: authError.userMessage });
      throw authError;
    }
  }, [scheduleTokenRefresh]);

  // Check if token is expired
  const isTokenExpired = useCallback((): boolean => {
    return isExpired(state.tokens?.expiresAt);
  }, [state.tokens?.expiresAt]);

  // Get valid token (with automatic refresh if needed)
  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!state.tokens?.jwt) {
      return null;
    }

    if (isTokenExpired()) {
      console.log('[AUTH] Token expired, attempting refresh for request');
      const refreshSuccess = await refreshTokenFn();
      if (!refreshSuccess) {
        return null;
      }
      // Get updated token from state after refresh
      const updatedTokens = await loadTokens();
      return updatedTokens?.jwt || null;
    }

    return state.tokens.jwt;
  }, [state.tokens, isTokenExpired, refreshTokenFn]);

  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRefreshTimeout();
    };
  }, [clearRefreshTimeout]);

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken: refreshTokenFn,
    clearError,
    isTokenExpired,
    getValidToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protected routes
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { isLoading, isAuthenticated } = useAuth();
    
    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.replace('/auth/login');
      }
    }, [isLoading, isAuthenticated]);

    if (isLoading) {
      return null; // Or loading spinner
    }

    if (!isAuthenticated) {
      return null; // Will redirect in useEffect
    }

    return <Component {...props} />;
  };
}