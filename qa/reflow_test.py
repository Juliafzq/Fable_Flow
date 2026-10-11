import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
W, H, PORT = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
c = CDP(W, H, port=PORT)
def setup(tasks, pillar):
    c.js("""((tasks, pillar) => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
      a.state.hasCompletedOnboarding = true; a.state.isCardFlipped = false; a._todayFlipDeg = 0;
      const mk = (x, i) => ({ id: 't' + i, orderIndex: i + 1, title: x, isCompleted: false, assignedQuadrant: null });
      if (pillar === 'card') { a.state.tasks = tasks.map(mk); a.state.activePillar = 'card'; }
      else { a.ensureTourDemoArchiveCards(); const k = a.getOffsetDateKey(a.state.cardDateKey, -1); a.state.selectedStackDateKey = k;
             a.state.archiveCards[k].tasks = tasks.map(mk); a.state.activePillar = 'stack'; a.state.isStackEditMode = true; a.state.isStackCardFlipped = false; a._stackFlipDeg = 0; }
      a.saveState(); a.renderAll(); })(%s, %s)""" % (json.dumps(tasks), json.dumps(pillar)))
    time.sleep(0.7)
snap = """((sel) => { const rows = Array.from(document.querySelectorAll(sel + ' .task-row'));
  return { font: parseFloat(getComputedStyle(rows[0].querySelector('.task-index')).fontSize),
           rows: rows.map(r => { const b = r.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.height)]; }) }; })"""
cases = {
  'today_short': (['Call grandma', 'Buy milk', 'Run'], 'card', '#task-list-container'),
  'today_full': (['Reply to the design review comments from Tuesday', 'Book dentist appointment and pick up prescription',
                  'Draft the quarterly planning doc outline for the team', 'Go for a 30 minute run along the river before dinner',
                  'Read two chapters of the book club novel tonight', 'Call grandma and ask about her trip to the coast',
                  'Clean the kitchen and take out the recycling bins'], 'card', '#task-list-container'),
  'stack_full': (['Reply to the design review comments from Tuesday', 'Book dentist appointment and pick up prescription',
                  'Draft the quarterly planning doc outline for the team', 'Go for a 30 minute run along the river before dinner',
                  'Read two chapters of the book club novel tonight', 'Call grandma and ask about her trip to the coast'], 'stack', '#stack-task-list-container'),
}
allok = True
for name, (tasks, pillar, sel) in cases.items():
    setup(tasks, pillar)
    before = c.js(snap + "(%s)" % json.dumps(sel))
    for idx in [0, 2]:
        c.js("""((sel, idx, pillar) => { const a = window.fableFlowApp; a.renderAll();
          const rows = document.querySelectorAll(sel + ' .task-row'); const arr = pillar === 'card' ? a.state.tasks : a.getSelectedStackCard().tasks;
          a.startInlineEditTask(rows[idx], arr[idx], pillar !== 'card', true); })(%s, %d, %s)""" % (json.dumps(sel), idx, json.dumps(pillar)))
        time.sleep(0.3)
        during = c.js(snap + "(%s)" % json.dumps(sel))
        print('   before', before['rows']); print('   during', during['rows'])
        maxShift = max(abs(a[0]-b[0]) + abs(a[1]-b[1]) for a, b in zip(before['rows'], during['rows']))
        ok = during['font'] == before['font'] and maxShift <= 2
        allok &= ok
        print(name, 'edit row', idx + 1, 'font', before['font'], '->', during['font'], 'max row shift px', maxShift, 'OK' if ok else 'MOVED')
        if name == 'today_full' and idx == 2: c.shot(f'edit_inplace_{W}')
        if name == 'stack_full' and idx == 2: c.shot(f'edit_inplace_stack_{W}')
print('PASS' if allok else 'FAIL')
c.close()
