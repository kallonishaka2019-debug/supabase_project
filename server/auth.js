const crypto = require("node:crypto");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function registerAuthRoutes(app, { supabaseAuth, supabaseAdmin, supabaseUrl, supabasePublishableKey, appBaseUrl, nodeEnv }) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: nodeEnv === "production",
    path: "/",
  };

  function ensureSupabase(request, response, next) {
    if (!supabaseAuth || !supabaseAdmin) {
      return response.status(503).json({ error: "Authentication is not configured on the server." });
    }
    return next();
  }

  function setAuthCookies(response, session) {
    response.cookie("sb_access_token", session.access_token, {
      ...cookieOptions,
      maxAge: (session.expires_in || 3600) * 1000,
    });
    response.cookie("sb_refresh_token", session.refresh_token, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  function clearAuthCookies(response) {
    response.clearCookie("sb_access_token", cookieOptions);
    response.clearCookie("sb_refresh_token", cookieOptions);
  }

  async function loadProfile(authUser) {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone, role")
      .eq("id", authUser.id)
      .single();
    if (error?.code === "PGRST116") return null;
    if (error) throw error;
    if (!profile) return null;

    return {
      id: authUser.id,
      email: authUser.email,
      name: profile.full_name,
      phone: profile.phone || "",
      is_admin: profile.role === "admin",
    };
  }

  async function requireAuth(request, response, next) {
    if (!supabaseAuth || !supabaseAdmin) {
      return response.status(503).json({ error: "Authentication is not configured on the server." });
    }

    try {
      const accessToken = request.cookies.sb_access_token;
      const refreshToken = request.cookies.sb_refresh_token;
      let authUser = null;
      let refreshedSession = null;

      if (accessToken) {
        const { data, error } = await supabaseAuth.auth.getUser(accessToken);
        if (!error && data?.user) authUser = data.user;
      }

      if (!authUser && refreshToken) {
        const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });
        if (!error && data?.session?.user) {
          authUser = data.session.user;
          refreshedSession = data.session;
        }
      }

      if (!authUser) {
        clearAuthCookies(response);
        return response.status(401).json({ error: "Please log in to continue." });
      }

      const user = await loadProfile(authUser);
      if (!user) {
        clearAuthCookies(response);
        return response.status(401).json({ error: "Account profile is unavailable. Contact support." });
      }

      if (refreshedSession) setAuthCookies(response, refreshedSession);
      request.user = user;
      return next();
    } catch (error) {
      console.error("Authentication session check failed:", error?.message || "Unknown error");
      return response.status(502).json({ error: "Unable to verify your session right now. Please try again." });
    }
  }

  async function requireAdmin(request, response, next) {
    return requireAuth(request, response, () => {
      if (!request.user?.is_admin) {
        return response.status(403).json({ error: "Admin access required." });
      }
      return next();
    });
  }

  app.post("/api/auth/register", ensureSupabase, async (request, response) => {
    const name = String(request.body?.name || "").trim();
    const email = String(request.body?.email || "").trim().toLowerCase();
    const phone = String(request.body?.phone || "").trim();
    const password = String(request.body?.password || "");

    if (name.length < 2) return response.status(400).json({ error: "Name must be at least 2 characters." });
    if (!isValidEmail(email)) return response.status(400).json({ error: "Enter a valid email address." });
    if (!phone) return response.status(400).json({ error: "Phone number is required." });
    if (password.length < 6) return response.status(400).json({ error: "Password must be at least 6 characters." });

    try {
      const { data, error } = await supabaseAuth.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, phone },
          emailRedirectTo: `${appBaseUrl}/api/auth/confirm`,
        },
      });

      if (error) return response.status(error.status === 429 ? 429 : 400).json({ error: error.message });
      if (!data?.user) {
        return response.status(502).json({ error: "Unable to create your account right now. Please try again." });
      }

      if (data.session) {
        const user = await loadProfile(data.user);
        if (!user) {
          return response.status(503).json({ error: "Account created, but its profile is not ready. Please log in after setup is complete." });
        }
        setAuthCookies(response, data.session);
        return response.status(201).json({ success: true, user });
      }

      return response.status(201).json({
        success: true,
        needsVerification: true,
        email,
      });
    } catch (error) {
      console.error("Supabase signup request failed:", error?.message || "Unknown error");
      return response.status(502).json({ error: "Unable to create your account right now. Please try again." });
    }
  });

  app.get("/api/auth/confirm", ensureSupabase, async (request, response) => {
    const tokenHash = String(request.query?.token_hash || "");
    const type = String(request.query?.type || "signup");
    if (!tokenHash) return response.redirect("/jersey.html?verified=0");

    try {
      const { data, error } = await supabaseAuth.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error || !data?.session) return response.redirect("/jersey.html?verified=0");

      const user = await loadProfile(data.session.user);
      if (!user) return response.redirect("/jersey.html?verified=0");
      setAuthCookies(response, data.session);
      return response.redirect("/jersey.html?verified=1");
    } catch (error) {
      console.error("Supabase email confirmation failed:", error?.message || "Unknown error");
      return response.redirect("/jersey.html?verified=0");
    }
  });

  app.post("/api/auth/resend", ensureSupabase, async (request, response) => {
    const email = String(request.body?.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) return response.status(400).json({ error: "Enter a valid email address." });

    try {
      const { error } = await supabaseAuth.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${appBaseUrl}/api/auth/confirm` },
      });
      if (error) return response.status(error.status === 429 ? 429 : 400).json({ error: error.message });
      return response.json({ success: true, message: "If the account is awaiting confirmation, a new email will be sent." });
    } catch (error) {
      console.error("Supabase confirmation email request failed:", error?.message || "Unknown error");
      return response.status(502).json({ error: "Unable to send the confirmation email right now. Please try again." });
    }
  });

  app.post("/api/auth/login", ensureSupabase, async (request, response) => {
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    if (!isValidEmail(email) || !password) {
      return response.status(400).json({ error: "Enter your email and password." });
    }

    try {
      const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
      if (error || !data?.session) {
        const message = /email not confirmed/i.test(error?.message || "")
          ? "Confirm your email before logging in. Check your inbox or request a new link."
          : "Invalid email or password.";
        return response.status(401).json({ error: message });
      }

      const user = await loadProfile(data.user);
      if (!user) {
        return response.status(503).json({ error: "Your account profile is unavailable. Contact support." });
      }

      setAuthCookies(response, data.session);
      return response.json({ success: true, user });
    } catch (error) {
      console.error("Supabase login request failed:", error?.message || "Unknown error");
      return response.status(502).json({ error: "Unable to log in right now. Please try again." });
    }
  });

  // Google sign-in uses Supabase's PKCE flow; the verifier never leaves an httpOnly cookie.
  app.get("/api/auth/google", ensureSupabase, (request, response) => {
    if (!supabaseUrl) return response.status(503).json({ error: "Authentication is not configured on the server." });

    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    response.cookie("sb_pkce_verifier", verifier, { ...cookieOptions, maxAge: 10 * 60 * 1000 });

    const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authorizeUrl.searchParams.set("provider", "google");
    authorizeUrl.searchParams.set("redirect_to", `${appBaseUrl}/api/auth/google/callback`);
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "s256");
    return response.redirect(authorizeUrl.toString());
  });

  app.get("/api/auth/google/callback", ensureSupabase, async (request, response) => {
    const code = String(request.query?.code || "");
    const verifier = request.cookies.sb_pkce_verifier;
    response.clearCookie("sb_pkce_verifier", cookieOptions);
    if (!code || !verifier) {
      console.warn("Google callback missing:", { code: Boolean(code), verifier: Boolean(verifier), error: request.query?.error_code || request.query?.error, description: request.query?.error_description });
      return response.redirect("/jersey.html?google=0");
    }

    try {
      const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabasePublishableKey },
        body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      });
      const session = await tokenResponse.json().catch(() => null);
      if (!tokenResponse.ok || !session?.access_token || !session?.user) {
        console.warn("Google token exchange failed:", tokenResponse.status, session?.msg || session?.error_description || session?.error || "");
        return response.redirect("/jersey.html?google=0");
      }

      const user = await loadProfile(session.user);
      if (!user) {
        console.warn("Google sign-in: no profile for user", session.user.id);
        return response.redirect("/jersey.html?google=0");
      }

      setAuthCookies(response, session);
      return response.redirect("/jersey.html?google=1");
    } catch (error) {
      console.error("Google sign-in failed:", error?.message || "Unknown error");
      return response.redirect("/jersey.html?google=0");
    }
  });

  app.get("/api/auth/me", ensureSupabase, requireAuth, (request, response) => {
    response.json({ user: request.user });
  });

  app.post("/api/auth/logout", async (request, response) => {
    const accessToken = request.cookies.sb_access_token;
    if (accessToken && supabaseAdmin) {
      try {
        const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, "local");
        if (error) console.warn("Supabase logout could not revoke the session:", error.message);
      } catch (error) {
        console.warn("Supabase logout could not revoke the session:", error?.message || "Unknown error");
      }
    }
    clearAuthCookies(response);
    return response.status(204).end();
  });

  return { ensureSupabase, requireAuth, requireAdmin };
}

module.exports = { registerAuthRoutes };