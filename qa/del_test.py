import sys, time
sys.path.insert(0, '.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]))
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.activePillar = 'card';
  a.state.tasks = ['A task', 'Delete me', 'C task'].map((x, i) => ({ id: 't' + i, orderIndex: i + 1, title: x, isCompleted: false, assignedQuadrant: null }));
  a.saveState(); a.renderAll(); })()""")
time.sleep(0.6)
x, y = c.js("""(() => { const a = window.fableFlowApp; const row = document.querySelectorAll('#task-list-container .task-row')[1];
  a.startInlineEditTask(row, a.state.tasks[1], false, true); const b = row.querySelector('.task-inline-delete-btn').getBoundingClientRect(); return [b.left + b.width/2, b.top + b.height/2]; })()""")
time.sleep(0.3)
c.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]}); time.sleep(0.05)
c.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); time.sleep(0.6)
titles = c.js("window.fableFlowApp.state.tasks.map(t => t.title)")
print(titles); print('PASS' if titles == ['A task', 'C task'] else 'FAIL')
c.close()
