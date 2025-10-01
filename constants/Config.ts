/**
 * CalcAi Configuration
 * Update WORKER_URL after deploying your Cloudflare Worker
 */

export const WORKER_URL = 'https://calcai.liljcool45.workers.dev';

// Platform detection
export const PLATFORM = 'mobile'; // Will be detected at runtime

// Auth endpoints
export const AUTH_ENDPOINTS = {
  GOOGLE_AUTH: `${WORKER_URL}/auth/google`,
  CALLBACK: `${WORKER_URL}/auth/callback`,
  VERIFY: `${WORKER_URL}/auth/verify`,
  REFRESH: `${WORKER_URL}/auth/refresh`,
  LOGOUT: `${WORKER_URL}/auth/logout`,
};

// Webhook endpoints
export const WEBHOOK_ENDPOINTS = {
  SEND: `${WORKER_URL}/webhook/send`,
};

// Premium endpoints
export const PREMIUM_ENDPOINTS = {
  CHECK: `${WORKER_URL}/premium/check`,
  CREATE_CHECKOUT: `${WORKER_URL}/premium/create-checkout`,
};

// Session storage keys
export const STORAGE_KEYS = {
  SESSION_TOKEN: '@calcai_session_token',
  USER_DATA: '@calcai_user_data',
};
