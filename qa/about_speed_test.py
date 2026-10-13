"""About letter: lines appear at a quicker (but still calm) pace, in order.

Records when each .about-block becomes visible after the About letter opens.
- whole letter readable within ~5 s (was ~10 s)
- still calm: lines come one at a time, >= 0.5 s apart, in order
- fade is short enough that the last line is fully shown soon after it starts
"""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP

c = CDP(390, 844, port=int(sys.argv[1]))
c.js("""(() => { const a = window.fableFlowApp;
  window.__aboutLog = [];
  const blocks = Array.from(document.querySelectorAll('#about-letter-blocks .about-block'));
  blocks.forEach((b) => b.classList.remove('visible'));
  const obs = new MutationObserver(() => {
    blocks.forEach((b, i) => {
      if (b.classList.contains('visible') && !window.__aboutLog.some((e) => e.i === i)) {
        window.__aboutLog.push({ i, t: performance.now() - window.__aboutT0 });
      }
    });
  });
  blocks.forEach((b) => obs.observe(b, { attributes: true, attributeFilter: ['class'] }));
  window.__aboutT0 = performance.now();
  a.openAboutModal();
  return blocks.length; })()""")
n = c.js("document.querySelectorAll('#about-letter-blocks .about-block').length")
time.sleep(1.6)
c.shot('about_speed_mid')
time.sleep(9.0)
log = c.js("window.__aboutLog")
fade = c.js("parseFloat(getComputedStyle(document.querySelector('#about-letter-blocks .about-block')).transitionDuration)")
c.shot('about_speed_end')
log = sorted(log, key=lambda e: e['t'])
times = [round(e['t']) for e in log]
order = [e['i'] for e in log]
gaps = [b - a for a, b in zip(times, times[1:])]
print(json.dumps({'blocks': n, 'times_ms': times, 'order': order, 'gaps_ms': gaps, 'fade_s': fade}))
res = {
    'all lines appear': len(log) == n and n >= 6,
    'in order': order == list(range(n)),
    'last line starts within 4.8 s': bool(times) and times[-1] <= 4800,
    'fully shown within ~5.6 s (start + fade)': bool(times) and times[-1] + fade * 1000 <= 5600,
    'still one at a time (>= 0.5 s apart)': all(g >= 500 for g in gaps),
    'first line comes quickly (<= 0.4 s)': bool(times) and times[0] <= 400,
}
for k, v in res.items(): print(('OK   ' if v else 'BAD  ') + k)
print('PASS' if all(res.values()) else 'FAIL')
c.close()
