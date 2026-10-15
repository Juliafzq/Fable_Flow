"""Own-domain Google sign-in (ID token): URL shape, state/nonce, Supabase exchange call, native hand-off."""
import sys, json, time
from urllib.parse import urlparse, parse_qs
sys.path.insert(0, '.')
from cdp_helper import CDP
res = {}
c = CDP(390, 844, port=int(sys.argv[1]) if len(sys.argv) > 1 else 9751)
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden'); a.state.hasCompletedOnboarding = true; a.renderAll();
  const s = a.supabaseSync; s._isExternalOAuthEnabled = async () => true; s._canUseOwnGoogleFlow = () => true;
  const realFetch = window.fetch; window.__calls = [];
  window.fetch = async (url, opts) => { if (String(url).includes('grant_type=id_token')) { window.__calls.push({ url: String(url), body: JSON.parse(opts.body) }); } return realFetch(url, opts); }; })()""")
# iPhone app path: native sheet gets a Google URL that returns to auth-return.html with an "n." state
r = c.js("""(async () => { window.__UNTO_NATIVE_IOS__ = true; window.__UNTO_NATIVE_OAUTH__ = true; window.__posted = [];
  window.webkit = { messageHandlers: { untoNative: { postMessage: (m) => window.__posted.push(m) } } };
  await window.fableFlowApp.supabaseSync.signInWithProvider('google');
  return { posted: window.__posted, pending: JSON.parse(localStorage.getItem('fable_flow_google_pending_v1')) }; })()""")
u = urlparse(r['posted'][0]['url']); q = {k: v[0] for k, v in parse_qs(u.query).items()}
res['goes straight to Google (not supabase.co)'] = u.netloc == 'accounts.google.com'
res['returns to our own page'] = q.get('redirect_uri', '').endswith('/auth-return.html') and 'supabase' not in q.get('redirect_uri', '')
res['asks only for name + email (ID token)'] = q.get('response_type') == 'id_token' and q.get('scope') == 'openid email profile'
res['iPhone state marks the app sheet'] = q.get('state', '').startswith('n.') and q['state'] == r['pending']['state']
nonce_ok = c.js(f"(async () => (await window.fableFlowApp.supabaseSync._sha256Hex({json.dumps(r['pending']['nonce'])})) === {json.dumps(q.get('nonce'))})()")
res['Google gets the hashed nonce, raw nonce kept for Supabase'] = nonce_ok
# Wrong state is rejected before calling Supabase
c.js("window.untoHandleAuthCallback('id_token=fake.jwt.token&state=w.wrong')"); time.sleep(1.2)
res['mismatched state is rejected (no Supabase call)'] = c.js("window.__calls.length") == 0 and 'expired' in c.js("document.getElementById('auth-error-msg').textContent")
# Correct state: exchange is attempted with the raw nonce; Supabase rejects the fake token with a message
c.js("""(async () => { window.__UNTO_NATIVE_IOS__ = false; await window.fableFlowApp.supabaseSync._buildOwnGoogleUrl(false); })()""")
p = c.js("JSON.parse(localStorage.getItem('fable_flow_google_pending_v1'))")
c.js(f"window.untoHandleAuthCallback('id_token=eyJhbGciOiJSUzI1NiJ9.e30.sig&state=' + {json.dumps(p['state'])})"); time.sleep(2.0)
calls = c.js("window.__calls")
res['valid state -> Supabase ID-token sign-in called with raw nonce'] = len(calls) == 1 and calls[0]['body']['provider'] == 'google' and calls[0]['body']['nonce'] == p['nonce']
msg = c.js("document.getElementById('auth-error-msg').textContent")
res['bad token -> readable error, still signed out'] = bool(msg) and not c.js("window.fableFlowApp.supabaseSync.isLoggedIn()")
res['_supabase_said'] = msg
r = c.js("window.untoHandleAuthCallback('error=access_denied&state=w.x')")
res['cancel on Google screen is quiet'] = r == 'cancelled'
c.close()
ok = all(v for k, v in res.items() if not k.startswith('_'))
print(json.dumps(res, indent=1)); print('PASS' if ok else 'FAIL')
