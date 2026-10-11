import sys, json, time
sys.path.insert(0,'.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]) if len(sys.argv) > 1 else 9272)
c.js("(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden'); a.state.hasCompletedOnboarding = true; a.ensureTourDemoArchiveCards(); a.state.activePillar='stack'; a.state.isStackCardFlipped=false; a._stackFlipDeg=0; a.renderAll(); })()")
time.sleep(0.5)
def swipe(x0, y0, x1, y1, target_sel):
    c.js(f"""(async () => {{
      const el = document.querySelector('{target_sel}');
      const ev = (type, x, y, tgt) => tgt.dispatchEvent(new PointerEvent(type, {{ clientX: x, clientY: y, pointerId: 7, bubbles: true, cancelable: true, isPrimary: true }}));
      ev('pointerdown', {x0}, {y0}, el);
      for (let i = 1; i <= 10; i++) {{ ev('pointermove', {x0} + ({x1}-{x0})*i/10, {y0} + ({y1}-{y0})*i/10, window); await new Promise(r => setTimeout(r, 16)); }}
      ev('pointerup', {x1}, {y1}, window);
      await new Promise(r => setTimeout(r, 650));
    }})()""")
st = lambda: c.js("(() => { const a = window.fableFlowApp; return { flipped: a.state.isStackCardFlipped, date: a.state.selectedStackDateKey }; })()")
s0 = st(); print('start', s0)
r = c.js("(() => { const r = document.getElementById('stack-card-3d').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
cx, cy = r[0] + r[2]/2, r[1] + r[3]/2
swipe(cx+70, cy, cx-70, cy, '#stack-card-3d .card-face-front .card-dot-grid-body')
s1 = st(); print('after card swipe (expect flipped, same date)', s1)
swipe(cx-70, cy, cx+70, cy, '#stack-card-3d .card-face-back .card-back-body')
s2 = st(); print('after back swipe (expect unflipped)', s2)
swipe(8, cy, 200, cy, '#stack-carousel-stage')
s3 = st(); print('after edge swipe (expect date changed)', s3)
# typing in reflection must NOT flip
c.js("(() => { const a = window.fableFlowApp; a.state.isStackEditMode = true; a.state.isStackCardFlipped = true; a._stackFlipDeg = -180; a.renderAll(); document.getElementById('stack-card-back-reflection').focus(); })()")
time.sleep(0.3)
swipe(cx-70, cy-60, cx+70, cy-60, '#stack-card-back-reflection')
s4 = st(); print('swipe while typing reflection (expect still flipped)', s4)
ok = s1['flipped'] and s1['date']==s0['date'] and not s2['flipped'] and s3['date']!=s0['date'] and s4['flipped']
print('PASS' if ok else 'FAIL')
c.close()
