import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
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

  useEffect(() => {
    // Check for existing session on mount
    const initializeAuth = async () => {
      try {
        console.log("[AuthContext] Initializing authentication...");
        
        // Try to get stored user first for immediate UI update
        const storedUser = await authService.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }

        // Verify session with server
        const { user: verifiedUser, error } = await authService.verifySession();
        
        if (error) {
          console.error("[AuthContext] Session verification error:", error);
          setAuthError(error.message);
          setUser(null);
          setSession(null);
        } else if (verifiedUser) {
          console.log("[AuthContext] Session verified for user:", verifiedUser.email);
          setUser(verifiedUser);
          setSession({ sessionToken: '', user: verifiedUser, expiresIn: 0 }); // Token is stored in AsyncStorage
        } else {
          console.log("[AuthContext] No active session");
          setUser(null);
          setSession(null);
        }
      } catch (error: any) {
        console.error("[AuthContext] Initialization error:", error);
        setAuthError(error.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Sign In - Email/password not implemented yet
  const signIn = async (email: string) => {
    console.log("[AuthContext] Email sign-in not implemented - use Google Sign-In");
    setAuthError("Please use Google Sign-In");
    return { error: { name: 'NotImplemented', message: 'Email sign-in not implemented' } as AuthError };
  };

  // Verify OTP - Not implemented yet
  const verifyOtp = async (email: string, token: string) => {
    console.log("[AuthContext] OTP verification not implemented");
    return { error: { name: 'NotImplemented', message: 'OTP verification not implemented' } as AuthError };
  };

  // Sign Up - Email/password not implemented yet
  const signUp = async (email: string) => {
    console.log("[AuthContext] Email sign-up not implemented - use Google Sign-In");
    setAuthError("Please use Google Sign-In");
    return { error: { name: 'NotImplemented', message: 'Email sign-up not implemented' } as AuthError, session: null, user: null };
  };

  // Sign Out
  const signOut = async () => {
    try {
      setLoading(true);
      console.log("[AuthContext] Signing out...");
      
      const { error } = await authService.signOut();
      
      if (error) {
        console.error("[AuthContext] Sign out error:", error);
        setAuthError(error.message);
        return { error };
      }
      
      setSession(null);
      setUser(null);
      setAuthError(null);
      console.log("[AuthContext] Sign out successful");
      
      return { error: null };
    } catch (error: any) {
      console.error("[AuthContext] Sign out exception:", error);
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
      console.log("[AuthContext] Initiating Google sign-in...");
      
      const { error, session: newSession } = await authService.signInWithGoogle();
      
      if (error) {
        console.error("[AuthContext] Google sign-in error:", error);
        setAuthError(error.message);
        return { error };
      }
      
      if (newSession) {
        console.log("[AuthContext] Google sign-in successful for:", newSession.user.email);
        setUser(newSession.user);
        setSession(newSession);
        setAuthError(null);
      }
      
      return { error: null };
    } catch (error: any) {
      console.error("[AuthContext] Google sign-in exception:", error);
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

    console.log(`[useProtectedRoute] Loading: ${loading}, Session: ${!!session}, Segments: ${segments.join('/')}, InAuthGroup: ${inAuthGroup}`);

    // TODO: Re-enable route protection once Cloudflare auth is integrated
    // For now, allow all routes without authentication
    console.log("[useProtectedRoute] Route protection disabled - awaiting Cloudflare integration");
    };

    // Only navigate when loading is complete to prevent race conditions
    if (!loading) {
      // Use requestAnimationFrame to ensure navigation happens after current render
      requestAnimationFrame(navigate);
    }
  }, [session, loading, segments, router]);
}
