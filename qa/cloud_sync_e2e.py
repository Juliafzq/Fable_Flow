"""End-to-end cloud sync across two independent browsers ("Mac" and "Phone") against the real Supabase project.
Usage: python3 qa/cloud_sync_e2e.py  (creates one throwaway test account: synctest+<time>@untoflow.test)"""
import sys, json, time
sys.path.insert(0, '/usr/local/google/home/zuqi/github/ProjectFocus/qa')
from cdp_helper import CDP

EMAIL = f"untoflow.synctest+{int(time.time())}@gmail.com"
PW = 'Tomato-test-4821'
res = {}

def boot(port):
    c = CDP(390, 844, port=port)
    c.js("(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden'); a.state.hasCompletedOnboarding = true; a.state.activePillar = 'card'; a.renderAll(); })()")
    time.sleep(1.0)
    return c

def auth(c, mode):
    return c.js(f"""(async () => {{ const a = window.fableFlowApp; a.openAuthModal('{mode}');
      a.els.authEmailInput.value = {json.dumps(EMAIL)}; a.els.authPasswordInput.value = {json.dumps(PW)};
      await a.handleAuthFormSubmit();
      const err = a.els.authErrorMsg && !a.els.authErrorMsg.classList.contains('hidden') ? a.els.authErrorMsg.textContent : null;
      const s = a.supabaseSync.session;
      return {{ err, loggedIn: a.supabaseSync.isLoggedIn(), mode: s && s.mode, hasRefresh: Boolean(s && s.refreshToken), expiresAt: s && s.expiresAt,
               badge: a.els.authSyncModeBadge && a.els.authSyncModeBadge.textContent }}; }})()""")

titles = lambda c: c.js("window.fableFlowApp.state.tasks.map(t => t.title + (t.isCompleted ? ' [x]' : ''))")

mac = boot(9661)
# Mac: give it its own cards, then create the account (uploads them)
mac.js("""(() => { const a = window.fableFlowApp; a.state.tasks = [
   { id: 'm1', orderIndex: 1, title: 'Walk by the river', isCompleted: false, assignedQuadrant: null },
   { id: 'm2', orderIndex: 2, title: 'Call grandma', isCompleted: true, assignedQuadrant: null } ]; a.saveState(); a.renderAll(); })()""")
r = auth(mac, 'signup'); res['mac: create account (cloud session with refresh token)'] = r['loggedIn'] and not r['err'] and r['mode'] == 'supabase' and r['hasRefresh']
res['_mac_signup'] = r
time.sleep(1.5)

phone = boot(9662)
res['_phone_before'] = titles(phone)
r = auth(phone, 'signin'); res['phone: sign in to the same account'] = r['loggedIn'] and not r['err']
res['_phone_signin'] = r
time.sleep(0.8)
pt = titles(phone)
res['phone: sees the Mac\'s cards'] = pt == ['Walk by the river', 'Call grandma [x]']
res['_phone_after'] = pt

# Phone edits: cross out + add, then goes to background (flush)
phone.js("""(() => { const a = window.fableFlowApp; a.state.tasks[0].isCompleted = true;
  a.state.tasks.push({ id: 'p3', orderIndex: 3, title: 'Water the fig', isCompleted: false, assignedQuadrant: null }); a.saveState(); a.renderAll(); })()""")
time.sleep(1.5)

# Mac comes back to the front -> pulls the newer copy
mac.js("""(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); })()""")
time.sleep(2.0)
mt = titles(mac)
res['mac: returning to the app shows the phone\'s edits'] = mt == ['Walk by the river [x]', 'Call grandma [x]', 'Water the fig']
res['_mac_after'] = mt

# Expired login: fake an expired/invalid token -> next save must refresh and still reach the cloud
r = mac.js("""(async () => { const a = window.fableFlowApp; const s = a.supabaseSync;
  s.session.accessToken = 'expired.invalid.token'; s.session.expiresAt = Math.floor(Date.now() / 1000) - 10; s._saveSession(s.session);
  a.state.tasks.push({ id: 'm4', orderIndex: 4, title: 'Read Middlemarch', isCompleted: false, assignedQuadrant: null });
  const ok = await s.pushCloudState(a.state);
  return { ok, refreshed: s.session.accessToken !== 'expired.invalid.token', newExpiry: s.session.expiresAt > Date.now() / 1000 }; })()""")
res['expired login renews itself and the save still syncs'] = r['ok'] and r['refreshed'] and r['newExpiry']
res['_refresh'] = r

# Wrong password message
r = phone.js(f"""(async () => {{ const s = window.fableFlowApp.supabaseSync; try {{ await s.signIn({json.dumps(EMAIL)}, 'nope-nope'); return 'no error'; }} catch (e) {{ return e.message; }} }})()""")
res['wrong password gives a clear message'] = r == 'Wrong email or password'

# Google button can't be used to open someone else's account
r = phone.js(f"""(async () => {{ const s = window.fableFlowApp.supabaseSync; try {{ await s.signInWithProvider('google', {json.dumps(EMAIL)}); return 'no error'; }} catch (e) {{ return e.message; }} }})()""")
res['Google/Apple fallback is blocked (no email-only login)'] = 'set up yet' in r

# Another account can't read this one's row (RLS)
r = phone.js("""(async () => { const s = window.fableFlowApp.supabaseSync; const cfg = s.config;
  const res = await fetch(`${cfg.url}/rest/v1/fable_flow_user_state?select=user_id`, { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` } });
  return { status: res.status, rows: (await res.json()).length }; })()""")
res['signed-out visitor sees no one\'s cards (RLS)'] = r['status'] == 200 and r['rows'] == 0
res['_rls'] = r

mac.close(); phone.close()
ok = all(v for k, v in res.items() if not k.startswith('_'))
print(json.dumps(res, indent=1, ensure_ascii=False))
print('TEST ACCOUNT:', EMAIL)
print('PASS' if ok else 'FAIL')
