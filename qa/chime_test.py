"""Timer end: the bell rings several times, and it rings on time even when you're not on the page.

A  page hidden + its 1 s ticker throttled to nothing (what browsers do to background tabs):
   the timer still finishes on time and the bell rings 3 times
B  in the foreground the bell rings 3 times, spaced out, all queued on the audio clock up front
   (so a throttled background page can't cut the later rings)
C  any tap silences the ringing
D  coming back long after it finished (phone was asleep): one soft chime, not the full alarm
E  ending a timer yourself (stop button): one chime, as before
F  sound off: no bell at all
Not verifiable here: real iPhone background / lock-screen behaviour.
"""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP

c = CDP(390, 844, port=int(sys.argv[1]))
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.activePillar = 'timer'; a.state.timerSubMode = 'grid';
  if (!window.__realNow) { window.__realNow = Date.now.bind(Date); window.__clockOffset = 0; Date.now = () => window.__realNow() + window.__clockOffset; }
  window.__rings = []; window.__strikes = [];
  const S = a.sensory;
  const oc = S.playCompletionChime.bind(S);
  S.playCompletionChime = function () { window.__rings.push({ kind: 'chime', t: performance.now() }); return oc(); };
  if (S.playCompletionAlarm) { const oa = S.playCompletionAlarm.bind(S);
    S.playCompletionAlarm = function (...x) { window.__rings.push({ kind: 'alarm', t: performance.now() }); return oa(...x); }; }
  if (S._scheduleBellRing) { const ob = S._scheduleBellRing.bind(S);
    S._scheduleBellRing = function (ctx, when, dest) { window.__strikes.push({ when, at: ctx.currentTime }); return ob(ctx, when, dest); }; }
  a.renderAll(); })()""")
time.sleep(0.4)

def reset_log():
    c.js("window.__rings = []; window.__strikes = [];")

def log():
    return c.js("({ rings: window.__rings, strikes: window.__strikes })")

def start(q, secs):
    return c.js("""((q, secs) => { const a = window.fableFlowApp; const s = a.state.timers[q];
      s.customTitle = 'Chime ' + q; s.mode = 'countdown'; s.runState = 'idle'; s.remainingSeconds = secs; s.configuredMinutes = 1;
      a.togglePlayPause(q); return Date.now() + secs * 1000; })(%d, %d)""" % (q, secs))

def set_visible(v):
    c.js("""((v) => { Object.defineProperty(document, 'visibilityState', { value: v ? 'visible' : 'hidden', configurable: true });
      Object.defineProperty(document, 'hidden', { value: !v, configurable: true });
      document.dispatchEvent(new Event('visibilitychange')); })(%s)""" % ('true' if v else 'false'))

def bell_count(l):
    # rings actually queued on the audio clock (new engine) or 1 per old single chime
    return len(l['strikes']) if l['strikes'] else sum(1 for r in l['rings'] if r['kind'] == 'chime')

res = {}
# --- A: background tab, ticker throttled away -------------------------------------------
reset_log()
due = start(0, 3)
set_visible(False)
c.js("(() => { const a = window.fableFlowApp; clearInterval(a.tickInterval); a.tickInterval = null; })()")
time.sleep(4.6)
st = c.js("""(() => { const s = window.fableFlowApp.state.timers[0]; return { state: s.runState, rem: s.remainingSeconds }; })()""")
la = log()
first = la['rings'][0]['t'] if la['rings'] else None
print('A', st, 'rings', [r['kind'] for r in la['rings']], 'strikes', len(la['strikes']))
res['A hidden page: timer still finishes on time'] = st['state'] == 'completed'
res['A hidden page: bell rings 3 times'] = bell_count(la) >= 3
set_visible(True)
c.js("window.fableFlowApp.sensory.stopCompletionAlarm && window.fableFlowApp.sensory.stopCompletionAlarm()")
c.js("window.fableFlowApp.startWallClockTicker()")
time.sleep(0.5)

# --- B: foreground, 3 rings spaced out, queued up front ----------------------------------
reset_log()
start(1, 2)
time.sleep(3.2)
lb = log()
whens = sorted(s['when'] for s in lb['strikes'])
gaps = [round(b - a, 2) for a, b in zip(whens, whens[1:])]
queued_up_front = len(set(round(s['at'], 2) for s in lb['strikes'])) <= 1 if lb['strikes'] else False
print('B rings', [r['kind'] for r in lb['rings']], 'strike times', [round(w, 2) for w in whens], 'gaps', gaps)
res['B foreground: bell rings 3 times'] = bell_count(lb) >= 3
res['B rings are spaced out (1.2-3 s apart)'] = len(gaps) >= 2 and all(1.2 <= g <= 3.0 for g in gaps)
res['B all rings queued on the audio clock at once'] = queued_up_front
ringing_before = c.js("Boolean(window.fableFlowApp.sensory.isAlarmRinging && window.fableFlowApp.sensory.isAlarmRinging())")
c.shot('chime_ringing_banner')

# --- C: a tap silences it ----------------------------------------------------------------
c.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 195, 'y': 60}]}); time.sleep(0.05)
c.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
time.sleep(0.3)
ringing_after = c.js("Boolean(window.fableFlowApp.sensory.isAlarmRinging && window.fableFlowApp.sensory.isAlarmRinging())")
print('C ringing before tap', ringing_before, 'after tap', ringing_after)
res['C a tap silences the ringing'] = ringing_before and not ringing_after

# --- D: phone asleep past the end, come back -> one soft chime ---------------------------
reset_log()
start(2, 60)
set_visible(False)
c.js("""(() => { const a = window.fableFlowApp; clearInterval(a.tickInterval); a.tickInterval = null;
  if (a._dueTimeout) { clearTimeout(a._dueTimeout); a._dueTimeout = null; }   // iOS: every JS timer frozen
  window.__clockOffset += 300 * 1000; })()""")
set_visible(True)
time.sleep(0.8)
ld = log()
st = c.js("window.fableFlowApp.state.timers[2].runState")
print('D', st, 'rings', [r['kind'] for r in ld['rings']], 'strikes', len(ld['strikes']))
res['D back after it ended: completed + a single soft chime'] = st == 'completed' and [r['kind'] for r in ld['rings']] == ['chime']
c.js("window.fableFlowApp.startWallClockTicker()")

# --- E: ending it yourself -> one chime ----------------------------------------------------
reset_log()
start(3, 600)
time.sleep(0.4)
c.js("window.fableFlowApp.handleEndOrResetButton(3)")
time.sleep(0.4)
le = log()
print('E rings', [r['kind'] for r in le['rings']])
res['E stop button: single chime (unchanged)'] = [r['kind'] for r in le['rings']] == ['chime']

# --- F: sound off -> no bell ----------------------------------------------------------------
reset_log()
c.js("window.fableFlowApp.sensory.isSilentMode = true")
start(4, 1)
time.sleep(2.4)
lf = log()
st = c.js("window.fableFlowApp.state.timers[4].runState")
print('F', st, 'strikes', len(lf['strikes']))
res['F sound off: finishes silently'] = st == 'completed' and len(lf['strikes']) == 0
c.js("window.fableFlowApp.sensory.isSilentMode = false")

for k, v in res.items(): print(('OK   ' if v else 'BAD  ') + k)
print('PASS' if all(res.values()) else 'FAIL')
c.close()
