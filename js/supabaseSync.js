/**
 * UNTO / FLOW — Phase 3 Supabase Auth & Cloud Sync Engine
 *
 * Provides:
 * 1. Direct Supabase GoTrue Auth (/auth/v1/signup, /auth/v1/token, /auth/v1/authorize)
 *    and PostgREST (/rest/v1/fable_flow_user_state) when a Supabase URL + Anon Key are configured.
 * 2. Automatic Multi-User Local Vault Mode when running without external credentials or offline,
 *    giving each logged-in user an isolated, persistent workspace (tasks, timers, reflections,
 *    photos, archive cards, and daily reset settings) that automatically syncs to Supabase
 *    once project credentials are provided.
 */

const CONFIG_STORAGE_KEY = 'fable_flow_supabase_config_v1';
const SESSION_STORAGE_KEY = 'fable_flow_auth_session_v1';
const LOCAL_ACCOUNTS_KEY = 'fable_flow_accounts_v1';
const USER_VAULT_PREFIX = 'fable_flow_user_vault_';

// "Continue with Google" talks to Google directly from the app's own domain, so Google's screens say
// "flow.untoworld.com" instead of the Supabase project address. Google returns an ID token to
// auth-return.html, and Supabase signs the user in with it. Other hosts use Supabase's redirect flow.
export const GOOGLE_WEB_CLIENT_ID = '1054263793454-h8q5lhki7k9gjkt7g1io528437i3dhpe.apps.googleusercontent.com';
export const OWN_GOOGLE_ORIGINS = ['https://flow.untoworld.com'];
const GOOGLE_PENDING_KEY = 'fable_flow_google_pending_v1';

// Built-in default project configuration (populated by scripts/provision_supabase.py or UI)
export const DEFAULT_SUPABASE_CONFIG = {
  url: 'https://hnuzvsdxrtcuylfvoftn.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudXp2c2R4cnRjdXlsZnZvZnRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzIyMzMsImV4cCI6MjEwNzY0ODIzM30.i_UeE3WGSG_xboeUA0zYWZBy3HCQ8qO2oOkCusk780c',
};

export class SupabaseSyncService {
  constructor() {
    this.config = this._loadConfig();
    this.session = this._loadSession();
    this.lastSyncedAt = this.session ? this.session.lastSyncedAt || null : null;
    this.isSyncing = false;
    this._syncTimer = null;
    this._checkOAuthRedirectHash();
  }

  /**
   * The app always talks to its own built-in cloud project. (Earlier builds let a link like
   * ?supabase_url=... or a saved setting swap in another server, which a bad actor could use to
   * collect passwords, so those overrides are ignored and cleared.)
   */
  _loadConfig() {
    try {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch (_) {}
    if (DEFAULT_SUPABASE_CONFIG.url && DEFAULT_SUPABASE_CONFIG.anonKey) {
      return {
        url: String(DEFAULT_SUPABASE_CONFIG.url).trim().replace(/\/+$/, ''),
        anonKey: String(DEFAULT_SUPABASE_CONFIG.anonKey).trim(),
      };
    }
    return { url: '', anonKey: '' };
  }

  isCloudConfigured() {
    return Boolean(
      this.config &&
        this.config.url &&
        this.config.url.startsWith('https://') &&
        this.config.anonKey &&
        this.config.anonKey.length > 15
    );
  }

  _loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user && parsed.user.id && parsed.user.email) {
        if (
          parsed.user.email === 'google.user@gmail.com' ||
          parsed.user.email === 'apple.user@icloud.com'
        ) {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          return null;
        }
        // A device-only ("local vault") login can't talk to the cloud: ask for a real sign-in.
        // The cards themselves stay on the device; nothing is deleted.
        if (this.isCloudConfigured() && parsed.mode !== 'supabase') {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          return null;
        }
        return parsed;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  _saveSession(session) {
    this.session = session;
    try {
      if (session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (_) {}
  }

  /**
   * fetch() that turns the browser's cryptic network errors ("Load failed" in Safari,
   * "Failed to fetch" in Chrome) into a clear message.
   */
  async _fetch(url, options) {
    try {
      return await fetch(url, options);
    } catch (e) {
      const err = new Error("Can't reach the sync server. Check your internet connection, or try another Wi-Fi or mobile data.");
      err.code = 'network';
      throw err;
    }
  }

  /** Builds a cloud session from a GoTrue token response (keeps the expiry so we can refresh). */
  _cloudSessionFrom(data, fallbackEmail, provider = 'email') {
    const userObj = data.user || {};
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = data.expires_at || (data.expires_in ? nowSec + Number(data.expires_in) : nowSec + 3600);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresAt,
      mode: 'supabase',
      lastSyncedAt: new Date().toISOString(),
      user: {
        id: userObj.id,
        email: userObj.email || fallbackEmail,
        provider,
      },
    };
  }

  /** Cloud logins last an hour; renew with the refresh token so syncing never silently stops. */
  async _refreshSession() {
    if (!this.session || !this.session.refreshToken) return false;
    if (this._refreshing) return this._refreshing;
    this._refreshing = (async () => {
      try {
        const res = await this._fetch(`${this.config.url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { apikey: this.config.anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.session.refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data.access_token) return false;
        const next = this._cloudSessionFrom(data, this.session.user.email, this.session.user.provider);
        next.user.id = next.user.id || this.session.user.id;
        next.lastSyncedAt = this.session.lastSyncedAt || next.lastSyncedAt;
        this._saveSession(next);
        return true;
      } catch (_) {
        return false;
      } finally {
        setTimeout(() => {
          this._refreshing = null;
        }, 0);
      }
    })();
    return this._refreshing;
  }

  /** fetch() with the user's cloud token; refreshes it first if it's about to expire, retries once on 401. */
  async _authedFetch(url, options = {}) {
    if (!this.session || !this.session.accessToken) throw new Error('Not signed in');
    const nowSec = Math.floor(Date.now() / 1000);
    if (this.session.expiresAt && this.session.expiresAt - 60 < nowSec) {
      await this._refreshSession();
    }
    const doFetch = () =>
      this._fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          apikey: this.config.anonKey,
          Authorization: `Bearer ${this.session.accessToken}`,
        },
      });
    let res = await doFetch();
    if (res.status === 401 && (await this._refreshSession())) {
      res = await doFetch();
    }
    return res;
  }

  getCurrentUser() {
    return this.session && this.session.user ? this.session.user : null;
  }

  isLoggedIn() {
    return Boolean(this.getCurrentUser());
  }

  /** Sign-in links (Google, password reset) come back with tokens or an error in the URL #fragment. */
  _checkOAuthRedirectHash() {
    try {
      if (typeof window === 'undefined' || !window.location.hash) return;
      const hash = window.location.hash.substring(1);
      if (!/access_token=|id_token=|error=|error_code=/.test(hash)) return;
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      this.handleAuthFragment(hash);
    } catch (_) {}
  }

  /**
   * Handles a returned auth fragment, either from this page's URL or handed over by the iPhone
   * app after Google sign-in in the system sign-in sheet. Returns 'signed-in' | 'error' | 'cancelled' | 'ignored'.
   */
  handleAuthFragment(fragment) {
    const params = new URLSearchParams(String(fragment || '').replace(/^#/, ''));
    // "Cancel" on Google's screen comes back as a bare access_denied; Supabase errors (e.g. an expired
    // reset link) also say access_denied but carry an error_code, and those should be shown.
    const googleCancelled = params.get('error') === 'access_denied' && !params.get('error_code');
    if (params.get('error') === 'cancelled' || googleCancelled) return 'cancelled';
    if (params.get('id_token') && this.isCloudConfigured()) {
      this._linkSessionReady = this._signInWithGoogleIdToken(params.get('id_token'), params.get('state') || '').catch(
        (err) => {
          if (typeof this.onAuthLinkError === 'function') this.onAuthLinkError(err.message || 'Sign-in failed');
          else this.pendingAuthLinkError = err.message || 'Sign-in failed';
        }
      );
      return 'signed-in';
    }
    if (params.get('error') || params.get('error_code')) {
      const code = params.get('error_code') || '';
      const msg =
        code === 'otp_expired'
          ? 'This reset link has expired or was already used. Request a new one.'
          : params.get('error_description') || 'Sign-in failed';
      this.pendingAuthLinkError = msg;
      if (typeof this.onAuthLinkError === 'function') {
        this.pendingAuthLinkError = null;
        this.onAuthLinkError(msg);
      }
      return 'error';
    }
    const accessToken = params.get('access_token');
    if (!accessToken || !this.isCloudConfigured()) return 'ignored';
    const refreshToken = params.get('refresh_token');
    const linkType = params.get('type') || '';
    const expiresIn = Number(params.get('expires_in')) || 3600;
    if (linkType === 'recovery') this.passwordRecoveryPending = true;
    this._linkSessionReady = this._fetchSupabaseUserFromToken(accessToken, refreshToken, linkType, expiresIn);
    return 'signed-in';
  }

  async _fetchSupabaseUserFromToken(accessToken, refreshToken, linkType = '', expiresIn = 3600) {
    try {
      const res = await this._fetch(`${this.config.url}/auth/v1/user`, {
        headers: {
          apikey: this.config.anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) return;
      const user = await res.json();
      if (user && user.id) {
        this._saveSession({
          accessToken,
          refreshToken: refreshToken || null,
          expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
          mode: 'supabase',
          lastSyncedAt: new Date().toISOString(),
          user: {
            id: user.id,
            email: user.email || 'user@supabase.io',
            provider: (user.app_metadata && user.app_metadata.provider) || 'oauth',
          },
        });
        if (typeof this.onAuthStateChange === 'function') {
          this.onAuthStateChange(this.getCurrentUser());
        }
        if (linkType === 'recovery' && typeof this.onPasswordRecovery === 'function') {
          this.onPasswordRecovery(this.getCurrentUser());
        }
      }
    } catch (_) {}
  }

  _loadLocalAccounts() {
    try {
      const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  _saveLocalAccounts(accounts) {
    try {
      localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (_) {}
  }

  _hashPassword(pw) {
    let h = 2166136261;
    const str = `fable_flow_salt_${pw}`;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  _makeDeterministicUserId(email) {
    const clean = String(email || '').trim().toLowerCase();
    let h1 = 0xdeadbeef ^ clean.length;
    let h2 = 0x41c6ce57 ^ clean.length;
    for (let i = 0; i < clean.length; i++) {
      const ch = clean.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return `usr-${hex1}-${hex2}`;
  }

  async signUp(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Enter a valid email address');
    }
    if (cleanPass.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    if (this.isCloudConfigured()) {
      const res = await this._fetch(`${this.config.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: this.config.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.msg || data.error_description || data.message || '';
        if (/already registered|already exists/i.test(msg)) {
          throw new Error('Account already exists — switch to Sign In');
        }
        throw new Error(msg || 'Sign up failed');
      }
      if (!data.access_token) {
        throw new Error('Check your email to confirm your account, then sign in');
      }
      const session = this._cloudSessionFrom(data, cleanEmail);
      this.lastSyncedAt = session.lastSyncedAt;
      this._saveSession(session);
      return { user: this.getCurrentUser(), isNewUser: true };
    }

    // Local Vault Mode (Supabase-compatible structure)
    const accounts = this._loadLocalAccounts();
    if (accounts[cleanEmail]) {
      throw new Error('Account already exists — switch to Sign In');
    }
    const userId = this._makeDeterministicUserId(cleanEmail);
    accounts[cleanEmail] = {
      id: userId,
      email: cleanEmail,
      passwordHash: this._hashPassword(cleanPass),
      provider: 'email',
      createdAt: new Date().toISOString(),
    };
    this._saveLocalAccounts(accounts);

    const nowIso = new Date().toISOString();
    this.lastSyncedAt = nowIso;
    this._saveSession({
      accessToken: `local-token-${userId}`,
      mode: 'local-vault',
      lastSyncedAt: nowIso,
      user: {
        id: userId,
        email: cleanEmail,
        provider: 'email',
      },
    });
    return { user: this.getCurrentUser(), isNewUser: true };
  }

  async signIn(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Enter a valid email address');
    }
    if (!cleanPass) {
      throw new Error('Enter your password');
    }

    if (this.isCloudConfigured()) {
      const res = await this._fetch(`${this.config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: this.config.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error_description || data.msg || data.message || '';
        if (/email not confirmed/i.test(msg)) {
          throw new Error('Check your email to confirm your account, then sign in');
        }
        if (/invalid login credentials/i.test(msg) || data.error_code === 'invalid_credentials') {
          const exists = await this.accountExists(cleanEmail);
          if (exists === false) {
            const err = new Error('No account found under this email.');
            err.code = 'no_account';
            throw err;
          }
          if (exists === true) {
            const err = new Error('Wrong password. Try again, or tap "Forgot password?"');
            err.code = 'wrong_password';
            throw err;
          }
          throw new Error('Wrong email or password');
        }
        throw new Error(msg || 'Sign-in failed');
      }
      const session = this._cloudSessionFrom(data, cleanEmail);
      this.lastSyncedAt = session.lastSyncedAt;
      this._saveSession(session);
      return { user: this.getCurrentUser(), isNewUser: false };
    }

    // Local Vault Mode
    const accounts = this._loadLocalAccounts();
    const existing = accounts[cleanEmail];
    if (!existing) {
      throw new Error('No account on this device. Accounts don\'t sync between devices yet.');
    }
    if (existing.passwordHash && existing.passwordHash !== this._hashPassword(cleanPass)) {
      throw new Error('Incorrect password');
    }

    const nowIso = new Date().toISOString();
    this.lastSyncedAt = nowIso;
    this._saveSession({
      accessToken: `local-token-${existing.id}`,
      mode: 'local-vault',
      lastSyncedAt: nowIso,
      user: {
        id: existing.id,
        email: existing.email,
        provider: existing.provider || 'email',
      },
    });
    return { user: this.getCurrentUser(), isNewUser: false };
  }

  /**
   * true / false if the cloud can say whether an account uses this email, null if unknown
   * (needs the public.account_exists() function from supabase/schema.sql).
   */
  async accountExists(email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean || !this.isCloudConfigured()) return null;
    try {
      const res = await this._fetch(`${this.config.url}/rest/v1/rpc/account_exists`, {
        method: 'POST',
        headers: {
          apikey: this.config.anonKey,
          Authorization: `Bearer ${this.config.anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ check_email: clean }),
      });
      if (!res.ok) return null;
      const val = await res.json();
      return val === true ? true : val === false ? false : null;
    } catch (_) {
      return null;
    }
  }

  /** Emails a password reset link that opens this app. */
  async requestPasswordReset(email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      throw new Error('Enter your email above first');
    }
    if (!this.isCloudConfigured()) {
      throw new Error('Password reset needs cloud sync');
    }
    const exists = await this.accountExists(clean);
    if (exists === false) {
      const err = new Error('No account found under this email.');
      err.code = 'no_account';
      throw err;
    }
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const res = await this._fetch(
      `${this.config.url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: 'POST',
        headers: { apikey: this.config.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.msg || data.error_description || data.message || '';
      if (res.status === 429 || /rate limit|security purposes/i.test(msg)) {
        throw new Error('Too many reset emails. Please wait a few minutes and try again.');
      }
      throw new Error(msg || "Couldn't send the reset email");
    }
    return true;
  }

  /** Sets a new password for the signed-in user (used after opening a reset link). */
  async updatePassword(newPassword) {
    const pw = String(newPassword || '');
    if (pw.length < 6) throw new Error('Password must be at least 6 characters');
    if (this._linkSessionReady) await this._linkSessionReady;
    if (!this.session || this.session.mode !== 'supabase') {
      throw new Error('This reset link has expired or was already used. Request a new one.');
    }
    const res = await this._authedFetch(`${this.config.url}/auth/v1/user`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.msg || data.error_description || data.message || '';
      if (data.error_code === 'same_password' || /different from the old/i.test(msg)) {
        throw new Error('Choose a password different from your old one');
      }
      throw new Error(msg || "Couldn't save the new password");
    }
    this.passwordRecoveryPending = false;
    return true;
  }

  /** Which social sign-ins are switched on in Supabase ({ google, apple }); cached for 5 minutes. */
  async getEnabledOAuthProviders() {
    const none = { google: false, apple: false };
    if (!this.isCloudConfigured()) return none;
    if (this._oauthProviders && Date.now() - this._oauthProvidersAt < 5 * 60 * 1000) {
      return this._oauthProviders;
    }
    try {
      const res = await this._fetch(`${this.config.url}/auth/v1/settings`, {
        headers: { apikey: this.config.anonKey },
      });
      if (!res.ok) return none;
      const settings = await res.json();
      const ext = (settings && settings.external) || {};
      this._oauthProviders = { google: ext.google === true, apple: ext.apple === true };
      this._oauthProvidersAt = Date.now();
      return this._oauthProviders;
    } catch (_) {
      return none;
    }
  }

  async _isExternalOAuthEnabled(provider) {
    if (!this.isCloudConfigured()) return false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await this._fetch(`${this.config.url}/auth/v1/settings`, {
        headers: { apikey: this.config.anonKey },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return false;
      const settings = await res.json();
      return Boolean(settings && settings.external && settings.external[provider] === true);
    } catch (_) {
      return false;
    }
  }

  _resolveProviderEmail(cleanProvider, emailHint) {
    const trimmed = String(emailHint || '').trim().toLowerCase();
    if (trimmed && trimmed.includes('@')) return trimmed;
    return '';
  }

  /** True when this page is served from a domain registered with Google for the direct flow. */
  _canUseOwnGoogleFlow() {
    return typeof window !== 'undefined' && OWN_GOOGLE_ORIGINS.includes(window.location.origin);
  }

  async _sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  _randomHex(bytes = 24) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** Builds Google's sign-in URL (OpenID Connect, ID token) and remembers the nonce/state for the return trip. */
  async _buildOwnGoogleUrl(forNativeApp) {
    const nonce = this._randomHex();
    const state = `${forNativeApp ? 'n' : 'w'}.${this._randomHex(12)}`;
    try {
      localStorage.setItem(GOOGLE_PENDING_KEY, JSON.stringify({ nonce, state, at: Date.now() }));
    } catch (_) {}
    const params = new URLSearchParams({
      client_id: GOOGLE_WEB_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth-return.html`,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce: await this._sha256Hex(nonce),
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Exchanges Google's ID token for a Supabase session. */
  async _signInWithGoogleIdToken(idToken, state) {
    let pending = null;
    try {
      pending = JSON.parse(localStorage.getItem(GOOGLE_PENDING_KEY) || 'null');
      localStorage.removeItem(GOOGLE_PENDING_KEY);
    } catch (_) {}
    if (!pending || pending.state !== state || Date.now() - pending.at > 15 * 60 * 1000) {
      throw new Error('Sign-in expired. Please try again.');
    }
    const res = await this._fetch(`${this.config.url}/auth/v1/token?grant_type=id_token`, {
      method: 'POST',
      headers: { apikey: this.config.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', id_token: idToken, nonce: pending.nonce }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new Error(data.msg || data.error_description || data.message || 'Sign-in failed');
    }
    const session = this._cloudSessionFrom(data, (data.user && data.user.email) || '', 'google');
    this.lastSyncedAt = session.lastSyncedAt;
    this._saveSession(session);
    if (typeof this.onAuthStateChange === 'function') {
      this.onAuthStateChange(this.getCurrentUser());
    }
    return this.getCurrentUser();
  }

  async signInWithProvider(provider, emailHint = '') {
    const cleanProvider = provider === 'apple' ? 'apple' : 'google';
    const cleanEmail = this._resolveProviderEmail(cleanProvider, emailHint);

    if (this.isCloudConfigured()) {
      const oauthEnabled = await this._isExternalOAuthEnabled(cleanProvider);
      if (oauthEnabled) {
        const handler =
          window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.untoNative;
        const isNativeApp = Boolean(window.__UNTO_NATIVE_IOS__ && handler);
        if (cleanProvider === 'google' && this._canUseOwnGoogleFlow()) {
          if (isNativeApp && !window.__UNTO_NATIVE_OAUTH__) {
            throw new Error('Update the iPhone app (press Run in Xcode) to use Google sign-in.');
          }
          const googleUrl = await this._buildOwnGoogleUrl(isNativeApp);
          if (isNativeApp) {
            handler.postMessage({ action: 'oauthSignIn', url: googleUrl });
          } else {
            window.location.href = googleUrl;
          }
          return { redirecting: true };
        }
        if (window.__UNTO_NATIVE_IOS__ && handler) {
          // iPhone app: Google refuses sign-in inside an app's embedded browser, so the app opens
          // Apple's secure sign-in sheet and hands the result back through untoflow://auth-callback.
          if (!window.__UNTO_NATIVE_OAUTH__) {
            throw new Error('Update the iPhone app (press Run in Xcode) to use Google sign-in.');
          }
          const authUrl = `${this.config.url}/auth/v1/authorize?provider=${cleanProvider}&redirect_to=${encodeURIComponent(
            'untoflow://auth-callback'
          )}`;
          handler.postMessage({ action: 'oauthSignIn', url: authUrl });
          return { redirecting: true };
        }
        const redirectTo = encodeURIComponent(window.location.origin + window.location.pathname);
        window.location.href = `${this.config.url}/auth/v1/authorize?provider=${cleanProvider}&redirect_to=${redirectTo}`;
        return { redirecting: true };
      }
    }

    if (!cleanEmail) {
      throw new Error(
        cleanProvider === 'apple'
          ? 'Enter your Apple ID email above first, or connect OAuth in Cloud Sync settings'
          : 'Enter your Google email above first, or connect OAuth in Cloud Sync settings'
      );
    }

    if (this.isCloudConfigured()) {
      // Real Google / Apple sign-in isn't connected yet. (Never fake it with a password derived
      // from the email address: anyone who knew the email could open the account.)
      throw new Error('Google / Apple sign-in isn\'t set up yet. Use email and password.');
    }

    const accounts = this._loadLocalAccounts();
    const isNew = !accounts[cleanEmail];
    const userId = existingIdOrNew(accounts[cleanEmail], this._makeDeterministicUserId(cleanEmail));

    accounts[cleanEmail] = {
      id: userId,
      email: cleanEmail,
      passwordHash: null,
      provider: cleanProvider,
      createdAt: (accounts[cleanEmail] && accounts[cleanEmail].createdAt) || new Date().toISOString(),
    };
    this._saveLocalAccounts(accounts);

    const nowIso = new Date().toISOString();
    this.lastSyncedAt = nowIso;
    this._saveSession({
      accessToken: `local-oauth-${userId}`,
      mode: 'local-vault',
      lastSyncedAt: nowIso,
      user: {
        id: userId,
        email: cleanEmail,
        provider: cleanProvider,
      },
    });
    return { user: this.getCurrentUser(), isNewUser: isNew };
  }

  async signOut() {
    if (this.isCloudConfigured() && this.session && this.session.accessToken) {
      try {
        await this._fetch(`${this.config.url}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: this.config.anonKey,
            Authorization: `Bearer ${this.session.accessToken}`,
          },
        });
      } catch (_) {}
    }
    this._saveSession(null);
    this.lastSyncedAt = null;
  }

  loadUserVaultState(userId) {
    if (!userId) return null;
    try {
      const raw = localStorage.getItem(`${USER_VAULT_PREFIX}${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  saveUserVaultState(userId, statePayload) {
    if (!userId || !statePayload) return;
    try {
      localStorage.setItem(
        `${USER_VAULT_PREFIX}${userId}`,
        JSON.stringify({
          state: statePayload,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (_) {}
  }

  /**
   * Returns { state, updatedAt } from the cloud, or null if this account has no cloud copy yet.
   * Throws if the cloud can't be reached, so callers never mistake an outage for "empty".
   */
  async pullCloudRecord() {
    const user = this.getCurrentUser();
    if (!user || !this.isCloudConfigured() || !this.session || !this.session.accessToken) return null;
    const url = `${this.config.url}/rest/v1/fable_flow_user_state?user_id=eq.${encodeURIComponent(
      user.id
    )}&select=state_json,updated_at`;
    const res = await this._authedFetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Cloud sync unavailable (${res.status})`);
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows[0].state_json) {
      this.lastSyncedAt = rows[0].updated_at || new Date().toISOString();
      this.saveUserVaultState(user.id, rows[0].state_json);
      return { state: rows[0].state_json, updatedAt: rows[0].updated_at || null };
    }
    return null;
  }

  async pullCloudState() {
    const user = this.getCurrentUser();
    if (!user) return null;
    if (this.isCloudConfigured() && this.session && this.session.mode === 'supabase') {
      const rec = await this.pullCloudRecord();
      return rec ? rec.state : null;
    }
    const localRecord = this.loadUserVaultState(user.id);
    if (localRecord && localRecord.state) {
      this.lastSyncedAt = localRecord.updatedAt || this.lastSyncedAt;
      return localRecord.state;
    }
    return null;
  }

  async pushCloudState(statePayload) {
    const user = this.getCurrentUser();
    if (!user || !statePayload) return false;

    const snapshot = JSON.parse(JSON.stringify(statePayload));
    this.saveUserVaultState(user.id, snapshot);
    const nowIso = new Date().toISOString();
    this.lastSyncedAt = nowIso;
    if (this.session) {
      this.session.lastSyncedAt = nowIso;
      this._saveSession(this.session);
    }

    if (this.isCloudConfigured() && this.session && this.session.accessToken) {
      try {
        this.isSyncing = true;
        const res = await this._authedFetch(`${this.config.url}/rest/v1/fable_flow_user_state`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({
            user_id: user.id,
            email: user.email,
            state_json: snapshot,
            updated_at: nowIso,
          }),
        });
        this.isSyncing = false;
        if (res.ok) this.lastPushedAt = nowIso;
        return res.ok;
      } catch (_) {
        this.isSyncing = false;
        return false;
      }
    }
    return true;
  }

  schedulePushCloudState(statePayload, delayMs = 350) {
    if (!this.isLoggedIn()) return;
    const user = this.getCurrentUser();
    if (user) {
      this.saveUserVaultState(user.id, statePayload);
    }
    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
    }
    this._syncTimer = setTimeout(() => {
      this._syncTimer = null;
      this.pushCloudState(statePayload);
    }, delayMs);
  }
}

function existingIdOrNew(entry, fallbackId) {
  return entry && entry.id ? entry.id : fallbackId;
}
