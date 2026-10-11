"""× must delete on the FIRST tap, however editing was opened (tap on text, number, gap; Today & past cards)."""
import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
c = CDP(390, 844, port=int(sys.argv[1]))
def tap(x, y, hold=0.06):
    c.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]}); time.sleep(hold)
    c.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
def setup(pillar):
    c.js("""((pillar) => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
      a.state.hasCompletedOnboarding = true; a.state.isCardFlipped = false; a._todayFlipDeg = 0; a.state.tasks.forEach(t => { if (t.assignedQuadrant !== null && t.assignedQuadrant !== undefined) a.clearQuadrantAssignment(t.assignedQuadrant); });
      const mk = (x, i) => ({ id: 't' + i + Date.now(), orderIndex: i + 1, title: x, isCompleted: false, assignedQuadrant: null });
      const tasks = ['Keep this one', 'Delete this task please', 'Keep this too'].map(mk);
      if (pillar === 'card') { a.state.tasks = tasks; a.state.activePillar = 'card'; }
      else { a.ensureTourDemoArchiveCards(); const k = a.getOffsetDateKey(a.state.cardDateKey, -1); a.state.selectedStackDateKey = k;
             a.state.archiveCards[k].tasks = tasks; a.state.activePillar = 'stack'; a.state.isStackEditMode = true; a.state.isStackCardFlipped = false; a._stackFlipDeg = 0; }
      a.saveState(); a.renderAll(); })(%s)""" % json.dumps(pillar))
    time.sleep(0.7)
results = []
for pillar, sel in [('card', '#task-list-container'), ('stack', '#stack-task-list-container')]:
    for spot in ['text', 'index', 'gap']:
        setup(pillar)
        x, y = c.js("""((sel, spot) => { const row = document.querySelectorAll(sel + ' .task-row')[1];
          const t = row.querySelector('.task-title').getBoundingClientRect(); const i = row.querySelector('.task-index').getBoundingClientRect();
          const r = row.getBoundingClientRect();
          if (spot === 'text') return [t.left + 20, t.top + t.height / 2];
          if (spot === 'index') return [i.left + i.width / 2, i.top + i.height / 2];
          return [t.right + 12, t.top + t.height / 2]; })(%s, %s)""" % (json.dumps(sel), json.dumps(spot)))
        tap(x, y); time.sleep(0.8)
        editing = c.js("Boolean(document.querySelector('%s .task-inline-input'))" % sel)
        if spot == 'text':
            # iOS Safari: the opening tap's touchend goes to the replaced (detached) title node and never
            # reaches the row, so any per-row "suppress next click" state is left behind. Reproduce that.
            c.js("(() => { const r = document.querySelectorAll('%s .task-row')[1]; r._suppressCompatClick = true; })()" % sel)
        bx, by = c.js("(() => { const b = document.querySelector('%s .task-inline-delete-btn').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()" % sel)
        tap(bx, by); time.sleep(0.7)
        titles = c.js("""((pillar) => { const a = window.fableFlowApp; return (pillar === 'card' ? a.state.tasks : a.getSelectedStackCard().tasks).map(t => t.title); })(%s)""" % json.dumps(pillar))
        side = c.js("(() => { const a = window.fableFlowApp; return { pillar: a.state.activePillar, assigned: a.state.tasks.filter(t => t.assignedQuadrant !== null && t.assignedQuadrant !== undefined).length, editingNow: Boolean(document.querySelector('.task-inline-input')) }; })()")
        noSideEffects = side['pillar'] == pillar and side['assigned'] == 0 and not side['editingNow']
        if not noSideEffects: print('      side effect after delete:', side)
        ok = editing and titles == ['Keep this one', 'Keep this too'] and noSideEffects
        results.append(ok)
        print(('OK   ' if ok else 'BAD  ') + f'{pillar:5} open via {spot:5} -> after 1 tap on ×: {titles}')
print('PASS' if all(results) else 'FAIL')
c.close()
