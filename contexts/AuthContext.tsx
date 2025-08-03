import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../utils/supabase'; // Adjusted path
import { Session, User, AuthError } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import Constants from 'expo-constants';

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

// Helper to extract params from URL, needed for native OAuth callback
const getUrlParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const urlParts = url.split('#'); // OAuth tokens are often in the hash fragment
  if (urlParts.length > 1) {
    const hash = urlParts[1];
    const pairs = hash.split('&');
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    });
  }
  return params;
};

// Create the AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Attempt to get the initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
      console.log("[AuthContext] Initial session loaded:", initialSession ? `User: ${initialSession.user.id}` : 'No session');
    }).catch((error) => {
      console.error("[AuthContext] Error getting initial session:", error);
      setAuthError(error?.message || 'Failed to fetch initial session');
      setLoading(false);
    });

    // Set up an auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      console.log("[AuthContext] Auth state changed:", _event, currentSession ? `User: ${currentSession.user.id}` : 'No session');
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setAuthError(null); // Clear errors on state change
      setLoading(false); // Ensure loading is false after state changes
    });

    // Handle AppState changes for token refresh on native
    const handleAppStateChange = (nextAppState: string) => {
      if (Platform.OS !== 'web' && nextAppState === 'active') {
        // App came to foreground, refresh session potentially
         console.log("[AuthContext] App became active, attempting token refresh.");
         supabase.auth.startAutoRefresh();
      } else {
         supabase.auth.stopAutoRefresh();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
     console.log("[AuthContext] AppState listener added.");

    // Unsubscribe on cleanup
    return () => {
      console.log("[AuthContext] Cleaning up listeners.");
      subscription?.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  // Sign In with OTP
  const signIn = async (email: string) => {
    if (!email) {
      const errorMsg = "Email is required.";
      setAuthError(errorMsg);
      return { error: { name: 'InputError', message: errorMsg } as AuthError };
    }
    setLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: {
        emailRedirectTo: Linking.createURL('auth/callback')
      }
    });
    if (error) setAuthError(error.message);
    setLoading(false);
    return { error };
  };

  // Verify OTP
  const verifyOtp = async (email: string, token: string) => {
    if (!email || !token) {
      const errorMsg = "Email and verification code are required.";
      setAuthError(errorMsg);
      return { error: { name: 'InputError', message: errorMsg } as AuthError };
    }
    setLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'magiclink'
    });
    if (error) setAuthError(error.message);
    setLoading(false);
    return { error };
  };

  // Sign Up (now also uses OTP)
  const signUp = async (email: string) => {
    if (!email) {
      const errorMsg = "Email is required.";
      setAuthError(errorMsg);
      return { error: { name: 'InputError', message: errorMsg } as AuthError, session: null, user: null };
    }
    setLoading(true);
    setAuthError(null);
    
    // For new users, we'll just send them an OTP directly
    const { data, error } = await supabase.auth.signInWithOtp({ 
      email,
      options: {
        emailRedirectTo: Linking.createURL('auth/callback')
      }
    });
    
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError("Please check your email for the login link.");
    }
    setLoading(false);
    return { error, session: data?.session, user: data?.user };
  };

  // --- Sign Out ---
  const signOut = async () => {
    setLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
    // State updates handled by onAuthStateChange
    setLoading(false);
    return { error };
  };

  // --- Sign In with Google ---
  const signInWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    let authResponseError: AuthError | null = null;

    try {
      // Generate the correct redirect URI for native
      const redirectUri = makeRedirectUri({
        // Ensure the path starts with '/' if needed by createURL structure
        native: Linking.createURL('auth/callback', { scheme: 'calcai' }), 
        // Example for Expo Go: use Proxy
        // native: 'exp://192.168.0.X:8081/--/auth/callback' // Replace with your local IP
        // Use `scheme` parameter for bare/standalone if using custom scheme
        // scheme: 'calcai' 
      });
      console.log(`[signInWithGoogle] Corrected Redirect URI: ${redirectUri}`);

      if (Platform.OS === 'web') {
         console.log("[signInWithGoogle] Web platform detected. Using standard OAuth flow.");
         const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              // Use the same generated URI for consistency, or specific web origin if needed
              redirectTo: Linking.createURL('auth/callback'), // Or window.location.origin + '/auth/callback'
              queryParams: {
                 prompt: 'select_account', 
              },
            },
          });
          if (error) throw error;

      } else {
         console.log("[signInWithGoogle] Native platform detected. Using WebBrowser.");
         const { data, error: urlError } = await supabase.auth.signInWithOAuth({
           provider: 'google',
           options: {
             redirectTo: redirectUri, // Use the corrected URI
             skipBrowserRedirect: true, 
             queryParams: {
                 prompt: 'select_account', 
              },
           },
         });

         if (urlError) throw urlError;
         if (!data?.url) throw new Error("No OAuth URL returned from Supabase");

         console.log(`[signInWithGoogle] Opening WebBrowser with URL: ${data.url}`);
         const result = await WebBrowser.openAuthSessionAsync(
           data.url,
           redirectUri, // Pass the corrected URI here as well
           { showInRecents: true } 
         );

        console.log("[signInWithGoogle] WebBrowser result:", JSON.stringify(result));

        if (result.type === 'success') {
          // Extract tokens/params from the result URL (often in hash fragment)
          const params = getUrlParams(result.url);
           console.log("[signInWithGoogle] Extracted params from callback URL:", JSON.stringify(params)); // Log params

           if (params.error) {
              console.error("[signInWithGoogle] Error found in callback params:", params.error_description || params.error);
              throw new Error(params.error_description || params.error);
           }

          if (params.access_token && params.refresh_token) {
            console.log("[signInWithGoogle] Tokens found in URL, attempting manual setSession...");
            try {
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                  access_token: params.access_token,
                  refresh_token: params.refresh_token,
                });
                if (sessionError) {
                   console.error("[signInWithGoogle] Error during manual setSession:", sessionError);
                  throw sessionError;
                } else {
                   console.log("[signInWithGoogle] Manual setSession successful. Session User:", sessionData?.session?.user?.id);
                   // onAuthStateChange should fire now
                }
            } catch (setSessionCatchError) {
                 console.error("[signInWithGoogle] Caught exception during manual setSession:", setSessionCatchError);
                 throw setSessionCatchError; // Re-throw
            }
          } else {
             console.warn("[signInWithGoogle] No tokens found in callback URL fragment. Relying on onAuthStateChange/refreshSession.");
             // If tokens aren't in the fragment, Supabase might have set the session via cookies/storage
             // during the flow. The onAuthStateChange listener should ideally pick it up.
             // We might force a session refresh just in case.
             try {
                 console.log("[signInWithGoogle] Attempting refreshSession as fallback...");
                 const { error: refreshError } = await supabase.auth.refreshSession();
                 if (refreshError) {
                     console.error("[signInWithGoogle] Error during fallback refreshSession:", refreshError);
                 } else {
                     console.log("[signInWithGoogle] Fallback refreshSession completed.");
                 }
             } catch (refreshCatchError) {
                  console.error("[signInWithGoogle] Caught exception during fallback refreshSession:", refreshCatchError);
             }
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
           console.log("[signInWithGoogle] OAuth flow cancelled by user.");
           // Optionally set an error or just do nothing
           // setAuthError("Google Sign-In cancelled.");
        } else {
           throw new Error(`WebBrowser returned unexpected result type: ${result.type}`);
        }
      }
    } catch (error: any) {
      console.error('[signInWithGoogle] Error:', error);
       authResponseError = error instanceof AuthError ? error : { name: 'OAuthError', message: error?.message || 'An unknown OAuth error occurred' } as AuthError;
      setAuthError(authResponseError.message);
    } finally {
      setLoading(false);
    }
    return { error: authResponseError };
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

    if (Platform.OS === 'web') {
      // Web: Only protect webhook paths
      if (!session && isWebhookPath && !inAuthGroup) {
        console.log("[useProtectedRoute] Web: No session, webhook path, redirecting to login");
        router.replace('/auth/login');
      } else if (session && inAuthGroup) {
        console.log("[useProtectedRoute] Web: Session exists, in auth group, redirecting to /");
        router.replace('/');
      }
    } else {
      // Mobile: Protect all routes
      if (!session && !inAuthGroup) {
        console.log("[useProtectedRoute] Mobile: No session, redirecting to login");
        router.replace('/auth/login');
      } else if (session && inAuthGroup) {
        console.log("[useProtectedRoute] Mobile: Session exists, redirecting from auth group to /");
          // Clear the navigation stack and replace with root
          router.replace('/', { replace: true });
      }
      }
    };

    // Only navigate when loading is complete to prevent race conditions
    if (!loading) {
      // Use requestAnimationFrame to ensure navigation happens after current render
      requestAnimationFrame(navigate);
    }
  }, [session, loading, segments, router]);
}
