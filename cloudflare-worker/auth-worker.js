/**
 * CalcAi Authentication Worker
 * Handles Google OAuth 2.0 authentication for web and mobile apps
 * Stores user data in Cloudflare D1 database
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for mobile/web app
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // TODO: Restrict to your domain in production
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (path === '/auth/google') {
        return handleGoogleAuth(request, env, corsHeaders);
      } else if (path === '/auth/callback') {
        return handleGoogleCallback(request, env, corsHeaders);
      } else if (path === '/auth/verify') {
        return handleVerifyToken(request, env, corsHeaders);
      } else if (path === '/auth/refresh') {
        return handleRefreshToken(request, env, corsHeaders);
      } else if (path === '/auth/logout') {
        return handleLogout(request, env, corsHeaders);
      } else if (path === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error', message: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};

/**
 * Initiates Google OAuth flow
 * Returns authorization URL for client to redirect to
 */
async function handleGoogleAuth(request, env, corsHeaders) {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform') || 'web'; // 'web' or 'mobile'
  
  // Generate state parameter for CSRF protection
  const state = crypto.randomUUID();
  
  // Store state in KV with 10 minute expiration
  await env.AUTH_STATE.put(state, JSON.stringify({ 
    platform, 
    timestamp: Date.now() 
  }), { expirationTtl: 600 });

  // Build Google OAuth URL
  const redirectUri = platform === 'mobile' 
    ? env.GOOGLE_REDIRECT_URI_MOBILE 
    : env.GOOGLE_REDIRECT_URI_WEB;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return new Response(
    JSON.stringify({ 
      authUrl: authUrl.toString(),
      state 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Handles OAuth callback from Google
 * Exchanges code for tokens and creates/updates user in database
 */
async function handleGoogleCallback(request, env, corsHeaders) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(
      JSON.stringify({ error: 'OAuth error', details: error }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!code || !state) {
    return new Response(
      JSON.stringify({ error: 'Missing code or state parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify state parameter
  const stateData = await env.AUTH_STATE.get(state);
  if (!stateData) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired state parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { platform } = JSON.parse(stateData);
  await env.AUTH_STATE.delete(state);

  // Exchange code for tokens
  const redirectUri = platform === 'mobile' 
    ? env.GOOGLE_REDIRECT_URI_MOBILE 
    : env.GOOGLE_REDIRECT_URI_WEB;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    return new Response(
      JSON.stringify({ error: 'Token exchange failed', details: errorData }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const tokens = await tokenResponse.json();

  // Get user info from Google
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch user info' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userInfo = await userInfoResponse.json();

  // Create or update user in D1 database
  const userId = await upsertUser(env.DB, userInfo, tokens);

  // Generate session token
  const sessionToken = await generateSessionToken(userId);
  
  // Store session in KV with 7 day expiration
  await env.SESSIONS.put(sessionToken, JSON.stringify({
    userId,
    email: userInfo.email,
    createdAt: Date.now(),
  }), { expirationTtl: 604800 }); // 7 days

  // Redirect based on platform
  if (platform === 'mobile') {
    // For mobile, redirect to app deep link with token
    const mobileRedirect = `calcai://auth/callback?token=${sessionToken}`;
    return Response.redirect(mobileRedirect, 302);
  } else {
    // For web, redirect to actual website with token
    const webRedirect = `https://calc.tearhappy.com/auth/callback?token=${sessionToken}`;
    return Response.redirect(webRedirect, 302);
  }
}

/**
 * Verifies a session token
 */
async function handleVerifyToken(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.substring(7);
  const sessionData = await env.SESSIONS.get(token);

  if (!sessionData) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired session' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const session = JSON.parse(sessionData);

  // Get user from database
  const user = await env.DB.prepare(
    'SELECT id, email, name, picture, created_at FROM users WHERE id = ?'
  ).bind(session.userId).first();

  if (!user) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Refreshes a session token
 */
async function handleRefreshToken(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const oldToken = authHeader.substring(7);
  const sessionData = await env.SESSIONS.get(oldToken);

  if (!sessionData) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired session' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const session = JSON.parse(sessionData);

  // Generate new session token
  const newToken = await generateSessionToken(session.userId);
  
  // Store new session
  await env.SESSIONS.put(newToken, JSON.stringify({
    userId: session.userId,
    email: session.email,
    createdAt: Date.now(),
  }), { expirationTtl: 604800 });

  // Delete old session
  await env.SESSIONS.delete(oldToken);

  return new Response(
    JSON.stringify({
      sessionToken: newToken,
      expiresIn: 604800,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Logs out a user by deleting their session
 */
async function handleLogout(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.substring(7);
  await env.SESSIONS.delete(token);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Creates or updates a user in the database
 */
async function upsertUser(db, userInfo, tokens) {
  const existingUser = await db.prepare(
    'SELECT id FROM users WHERE google_id = ?'
  ).bind(userInfo.id).first();

  if (existingUser) {
    // Update existing user
    await db.prepare(
      'UPDATE users SET email = ?, name = ?, picture = ?, updated_at = CURRENT_TIMESTAMP WHERE google_id = ?'
    ).bind(userInfo.email, userInfo.name, userInfo.picture, userInfo.id).run();
    
    return existingUser.id;
  } else {
    // Create new user
    const userId = crypto.randomUUID();
    await db.prepare(
      'INSERT INTO users (id, google_id, email, name, picture) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, userInfo.id, userInfo.email, userInfo.name, userInfo.picture).run();
    
    return userId;
  }
}

/**
 * Generates a secure session token
 */
async function generateSessionToken(userId) {
  const data = `${userId}:${Date.now()}:${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
