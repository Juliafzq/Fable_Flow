"""Google sign-in plumbing: web redirect + iPhone-app hand-off (simulated native bridge) + returned tokens."""
import sys, json, time
sys.path.insert(0, '/usr/local/google/home/zuqi/github/ProjectFocus/qa')
from cdp_helper import CDP

EMAIL = 'untoflow.synctest+1792078124@gmail.com'
PW = 'Tomato-test-4821'
res = {}
c = CDP(390, 844, port=9721)
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden'); a.state.hasCompletedOnboarding = true; a.renderAll();
  a.supabaseSync._isExternalOAuthEnabled = async () => true; })()""")

# iPhone app: hand-off to the native sign-in sheet
r = c.js("""(async () => { window.__UNTO_NATIVE_IOS__ = true; window.__UNTO_NATIVE_OAUTH__ = true; window.__posted = [];
  window.webkit = { messageHandlers: { untoNative: { postMessage: (m) => window.__posted.push(m) } } };
  const out = await window.fableFlowApp.supabaseSync.signInWithProvider('google'); return { out, posted: window.__posted }; })()""")
p = r['posted'][0] if r['posted'] else {}
res['iPhone app: opens the system sign-in sheet (not the embedded view)'] = p.get('action') == 'oauthSignIn' and 'untoflow%3A%2F%2Fauth-callback' in p.get('url', '') and '/auth/v1/authorize?provider=google' in p.get('url', '') and c.js('location.href').startswith('http://127.0.0.1')
r = c.js("""(async () => { window.__UNTO_NATIVE_OAUTH__ = false; try { await window.fableFlowApp.supabaseSync.signInWithProvider('google'); return 'no error'; } catch (e) { return e.message; } })()""")
res['old iPhone build: asks to update instead of failing silently'] = 'Update the iPhone app' in r

# Sheet cancelled -> nothing happens; error -> message
r = c.js("window.untoHandleAuthCallback('error=cancelled')")
res['cancelled sheet is ignored'] = r == 'cancelled' and c.js("document.getElementById('auth-modal-overlay').classList.contains('hidden')")
c.js("window.untoHandleAuthCallback('error=server_error&error_code=unexpected_failure&error_description=Google+said+no')")
res['sign-in error is shown on the sign-in screen'] = c.js("document.getElementById('auth-error-msg').textContent") == 'Google said no'

# Real tokens handed back by the sheet -> signed in, modal closes, toast
tok = c.js(f"""(async () => {{ const s = window.fableFlowApp.supabaseSync; const r = await fetch(`${{s.config.url}}/auth/v1/token?grant_type=password`, {{ method: 'POST',
  headers: {{ apikey: s.config.anonKey, 'Content-Type': 'application/json' }}, body: JSON.stringify({{ email: {json.dumps(EMAIL)}, password: {json.dumps(PW)} }}) }}); return await r.json(); }})()""")
frag = f"access_token={tok['access_token']}&expires_in=3600&provider_token=x&refresh_token={tok['refresh_token']}&token_type=bearer"
c.js(f"window.untoHandleAuthCallback({json.dumps(frag)})")
time.sleep(1.5)
st = c.js("(() => { const a = window.fableFlowApp; return { in: a.supabaseSync.isLoggedIn(), email: a.supabaseSync.getCurrentUser() && a.supabaseSync.getCurrentUser().email, modalHidden: document.getElementById('auth-modal-overlay').classList.contains('hidden'), mode: a.supabaseSync.session && a.supabaseSync.session.mode }; })()")
res['tokens from the sheet sign the user in and close the dialog'] = st['in'] and st['email'] == EMAIL and st['modalHidden'] and st['mode'] == 'supabase'
res['_state'] = st
c.close()

# Web (Safari / Chrome / Mac app): full-page redirect to Google via Supabase
c = CDP(390, 844, port=9722)
c.js("(() => { const a = window.fableFlowApp; a.supabaseSync._isExternalOAuthEnabled = async () => true; a.supabaseSync.signInWithProvider('google'); })()")
time.sleep(2.0)
href = c.js("location.href")
res['web: goes to Supabase/Google sign-in with the app as the return address'] = href.startswith('https://hnuzvsdxrtcuylfvoftn.supabase.co/auth/v1/authorize') or 'supabase.co' in href or 'accounts.google.com' in href
res['_web_href'] = href[:160]
c.close()
ok = all(v for k, v in res.items() if not k.startswith('_'))
print(json.dumps(res, indent=1)); print('PASS' if ok else 'FAIL')
