"""Timer keeps time while the app is in the background / phone asleep (timers paused, clock moves on)."""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]))
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true;
  // install a controllable clock: real time + offset
  if (!window.__realNow) { window.__realNow = Date.now.bind(Date); window.__clockOffset = 0; Date.now = () => window.__realNow() + window.__clockOffset; }
  a.saveState(); })()""")
time.sleep(0.4)

def start(q, mins, mode='countdown'):
    c.js("""((q, mins, mode) => { const a = window.fableFlowApp; const s = a.state.timers[q];
      s.customTitle = 'Test ' + q; s.mode = mode; s.runState = 'idle';
      s.remainingSeconds = mode === 'countdown' ? mins * 60 : 0; s.configuredMinutes = mins;
      a.togglePlayPause(q); })(%d, %d, %s)""" % (q, mins, json.dumps(mode)))

def sleep_phone(seconds, how):
    # simulate iOS: timers stop firing while hidden; the wall clock keeps moving
    c.js("""((secs, how) => { const a = window.fableFlowApp;
      clearInterval(a.tickInterval); a.tickInterval = null;               // JS timers suspended
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.__clockOffset += secs * 1000;                                   // time passes
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      if (how === 'visibility') document.dispatchEvent(new Event('visibilitychange'));
      if (how === 'pageshow') window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      a.startWallClockTicker();                                              // JS timers resume on wake
    })(%d, %s)""" % (seconds, json.dumps(how)))

res = {}
get = lambda q: c.js("(() => { const s = window.fableFlowApp.state.timers[%d]; return { rem: s.remainingSeconds, state: s.runState, readout: document.getElementById('hero-readout').textContent }; })()" % q)

# A: 25-min countdown, phone asleep 10 minutes, wake via visibilitychange
c.js("(() => { const a = window.fableFlowApp; a.state.activePillar = 'timer'; a.state.timerSubMode = 'hero'; a.state.selectedQuadrant = 0; a.renderAll(); })()")
start(0, 25); time.sleep(1.2)
before = get(0)['rem']
sleep_phone(600, 'visibility'); time.sleep(1.3)
a = get(0); res['countdown catches up after 10 min asleep'] = abs((before - 600) - a['rem']) <= 3 and a['state'] == 'running'
print('A', before, '->', a)

# B: timers resume without any event (e.g. app switcher) -> next tick must still catch up
sleep_phone(120, 'resume-timers-only'); time.sleep(1.5)
b = get(0); res['catches up even with no resume event'] = abs((a['rem'] - 120) - b['rem']) <= 3
print('B', a['rem'], '->', b)

# C: countdown finishes while asleep -> completed (silver) when you come back
start(1, 1); time.sleep(1.1)
sleep_phone(300, 'pageshow'); time.sleep(1.3)
c_ = get(1); res['finishes while asleep -> completed'] = c_['state'] == 'completed' and c_['rem'] == 0
print('C', c_)

# D: stopwatch counts the time away
start(2, 0, 'stopwatch'); time.sleep(1.1)
d0 = get(2)['rem']; sleep_phone(240, 'visibility'); time.sleep(1.3)
d = get(2); res['stopwatch counts time away'] = abs(d['rem'] - (d0 + 240)) <= 3
print('D', d0, '->', d)

# E: no drift: normal foreground ticking for ~5 s stays accurate (stopwatch in slot 2 is the running one)
e0 = get(2)['rem']; time.sleep(5.2); e = get(2)['rem']
res['foreground ticking accurate'] = 4 <= (e - e0) <= 6
print('E', e0, '->', e)

# F: iOS killed the app in the background; reopening must count the time away (saved state, real reload)
c.js("""(() => { const a = window.fableFlowApp;
  a.saveState(); a.saveState = () => {};            // freeze storage (the real save happened when iOS hid the app)
  const raw = JSON.parse(localStorage.getItem('fable_flow_phase2_mvp_v10'));
  raw.timers[2].lastTickTimestamp = window.__realNow() - 300 * 1000;   // last saved 5 real minutes ago
  localStorage.setItem('fable_flow_phase2_mvp_v10', JSON.stringify(raw)); window.__beforeReload = raw.timers[2].remainingSeconds; })()""")
f0 = c.js("window.__beforeReload")
c.call('Page.reload'); time.sleep(4.0)
f = c.js("window.fableFlowApp.state.timers[2].remainingSeconds")
res['reopened after being closed counts time away'] = abs(f - (f0 + 300)) <= 5
print('F', f0, '->', f)
for k, v in res.items(): print(('OK   ' if v else 'BAD  ') + k)
print('PASS' if all(res.values()) else 'FAIL')
c.close()
