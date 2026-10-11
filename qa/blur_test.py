import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]))
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.activePillar = 'card';
  a.state.tasks = [{ id: 't0', orderIndex: 1, title: 'Book dentist appointment and pick up prescription', isCompleted: false, assignedQuadrant: null }];
  a.saveState(); a.renderAll(); })()""")
time.sleep(0.6)
r = c.js("""(async () => { const a = window.fableFlowApp; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const row = document.querySelector('#task-list-container .task-row');
  a.startInlineEditTask(row, a.state.tasks[0], false, true);
  const inp = row.querySelector('.task-inline-input');
  // simulate iOS's late compat mousedown stealing focus 120ms after the tap
  await sleep(120); inp.blur(); await sleep(400);
  const stillEditingAfterStrayBlur = document.body.contains(inp) && document.activeElement === inp;
  // a real "leave" later should still save & close
  await sleep(300); inp.value = 'Book dentist'; inp.dispatchEvent(new InputEvent('input', { bubbles: true })); inp.blur(); await sleep(400);
  return { stillEditingAfterStrayBlur, closedAfterRealBlur: !document.querySelector('#task-list-container .task-inline-input'), savedTitle: a.state.tasks[0].title };
})()""")
print(r); print('PASS' if r['stillEditingAfterStrayBlur'] and r['closedAfterRealBlur'] and r['savedTitle'] == 'Book dentist' else 'FAIL')
c.close()
