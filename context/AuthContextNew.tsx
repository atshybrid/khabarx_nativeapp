import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { clearTokens, isExpired, loadTokens, refreshTokens, saveTokens, type Tokens } from '../services/auth';
import { AuthErrorCode, AuthErrorHandler } from '../services/authErrors';
import { emit } from '../services/events';
import { autoSyncPreferences } from '../services/loginSync';

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
  const lastScheduledExpiryRef = useRef<number | undefined>(undefined);
  const lastBackgroundTime = useRef<number>(0);
  // Ref to hold latest refresh function to avoid cyclic deps in scheduleTokenRefresh
  const doRefreshTokenRef = useRef<(() => Promise<boolean>) | undefined>(undefined);
  // Ref to call the scheduler without adding it to effect deps
  const scheduleRef = useRef<(expiresAt?: number) => void>(() => {});

  // Clear any existing timeout
  const clearRefreshTimeout = useCallback((): void => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = undefined;
    }
  }, []);

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback((expiresAt?: number): void => {
    // If no expiry provided, cancel any scheduled refresh
    if (!expiresAt) {
      clearRefreshTimeout();
      lastScheduledExpiryRef.current = undefined;
      return;
    }

    // Skip rescheduling if we already scheduled for the same expiry and timer is active
    if (lastScheduledExpiryRef.current === expiresAt && refreshTimeoutRef.current) {
      return;
    }

    // Replace any existing timer and schedule a new one
    clearRefreshTimeout();
    lastScheduledExpiryRef.current = expiresAt;

    // Refresh token 5 minutes before expiry
    const refreshTime = expiresAt - (5 * 60 * 1000);
    const delay = Math.max(0, refreshTime - Date.now());

    if (delay > 0) {
      refreshTimeoutRef.current = setTimeout(() => {
        console.log('[AUTH] Scheduled token refresh triggered');
        // Call latest version via ref to avoid useCallback cyclic deps
        doRefreshTokenRef.current?.();
      }, delay);

      console.log(`[AUTH] Token refresh scheduled in ${Math.round(delay / 1000)}s`);
    }
  }, [clearRefreshTimeout]);

  // Refresh token function (internal)
  const doRefreshToken = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[AUTH] Refreshing token...');
      // Avoid noisy errors if there are no tokens/refresh token available
      const existing = await loadTokens();
      if (!existing?.refreshToken) {
        console.log('[AUTH] Skip token refresh (no refresh token present)');
        return false;
      }
      
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

      // Schedule next refresh
      scheduleTokenRefresh(newTokens.expiresAt);
      
      console.log('[AUTH] Token refresh successful');
      return true;
      
    } catch (error) {
      console.warn('[AUTH] Token refresh failed:', error);
      
      const authError = AuthErrorHandler.handle(error, 'token_refresh');
      dispatch({ type: 'TOKEN_REFRESH_ERROR', payload: authError.userMessage });
      
      // If refresh fails with auth error, logout user
      if (authError.code === AuthErrorCode.TOKEN_INVALID || 
          authError.code === AuthErrorCode.REFRESH_FAILED) {
        clearRefreshTimeout();
        await clearTokens();
        await AsyncStorage.removeItem('profile_role');
        dispatch({ type: 'LOGOUT' });
        
        try {
          router.replace('/language');
        } catch (navError) {
          console.warn('[AUTH] Navigation after logout failed:', navError);
        }
      }
      
      return false;
    }
  }, [state.user, scheduleTokenRefresh, clearRefreshTimeout]);

  // Keep ref in sync with latest doRefreshToken implementation
  useEffect(() => {
    doRefreshTokenRef.current = doRefreshToken;
  }, [doRefreshToken]);

  // Keep schedule ref in sync with latest implementation
  useEffect(() => {
    scheduleRef.current = scheduleTokenRefresh;
  }, [scheduleTokenRefresh]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      try {
        dispatch({ type: 'LOADING', payload: true });

        const tokens = await loadTokens();
        if (!tokens) {
          if (mounted) dispatch({ type: 'LOADING', payload: false });
          return;
        }

        // Check if token is expired
        if (isExpired(tokens.expiresAt)) {
          console.log('[AUTH] Token expired, attempting refresh');
          const ok = await doRefreshTokenRef.current?.();
          if (!ok) {
            // refreshToken handles logout internally now
            return;
          }
          return; // refresh will update state
        }

        // Token is valid, set authenticated state
        const user: User = {
          id: tokens.user?.id || tokens.user?.userId || 'unknown',
          role: tokens.user?.role || 'Guest',
          languageId: tokens.languageId,
          ...tokens.user,
        };

        if (mounted) {
          dispatch({ type: 'LOGIN_SUCCESS', payload: { tokens, user } });
          scheduleRef.current?.(tokens.expiresAt);
          // Background preference sync on app start when already authenticated
          autoSyncPreferences('app_start').catch(() => {});
        }
      } catch (error) {
        console.error('[AUTH] Initialization failed:', error);
        const authError = AuthErrorHandler.handle(error, 'auth_initialization');
        if (mounted) dispatch({ type: 'LOGIN_ERROR', payload: authError.userMessage });
        await clearTokens();
      }
    };

    initializeAuth();
    return () => { mounted = false; };
  }, []);

  // (moved below isTokenExpired/logout definitions)

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
      
  console.log('[AUTH] Login successful', { role: user.role, userId: user.id });

  // After login, reconcile push token, language, and location with server
  autoSyncPreferences('login').catch(() => {});

  // Ask News tab to refresh after login
  try { emit('news:refresh', { reason: 'login' }); } catch {}
      
    } catch (error) {
      const authError = AuthErrorHandler.handle(error, 'login');
      dispatch({ type: 'LOGIN_ERROR', payload: authError.userMessage });
      throw authError;
    }
  }, [scheduleTokenRefresh]);

  // Logout function
  const logout = useCallback(async (reason?: string) => {
    try {
      clearRefreshTimeout();
      await clearTokens();
      await AsyncStorage.removeItem('profile_role');
      
      dispatch({ type: 'LOGOUT' });
      
      console.log('[AUTH] Logout completed', { reason });
  // Ask News tab to refresh in guest mode
  try { emit('news:refresh', { reason: 'logout' }); } catch {}
      
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

  // (duplicate refreshToken removed)

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
      const refreshSuccess = await doRefreshToken();
      if (!refreshSuccess) {
        return null;
      }
      // Get updated token from state after refresh
      const updatedTokens = await loadTokens();
      return updatedTokens?.jwt || null;
    }

    return state.tokens.jwt;
  }, [state.tokens, isTokenExpired, doRefreshToken]);

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
          if (isTokenExpired()) {
            const refreshSuccess = await doRefreshToken();
            if (!refreshSuccess) {
              await logout('Session expired while app was in background');
            }
          }
          // Also reconcile preferences (language, push token, location) after foreground
          try { await autoSyncPreferences('foreground'); } catch {}
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [state.isAuthenticated, isTokenExpired, doRefreshToken, logout]);

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken: doRefreshToken,
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