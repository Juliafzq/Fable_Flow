"""Asserts agreed bottom-bar layout: slots 1 Return/Stack, 2 Flip, 3 Trash, 4 Zoom; two-button bars use 1 & 4;
all bars share the Timer bar's x-positions/row; card icons ~31-35px glyph with 2.6px stroke."""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]))
c.js("(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden'); a.state.hasCompletedOnboarding = true; a.ensureTourDemoArchiveCards(); a.saveState(); })()")
def pos(setup, ids):
    c.js("(() => { const a = window.fableFlowApp; " + setup + " a.renderAll(); })()"); time.sleep(0.8)
    return c.js("(() => (%s).map(id => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return r.width ? [Math.round(r.left), Math.round(r.top)] : null; }))()" % json.dumps(ids))
timer = pos("a.state.activePillar='timer'; a.state.timerSubMode='hero'; a.state.selectedQuadrant=0;", ['hero-btn-grid', 'hero-btn-playpause', 'hero-btn-stopwatch'])
slots = {1: timer[0][0], 2: timer[1][0], 4: timer[2][0]}; rowY = timer[0][1]
slots[3] = slots[2] + (slots[2] - slots[1])
expect = {
  'today':    ("a.state.activePillar='card';", {'card-stack-btn': 1, 'card-flip-btn': 4}),
  'past':     ("a.state.selectedStackDateKey = a.getOffsetDateKey(a.state.cardDateKey, -1); a.state.activePillar='stack';",
               {'stack-btn-return': 1, 'stack-btn-flip': 2, 'stack-btn-trash': 3, 'stack-btn-zoomout': 4}),
  'empty':    ("const k = a.getOffsetDateKey(a.state.cardDateKey, -9); delete a.state.archiveCards[k]; a.state.selectedStackDateKey = k; a.state.activePillar='stack';",
               {'stack-btn-return': 1, 'stack-btn-zoomout': 4}),
  'calendar': ("a.state.activePillar='calendar';", {'calendar-btn-return': 1, 'calendar-btn-zoomin': 4}),
}
ok = True
for name, (setup, m) in expect.items():
    got = pos(setup, list(m))
    for (bid, slot), p in zip(m.items(), got):
        good = p is not None and abs(p[0] - slots[slot]) <= 1 and abs(p[1] - rowY) <= 1
        ok &= good
        if not good: print('WRONG', name, bid, 'expected slot', slot, slots[slot], rowY, 'got', p)
    hidden = [b for b in ['stack-btn-flip', 'stack-btn-trash'] if name == 'empty' and pos('', [b])[0] is not None]
    if hidden: ok = False; print('should be hidden on empty day:', hidden)
corner = c.js("document.querySelectorAll('.card-face-flip-btn').length")
if corner: ok = False; print('corner flip buttons still present:', corner)
print('PASS' if ok else 'FAIL')
c.close()
