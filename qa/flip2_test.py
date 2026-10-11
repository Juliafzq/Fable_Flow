import sys, json, time
sys.path.insert(0,'.')
from cdp_helper import CDP
W,H = int(sys.argv[1]), int(sys.argv[2])
c = CDP(W, H, port=int(sys.argv[3]) if len(sys.argv) > 3 else 9271)
c.js("(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden'); a.state.hasCompletedOnboarding = true; a.ensureTourDemoArchiveCards(); a.state.activePillar='card'; a.state.isCardFlipped=false; a._todayFlipDeg=0; a.saveState(); a.renderAll(); })()")
time.sleep(0.8)
def tap(sel):
    x, y = c.js(f"(() => {{ const els = Array.from(document.querySelectorAll('{sel}')).filter(e => {{ const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && cs.visibility === 'visible' && !e.closest('.hidden'); }}); const r = els[0].getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; }})()")
    for typ in ('touchStart', 'touchEnd'):
        c.call('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [] if typ == 'touchEnd' else [{'x': x, 'y': y}]})
    time.sleep(0.8)
g = lambda k: c.js(f"window.fableFlowApp.state.{k}")
res = {}
tap('#card-flip-btn'); res['today front btn -> flipped'] = g('isCardFlipped')
tap('#card-flip-btn'); res['today back btn -> unflipped'] = not g('isCardFlipped')
# diagonal swipe on today's blank card area that the browser cancels half-way
c.js("""(async () => { const el = document.querySelector('#screen-card .card-dot-grid-body'); const r = el.getBoundingClientRect();
  const x0 = r.left + r.width*0.7, y0 = r.top + r.height*0.75;
  const ev = (t, x, y, tg) => tg.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 9, bubbles: true, cancelable: true }));
  ev('pointerdown', x0, y0, el);
  for (let i = 1; i <= 6; i++) { ev('pointermove', x0 - i*5, y0 - i*4, window); await new Promise(r => setTimeout(r, 16)); }
  ev('pointercancel', 0, 0, window); await new Promise(r => setTimeout(r, 700)); })()""")
res['diagonal+cancel swipe -> flipped'] = g('isCardFlipped')
c.js("(() => { const a = window.fableFlowApp; a.state.selectedStackDateKey = a.getOffsetDateKey(a.state.cardDateKey, -1); a.state.activePillar='stack'; a.state.isStackCardFlipped=false; a._stackFlipDeg=0; a.renderAll(); })()")
time.sleep(0.8)
tap('#stack-btn-flip'); res['stack front btn -> flipped'] = g('isStackCardFlipped')
tap('#stack-btn-flip'); res['stack back btn -> unflipped'] = not g('isStackCardFlipped')
c.js("(() => { const a = window.fableFlowApp; a.state.activePillar='timer'; a.state.timerSubMode='hero'; a.renderAll(); a.openHeroTimeEditor(); })()")
time.sleep(0.4)
res['no preset pills'] = c.js("document.querySelectorAll('.hero-preset-pill').length === 0")
c.shot(f'hero_nopresets_{W}')
print(json.dumps(res, indent=1)); print('PASS' if all(res.values()) else 'FAIL')
c.close()
