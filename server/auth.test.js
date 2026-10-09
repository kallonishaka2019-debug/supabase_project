const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const cookieParser = require("cookie-parser");
const express = require("express");
const { registerAuthRoutes } = require("./auth");

async function startAuthServer(t, overrides = {}) {
  const calls = { signup: null, signIn: null, signOut: null };
  const auth = {
    signUp: async (input) => {
      calls.signup = input;
      return overrides.signUp || {
        data: { user: { id: "user-1", email: input.email }, session: null },
        error: null,
      };
    },
    signInWithPassword: async (input) => {
      calls.signIn = input;
      return overrides.signIn || {
        data: {
          user: { id: "user-1", email: input.email },
          session: {
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
            user: { id: "user-1", email: input.email },
          },
        },
        error: null,
      };
    },
    getUser: overrides.getUser || (async () => ({ data: { user: null }, error: { message: "Invalid token" } })),
    refreshSession: overrides.refreshSession || (async () => ({ data: { session: null }, error: null })),
    resend: async () => ({ error: null }),
    verifyOtp: overrides.verifyOtp || (async () => ({ data: { session: null }, error: { message: "Invalid token" } })),
  };

  const supabaseAuth = { auth };
  const supabaseAdmin = {
    auth: {
      admin: {
        signOut: async (...args) => {
          calls.signOut = args;
          return { error: null };
        },
      },
    },
    from: () => ({
      select() { return this; },
      eq() { return this; },
      single: async () => overrides.profile
        ? overrides.profile()
        : {
            data: { full_name: "Test Customer", phone: "076000000", role: "customer" },
            error: null,
          },
    }),
  };

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const { ensureSupabase, requireAuth } = registerAuthRoutes(app, {
    supabaseAuth,
    supabaseAdmin,
    appBaseUrl: "https://jersey.example",
    nodeEnv: "production",
  });
  app.get("/protected", ensureSupabase, requireAuth, (request, response) => response.json({ user: request.user }));

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));

  return { baseUrl: `http://127.0.0.1:${server.address().port}`, calls };
}

test("registration validates input before calling Supabase", async (t) => {
  const { baseUrl, calls } = await startAuthServer(t);
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "A", email: "bad", phone: "", password: "x" }),
  });

  assert.equal(response.status, 400);
  assert.equal(calls.signup, null);
  assert.match((await response.json()).error, /name must/i);
});

test("registration uses Supabase signup and returns a verification state", async (t) => {
  const { baseUrl, calls } = await startAuthServer(t);
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Customer",
      email: "TEST@example.com",
      phone: "076000000",
      password: "test-password",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.needsVerification, true);
  assert.equal(body.verificationEmailSent, undefined);
  assert.equal(calls.signup.email, "test@example.com");
  assert.deepEqual(calls.signup.options.data, { full_name: "Test Customer", phone: "076000000" });
  assert.equal(calls.signup.options.emailRedirectTo, "https://jersey.example/api/auth/confirm");
  assert.equal(response.headers.get("set-cookie"), null);
});

test("confirmation callback establishes a session and returns to the storefront", async (t) => {
  const { baseUrl } = await startAuthServer(t, {
    verifyOtp: async ({ token_hash: tokenHash, type }) => ({
      data: {
        session: {
          access_token: "confirmed-access-token",
          refresh_token: "confirmed-refresh-token",
          expires_in: 3600,
          user: { id: "user-1", email: "test@example.com" },
        },
      },
      error: tokenHash === "valid-token" && type === "signup" ? null : { message: "Invalid token" },
    }),
  });
  const response = await fetch(`${baseUrl}/api/auth/confirm?token_hash=valid-token&type=signup`, {
    redirect: "manual",
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/jersey.html?verified=1");
  assert.match(response.headers.get("set-cookie"), /sb_access_token=confirmed-access-token/);
});

test("login returns the profile and sets HTTP-only secure cookies", async (t) => {
  const { baseUrl, calls } = await startAuthServer(t);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "TEST@example.com", password: "test-password" }),
  });
  const body = await response.json();
  const cookies = response.headers.get("set-cookie");

  assert.equal(response.status, 200);
  assert.equal(calls.signIn.email, "test@example.com");
  assert.equal(body.user.name, "Test Customer");
  assert.match(cookies, /sb_access_token=access-token/);
  assert.match(cookies, /HttpOnly/);
  assert.match(cookies, /Secure/);
  assert.match(cookies, /SameSite=Lax/);
});

test("Google profile photo is returned with the signed-in account", async (t) => {
  const { baseUrl } = await startAuthServer(t, {
    signIn: {
      data: {
        user: {
          id: "user-1",
          email: "test@example.com",
          user_metadata: { picture: "https://example.com/avatar.png" },
        },
        session: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          user: { id: "user-1", email: "test@example.com" },
        },
      },
      error: null,
    },
  });
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "test-password" }),
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.avatar_url, "https://example.com/avatar.png");
});

test("protected routes reject requests without a session", async (t) => {
  const { baseUrl } = await startAuthServer(t);
  const response = await fetch(`${baseUrl}/protected`);

  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /log in/i);
});

test("protected routes refresh expired access tokens", async (t) => {
  const { baseUrl } = await startAuthServer(t, {
    getUser: async () => ({ data: { user: null }, error: { message: "Expired token" } }),
    refreshSession: async () => ({
      data: {
        session: {
          access_token: "refreshed-access-token",
          refresh_token: "refreshed-refresh-token",
          expires_in: 3600,
          user: { id: "user-1", email: "test@example.com" },
        },
      },
      error: null,
    }),
  });
  const response = await fetch(`${baseUrl}/protected`, {
    headers: { Cookie: "sb_access_token=expired; sb_refresh_token=refresh-token" },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /sb_access_token=refreshed-access-token/);
  assert.equal((await response.json()).user.name, "Test Customer");
});

test("temporary provider failures preserve the existing session cookies", async (t) => {
  const { baseUrl } = await startAuthServer(t, {
    getUser: async () => { throw new Error("provider offline"); },
  });
  const response = await fetch(`${baseUrl}/protected`, {
    headers: { Cookie: "sb_access_token=valid; sb_refresh_token=valid-refresh" },
  });

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("profile database failures are not treated as invalid sessions", async (t) => {
  const { baseUrl } = await startAuthServer(t, {
    getUser: async () => ({ data: { user: { id: "user-1", email: "test@example.com" } }, error: null }),
    profile: async () => ({ data: null, error: { code: "PGRST500", message: "Database unavailable" } }),
  });
  const response = await fetch(`${baseUrl}/protected`, {
    headers: { Cookie: "sb_access_token=valid; sb_refresh_token=valid-refresh" },
  });

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("logout revokes the current Supabase session and clears cookies", async (t) => {
  const { baseUrl, calls } = await startAuthServer(t);
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: "sb_access_token=access-token" },
  });
  const cookies = response.headers.get("set-cookie");

  assert.equal(response.status, 204);
  assert.deepEqual(calls.signOut, ["access-token", "local"]);
  assert.match(cookies, /sb_access_token=;/);
  assert.match(cookies, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
});