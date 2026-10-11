"""Strikethroughs must survive flipping (Today's card and past cards), via button and via swipe."""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]))
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.activePillar = 'card'; a.state.isCardFlipped = false; a._todayFlipDeg = 0;
  a.state.tasks = [['Crossed out task', true], ['Open task', false], ['Another crossed long task that wraps onto two lines here', true]]
    .map(([x, done], i) => ({ id: 't' + i, orderIndex: i + 1, title: x, isCompleted: done, assignedQuadrant: null }));
  a.ensureTourDemoArchiveCards(); const k = a.getOffsetDateKey(a.state.cardDateKey, -1);
  a.state.archiveCards[k].tasks = [{ id: 'p0', orderIndex: 1, title: 'Past crossed task', isCompleted: true }, { id: 'p1', orderIndex: 2, title: 'Past open', isCompleted: false }];
  a.state.selectedStackDateKey = k; a.saveState(); a.renderAll(); })()""")
time.sleep(0.8)
ink = """((sel) => Array.from(document.querySelectorAll(sel + ' .task-row')).map(r => {
  const cv = r.querySelector('.pencil-strike-canvas'); if (!cv || !cv.width) return 0;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n; }))"""
baseline = {}
def check(label, sel, expect_done):
    px = c.js(ink + "(%s)" % json.dumps(sel))
    base = baseline.setdefault(sel, px)
    # crossed-out rows must keep >= 80% of their original pencil ink; open rows must stay empty
    ok = all((p >= 0.8 * b and p > 200) if e else p == 0 for p, b, e in zip(px, base, expect_done))
    print(('OK   ' if ok else 'BAD  ') + label, px)
    return ok
allok = True
allok &= check('today initial', '#task-list-container', [True, False, True])
for how in ['button', 'button']:
    c.js("document.getElementById('card-flip-btn').click()"); time.sleep(0.9)
allok &= check('today after flip+flip back (button)', '#task-list-container', [True, False, True])
# swipe flip twice
for dx in (-160, 160):
    c.js("""(async (dx) => { const el = document.querySelector('#screen-card .card-face' + (window.fableFlowApp.state.isCardFlipped ? '-back .card-back-body' : '-front .card-header-bar'));
      const r = el.getBoundingClientRect(); const x0 = r.left + r.width / 2 - dx / 2, y0 = r.top + r.height / 2;
      const ev = (t, x, y, tg) => tg.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 5, bubbles: true, cancelable: true }));
      ev('pointerdown', x0, y0, el); for (let i = 1; i <= 8; i++) { ev('pointermove', x0 + dx * i / 8, y0, window); await new Promise(r => setTimeout(r, 16)); }
      ev('pointerup', x0 + dx, y0, window); })(%d)""" % dx)
    time.sleep(0.9)
allok &= check('today after swipe flip+back', '#task-list-container', [True, False, True])
c.js("(() => { const a = window.fableFlowApp; a.state.activePillar = 'stack'; a.state.isStackCardFlipped = false; a._stackFlipDeg = 0; a.renderAll(); })()"); time.sleep(0.8)
allok &= check('past initial', '#stack-task-list-container', [True, False])
c.js("document.getElementById('stack-btn-flip').click()"); time.sleep(0.9)
c.js("document.getElementById('stack-btn-flip').click()"); time.sleep(0.9)
allok &= check('past after flip+flip back', '#stack-task-list-container', [True, False])
c.shot('strike_after_flip')
print('PASS' if allok else 'FAIL')
c.close()
