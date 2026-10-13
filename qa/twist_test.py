"""Hero tomato: the whole TOP HALF is a real 3D object that turns a full 360° with the dial.

Checks, on the real hero canvas (sprite coords x1, canvas is x2):
- the 3D top is active for every colour (6 colours, grey, silver), no GL errors, repeatable frames
- turning the dial changes the top half (leaves, shoulders, lobes), incl. the leaves at the BACK
  (the outline behind the stem), not only the number band
- true 360°: one full turn of the top lands exactly on the starting look; half a turn shows the back
- the stem turns in place (doesn't drift sideways)
- smooth: tiny dial steps give tiny changes everywhere (no pops / hand-overs)
- turning direction matches the numbers (wind up -> surface moves left at the front)
- bottom half + pointer + background never change
- no colour jump where the 3D top meets the photo's bottom half (just above the seam)
Saves screenshots for visual inspection.
"""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP

c = CDP(390, 844, port=int(sys.argv[1]))
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.activePillar = 'timer'; a.state.timerSubMode = 'hero';
  a.state.selectedQuadrant = 0; a.renderAll(); })()""")
time.sleep(1.5)

c.js(r"""window.__tw = {
  set(min, key) { const h = window.fableFlowApp.hero3D; const isGrey = key === 'unassigned', isSilver = key === 'completed';
    h.silverBlend = isSilver ? 1 : 0; h.updateOdometer(min * 6, (isGrey || isSilver) ? 0 : key, !isGrey, isSilver);
    if (isSilver) { h.silverBlend = 1; h.targetSilverBlend = 1; h.render(); } },
  grab() { const h = window.fableFlowApp.hero3D; return h.canvas.getContext('2d').getImageData(0, 0, h.canvas.width, h.canvas.height).data; },
  diff(A, B, x0, y0, x1, y1, skipStem) { const W = 1400; let s = 0, n = 0, mx = 0;
    for (let y = y0 * 2; y < y1 * 2; y++) for (let x = x0 * 2; x < x1 * 2; x++) {
      if (skipStem && x >= 300 * 2 && x < 363 * 2 && y < 112 * 2) continue;
      const i = (y * W + x) * 4; const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i+1] - B[i+1]) + Math.abs(A[i+2] - B[i+2])) / 3;
      s += d; n++; if (d > mx) mx = d; }
    return { mean: s / n, max: mx }; },
  shift(A, B, x0, y0, x1, y1) { const W = 1400; let best = null;
    for (let dx = -30; dx <= 30; dx++) { let s = 0;
      for (let y = y0 * 2; y < y1 * 2; y += 2) for (let x = x0 * 2; x < x1 * 2; x += 2) {
        const i = (y * W + x) * 4, j = (y * W + x + dx) * 4; s += Math.abs(A[i] - B[j]) + Math.abs(A[i+1] - B[j+1]); }
      if (!best || s < best.s) best = { dx, s }; }
    return best.dx; },
  // stem: horizontal centre of the dark-vs-backdrop run on a row above the dome
  stemCentre(A, sy) { const W = 1400, y = sy * 2; const bg = [A[(y * W + 20) * 4], A[(y * W + 20) * 4 + 1], A[(y * W + 20) * 4 + 2]];
    let x0 = -1, x1 = -1;
    for (let x = 280 * 2; x < 385 * 2; x++) { const i = (y * W + x) * 4;
      const d = Math.abs(A[i] - bg[0]) + Math.abs(A[i+1] - bg[1]) + Math.abs(A[i+2] - bg[2]);
      if (d > 60) { if (x0 < 0) x0 = x; x1 = x; } }
    return x0 < 0 ? null : (x0 + x1) / 4; },
};""")

def run(expr):
    return c.js("(() => { const T = window.__tw; " + expr + " })()")

res = {}
TOP = (185, 112, 480, 205)      # shoulders + leaves, above the number band
CAP = (236, 92, 428, 134)       # the leaves around the stem
BACK = (196, 70, 470, 100)      # the outline behind the stem (back leaves)
BOTTOM = (130, 312, 530, 425)   # bottom half incl. the pointer
BG = (10, 10, 100, 590)         # plain background
FULL = 360.0 / (3.0 / (0.978 * 1.118))   # minutes for one full turn of the top (~131.2)

st = run("""const h = window.fableFlowApp.hero3D; const R = {};
  for (const k of [0, 1, 2, 3, 4, 5, 'unassigned', 'completed']) R[k] = h._topReady(k);
  const top = h._top3D; return { ready: R, gl: top ? top.gl.getError() : 'none', verts: top && top.vertexCount };""")
print('3D top', st)
res['3D top active for all 8 colours, no GL error'] = st['gl'] == 0 and all(st['ready'].values())

r0 = run("""T.set(0, 0); const A = T.grab(); window.__A0 = A; T.set(7, 0); T.set(0, 0); const B = T.grab();
  return T.diff(A, B, 0, 0, 700, 600, false);""")
print('repeat 0 vs 0', r0)
res['frames are repeatable'] = r0['max'] == 0

out = run("""const A = window.__A0; const R = {};
  for (const m of [5, 10, 18, 37]) { T.set(m, 0); const B = T.grab();
    R[m] = { top: T.diff(A, B, %d, %d, %d, %d, true), cap: T.diff(A, B, %d, %d, %d, %d, true), back: T.diff(A, B, %d, %d, %d, %d, true),
             bottom: T.diff(A, B, %d, %d, %d, %d, false), bg: T.diff(A, B, %d, %d, %d, %d, false) }; }
  return R;""" % (TOP + CAP + BACK + BOTTOM + BG))
for m, r in out.items():
    print('min', m, json.dumps({k: round(v['mean'], 2) for k, v in r.items()}), 'bottom max', r['bottom']['max'])
res['turning changes the shoulders and leaves (5..37 min)'] = all(out[m]['top']['mean'] > 1.0 and out[m]['cap']['mean'] > 3.0 for m in out)
res['the BACK leaves move too (outline behind the stem)'] = all(out[m]['back']['mean'] > 1.5 for m in out)
res['bottom half + pointer never change'] = all(out[m]['bottom']['max'] <= 2 for m in out)
res['background never changes'] = all(out[m]['bg']['max'] == 0 for m in out)

turn = run("""const A = window.__A0; T.set(%f, 0); const F = T.grab(); T.set(%f, 0); const H = T.grab();
  return { full: T.diff(A, F, %d, %d, %d, %d, false), half: T.diff(A, H, %d, %d, %d, %d, false) };""" % ((FULL, FULL / 2) + CAP + CAP))
print('one full turn (%.1f min) vs 0:' % FULL, turn['full'], ' half turn vs 0:', turn['half'])
res['one full turn of the top returns to the starting look'] = turn['full']['mean'] < 0.6
res['half a turn shows a different side (the back)'] = turn['half']['mean'] > 4.0

stem = run("""const R = []; for (const m of [0, 15, 33, 49, 66, 90, 120]) { T.set(m, 0); const A = T.grab(); R.push(T.stemCentre(A, 69)); } return R;""")
print('stem centre (sprite x) at 0/15/33/49/66/90/120 min:', stem)
res['stem turns in place (centre within 2.5 px)'] = all(s is not None for s in stem) and max(stem) - min(stem) <= 2.5

# smoothness: 0.25-min steps over a whole quarter turn
sm = run("""let prev = null; const steps = [];
  for (let m = 0; m <= 33; m += 0.25) { T.set(m, 0); const B = T.grab();
    if (prev) steps.push(T.diff(prev, B, %d, %d, %d, %d, true).mean); prev = B; }
  const s = steps.slice().sort((a, b) => a - b); return { max: s[s.length - 1], median: s[s.length >> 1], n: steps.length };""" % CAP)
print('step-to-step change (0.25 min):', sm)
res['smooth: no pops (largest 0.25-min step <= 2.5x the median)'] = sm['max'] <= 2.5 * max(0.05, sm['median'])

dirn = run("""T.set(0, 0); const A = T.grab(); T.set(1.5, 0); const B = T.grab(); return T.shift(A, B, 250, 112, 420, 150);""")
print('front surface shift for +1.5 min (canvas px, negative = left):', dirn)
res['wind up -> surface moves left at the front'] = dirn < 0

seam = run("""T.set(0, 0); const A = T.grab(); const h = window.fableFlowApp.hero3D; const img = h.images.get(0);
  const cv = document.createElement('canvas'); cv.width = 700; cv.height = 600; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const P = g.getImageData(0, 0, 700, 600).data; let s = 0, n = 0;
  for (let x = 170; x <= 490; x += 2) { const u = Math.max(-1, Math.min(1, (x - 330.5) / 215.5));
    const sy = Math.round(298.8 + 0.5 * u - 18.2 * u * u - 15.2 * u * u * u * u);
    for (let y = sy - 16; y <= sy - 14; y++) { const i = (y * 2 * 1400 + x * 2) * 4, j = (y * 700 + x) * 4;
      s += (Math.abs(A[i] - P[j]) + Math.abs(A[i+1] - P[j+1]) + Math.abs(A[i+2] - P[j+2])) / 3; n++; } }
  return s / n;""")
print('3D top vs photo just above the seam (mean level diff):', round(seam, 2))
res['no colour jump where the 3D top meets the photo (<= 9 levels)'] = seam <= 9

perf = run("""const h = window.fableFlowApp.hero3D; const t0 = performance.now(); for (let i = 0; i < 5; i++) { T.set(10 + i, 0); }
  return (performance.now() - t0) / 5;""")
print('frame time (ms, headless software GL; a phone GPU is far faster):', round(perf, 1))

# screenshots
c.js("window.__tw.set(0, 0)"); c.shot('twist3d_00')
c.js("window.__tw.set(25, 0)"); c.shot('twist3d_25')
c.js("window.__tw.set(66, 0)"); c.shot('twist3d_66')

for k, v in res.items(): print(('OK   ' if v else 'BAD  ') + k)
print('PASS' if all(res.values()) else 'FAIL')
c.close()
