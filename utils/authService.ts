/**
 * Authentication Service
 * Handles communication with Cloudflare Worker for authentication
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { AUTH_ENDPOINTS, STORAGE_KEYS } from '../constants/Config';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface Session {
  sessionToken: string;
  user: User;
  expiresIn: number;
}

export interface AuthError {
  name: string;
  message: string;
}

/**
 * Initiates Google OAuth flow
 */
export async function signInWithGoogle(): Promise<{ error: AuthError | null; session: Session | null }> {
  try {
    const platform = Platform.OS === 'web' ? 'web' : 'mobile';
    
    // Get auth URL from worker
    const response = await fetch(`${AUTH_ENDPOINTS.GOOGLE_AUTH}?platform=${platform}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      return { 
        error: { name: 'AuthError', message: errorData.error || 'Failed to initiate authentication' },
        session: null 
      };
    }

    const { authUrl, state } = await response.json();

    if (Platform.OS === 'web') {
      // For web, redirect to Google OAuth
      window.location.href = authUrl;
      return { error: null, session: null };
    } else {
      // For mobile, use WebBrowser
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'calcai://auth/callback'
      );

      if (result.type === 'success' && result.url) {
        // Parse callback URL
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (!code || returnedState !== state) {
          return {
            error: { name: 'AuthError', message: 'Invalid callback parameters' },
            session: null
          };
        }

        // Exchange code for session
        const callbackUrl = `${AUTH_ENDPOINTS.CALLBACK}?code=${code}&state=${returnedState}`;
        const sessionResponse = await fetch(callbackUrl);

        if (!sessionResponse.ok) {
          const errorData = await sessionResponse.json();
          return {
            error: { name: 'AuthError', message: errorData.error || 'Failed to create session' },
            session: null
          };
        }

        const sessionData = await sessionResponse.json();

        // Store session
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, sessionData.sessionToken);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(sessionData.user));

        return { error: null, session: sessionData };
      } else {
        return {
          error: { name: 'AuthError', message: 'Authentication cancelled' },
          session: null
        };
      }
    }
  } catch (error: any) {
    console.error('signInWithGoogle error:', error);
    return {
      error: { name: 'AuthError', message: error.message || 'Authentication failed' },
      session: null
    };
  }
}

/**
 * Verifies the current session token
 */
export async function verifySession(): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
    
    if (!token) {
      return { user: null, error: null };
    }

    const response = await fetch(AUTH_ENDPOINTS.VERIFY, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Token is invalid or expired
      await clearSession();
      return { user: null, error: null };
    }

    const data = await response.json();
    
    if (data.valid && data.user) {
      // Update stored user data
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
      return { user: data.user, error: null };
    }

    return { user: null, error: null };
  } catch (error: any) {
    console.error('verifySession error:', error);
    return {
      user: null,
      error: { name: 'VerifyError', message: error.message || 'Failed to verify session' }
    };
  }
}

/**
 * Refreshes the session token
 */
export async function refreshSession(): Promise<{ success: boolean; error: AuthError | null }> {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
    
    if (!token) {
      return { success: false, error: { name: 'RefreshError', message: 'No session to refresh' } };
    }

    const response = await fetch(AUTH_ENDPOINTS.REFRESH, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      await clearSession();
      return { success: false, error: { name: 'RefreshError', message: 'Failed to refresh session' } };
    }

    const data = await response.json();
    
    // Update stored token
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.sessionToken);
    
    return { success: true, error: null };
  } catch (error: any) {
    console.error('refreshSession error:', error);
    return {
      success: false,
      error: { name: 'RefreshError', message: error.message || 'Failed to refresh session' }
    };
  }
}

/**
 * Signs out the user
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
    
    if (token) {
      // Call logout endpoint to invalidate session on server
      await fetch(AUTH_ENDPOINTS.LOGOUT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }

    // Clear local session
    await clearSession();
    
    return { error: null };
  } catch (error: any) {
    console.error('signOut error:', error);
    // Still clear local session even if server call fails
    await clearSession();
    return { error: null };
  }
}

/**
 * Clears local session data
 */
async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
  await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
}

/**
 * Gets stored user data
 */
export async function getStoredUser(): Promise<User | null> {
  try {
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('getStoredUser error:', error);
    return null;
  }
}
