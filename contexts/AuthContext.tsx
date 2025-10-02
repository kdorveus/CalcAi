import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { usePostHog } from './PostHogContext';
import * as authService from '../utils/authService';

// Import types from auth service
type User = authService.User;
type Session = authService.Session | null;
type AuthError = authService.AuthError;

// Define the shape of the context data
type AuthContextType = {
  signIn: (email: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string) => Promise<{ error: AuthError | null, session: Session | null, user: User | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>;
  user: User | null;
  session: Session | null;
  loading: boolean; // Indicates initial session load AND ongoing auth operations
  authError: string | null; // Store auth errors
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null, session: null, user: null }),
  signOut: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  verifyOtp: async () => ({ error: null }),
  user: null,
  session: null,
  loading: true, // Start loading true
  authError: null,
});

// Define props for the AuthProvider
interface AuthProviderProps {
  children: ReactNode;
}


// Create the AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const { resetUser: postHogReset, identifyUser } = usePostHog();

  useEffect(() => {
    // Check for existing session on mount
    const initializeAuth = async () => {
      try {
        // Try to get stored user first for immediate UI update
        const storedUser = await authService.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }

        // Verify session with server
        const { user: verifiedUser, error } = await authService.verifySession();
        
        if (error) {
          setAuthError(error.message);
          setUser(null);
          setSession(null);
        } else if (verifiedUser) {
          identifyUser(verifiedUser.id, { email: verifiedUser.email, name: verifiedUser.name });
          setUser(verifiedUser);
          setSession({ sessionToken: '', user: verifiedUser, expiresIn: 0 }); // Token is stored in AsyncStorage
        } else {
          setUser(null);
          setSession(null);
        }
      } catch (error: any) {
        setAuthError(error.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Sign In - Email/password not implemented yet
  const signIn = async (email: string) => {
    setAuthError("Please use Google Sign-In");
    return { error: { name: 'NotImplemented', message: 'Email sign-in not implemented' } as AuthError };
  };

  // Verify OTP - Not implemented yet
  const verifyOtp = async (email: string, token: string) => {
    return { error: { name: 'NotImplemented', message: 'OTP verification not implemented' } as AuthError };
  };

  // Sign Up - Email/password not implemented yet
  const signUp = async (email: string) => {
    setAuthError("Please use Google Sign-In");
    return { error: { name: 'NotImplemented', message: 'Email sign-up not implemented' } as AuthError, session: null, user: null };
  };

  // Sign Out
  const signOut = async () => {
    try {
      setLoading(true);
      
      const { error } = await authService.signOut();
      
      if (error) {
        setAuthError(error.message);
        return { error };
      }
      
      setSession(null);
      setUser(null);
      postHogReset();
      setAuthError(null);
      
      return { error: null };
    } catch (error: any) {
      setAuthError(error.message);
      return { error: { name: 'SignOutError', message: error.message } as AuthError };
    } finally {
      setLoading(false);
    }
  };

  // Sign In with Google
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      
      const { error, session: newSession } = await authService.signInWithGoogle();
      
      if (error) {
        setAuthError(error.message);
        return { error };
      }
      
      if (newSession) {
        setUser(newSession.user);
        setSession(newSession);
        setAuthError(null);
      }
      
      return { error: null };
    } catch (error: any) {
      const authError = { name: 'GoogleAuthError', message: error.message } as AuthError;
      setAuthError(error.message);
      return { error: authError };
    } finally {
      setLoading(false);
    }
  };


  return (
    <AuthContext.Provider
      value={{
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        verifyOtp,
        user,
        session,
        loading,
        authError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Export the hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Custom hook for route protection (can be used in root layout)
export function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    const navigate = () => {
    const inAuthGroup = segments[0] === 'auth';
    const isWebhookPath = segments.includes('webhook');

    // TODO: Re-enable route protection once Cloudflare auth is integrated
    // For now, allow all routes without authentication
    };

    // Only navigate when loading is complete to prevent race conditions
    if (!loading) {
      // Use requestAnimationFrame to ensure navigation happens after current render
      requestAnimationFrame(navigate);
    }
  }, [session, loading, segments, router]);
}
