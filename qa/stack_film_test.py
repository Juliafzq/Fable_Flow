"""Stack filmstrip: direct-manipulation checks (1:1 tracking, neighbour visible, velocity-matched settle,
snap-back keeps flip state, rubber band at the first card, catch mid-settle)."""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]) if len(sys.argv) > 1 else 9281)
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.ensureTourDemoArchiveCards(); a.state.activePillar = 'stack';
  const keys = a.getNavigableStackDateKeys(); a.state.selectedStackDateKey = keys[keys.length - 3];
  a.state.isStackCardFlipped = false; a._stackFlipDeg = 0; a.renderAll(); })()""")
time.sleep(0.8)
card = c.js("(() => { const r = document.getElementById('stack-card-3d').getBoundingClientRect(); return [r.left, r.right, r.top + r.height * 0.5, r.width]; })()")
X0 = card[0] + 12  # left edge zone of the card
Y = card[2]
st = lambda: c.js("(() => { const a = window.fableFlowApp; return { sel: a.state.selectedStackDateKey, flipped: a.state.isStackCardFlipped, film: Boolean(a._stackFilm), clones: document.querySelectorAll('.stack-filmstrip-clone').length }; })()")

# helper in page: dispatch pointer events; `moves` list of [x, dtMs]; optional sampling of layout after each move
c.js(r"""window.__drag = async (x0, y, moves, release, sampleAfterRelease) => {
  const stage = document.getElementById('stack-carousel-stage');
  const target = document.elementFromPoint(x0, y) || stage;
  const ev = (type, x, tgt) => tgt.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 9, bubbles: true, cancelable: true, isPrimary: true, pointerType: 'touch' }));
  const realX = () => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.stack-center-perspective')).transform); return m.m41; };
  const layers = () => [...document.querySelectorAll('.stack-center-perspective, .stack-filmstrip-clone')].map(el => ({
      x: Math.round(new DOMMatrix(getComputedStyle(el).transform).m41), clone: el.classList.contains('stack-filmstrip-clone'),
      head: (el.querySelector('.card-date-title, [id$="card-date-header"], [data-clone-id$="card-date-header"]') || {}).textContent }));
  ev('pointerdown', x0, target);
  const log = [];
  let x = x0;
  for (const [nx, dt] of moves) { await new Promise(r => setTimeout(r, dt)); x = nx; ev('pointermove', x, window); log.push({ finger: Math.round(x - x0), layers: layers() }); }
  if (!release) return log;
  ev('pointerup', x, window);
  const after = [];
  const t0 = performance.now();
  for (let i = 0; i < sampleAfterRelease; i++) { await new Promise(r => requestAnimationFrame(r)); after.push({ t: Math.round(performance.now() - t0), x: Math.round(realX()), layers: layers().length }); }
  return { log, after };
};""")

res = {}
s0 = st()

# 1) Slow drag right 150px (towards the earlier card): real card must move exactly with the finger
moves = [[X0 + 7 + i * 10, 16] for i in range(1, 16)]   # first 7px is touch slop
log = c.js(f"window.__drag({X0}, {Y}, {json.dumps(moves)}, false, 0)")
last = log[-1]
cur = [l for l in last['layers'] if l['clone']]
real = [l for l in last['layers'] if not l['clone']]
finger_after_slop = last['finger'] - 7
res['1:1 tracking (dragged card moved == finger)'] = bool(cur) and abs(cur[0]['x'] - finger_after_slop) <= 1
res['neighbour card with content slides in alongside'] = bool(real) and real[0]['head'] and cur[0]['head'] and real[0]['head'] != cur[0]['head'] and real[0]['x'] < 0
res['_detail_tracking'] = {'finger_after_slop': finger_after_slop, 'layers': last['layers']}
# release slowly (pause first so velocity ~0): only 150px of ~350 -> snaps back
c.js("new Promise(r => setTimeout(r, 200))")
c.js(f"(() => {{ window.dispatchEvent(new PointerEvent('pointerup', {{ clientX: {moves[-1][0]}, clientY: {Y}, pointerId: 9, bubbles: true }})); }})()")
time.sleep(0.8)
s1 = st()
res['slow short drag snaps back to same card'] = s1['sel'] == s0['sel'] and not s1['film'] and s1['clones'] == 0

# 2) Quick flick left (towards the later card): commits, and settle starts at the finger's speed
x_start = card[1] - 12
moves = [[x_start - 7 - i * 18, 16] for i in range(1, 7)]  # ~1.1 px/ms, ~115px
out = c.js(f"window.__drag({x_start}, {Y}, {json.dumps(moves)}, true, 40)")
time.sleep(0.4)
s2 = st()
after = out['after']
v_finger = 18 / 16.0
v_first = None
if len(after) >= 3 and after[2]['t'] > after[0]['t']:
    v_first = (after[0]['x'] - after[2]['x']) / (after[2]['t'] - after[0]['t'])
settle_t = next((a['t'] for a in after if a['layers'] == 1), None)
res['flick commits to next card'] = s2['sel'] != s0['sel'] and s2['sel'] > s0['sel'] and not s2['film'] and s2['clones'] == 0
res['release speed continues the finger speed (within 45%)'] = v_first is not None and abs(v_first - v_finger) / v_finger < 0.45
res['settles fast (< 520ms)'] = settle_t is not None and settle_t < 520
res['_detail_flick'] = {'v_finger_px_ms': round(v_finger, 2), 'v_after_release_px_ms': v_first and round(v_first, 2), 'settle_ms': settle_t, 'first_frames': after[:6]}

# 3) Snap-back keeps flip state of the original card
c.js("(() => { const a = window.fableFlowApp; a.state.isStackCardFlipped = true; a._stackFlipDeg = -180; a.renderAll(); })()"); time.sleep(0.7)
moves = [[X0 + 7 + i * 8, 16] for i in range(1, 8)]
c.js(f"window.__drag({X0}, {Y}, {json.dumps(moves)}, false, 0)")
c.js("new Promise(r => setTimeout(r, 200))")
c.js(f"window.dispatchEvent(new PointerEvent('pointerup', {{ clientX: {moves[-1][0]}, clientY: {Y}, pointerId: 9, bubbles: true }}))")
time.sleep(0.8)
s3 = st()
res['snap-back keeps the back side showing'] = s3['flipped'] is True and s3['sel'] == s2['sel']
c.js("(() => { const a = window.fableFlowApp; a.state.isStackCardFlipped = false; a._stackFlipDeg = 0; a.renderAll(); })()"); time.sleep(0.7)

# 4) Rubber band at the oldest card
c.js("(() => { const a = window.fableFlowApp; const k = a.getNavigableStackDateKeys(); a.state.selectedStackDateKey = k[0]; a.renderAll(); })()"); time.sleep(0.6)
moves = [[X0 + 7 + i * 15, 16] for i in range(1, 11)]
log = c.js(f"window.__drag({X0}, {Y}, {json.dumps(moves)}, false, 0)")
real_x = [l for l in log[-1]['layers'] if not l['clone']][0]['x']
res['rubber band past the oldest card (moves less than finger)'] = 0 < real_x < (log[-1]['finger'] - 7) * 0.7
res['_detail_rubber'] = {'finger': log[-1]['finger'] - 7, 'card_x': real_x}
c.js(f"window.dispatchEvent(new PointerEvent('pointerup', {{ clientX: {moves[-1][0]}, clientY: {Y}, pointerId: 9, bubbles: true }}))")
time.sleep(0.8)
s4 = st()
res['rubber band springs back to oldest card'] = not s4['film'] and s4['clones'] == 0

# 5) Catch a card mid-glide: flick, touch again after 60ms, hold still, release -> lands cleanly, no flip
k0 = st()['sel']
moves = [[x_start - 7 - i * 20, 16] for i in range(1, 6)]
c.js(f"window.__drag({x_start}, {Y}, {json.dumps(moves)}, true, 3)")
caught = c.js(f"""(async () => {{ const a = window.fableFlowApp; const busy = Boolean(a._stackFilm && a._stackFilm.settling);
  const cx = {(card[0] + card[1]) / 2};
  const t = document.elementFromPoint(cx, {Y});
  t.dispatchEvent(new PointerEvent('pointerdown', {{ clientX: cx, clientY: {Y}, pointerId: 11, bubbles: true, cancelable: true, isPrimary: true }}));
  const held = Boolean(a._stackFilm && !a._stackFilm.settling);
  await new Promise(r => setTimeout(r, 150));
  window.dispatchEvent(new PointerEvent('pointerup', {{ clientX: cx, clientY: {Y}, pointerId: 11, bubbles: true }}));
  await new Promise(r => setTimeout(r, 700));
  return {{ busy, held, film: Boolean(a._stackFilm), clones: document.querySelectorAll('.stack-filmstrip-clone').length, flipped: a.state.isStackCardFlipped, sel: a.state.selectedStackDateKey }};
}})()""")
res['catch a gliding card, then it lands cleanly (no flip)'] = caught['busy'] and caught['held'] and not caught['film'] and caught['clones'] == 0 and caught['flipped'] is False
res['_detail_catch'] = caught

# 6) Trackpad horizontal two-finger swipe moves 1:1 then settles to next card
c.js("(() => { const a = window.fableFlowApp; const k = a.getNavigableStackDateKeys(); a.state.selectedStackDateKey = k[k.length - 3]; a.renderAll(); })()"); time.sleep(0.6)
s6a = st()
wheel = c.js("""(async () => { const s = document.getElementById('stack-screen') || document.querySelector('.stack-screen');
  const xs = [];
  for (let i = 0; i < 8; i++) { s.dispatchEvent(new WheelEvent('wheel', { deltaX: 14, deltaY: 1, deltaMode: 0, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 16));
    xs.push(Math.round(new DOMMatrix(getComputedStyle(document.querySelector('.stack-center-perspective, .stack-filmstrip-clone')).transform).m41)); }
  await new Promise(r => setTimeout(r, 800));
  return xs; })()""")
s6 = st()
res['trackpad swipe: cards follow the fingers, then settle on next card'] = s6['sel'] > s6a['sel'] and not s6['film'] and s6['clones'] == 0
res['_detail_wheel'] = wheel

ok = all(v for k, v in res.items() if not k.startswith('_'))
print(json.dumps(res, indent=1))
print('PASS' if ok else 'FAIL')
c.close()
