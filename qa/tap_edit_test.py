import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
W, H, PORT = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
c = CDP(W, H, port=PORT)
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.activePillar = 'card'; a.state.isCardFlipped = false; a._todayFlipDeg = 0;
  const t = ['Reply to the design review comments', 'Book dentist appointment and pick up prescription', 'Call grandma'];
  a.state.tasks = t.map((x, i) => ({ id: 't' + i, orderIndex: i + 1, title: x, isCompleted: false, assignedQuadrant: null }));
  a.saveState(); a.renderAll(); })()""")
time.sleep(0.7)
results = []
# tap on different spots of row 2: title text start, title end, index number, empty right side of title
spots = c.js("""(() => { const row = document.querySelectorAll('#task-list-container .task-row')[1]; const t = row.querySelector('.task-title').getBoundingClientRect();
  const i = row.querySelector('.task-index').getBoundingClientRect(); const r = row.getBoundingClientRect();
  return { titleStart: [t.left + 10, t.top + 12], titleEnd: [t.right - 8, t.bottom - 10], index: [i.left + i.width/2, i.top + i.height/2], rowRightGap: [r.right - 70, r.top + r.height/2] }; })()""")
for name, (x, y) in spots.items():
    for trial in range(3):
        c.js("(() => { document.activeElement && document.activeElement.blur(); window.fableFlowApp.renderAll(); })()")
        time.sleep(0.35)
        c.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        time.sleep(0.06)
        c.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        time.sleep(0.9)
        st = c.js("(() => { const inp = document.querySelector('#task-list-container .task-inline-input'); return { editing: Boolean(inp), focused: Boolean(inp) && document.activeElement === inp }; })()")
        results.append((name, trial, st['editing'], st['focused']))
ok = all(e and f for _, _, e, f in results)
for r in results: print(r)
print('PASS' if ok else 'FAIL')
c.close()
