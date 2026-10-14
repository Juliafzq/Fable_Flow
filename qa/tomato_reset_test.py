"""Settings > Tomato Reset (Yes/No): tomatoes reset with the card at the daily reset time only when Yes."""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]))
setup = """((reset) => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.activePillar = 'card'; a.state.dailyTomatoReset = reset;
  a.resetAllTomatoesInState(a.state); a.state.cardDateKey = a.getCurrentLogicalDateString(a.state.dailyResetHour);
  a.state.lastRolloverLogicalDate = a.state.cardDateKey;
  a.state.tasks = [{ id: 'r0', orderIndex: 1, title: 'Write essay', isCompleted: false, assignedQuadrant: null }];
  a.assignTaskToQuadrant(2, a.state.tasks[0]); const s = a.state.timers[2]; s.remainingSeconds = 1200; s.configuredMinutes = 20; s.angleDegrees = 120;
  a.togglePlayPause(2); a.saveState(); a.renderAll(); return a.state.timers[2].runState; })(%s)"""
slot = "(() => { const s = window.fableFlowApp.state.timers[2]; return { title: s.customTitle, run: s.runState, task: s.assignedTaskId, rem: s.remainingSeconds }; })()"
res = {}
# UI row exists and reflects state
c.js(setup % 'false'); c.js("window.fableFlowApp.openProfileModal()"); time.sleep(0.3)
res['setting row shows No by default'] = c.js("document.getElementById('profile-tomato-reset-select').value") == 'no'
c.js("(() => { const el = document.getElementById('profile-tomato-reset-select'); el.value = 'yes'; el.dispatchEvent(new Event('change')); })()")
res['choosing Yes saves the setting'] = c.js("JSON.parse(localStorage.getItem('fable_flow_phase2_mvp_v10')).dailyTomatoReset") is True
c.js("document.getElementById('profile-modal-overlay').classList.add('hidden')")
# Live rollover, No
c.js(setup % 'false'); c.js("window.fableFlowApp.simulateFiveAmRollover()"); time.sleep(0.3); s = c.js(slot); print('  slot', json.dumps(s)); print('  slot', json.dumps(s))
res['No: tomato keeps title + running across the day'] = s['title'] == 'Write essay' and s['run'] == 'running' and s['rem'] > 1100 and s['task'] is None
# Live rollover, Yes
c.js(setup % 'true'); c.js("window.fableFlowApp.simulateFiveAmRollover()"); time.sleep(0.3); s = c.js(slot); print('  slot', json.dumps(s)); print('  slot', json.dumps(s))
res['Yes: tomato reset with the card'] = s['title'] is None and s['run'] == 'idle' and s['rem'] == 0
# Reopen on a new day (app was closed over the reset time)
for flag, name in (('true', 'Yes'), ('false', 'No')):
    c.js(setup % flag)
    c.js("window.fableFlowApp.saveState()")
    c.call('Page.navigate', {'url': 'http://127.0.0.1:8091/manifest.json'}); time.sleep(1.0)
    c.js("""(() => { const st = JSON.parse(localStorage.getItem('fable_flow_phase2_mvp_v10'));
      const [y, m, d] = st.cardDateKey.split('-').map(Number); const dt = new Date(y, m - 1, d - 1);
      st.cardDateKey = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      st.lastRolloverLogicalDate = st.cardDateKey; localStorage.setItem('fable_flow_phase2_mvp_v10', JSON.stringify(st)); return st.cardDateKey; })()""")
    c.call('Page.navigate', {'url': 'http://127.0.0.1:8091/'})
    time.sleep(3.5)
    for _ in range(30):
        if c.js("Boolean(window.fableFlowApp)"): break
        time.sleep(0.3)
    s = c.js(slot); print('  slot', json.dumps(s))
    if name == 'Yes':
        res['Yes: reopening next day resets tomatoes'] = s['title'] is None and s['run'] == 'idle'
    else:
        res['No: reopening next day keeps tomatoes'] = s['title'] == 'Write essay' and s['run'] == 'running'
for k, v in res.items(): print(('OK   ' if v else 'BAD  ') + k)
print('PASS' if all(res.values()) else 'FAIL')
c.close()
