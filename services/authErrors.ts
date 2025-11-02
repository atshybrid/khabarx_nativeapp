// Authentication error types and handling utilities
export enum AuthErrorCode {
  // Token errors
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_MISSING = 'TOKEN_MISSING',
  REFRESH_FAILED = 'REFRESH_FAILED',
  
  // Google Auth errors
  GOOGLE_SIGNIN_CANCELLED = 'GOOGLE_SIGNIN_CANCELLED',
  GOOGLE_SIGNIN_FAILED = 'GOOGLE_SIGNIN_FAILED',
  GOOGLE_PLAY_SERVICES_MISSING = 'GOOGLE_PLAY_SERVICES_MISSING',
  FIREBASE_EXCHANGE_FAILED = 'FIREBASE_EXCHANGE_FAILED',
  
  // API errors
  API_NETWORK_ERROR = 'API_NETWORK_ERROR',
  API_SERVER_ERROR = 'API_SERVER_ERROR',
  API_VALIDATION_ERROR = 'API_VALIDATION_ERROR',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  
  // User creation errors
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_CREATION_FAILED = 'USER_CREATION_FAILED',
  LOCATION_PERMISSION_DENIED = 'LOCATION_PERMISSION_DENIED',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

export interface AuthError extends Error {
  code: AuthErrorCode;
  userMessage: string;
  originalError?: Error;
  context?: Record<string, any>;
}

export class AuthenticationError extends Error implements AuthError {
  code: AuthErrorCode;
  userMessage: string;
  originalError?: Error;
  context?: Record<string, any>;

  constructor(
    code: AuthErrorCode,
    message: string,
    userMessage: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.userMessage = userMessage;
    this.originalError = originalError;
    this.context = context;
  }

  static fromGoogleSignInError(error: any): AuthenticationError {
    const message = error?.message || 'Google Sign-In failed';
    
    if (message.includes('SIGN_IN_CANCELLED') || message.includes('cancelled')) {
      return new AuthenticationError(
        AuthErrorCode.GOOGLE_SIGNIN_CANCELLED,
        message,
        'Sign-in was cancelled. Please try again.',
        error
      );
    }
    
    if (message.includes('PLAY_SERVICES')) {
      return new AuthenticationError(
        AuthErrorCode.GOOGLE_PLAY_SERVICES_MISSING,
        message,
        'Google Play Services is required. Please update Google Play Services and try again.',
        error
      );
    }
    
    return new AuthenticationError(
      AuthErrorCode.GOOGLE_SIGNIN_FAILED,
      message,
      'Google Sign-In failed. Please check your internet connection and try again.',
      error
    );
  }

  static fromNetworkError(error: any): AuthenticationError {
    const message = error?.message || 'Network request failed';
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return new AuthenticationError(
        AuthErrorCode.API_NETWORK_ERROR,
        message,
        'Request timed out. Please check your internet connection and try again.',
        error
      );
    }
    
    if (message.includes('Network request failed')) {
      return new AuthenticationError(
        AuthErrorCode.API_NETWORK_ERROR,
        message,
        'Unable to connect to server. Please check your internet connection.',
        error
      );
    }
    
    return new AuthenticationError(
      AuthErrorCode.API_NETWORK_ERROR,
      message,
      'Network error occurred. Please try again.',
      error
    );
  }

  static fromHttpError(error: any, context?: Record<string, any>): AuthenticationError {
    const status = error?.status;
    const message = error?.message || error?.body?.message || 'HTTP error';
    
    switch (status) {
      case 401:
        return new AuthenticationError(
          AuthErrorCode.TOKEN_INVALID,
          message,
          'Your session has expired. Please sign in again.',
          error,
          context
        );
      
      case 403:
        return new AuthenticationError(
          AuthErrorCode.TOKEN_INVALID,
          message,
          'Access denied. Please sign in again.',
          error,
          context
        );
      
      case 409:
        return new AuthenticationError(
          AuthErrorCode.USER_ALREADY_EXISTS,
          message,
          'An account with this information already exists.',
          error,
          context
        );
      
      case 422:
        return new AuthenticationError(
          AuthErrorCode.API_VALIDATION_ERROR,
          message,
          'Invalid information provided. Please check your details and try again.',
          error,
          context
        );
      
      case 429:
        return new AuthenticationError(
          AuthErrorCode.API_RATE_LIMITED,
          message,
          'Too many requests. Please wait a moment and try again.',
          error,
          context
        );
      
      case 500:
      case 502:
      case 503:
      case 504:
        return new AuthenticationError(
          AuthErrorCode.API_SERVER_ERROR,
          message,
          'Server error occurred. Please try again later.',
          error,
          context
        );
      
      default:
        return new AuthenticationError(
          AuthErrorCode.UNKNOWN_ERROR,
          message,
          'An error occurred. Please try again.',
          error,
          context
        );
    }
  }

  static fromUnknownError(error: any, context?: Record<string, any>): AuthenticationError {
    const message = error?.message || 'Unknown error occurred';
    
    return new AuthenticationError(
      AuthErrorCode.UNKNOWN_ERROR,
      message,
      'An unexpected error occurred. Please try again.',
      error,
      context
    );
  }
}

// Error handler utility
export class AuthErrorHandler {
  private static logError(error: AuthError, context: string) {
    // Downgrade noise for expected refresh failures to warnings to avoid red LogBox overlays in dev
    const isRefreshNoise =
      context === 'token_refresh' &&
      (error.code === AuthErrorCode.TOKEN_INVALID || error.code === AuthErrorCode.REFRESH_FAILED);
    const logger = isRefreshNoise ? console.warn : console.error;
    logger(`[AUTH_ERROR] ${context}:`, {
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      context: error.context,
      stack: error.stack,
    });
  }

  static handle(error: any, context: string): AuthError {
    let authError: AuthError;

    if (error instanceof AuthenticationError) {
      authError = error;
    } else if (error?.code?.includes?.('GOOGLE') || error?.message?.includes?.('Google')) {
      authError = AuthenticationError.fromGoogleSignInError(error);
    } else if (error?.status) {
      authError = AuthenticationError.fromHttpError(error, { context });
    } else if (error?.message?.includes?.('Network') || error?.message?.includes?.('timeout')) {
      authError = AuthenticationError.fromNetworkError(error);
    } else {
      authError = AuthenticationError.fromUnknownError(error, { context });
    }

    this.logError(authError, context);
    return authError;
  }

  static getUserMessage(error: any, fallback = 'An error occurred'): string {
    if (error instanceof AuthenticationError) {
      return error.userMessage;
    }
    return fallback;
  }
}

// Retry utility for network requests
export class RetryUtil {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry for certain error types
        if (error instanceof AuthenticationError) {
          const nonRetryableCodes = [
            AuthErrorCode.GOOGLE_SIGNIN_CANCELLED,
            AuthErrorCode.TOKEN_INVALID,
            AuthErrorCode.USER_ALREADY_EXISTS,
            AuthErrorCode.API_VALIDATION_ERROR,
            AuthErrorCode.LOCATION_PERMISSION_DENIED,
          ];
          
          if (nonRetryableCodes.includes(error.code)) {
            throw error;
          }
        }
        
        // Don't retry on final attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retry with exponential backoff
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`[RETRY] Attempt ${attempt + 1} after ${delay}ms delay`);
      }
    }
    
    throw lastError;
  }
}