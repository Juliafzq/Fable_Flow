import sys, time, json
sys.path.insert(0, '.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]))
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.activePillar = 'card'; a.state.isCardFlipped = false; a._todayFlipDeg = 0;
  a.state.tasks = ['Short', 'Second item'].map((x, i) => ({ id: 'g' + i, orderIndex: i + 1, title: x, isCompleted: false, assignedQuadrant: null }));
  a.ensureTourDemoArchiveCards(); const k = a.getOffsetDateKey(a.state.cardDateKey, -2); a.state.selectedStackDateKey = k;
  a.saveState(); a.renderAll(); })()""")
time.sleep(0.8)
def touch_swipe(x0, y0, dx, steps=10):
    c.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
    for i in range(1, steps + 1):
        c.call('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + dx * i / steps, 'y': y0}]}); time.sleep(0.016)
    c.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); time.sleep(0.9)
st = lambda: c.js("""(() => { const a = window.fableFlowApp; return { flipped: a.state.isCardFlipped, done: a.state.tasks.map(t => t.isCompleted),
  sflip: a.state.isStackCardFlipped, sel: a.state.selectedStackDateKey }; })()""")
res = {}
title = c.js("(() => { const r = document.querySelectorAll('#task-list-container .task-title')[1].getBoundingClientRect(); return [r.left, r.top + r.height/2, r.right]; })()")
# 1) right->left on task text: no flip, no strike
touch_swipe(title[2] - 4, title[1], -120); s = st(); res['R->L on text does not flip'] = (s['flipped'] is False)
# 2) left->right on task text: strike, no flip
touch_swipe(title[0] + 2, title[1], 140); s = st(); res['L->R on text crosses out, no flip'] = (s['flipped'] is False and s['done'][1] is True)
# 3) swipe on blank card space below the list: flips
body = c.js("(() => { const r = document.getElementById('daily-card-3d').getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height*0.8]; })()")
touch_swipe(body[0] + 60, body[1], -140); s = st(); res['swipe on empty space flips'] = s['flipped'] is True
touch_swipe(body[0] - 60, body[1], 140); s = st(); res['swipe on empty back flips back'] = s['flipped'] is False
# 4) flip button still works
c.js("document.getElementById('card-flip-btn').click()"); time.sleep(0.8); res['button flips'] = st()['flipped'] is True
c.js("document.getElementById('card-flip-btn').click()"); time.sleep(0.8)
# Stack
c.js("(() => { const a = window.fableFlowApp; a.state.activePillar = 'stack'; a.state.isStackCardFlipped = false; a._stackFlipDeg = 0; a.renderAll(); })()"); time.sleep(0.8)
card = c.js("(() => { const r = document.getElementById('stack-card-3d').getBoundingClientRect(); return [r.left, r.right, r.top + r.height*0.55, r.width]; })()")
sel0 = st()['sel']
touch_swipe((card[0]+card[1])/2 + 60, card[2], -140); s = st(); res['stack: swipe on card flips'] = s['sflip'] is True and s['sel'] == sel0
touch_swipe((card[0]+card[1])/2 - 60, card[2], 140); s = st(); res['stack: swipe on card flips back'] = s['sflip'] is False
touch_swipe(card[0] + 10, card[2], 150); s = st(); res['stack: swipe from left edge scrolls, no flip'] = s['sflip'] is False and s['sel'] != sel0
sel1 = s['sel']
touch_swipe(card[1] - 10, card[2], -150); s = st(); res['stack: swipe from right edge scrolls, no flip'] = s['sflip'] is False and s['sel'] != sel1
c.js("document.getElementById('stack-btn-flip').click()"); time.sleep(0.8); res['stack: button flips'] = st()['sflip'] is True
for k, v in res.items(): print(('OK   ' if v else 'BAD  ') + k)
print('PASS' if all(res.values()) else 'FAIL')
c.close()
