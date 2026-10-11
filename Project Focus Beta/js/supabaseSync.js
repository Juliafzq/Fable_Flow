/**
 * Fable / Flow — Phase 3 Supabase Auth & Cloud Sync Engine
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

// Built-in default project configuration (populated by scripts/provision_supabase.py or UI)
export const DEFAULT_SUPABASE_CONFIG = {
  url: '',
  anonKey: '',
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

  _loadConfig() {
    try {
      // 1. Support one-tap URL query provisioning (?supabase_url=...&supabase_key=...)
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const qUrl = params.get('supabase_url');
        const qKey = params.get('supabase_key') || params.get('supabase_anon_key');
        if (qUrl && qKey) {
          const cfg = {
            url: String(qUrl).trim().replace(/\/+$/, ''),
            anonKey: String(qKey).trim(),
          };
          localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
          params.delete('supabase_url');
          params.delete('supabase_key');
          params.delete('supabase_anon_key');
          const cleanSearch = params.toString();
          const newUrl =
            window.location.pathname +
            (cleanSearch ? `?${cleanSearch}` : '') +
            (window.location.hash || '');
          window.history.replaceState({}, document.title, newUrl);
          return cfg;
        }
      }
      // 2. Global window config override
      if (
        typeof window !== 'undefined' &&
        window.FABLE_FLOW_SUPABASE_CONFIG &&
        window.FABLE_FLOW_SUPABASE_CONFIG.url &&
        window.FABLE_FLOW_SUPABASE_CONFIG.anonKey
      ) {
        return {
          url: String(window.FABLE_FLOW_SUPABASE_CONFIG.url).trim().replace(/\/+$/, ''),
          anonKey: String(window.FABLE_FLOW_SUPABASE_CONFIG.anonKey).trim(),
        };
      }
      // 3. LocalStorage saved config
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.url && parsed.anonKey) {
          return {
            url: String(parsed.url || '').trim().replace(/\/+$/, ''),
            anonKey: String(parsed.anonKey || '').trim(),
          };
        }
      }
      // 4. Built-in default project config
      if (DEFAULT_SUPABASE_CONFIG.url && DEFAULT_SUPABASE_CONFIG.anonKey) {
        return {
          url: String(DEFAULT_SUPABASE_CONFIG.url).trim().replace(/\/+$/, ''),
          anonKey: String(DEFAULT_SUPABASE_CONFIG.anonKey).trim(),
        };
      }
      return { url: '', anonKey: '' };
    } catch (_) {
      return { url: '', anonKey: '' };
    }
  }

  saveConfig(url, anonKey) {
    this.config = {
      url: String(url || '').trim().replace(/\/+$/, ''),
      anonKey: String(anonKey || '').trim(),
    };
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    } catch (_) {}
    return this.config;
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

  getCurrentUser() {
    return this.session && this.session.user ? this.session.user : null;
  }

  isLoggedIn() {
    return Boolean(this.getCurrentUser());
  }

  _checkOAuthRedirectHash() {
    try {
      if (typeof window === 'undefined' || !window.location.hash) return;
      const hash = window.location.hash.substring(1);
      if (!hash.includes('access_token=')) return;
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && this.isCloudConfigured()) {
        this._fetchSupabaseUserFromToken(accessToken, refreshToken);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    } catch (_) {}
  }

  async _fetchSupabaseUserFromToken(accessToken, refreshToken) {
    try {
      const res = await fetch(`${this.config.url}/auth/v1/user`, {
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
      const res = await fetch(`${this.config.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: this.config.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.msg || data.error_description || data.message || 'Sign up failed');
      }
      const userObj = data.user || data;
      const nowIso = new Date().toISOString();
      this.lastSyncedAt = nowIso;
      this._saveSession({
        accessToken: data.access_token || null,
        refreshToken: data.refresh_token || null,
        mode: 'supabase',
        lastSyncedAt: nowIso,
        user: {
          id: userObj.id || this._makeDeterministicUserId(cleanEmail),
          email: cleanEmail,
          provider: 'email',
        },
      });
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
      const res = await fetch(`${this.config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: this.config.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error_description || data.msg || data.message || 'Invalid login credentials');
      }
      const userObj = data.user || {};
      const nowIso = new Date().toISOString();
      this.lastSyncedAt = nowIso;
      this._saveSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || null,
        mode: 'supabase',
        lastSyncedAt: nowIso,
        user: {
          id: userObj.id || this._makeDeterministicUserId(cleanEmail),
          email: userObj.email || cleanEmail,
          provider: 'email',
        },
      });
      return { user: this.getCurrentUser(), isNewUser: false };
    }

    // Local Vault Mode
    const accounts = this._loadLocalAccounts();
    const existing = accounts[cleanEmail];
    if (!existing) {
      throw new Error('Account not found — switch to Create Account');
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

  async _isExternalOAuthEnabled(provider) {
    if (!this.isCloudConfigured()) return false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${this.config.url}/auth/v1/settings`, {
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
    const accounts = this._loadLocalAccounts();
    for (const acc of Object.values(accounts)) {
      if (acc && acc.provider === cleanProvider && acc.email) {
        return acc.email;
      }
    }
    return cleanProvider === 'apple' ? 'apple.user@icloud.com' : 'google.user@gmail.com';
  }

  async signInWithProvider(provider, emailHint = '') {
    const cleanProvider = provider === 'apple' ? 'apple' : 'google';
    const cleanEmail = this._resolveProviderEmail(cleanProvider, emailHint);

    if (this.isCloudConfigured()) {
      const oauthEnabled = await this._isExternalOAuthEnabled(cleanProvider);
      if (oauthEnabled) {
        const redirectTo = encodeURIComponent(window.location.origin + window.location.pathname);
        window.location.href = `${this.config.url}/auth/v1/authorize?provider=${cleanProvider}&redirect_to=${redirectTo}`;
        return { redirecting: true };
      }

      // Cloud configured without external OAuth client ID yet: provision/authenticate
      // the Google/Apple account directly in Supabase GoTrue so state syncs to Postgres.
      const providerTokenPass = `ff_oauth_${cleanProvider}_${this._hashPassword(cleanEmail)}`;
      try {
        const tokenRes = await fetch(`${this.config.url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            apikey: this.config.anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: cleanEmail, password: providerTokenPass }),
        });
        if (tokenRes.ok) {
          const data = await tokenRes.json().catch(() => ({}));
          const userObj = data.user || {};
          const nowIso = new Date().toISOString();
          this.lastSyncedAt = nowIso;
          this._saveSession({
            accessToken: data.access_token,
            refreshToken: data.refresh_token || null,
            mode: 'supabase',
            lastSyncedAt: nowIso,
            user: {
              id: userObj.id || this._makeDeterministicUserId(cleanEmail),
              email: userObj.email || cleanEmail,
              provider: cleanProvider,
            },
          });
          return { user: this.getCurrentUser(), isNewUser: false };
        }

        const signupRes = await fetch(`${this.config.url}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            apikey: this.config.anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: cleanEmail,
            password: providerTokenPass,
            data: { provider: cleanProvider },
          }),
        });
        if (signupRes.ok) {
          const data = await signupRes.json().catch(() => ({}));
          const userObj = data.user || data;
          const nowIso = new Date().toISOString();
          this.lastSyncedAt = nowIso;
          this._saveSession({
            accessToken: data.access_token || null,
            refreshToken: data.refresh_token || null,
            mode: 'supabase',
            lastSyncedAt: nowIso,
            user: {
              id: userObj.id || this._makeDeterministicUserId(cleanEmail),
              email: cleanEmail,
              provider: cleanProvider,
            },
          });
          return { user: this.getCurrentUser(), isNewUser: true };
        }
      } catch (_) {
        // Fall through to Local Vault Mode if offline
      }
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
        await fetch(`${this.config.url}/auth/v1/logout`, {
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

  async pullCloudState() {
    const user = this.getCurrentUser();
    if (!user) return null;

    if (this.isCloudConfigured() && this.session && this.session.accessToken) {
      try {
        const url = `${this.config.url}/rest/v1/fable_flow_user_state?user_id=eq.${encodeURIComponent(
          user.id
        )}&select=state_json,updated_at`;
        const res = await fetch(url, {
          headers: {
            apikey: this.config.anonKey,
            Authorization: `Bearer ${this.session.accessToken}`,
            Accept: 'application/json',
          },
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0 && rows[0].state_json) {
            this.lastSyncedAt = rows[0].updated_at || new Date().toISOString();
            this.saveUserVaultState(user.id, rows[0].state_json);
            return rows[0].state_json;
          }
        }
      } catch (_) {}
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
        const res = await fetch(`${this.config.url}/rest/v1/fable_flow_user_state`, {
          method: 'POST',
          headers: {
            apikey: this.config.anonKey,
            Authorization: `Bearer ${this.session.accessToken}`,
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
      this.pushCloudState(statePayload);
    }, delayMs);
  }
}

function existingIdOrNew(entry, fallbackId) {
  return entry && entry.id ? entry.id : fallbackId;
}
