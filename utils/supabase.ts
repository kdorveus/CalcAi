import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// --- Environment Variables ---
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Check your .env file.');
  throw new Error('Supabase environment variables are missing.');
}

// --- Platform-Specific Storage Configuration ---
let storageAdapter: any;

// Define Supabase client options
const options: SupabaseClientOptions<"public"> = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // For mobile apps, set to false on native to handle manually
    detectSessionInUrl: Platform.OS === 'web',
    // Initialize storage as null or undefined initially
    storage: undefined, 
  },
};

if (Platform.OS === 'web') {
  // For web, explicitly DO NOT provide a storage adapter initially.
  // Supabase client will default to localStorage when running in the browser.
  console.log('Web platform detected - using default localStorage');
} else {
  // For native platforms, load AsyncStorage dynamically.
  try {
    // Using require ensure it's only bundled/loaded for native.
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (!AsyncStorage) {
        throw new Error("AsyncStorage module loaded as undefined. Check installation.");
    }
    // Check if auth exists (it should, based on initialization)
    if (options.auth) { 
        options.auth.storage = AsyncStorage; // Assign storage here
        console.log('Native platform detected - using AsyncStorage for auth');
    } else {
        // This case should ideally not happen based on our initialization
        console.error("FATAL: options.auth is unexpectedly undefined.");
        throw new Error("options.auth is unexpectedly undefined during native storage setup.");
    }
  } catch (e) {
    console.error('FATAL: Failed to load AsyncStorage for native platform:', e);
    // If AsyncStorage is essential for native, failing here is appropriate.
    throw new Error(`Failed to initialize storage for native platform: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// --- Initialize Supabase Client ---
export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);

// Log to verify configuration
console.log(`Supabase initialized. Platform: ${Platform.OS}. Detect Session in URL: ${options.auth?.detectSessionInUrl}. Storage Adapter Provided: ${!!options.auth?.storage}`);
