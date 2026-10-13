"""Tapping a lit mini tomato on the card opens that tomato's timer page (it no longer unassigns).

- grey (unassigned) mini tomato: tap -> lights up, assigns, opens its hero timer page (unchanged behaviour)
- lit (assigned) mini tomato: tap -> opens the hero page of THAT tomato; assignment, title and running
  timer are untouched
- unassigning still works from the tomato page (hero dropdown) and the grid page (grid dropdown)
Uses real touch events on the Today card.
"""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP

c = CDP(390, 844, port=int(sys.argv[1]))

def tap(x, y, hold=0.06):
    c.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]}); time.sleep(hold)
    c.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})

def to_card():
    c.js("""(() => { const a = window.fableFlowApp; a.state.activePillar = 'card'; a.state.isCardFlipped = false;
      a._todayFlipDeg = 0; a.saveState(); a.renderAll(); })()""")
    time.sleep(0.7)

def tap_mini(row):
    x, y = c.js("""((i) => { const b = document.querySelectorAll('#task-list-container .task-row')[i]
      .querySelector('.task-tomato-btn').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })(%d)""" % row)
    tap(x, y); time.sleep(0.8)

state = lambda: c.js("""(() => { const a = window.fableFlowApp; return {
  pillar: a.state.activePillar, sub: a.state.timerSubMode, sel: a.state.selectedQuadrant,
  assigned: a.state.tasks.map(t => t.assignedQuadrant),
  slots: a.state.timers.map(s => ({ task: s.assignedTaskId, title: s.customTitle, run: s.runState, rem: s.remainingSeconds })),
  subtitle: document.getElementById('hero-subtitle').textContent }; })()""")

c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true;
  a.state.timers.forEach((s) => a.clearQuadrantAssignment(s.quadrant));
  const mk = (x, i) => ({ id: 'mt' + i, orderIndex: i + 1, title: x, isCompleted: false, assignedQuadrant: null });
  a.state.tasks = ['Write chapter one', 'Walk by the river', 'Call grandma'].map(mk);
  a.saveState(); })()""")
res = {}

# 1) grey tomato: assigns + opens hero (unchanged)
to_card(); tap_mini(1)
s1 = state(); print('grey tap ->', json.dumps({k: s1[k] for k in ('pillar', 'sub', 'sel', 'assigned', 'subtitle')}))
q = s1['assigned'][1]
res['grey tomato assigns and opens its timer'] = s1['pillar'] == 'timer' and s1['sub'] == 'hero' and q is not None and s1['sel'] == q

# start that tomato's timer so we can prove a lit tap leaves it alone
c.js("""((q) => { const a = window.fableFlowApp; const s = a.state.timers[q]; s.mode = 'countdown';
  s.remainingSeconds = 20 * 60; s.configuredMinutes = 20; s.runState = 'idle'; a.togglePlayPause(q); })(%d)""" % q)
time.sleep(0.4)
# move selection elsewhere so "opens THAT tomato" is meaningful
c.js("(() => { const a = window.fableFlowApp; a.state.selectedQuadrant = 5; a.state.timerSubMode = 'grid'; a.saveState(); })()")

# 2) lit tomato: opens hero of that tomato, nothing unassigned
to_card()
lit_before = c.js("document.querySelectorAll('#task-list-container .task-row')[1].querySelector('.task-mini-tomato-img').getAttribute('src')")
tap_mini(1)
s2 = state(); c.shot('mini_tap_lit_opens_hero')
print('lit tap  ->', json.dumps({k: s2[k] for k in ('pillar', 'sub', 'sel', 'assigned', 'subtitle')}), s2['slots'][q])
res['lit tomato opens the timer page'] = s2['pillar'] == 'timer' and s2['sub'] == 'hero'
res['...of that same tomato'] = s2['sel'] == q and s2['subtitle'].endswith('Walk by the river')
res['assignment kept'] = s2['assigned'][1] == q and s2['slots'][q]['task'] == 'mt1'
res['running timer untouched'] = s2['slots'][q]['run'] == 'running' and s2['slots'][q]['rem'] > 19 * 60

to_card()
lit_after = c.js("document.querySelectorAll('#task-list-container .task-row')[1].querySelector('.task-mini-tomato-img').getAttribute('src')")
res['mini tomato still lit on the card'] = lit_after == lit_before and 'grey' not in lit_after
tip = c.js("document.querySelectorAll('#task-list-container .task-row')[1].querySelector('.task-tomato-btn').title")
print('lit tooltip:', tip)
res['tooltip no longer says unassign'] = 'unassign' not in tip.lower()

# 3) unassign still possible from the hero page dropdown
c.js("""((q) => { const a = window.fableFlowApp; a.state.activePillar = 'timer'; a.state.timerSubMode = 'hero';
  a.state.selectedQuadrant = q; a.state.isHeroDropdownOpen = true; a.renderAll(); })(%d)""" % q)
time.sleep(0.4)
ok3 = c.js("""(() => { const b = Array.from(document.querySelectorAll('#hero-subtitle-dropdown-mount .dropdown-task-item'))
  .find((x) => x.style.color); if (!b) return false; b.click(); return true; })()""")
time.sleep(0.5)
s3 = state()
res['hero dropdown can still unassign'] = bool(ok3) and s3['assigned'][1] is None and not s3['slots'][q]['task']

# 4) unassign still possible from the grid page dropdown
to_card(); tap_mini(2)
q2 = state()['assigned'][2]
c.js("""((q) => { const a = window.fableFlowApp; a.state.activePillar = 'timer'; a.state.timerSubMode = 'grid';
  a.state.openDropdownQuadrant = q; a.renderAll(); })(%d)""" % q2)
time.sleep(0.4)
ok = c.js("""((q) => { const b = Array.from(document.querySelectorAll('#grid-quad-' + q + ' .dropdown-task-item'))
  .find((x) => x.style.color); if (!b) return false; b.click(); return true; })(%d)""" % q2)
time.sleep(0.5)
s4 = state()
res['grid dropdown can still unassign'] = bool(ok) and s4['assigned'][2] is None

for k, v in res.items(): print(('OK   ' if v else 'BAD  ') + k)
print('PASS' if all(res.values()) else 'FAIL')
c.close()
