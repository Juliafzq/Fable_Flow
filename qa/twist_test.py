"""Hero tomato: the TOP HALF visibly twists with the dial (not just the numbers).

Checks, on the real hero canvas (sprite coords x1, canvas is x2):
- at 00:00 the tomato is exactly the original picture (idle look unchanged)
- turning the dial changes the top half's surface (leaves / shoulders), not only the number band
- bottom half + pointer, the stem and the background never change
- turning direction matches the numbers (wind up -> surface moves left at the front)
- smooth: tiny dial steps give tiny changes (no pops), incl. the symmetry hand-over point
- no seams / tears: no new hard edges inside the twisted area
- every colour (6 colours, grey, silver) twists
- render time per frame (twist on)
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
  // mean |diff| over a sprite-coord rect (canvas = 2x), optional exclusion of the stem column
  diff(A, B, x0, y0, x1, y1, skipStem) { const W = 1400; let s = 0, n = 0, mx = 0;
    for (let y = y0 * 2; y < y1 * 2; y++) for (let x = x0 * 2; x < x1 * 2; x++) {
      if (skipStem && x >= 306 * 2 && x < 357 * 2 && y < 104 * 2) continue;
      const i = (y * W + x) * 4; const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i+1] - B[i+1]) + Math.abs(A[i+2] - B[i+2])) / 3;
      s += d; n++; if (d > mx) mx = d; }
    return { mean: s / n, max: mx }; },
  // best horizontal shift (canvas px) of B relative to A over a band, by SAD search
  shift(A, B, x0, y0, x1, y1) { const W = 1400; let best = null;
    for (let dx = -24; dx <= 24; dx++) { let s = 0;
      for (let y = y0 * 2; y < y1 * 2; y += 2) for (let x = x0 * 2; x < x1 * 2; x += 2) {
        const i = (y * W + x) * 4, j = (y * W + x + dx) * 4; s += Math.abs(A[i] - B[j]) + Math.abs(A[i+1] - B[j+1]); }
      if (!best || s < best.s) best = { dx, s }; }
    return best.dx; },
  // strongest neighbour step inside the dome (seam/tear detector), upper part only (no numbers there)
  edge(A, x0, y0, x1, y1) { const W = 1400; let mx = 0, sum = 0, n = 0;
    for (let y = y0 * 2; y < y1 * 2; y++) for (let x = x0 * 2; x < x1 * 2; x++) {
      if (x >= 300 * 2 && x < 363 * 2 && y < 106 * 2) continue;
      const i = (y * W + x) * 4, r = i + 4, d = i + W * 4;
      const g = Math.max(Math.abs(A[i] - A[r]) + Math.abs(A[i+1] - A[r+1]) + Math.abs(A[i+2] - A[r+2]),
                         Math.abs(A[i] - A[d]) + Math.abs(A[i+1] - A[d+1]) + Math.abs(A[i+2] - A[d+2]));
      if (g > mx) mx = g; sum += g; n++; }
    return { max: mx, mean: sum / n }; },
};""")

def run(expr):
    return c.js("(() => { const T = window.__tw; " + expr + " })()")

res = {}
# Regions in sprite coords
TOP = (185, 112, 480, 205)      # shoulders + leaves, above the number band
CAP = (236, 96, 428, 134)       # the leaves around the stem
BOTTOM = (130, 312, 530, 425)   # bottom half incl. the pointer
STEM = (318, 62, 346, 84)       # stem sticking out above the top
BG = (10, 10, 100, 590)         # plain background

r0 = run("""T.set(0, 0); const A = T.grab(); window.__A0 = A; T.set(0, 0); const B = T.grab();
  return T.diff(A, B, 0, 0, 700, 600, false);""")
print('repeat 0 vs 0', r0)

out = run("""const A = window.__A0; const R = {};
  for (const m of [5, 10, 18, 37]) { T.set(m, 0); const B = T.grab();
    R[m] = { top: T.diff(A, B, %d, %d, %d, %d, true), cap: T.diff(A, B, %d, %d, %d, %d, true),
             bottom: T.diff(A, B, %d, %d, %d, %d, false), stem: T.diff(A, B, %d, %d, %d, %d, false),
             bg: T.diff(A, B, %d, %d, %d, %d, false) }; }
  return R;""" % (TOP + CAP + BOTTOM + STEM + BG))
for m, r in out.items(): print('min', m, json.dumps({k: round(v['mean'], 2) for k, v in r.items()}), 'bottom max', r['bottom']['max'])
res['00:00 is the original picture (repeatable)'] = r0['max'] == 0
# one leaf step (72 deg) every 25 min: the 5 leaves land back on the resting look at 25 / 50 / 75 min
r25 = run("const A = window.__A0; T.set(25, 0); return T.diff(A, T.grab(), 0, 0, 700, 600, false);")
r50 = run("const A = window.__A0; T.set(50, 0); return T.diff(A, T.grab(), %d, %d, %d, %d, true);" % TOP)
print('25 min vs 0 (whole canvas)', r25, '50 min top', r50)
res['every 25 min the leaves land on the resting look'] = r50['max'] == 0
res['top half (shoulders) changes when turned'] = all(out[str(m)]['top']['mean'] > 2.0 for m in (5, 10, 18, 37))
res['leaves around the stem move when turned'] = all(out[str(m)]['cap']['mean'] > 3.0 for m in (5, 10, 18, 37))
res['bottom half + pointer never change'] = all(out[str(m)]['bottom']['max'] == 0 for m in (5, 10, 18, 37))
res['stem stays put'] = all(out[str(m)]['stem']['mean'] < 1.0 for m in (5, 10, 18, 37))
res['background untouched'] = all(out[str(m)]['bg']['max'] == 0 for m in (5, 10, 18, 37))

# direction: small wind-up -> features at the front of the leaves move left (negative dx)
dx = run("""T.set(3, 0); const A = T.grab(); T.set(4, 0); const B = T.grab(); return T.shift(A, B, 250, 104, 410, 132);""")
print('shift for +1 min (canvas px):', dx)
res['turns the same way as the numbers (moves left on wind-up)'] = dx < 0

# smoothness: tiny steps -> tiny change; check many points incl. the leaf hand-over at 12.5 / 37.5 min.
# Measured above the number band (rows 85..185) so the moving numbers don't count.
steps = run("""const R = []; for (const m of [1, 7.3, 11.5, 12.3, 12.45, 12.5, 12.55, 13.4, 20, 26.2, 37.4, 52.4]) {
    T.set(m, 0); const A = T.grab(); T.set(m + 0.1, 0); const B = T.grab();
    R.push([m, T.diff(A, B, 150, 85, 520, 185, true).mean]); } return R;""")
print('0.1-min step change:', [(m, round(d, 3)) for m, d in steps])
vals = sorted(d for _, d in steps)
median = vals[len(vals) // 2]
res['smooth: 0.1-min steps change < 1.5 levels on average'] = all(d < 1.5 for _, d in steps)
res['no pops: no step > 2.5x the typical step'] = all(d <= 2.5 * median + 0.05 for _, d in steps)

# seams / tears: twisted frames have no harder edges than the original picture
edges = run("""const R = {}; for (const m of [0, 6, 12.5, 18, 47]) { T.set(m, 0); const A = T.grab(); R[m] = T.edge(A, 150, 100, 515, 215); } return R;""")
print('edge max/mean:', {k: (v['max'], round(v['mean'], 2)) for k, v in edges.items()})
base = edges['0']
res['no seams or tears (no new hard edges)'] = all(v['max'] <= base['max'] * 1.25 + 6 and v['mean'] <= base['mean'] * 1.3 + 0.5 for v in edges.values())

# every colour twists
cols = run("""const R = {}; for (const k of [0, 1, 2, 3, 4, 5, 'unassigned', 'completed']) {
    T.set(0, k); const A = T.grab(); T.set(17, k); const B = T.grab(); R[k] = T.diff(A, B, %d, %d, %d, %d, true).mean; } return R;""" % CAP)
print('per colour cap change @17min:', {k: round(v, 2) for k, v in cols.items()})
res['all 8 tomato looks twist'] = all(v > 3.0 for v in cols.values())

# timing
perf = run("""const h = window.fableFlowApp.hero3D; T.set(0, 0); const t0 = performance.now(); let n = 0;
  for (let m = 0.5; m < 60; m += 1.7) { h.updateOdometer(m * 6, 0, true, false); n++; }
  return (performance.now() - t0) / n;""")
print('ms per hero frame with twist: %.2f' % perf)
res['frame time OK (< 16 ms in headless desktop Chrome)'] = perf < 16

# screenshots for visual inspection
for m, key, name in [(0, 0, 'twist_00m'), (4, 0, 'twist_04m'), (9, 0, 'twist_09m'), (12.5, 0, 'twist_12m30'), (18, 0, 'twist_18m'),
                     (20, 'unassigned', 'twist_grey_20m'), (8, 3, 'twist_c3_08m'), (17, 'completed', 'twist_silver_17m')]:
    run("T.set(%s, %s); return 1;" % (json.dumps(m), json.dumps(key)))
    time.sleep(0.15); c.shot(name)
for k, v in res.items(): print(('OK   ' if v else 'BAD  ') + k)
print('PASS' if all(res.values()) else 'FAIL')
c.close()
