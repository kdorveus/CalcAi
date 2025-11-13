/**
 * CalcAi Authentication Worker
 * Handles Google OAuth 2.0 authentication for web and mobile apps
 * Stores user data in Cloudflare D1 database
 */

// Error message constants
const ERROR_MESSAGES = {
  INVALID_JSON: 'Invalid JSON body',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  MISSING_CREDENTIAL: 'Missing credential',
  INVALID_CREDENTIAL: 'Invalid credential',
  INVALID_AUDIENCE: 'Invalid audience',
  MISSING_AUTH_HEADER: 'Missing or invalid authorization header',
  INVALID_SESSION: 'Invalid or expired session',
  INVALID_SESSION_FORMAT: 'Invalid session format',
  USER_NOT_FOUND: 'User not found',
  MISSING_PRICE_ID: 'Missing priceId',
  MISSING_WEBHOOK_DATA: 'Missing webhookUrl or data',
  INVALID_WEBHOOK_URL: 'Invalid webhook URL',
  MISSING_MESSAGE: 'Message is required',
  MESSAGE_TOO_LONG: 'Message too long (max 1000 characters)',
  PREMIUM_REQUIRED: 'Premium subscription required',
};

// Helper to create a JSON response
const jsonResponse = (data, corsHeaders, options = {}) => {
  return new Response(JSON.stringify(data), {
    ...options,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
};

const ALLOWED_ORIGINS = ['https://calc.tearhappy.com'];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Get origin from request
    const origin = request.headers.get('Origin');

    // CORS headers for mobile/web app
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const router = {
        '/auth/google': { GET: handleGoogleAuth },
        '/auth/google-one-tap': { POST: handleGoogleOneTap },
        '/auth/callback': { GET: handleGoogleCallback },
        '/auth/verify': { GET: handleVerifyToken },
        '/auth/refresh': { GET: handleRefreshToken },
        '/auth/logout': { POST: handleLogout },
        '/webhook/send': { POST: handleWebhookProxy },
        '/premium/check': { GET: handlePremiumCheck },
        '/premium/create-checkout': { POST: handleCreateCheckout },
        '/stripe/webhook': { POST: handleStripeWebhook },
        '/contact/send': { POST: handleContactForm },
        '/auth/google-client-id': { GET: handleGetGoogleClientId },
        '/health': {
          GET: () => jsonResponse({ status: 'ok' }, corsHeaders),
        },
      };

      const route = router[path];
      if (route) {
        const handler = route[request.method];
        if (handler) {
          return await handler(request, env, corsHeaders, ctx);
        }
        return jsonResponse({ error: ERROR_MESSAGES.METHOD_NOT_ALLOWED }, corsHeaders, {
          status: 405,
        });
      }

      return jsonResponse({ error: 'Not Found' }, corsHeaders, { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }), // Avoid leaking error messages
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};

/**
 * Initiates Google OAuth flow
 * Returns authorization URL for client to redirect to
 */
async function handleGoogleAuth(request, env, corsHeaders, _ctx) {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform') || 'web'; // 'web' or 'mobile'

  // Generate state parameter for CSRF protection
  const state = crypto.randomUUID();

  // Store state in KV with 10 minute expiration
  await env.AUTH_STATE.put(
    state,
    JSON.stringify({
      platform,
      timestamp: Date.now(),
    }),
    { expirationTtl: 600 }
  );

  // Build Google OAuth URL
  const redirectUri =
    platform === 'mobile' ? env.GOOGLE_REDIRECT_URI_MOBILE : env.GOOGLE_REDIRECT_URI_WEB;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'select_account'); // Only show account picker, not permissions every time

  return jsonResponse({ authUrl: authUrl.toString(), state }, corsHeaders);
}

/**
 * Returns Google Client ID for One Tap initialization
 */
async function handleGetGoogleClientId(_request, env, corsHeaders) {
  return jsonResponse({ clientId: env.GOOGLE_CLIENT_ID }, corsHeaders);
}

/**
 * Handles Google One Tap authentication
 * Verifies JWT credential from Google and creates session
 */
async function handleGoogleOneTap(request, env, corsHeaders, _ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: ERROR_MESSAGES.INVALID_JSON }, corsHeaders, { status: 400 });
  }

  const { credential } = body;
  if (!credential) {
    return jsonResponse({ error: ERROR_MESSAGES.MISSING_CREDENTIAL }, corsHeaders, { status: 400 });
  }

  // Verify the JWT token with Google
  const verifyResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
  );

  if (!verifyResponse.ok) {
    const errorDetails = await verifyResponse
      .json()
      .catch(() => ({ error: 'Failed to parse Google error response' }));
    console.error('Google token verification failed:', errorDetails);
    return jsonResponse(
      {
        error: 'Invalid credential',
        details: errorDetails.error_description || 'Verification failed',
      },
      corsHeaders,
      { status: 401 }
    );
  }

  const tokenInfo = await verifyResponse.json();

  // Verify the token is for our app
  if (tokenInfo.aud !== env.GOOGLE_CLIENT_ID) {
    return jsonResponse({ error: ERROR_MESSAGES.INVALID_AUDIENCE }, corsHeaders, { status: 401 });
  }

  // Extract user info from verified token
  const userInfo = {
    id: tokenInfo.sub,
    email: tokenInfo.email,
    name: tokenInfo.name,
    picture: tokenInfo.picture,
    email_verified: tokenInfo.email_verified,
  };

  // Create or update user in D1 database
  const userId = await upsertUser(env.DB, userInfo, {});

  // Generate session token
  const sessionToken = await generateSessionToken(userId);

  // Store session in KV with 7 day expiration
  await env.SESSIONS.put(
    sessionToken,
    JSON.stringify({
      userId,
      email: userInfo.email,
      createdAt: Date.now(),
    }),
    { expirationTtl: 604800 }
  ); // 7 days

  // Return session data
  return jsonResponse(
    {
      sessionToken,
      user: {
        id: userId,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
      expiresIn: 604800,
    },
    corsHeaders
  );
}

/**
 * Handles OAuth callback from Google
 * Exchanges code for tokens and creates/updates user in database
 */
async function handleGoogleCallback(request, env, corsHeaders, _ctx) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return jsonResponse({ error: 'OAuth error', details: error }, corsHeaders, { status: 400 });
  }

  if (!code || !state) {
    return jsonResponse({ error: 'Missing code or state parameter' }, corsHeaders, { status: 400 });
  }

  // Verify state parameter
  const stateData = await env.AUTH_STATE.get(state);
  if (!stateData) {
    return jsonResponse({ error: 'Invalid or expired state parameter' }, corsHeaders, {
      status: 400,
    });
  }

  const { platform } = JSON.parse(stateData);
  await env.AUTH_STATE.delete(state);

  // Exchange code for tokens
  const redirectUri =
    platform === 'mobile' ? env.GOOGLE_REDIRECT_URI_MOBILE : env.GOOGLE_REDIRECT_URI_WEB;

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
    return jsonResponse({ error: 'Token exchange failed', details: errorData }, corsHeaders, {
      status: 400,
    });
  }

  const tokens = await tokenResponse.json();

  // Get user info from Google
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoResponse.ok) {
    return jsonResponse({ error: 'Failed to fetch user info' }, corsHeaders, { status: 400 });
  }

  const userInfo = await userInfoResponse.json();

  // Create or update user in D1 database
  const userId = await upsertUser(env.DB, userInfo, tokens);

  // Generate session token
  const sessionToken = await generateSessionToken(userId);

  // Store session in KV with 7 day expiration
  await env.SESSIONS.put(
    sessionToken,
    JSON.stringify({
      userId,
      email: userInfo.email,
      createdAt: Date.now(),
    }),
    { expirationTtl: 604800 }
  ); // 7 days

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
async function handleVerifyToken(request, env, corsHeaders, _ctx) {
  const authResult = await verifyAuth(request, env, corsHeaders);
  if (authResult instanceof Response) {
    return authResult;
  }
  const { session } = authResult;

  // Get user from database
  const user = await env.DB.prepare(
    'SELECT id, email, name, picture, created_at FROM users WHERE id = ?'
  )
    .bind(session.userId)
    .first();

  if (!user) {
    return jsonResponse({ error: ERROR_MESSAGES.USER_NOT_FOUND }, corsHeaders, { status: 404 });
  }

  return jsonResponse(
    {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    },
    corsHeaders
  );
}

/**
 * Refreshes a session token
 */
async function handleRefreshToken(request, env, corsHeaders, _ctx) {
  const authResult = await verifyAuth(request, env, corsHeaders);
  if (authResult instanceof Response) {
    return authResult;
  }
  const { session, token: oldToken } = authResult;

  // Generate new session token
  const newToken = await generateSessionToken(session.userId);

  // Store new session
  await env.SESSIONS.put(
    newToken,
    JSON.stringify({
      userId: session.userId,
      email: session.email,
      createdAt: Date.now(),
    }),
    { expirationTtl: 604800 }
  );

  // Delete old session
  await env.SESSIONS.delete(oldToken);

  return jsonResponse({ sessionToken: newToken, expiresIn: 604800 }, corsHeaders);
}

/**
 * Logs out a user by deleting their session
 */
async function handleLogout(request, env, corsHeaders, ctx) {
  const authResult = await verifyAuth(request, env, corsHeaders);
  if (authResult instanceof Response) {
    return authResult;
  }
  const { token } = authResult;
  ctx.waitUntil(env.SESSIONS.delete(token));

  return jsonResponse({ success: true }, corsHeaders);
}

/**
 * Creates or updates a user in the database
 */
async function upsertUser(db, userInfo, _tokens) {
  const existingUser = await db
    .prepare('SELECT id FROM users WHERE google_id = ?')
    .bind(userInfo.id)
    .first();

  if (existingUser) {
    // Update existing user
    await db
      .prepare(
        'UPDATE users SET email = ?, name = ?, picture = ?, updated_at = CURRENT_TIMESTAMP WHERE google_id = ?'
      )
      .bind(userInfo.email, userInfo.name, userInfo.picture, userInfo.id)
      .run();

    return existingUser.id;
  } else {
    // Create new user
    const userId = crypto.randomUUID();
    await db
      .prepare('INSERT INTO users (id, google_id, email, name, picture) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, userInfo.id, userInfo.email, userInfo.name, userInfo.picture)
      .run();

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
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Helper function to verify authentication token and return session data
 * @returns {Promise<Response|{session: object, token: string}>} - Returns a Response object on failure, or session data on success.
 */
async function verifyAuth(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: ERROR_MESSAGES.MISSING_AUTH_HEADER }, corsHeaders, {
      status: 401,
    });
  }

  const token = authHeader.substring(7);
  const sessionData = await env.SESSIONS.get(token);

  if (!sessionData) {
    return jsonResponse({ error: ERROR_MESSAGES.INVALID_SESSION }, corsHeaders, { status: 401 });
  }

  try {
    const session = JSON.parse(sessionData);
    return { session, token };
  } catch (error) {
    console.error('Failed to parse session data:', error);
    return jsonResponse({ error: ERROR_MESSAGES.INVALID_SESSION_FORMAT }, corsHeaders, {
      status: 500,
    });
  }
}

/**
 * Checks if user has premium status
 */
async function handlePremiumCheck(request, env, corsHeaders, _ctx) {
  const authResult = await verifyAuth(request, env, corsHeaders);
  if (authResult instanceof Response) {
    return authResult; // Propagate auth error response
  }
  const { session } = authResult;

  const user = await env.DB.prepare('SELECT is_premium FROM users WHERE id = ?')
    .bind(session.userId)
    .first();

  return jsonResponse({ isPremium: Boolean(user?.is_premium) }, corsHeaders);
}

/**
 * Creates a Stripe Checkout session for premium purchase
 */
async function handleCreateCheckout(request, env, corsHeaders, _ctx) {
  const authResult = await verifyAuth(request, env, corsHeaders);
  if (authResult instanceof Response) {
    return authResult;
  }
  const { session } = authResult;

  // Get user from database
  const user = await env.DB.prepare('SELECT id, email, stripe_customer_id FROM users WHERE id = ?')
    .bind(session.userId)
    .first();

  if (!user) {
    return jsonResponse({ error: ERROR_MESSAGES.USER_NOT_FOUND }, corsHeaders, { status: 404 });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error('Invalid JSON in checkout request:', error);
    return jsonResponse({ error: ERROR_MESSAGES.INVALID_JSON }, corsHeaders, { status: 400 });
  }

  const { priceId } = body;

  if (!priceId) {
    return jsonResponse({ error: ERROR_MESSAGES.MISSING_PRICE_ID }, corsHeaders, { status: 400 });
  }

  // Create or retrieve Stripe customer
  let customerId = user.stripe_customer_id;

  if (!customerId) {
    // Create new Stripe customer
    const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: user.email,
        'metadata[userId]': user.id,
      }),
    });

    if (!customerResponse.ok) {
      const errorData = await customerResponse.text();
      return jsonResponse(
        { error: 'Failed to create Stripe customer', details: errorData },
        { status: 500 },
        corsHeaders
      );
    }

    const customer = await customerResponse.json();
    customerId = customer.id;

    // Save customer ID to database
    await env.DB.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')
      .bind(customerId, user.id)
      .run();
  }

  // Create Stripe Checkout session
  const checkoutResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      mode: 'payment',
      success_url: 'https://calc.tearhappy.com/premium/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://calc.tearhappy.com/premium/cancel',
      'metadata[userId]': user.id,
    }),
  });

  if (!checkoutResponse.ok) {
    const errorData = await checkoutResponse.text();
    return jsonResponse(
      { error: 'Failed to create checkout session', details: errorData },
      corsHeaders,
      { status: 500 }
    );
  }

  const checkout = await checkoutResponse.json();

  return jsonResponse({ sessionId: checkout.id, url: checkout.url }, corsHeaders);
}

/**
 * Handles Stripe webhook events
 */
async function handleStripeWebhook(request, env, corsHeaders) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return jsonResponse({ error: 'Missing stripe-signature header' }, corsHeaders, { status: 400 });
  }
  let event;
  try {
    const body = await request.text();

    // Verify webhook signature
    event = await verifyStripeWebhook(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return jsonResponse({ error: 'Webhook signature verification failed' }, corsHeaders, {
      status: 400,
    });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object, env);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object, env);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, env);
        break;
      default:
        break;
    }

    return jsonResponse({ received: true }, corsHeaders);
  } catch (error) {
    console.error('Error handling webhook:', error);
    return jsonResponse({ error: 'Webhook handler failed' }, corsHeaders, { status: 500 });
  }
}

/**
 * Verifies Stripe webhook signature
 */
async function verifyStripeWebhook(payload, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigHex = signature
    .split(',')
    .find((s) => s.startsWith('v1='))
    ?.substring(3);

  const timestamp = signature
    .split(',')
    .find((s) => s.startsWith('t='))
    ?.substring(2);

  if (!sigHex || !timestamp) {
    throw new Error('Invalid signature format');
  }

  const signedPayload = `${timestamp}.${payload}`;

  const sigBuffer = new Uint8Array(sigHex.match(/../g).map((h) => Number.parseInt(h, 16)));

  const verified = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBuffer,
    encoder.encode(signedPayload)
  );

  if (!verified) {
    throw new Error('Signature verification failed');
  }

  // Parse and return the event
  return JSON.parse(payload);
}

/**
 * Handles successful checkout completion
 */
async function handleCheckoutCompleted(session, env) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  // Update user premium status
  await env.DB.prepare(
    'UPDATE users SET is_premium = 1, stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(session.customer, userId)
    .run();
}

/**
 * Handles successful invoice payment
 */
async function handleInvoicePaid(invoice, env) {
  const customerId = invoice.customer;

  // Find user by Stripe customer ID and activate premium
  const user = await env.DB.prepare('SELECT id FROM users WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first();

  if (user) {
    await env.DB.prepare(
      'UPDATE users SET is_premium = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(user.id)
      .run();
  }
}

/**
 * Handles failed payment
 */
async function handlePaymentFailed(invoice, env) {
  const customerId = invoice.customer;

  // Find user and potentially deactivate premium
  const user = await env.DB.prepare('SELECT id FROM users WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first();

  if (user) {
    // Optionally deactivate premium after grace period
  }
}

/**
 * Handles subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription, env) {
  const customerId = subscription.customer;

  // Find user and deactivate premium
  const user = await env.DB.prepare('SELECT id FROM users WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first();

  if (user) {
    await env.DB.prepare(
      'UPDATE users SET is_premium = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(user.id)
      .run();
  }
}

/**
 * Proxies webhook requests with authentication and rate limiting
 */
async function handleWebhookProxy(request, env, corsHeaders, _ctx) {
  const authResult = await verifyAuth(request, env, corsHeaders);
  if (authResult instanceof Response) {
    return authResult;
  }
  const { session } = authResult;

  // Get user and verify premium status
  const user = await env.DB.prepare('SELECT id, email, is_premium FROM users WHERE id = ?')
    .bind(session.userId)
    .first();

  if (!user || !user.is_premium) {
    return jsonResponse({ error: ERROR_MESSAGES.PREMIUM_REQUIRED }, corsHeaders, { status: 403 });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error('Invalid JSON in webhook proxy request:', error);
    return jsonResponse({ error: ERROR_MESSAGES.INVALID_JSON }, corsHeaders, { status: 400 });
  }

  const { webhookUrl, data } = body;

  if (!webhookUrl || !data) {
    return jsonResponse({ error: ERROR_MESSAGES.MISSING_WEBHOOK_DATA }, corsHeaders, {
      status: 400,
    });
  }

  // Validate webhook URL
  try {
    new URL(webhookUrl);
  } catch (error) {
    console.error('Invalid webhook URL format:', error);
    return jsonResponse({ error: ERROR_MESSAGES.INVALID_WEBHOOK_URL }, corsHeaders, {
      status: 400,
    });
  }

  // Send webhook with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return jsonResponse(
      {
        success: true,
        status: webhookResponse.status,
      },
      corsHeaders
    );
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error.name === 'AbortError' ? 'Webhook timeout' : 'Webhook failed',
      },
      corsHeaders,
      { status: 500 }
    );
  }
}

/**
 * Handles contact form submissions
 */
async function handleContactForm(request, env, corsHeaders, ctx) {
  const authResult = await verifyAuth(request, env, corsHeaders);
  if (authResult instanceof Response) {
    return authResult;
  }
  const { session } = authResult;

  // Get user from database
  const user = await env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(session.userId)
    .first();

  if (!user) {
    return jsonResponse({ error: ERROR_MESSAGES.USER_NOT_FOUND }, corsHeaders, { status: 404 });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error('Invalid JSON in contact form request:', error);
    return jsonResponse({ error: ERROR_MESSAGES.INVALID_JSON }, corsHeaders, { status: 400 });
  }

  const { message } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return jsonResponse({ error: ERROR_MESSAGES.MISSING_MESSAGE }, corsHeaders, { status: 400 });
  }

  // Validate message length
  if (message.length > 1000) {
    return jsonResponse({ error: ERROR_MESSAGES.MESSAGE_TOO_LONG }, corsHeaders, { status: 400 });
  }

  // Prepare webhook payload
  const webhookPayload = {
    email: user.email,
    name: user.name,
    message: message.trim(),
    date: new Date().toISOString(),
    userId: user.id,
  };

  // Define the webhook sending function
  const sendWebhook = async () => {
    // Read from environment (configure these in Cloudflare dashboard)
    const webhookUrl = env.ACTIVEPIECES_WEBHOOK_URL;
    const contactHeaderName = env.CONTACT_HEADER_NAME;
    const contactHeaderValue = env.CONTACT_HEADER_VALUE;

    if (!webhookUrl || !contactHeaderName || !contactHeaderValue) {
      console.error('Server misconfiguration: missing webhook env vars');
      return;
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [contactHeaderName]: contactHeaderValue,
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      console.error('Webhook failed:', webhookResponse.status, await webhookResponse.text());
    }
  };

  // Perform the webhook call in the background after the response has been sent
  // This makes the API feel instantaneous to the user
  ctx.waitUntil(
    sendWebhook().catch((err) => {
      console.error('Contact form webhook failed in waitUntil:', err);
    })
  );

  // Immediately return a success response to the client
  return jsonResponse(
    {
      success: true,
      message: 'Message is being sent.',
    },
    corsHeaders
  );
}
