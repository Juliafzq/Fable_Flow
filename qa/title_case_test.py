"""Renamed timers keep the exact upper/lower case people type (no forced ALL CAPS).

Drives the real rename flow (hero subtitle dropdown -> Custom Title -> type -> Save) and checks
the hero subtitle, the grid tomato title and the "Timer completed" banner.
Built-in labels (TAP TO ASSIGN / EXAMPLE TASK) are not user text and are not checked here.
"""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP

c = CDP(390, 844, port=int(sys.argv[1]))
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.activePillar = 'timer'; a.state.timerSubMode = 'hero';
  a.state.selectedQuadrant = 0; a.clearQuadrantAssignment(0); a.renderAll(); })()""")
time.sleep(0.5)

def rename(text):
    c.js("""((text) => { const a = window.fableFlowApp;
      a.state.isHeroDropdownOpen = true; a.renderHeroScreen();
      document.querySelector('#hero-subtitle-dropdown-mount .dropdown-custom-header').click();
      const inp = document.getElementById('modal-input'); inp.value = text;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('modal-confirm').click(); })(%s)""" % json.dumps(text))
    time.sleep(0.5)

res = {}
rename('Deep work Session')
hero = c.js("""(() => { const el = document.getElementById('hero-subtitle');
  return { text: el.textContent, tt: getComputedStyle(el).textTransform,
           stored: window.fableFlowApp.state.timers[0].customTitle }; })()""")
c.shot('case_hero_mixed')
print('hero', hero)
res['saved exactly as typed'] = hero['stored'] == 'Deep work Session'
res['hero subtitle keeps case'] = hero['text'] == '01 / Deep work Session' and hero['tt'] != 'uppercase'

c.js("(() => { const a = window.fableFlowApp; a.state.timerSubMode = 'grid'; a.renderAll(); })()")
time.sleep(0.5)
grid = c.js("""(() => { const el = document.querySelector('#grid-quad-0 .grid-tomato-title');
  return el ? { text: el.textContent, tt: getComputedStyle(el).textTransform } : null; })()""")
c.shot('case_grid_mixed')
print('grid', grid)
res['grid title keeps case'] = bool(grid) and grid['text'] in ('Deep work…', 'Deep work') and grid['tt'] != 'uppercase'

# all-lowercase rename also stays lowercase
c.js("(() => { const a = window.fableFlowApp; a.state.timerSubMode = 'hero'; a.renderAll(); })()")
time.sleep(0.3)
rename('reading time')
low = c.js("document.getElementById('hero-subtitle').textContent")
print('lower', low)
res['lowercase stays lowercase'] = low == '01 / reading time'

# completion banner keeps case
c.js("""(() => { const a = window.fableFlowApp; const s = a.state.timers[0];
  s.mode = 'countdown'; s.runState = 'idle'; s.remainingSeconds = 1; s.configuredMinutes = 1; a.togglePlayPause(0); })()""")
time.sleep(2.6)
ban = c.js("""(() => { const el = document.getElementById('notification-banner');
  return { text: el.textContent, tt: getComputedStyle(el).textTransform }; })()""")
c.shot('case_banner')
print('banner', ban)
res['completion banner keeps case'] = 'reading time' in ban['text'] and 'READING TIME' not in ban['text'] and ban['tt'] != 'uppercase'

for k, v in res.items(): print(('OK   ' if v else 'BAD  ') + k)
print('PASS' if all(res.values()) else 'FAIL')
c.close()
