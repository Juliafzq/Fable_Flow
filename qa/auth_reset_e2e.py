"""Sign-in errors + forgot / reset password, against the real Supabase project (no emails are sent:
the reset email request and the account lookup are simulated; the emailed link + new password are real).
Uses the throwaway account made by cloud_sync_e2e.py."""
import sys, json, time
sys.path.insert(0, '/usr/local/google/home/zuqi/github/ProjectFocus/qa')
from cdp_helper import CDP

EMAIL = sys.argv[1] if len(sys.argv) > 1 else 'untoflow.synctest+1792078124@gmail.com'
PW = sys.argv[2] if len(sys.argv) > 2 else 'Tomato-test-4821'
NEW_PW = PW + '-new'
res = {}

c = CDP(390, 844, port=9671)
c.js("(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden'); a.state.hasCompletedOnboarding = true; a.renderAll(); })()")
time.sleep(0.8)

ui = lambda: c.js("""(() => { const a = window.fableFlowApp, e = a.els; const vis = (el) => el && !el.classList.contains('hidden') && el.offsetParent !== null;
  return { msg: vis(e.authErrorMsg) ? e.authErrorMsg.textContent : null, info: e.authErrorMsg.classList.contains('is-info'),
           createBtn: vis(e.authErrorActionBtn), forgot: vis(e.authForgotBtn), mode: a._authMode,
           resetView: vis(e.authViewReset), signedIn: a.supabaseSync.isLoggedIn(), pwType: e.authPasswordInput.type,
           pwAutocomplete: e.authPasswordInput.getAttribute('autocomplete'), email: e.authEmailInput.value }; })()""")

# Simulate the account_exists() lookup + /recover (no email sent) by wrapping fetch
c.js("""(() => { const real = window.fetch; window.__lookup = null; window.__recoverCalls = [];
  window.fetch = async (url, opts) => { const u = String(url);
    if (u.includes('/rest/v1/rpc/account_exists') && window.__lookup === 'missing') return new Response('{"code":"PGRST202"}', { status: 404 });
    if (u.includes('/rest/v1/rpc/account_exists') && window.__lookup !== null) return new Response(JSON.stringify(window.__lookup), { status: 200 });
    if (u.includes('/auth/v1/recover')) { window.__recoverCalls.push({ u, body: opts && opts.body }); return new Response('{}', { status: 200 }); }
    return real(url, opts); }; })()""")

def submit(mode, email, pw):
    c.js(f"""(async () => {{ const a = window.fableFlowApp; a.openAuthModal('{mode}'); a.els.authEmailInput.value = {json.dumps(email)};
      a.els.authPasswordInput.value = {json.dumps(pw)}; await a.handleAuthFormSubmit(); }})()""")
    return ui()

c.js("window.fableFlowApp.openAuthModal('signin')"); time.sleep(0.2)
u = ui(); res['sign-in tab shows "Forgot password?"'] = u['forgot'] and u['pwAutocomplete'] == 'current-password'
c.js("document.getElementById('auth-tab-signup').click()"); u = ui()
res['create-account tab hides it, asks browser for a new password'] = (not u['forgot']) and u['pwAutocomplete'] == 'new-password'
c.js("document.getElementById('auth-tab-signin').click()")
c.js("document.getElementById('auth-password-toggle').click()"); u1 = ui(); c.js("document.getElementById('auth-password-toggle').click()"); u2 = ui()
res['Show / Hide reveals the typed password'] = u1['pwType'] == 'text' and u2['pwType'] == 'password'

# Sign-in errors
c.js("window.__lookup = false")
u = submit('signin', 'nobody.here.' + str(int(time.time())) + '@gmail.com', 'whatever1')
res['unknown email -> "No account found" + Create Account button'] = u['msg'] == 'No account found under this email.' and u['createBtn']
c.js("document.getElementById('auth-error-action-btn').click()"); u2 = ui()
res['Create Account button switches tab and keeps the email'] = u2['mode'] == 'signup' and u2['email'].startswith('nobody.here.') and not u2['msg']
c.js("window.__lookup = true")
u = submit('signin', EMAIL, 'definitely-wrong')
res['known email + wrong password -> "Wrong password ... Forgot password?"'] = (u['msg'] or '').startswith('Wrong password') and not u['createBtn']
c.js("window.__lookup = 'missing'")
u = submit('signin', EMAIL, 'definitely-wrong')
res['before the SQL function exists -> generic message (no crash)'] = u['msg'] == 'Wrong email or password'

# Forgot password
c.js("window.fableFlowApp.supabaseSync.signOut()")
c.js("(() => { const a = window.fableFlowApp; a.openAuthModal('signin'); a.els.authEmailInput.value = ''; })()")
c.js("window.fableFlowApp.handleForgotPassword()"); time.sleep(0.2); u = ui()
res['forgot with empty email -> asks for email'] = u['msg'] == 'Enter your email above first'
c.js("window.__lookup = false")
c.js("(async () => { const a = window.fableFlowApp; a.els.authEmailInput.value = 'nobody.else@gmail.com'; await a.handleForgotPassword(); })()"); u = ui()
calls = c.js("window.__recoverCalls.length")
res['forgot with unknown email -> "No account found" + Create Account, no email sent'] = u['msg'] == 'No account found under this email.' and u['createBtn'] and calls == 0
c.js("window.__lookup = true")
c.js(f"(async () => {{ const a = window.fableFlowApp; a.els.authEmailInput.value = {json.dumps(EMAIL)}; await a.handleForgotPassword(); }})()"); u = ui()
rc = c.js("window.__recoverCalls")
res['forgot with known email -> reset email requested, link opens this app'] = (
    u['info'] and (u['msg'] or '').startswith('Reset link sent') and len(rc) == 1 and 'redirect_to=' in rc[0]['u'] and json.loads(rc[0]['body'])['email'] == EMAIL.lower())
res['_recover_call'] = rc

# Real emailed-link flow: get real tokens, then open the app the way the reset email's link does
tok = c.js(f"""(async () => {{ const s = window.fableFlowApp.supabaseSync; const r = await fetch(`${{s.config.url}}/auth/v1/token?grant_type=password`, {{ method: 'POST',
  headers: {{ apikey: s.config.anonKey, 'Content-Type': 'application/json' }}, body: JSON.stringify({{ email: {json.dumps(EMAIL)}, password: {json.dumps(PW)} }}) }});
  return r.ok ? await r.json() : {{ err: r.status }}; }})()""")
c.close()
assert 'access_token' in tok, tok
link = f"http://127.0.0.1:8091/#access_token={tok['access_token']}&expires_in=3600&refresh_token={tok['refresh_token']}&token_type=bearer&type=recovery"
c = CDP(390, 844, port=9672, url=link)
c.js("document.getElementById('about-modal-overlay').classList.add('hidden')")
time.sleep(1.5)
u = ui()
res['reset link opens "Set a new password"'] = u['resetView'] and u['signedIn']
res['reset link is removed from the address bar'] = c.js("location.hash") == ''
c.js(f"(async () => {{ const a = window.fableFlowApp; a.els.authNewPasswordInput.value = {json.dumps(PW)}; await a.handlePasswordResetSubmit(); }})()")
same = c.js("document.getElementById('auth-reset-error-msg').textContent")
res['reusing the old password is explained'] = 'different' in same
c.js(f"(async () => {{ const a = window.fableFlowApp; a.els.authNewPasswordInput.value = {json.dumps(NEW_PW)}; await a.handlePasswordResetSubmit(); }})()")
time.sleep(0.5)
u = ui()
res['new password saved, modal closes'] = not u['resetView'] and c.js("document.getElementById('auth-modal-overlay').classList.contains('hidden')")
# sign in elsewhere with the new password, then put the old password back for future test runs
check = c.js(f"""(async () => {{ const s = window.fableFlowApp.supabaseSync; const tryPw = async (pw) => (await fetch(`${{s.config.url}}/auth/v1/token?grant_type=password`, {{ method: 'POST',
  headers: {{ apikey: s.config.anonKey, 'Content-Type': 'application/json' }}, body: JSON.stringify({{ email: {json.dumps(EMAIL)}, password: pw }}) }})).ok;
  const newOk = await tryPw({json.dumps(NEW_PW)}); const oldOk = await tryPw({json.dumps(PW)});
  await s.updatePassword({json.dumps(PW)}); return {{ newOk, oldOk }}; }})()""")
res['new password works, old one no longer does'] = check['newOk'] and not check['oldOk']
c.close()

# Expired / used link
c = CDP(390, 844, port=9673, url="http://127.0.0.1:8091/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")
c.js("document.getElementById('about-modal-overlay').classList.add('hidden')"); time.sleep(1.0)
u = ui()
res['expired reset link -> clear message on the sign-in screen'] = (u['msg'] or '').startswith('This reset link has expired')
c.close()

ok = all(v for k, v in res.items() if not k.startswith('_'))
print(json.dumps(res, indent=1, ensure_ascii=False))
print('PASS' if ok else 'FAIL')
