import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
W, H, PORT = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
c = CDP(W, H, port=PORT)
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.tasks = []; a.state.activePillar = 'card'; a.state.isCardFlipped = false; a._todayFlipDeg = 0;
  a.saveState(); a.renderAll(); })()""")
time.sleep(0.6)
long_titles = ['Reply to the design review comments from Tuesday',
               'Book dentist appointment and pick up prescription',
               'Draft the quarterly planning doc outline for the team',
               'Go for a 30 minute run along the river before dinner',
               'Read two chapters of the book club novel tonight',
               'Call grandma and ask about her trip to the coast',
               'Clean the kitchen and take out the recycling bins',
               'Prepare slides for Friday demo and rehearse once',
               'This ninth item should never be allowed on the card']
r = c.js("""(async (titles) => {
  const a = window.fableFlowApp; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  a.startInlineAddTask(false); await sleep(40);
  const log = [];
  for (const t of titles) {
    const input = document.querySelector('#task-list-container .task-inline-input');
    if (!input) { log.push('no input for: ' + t.slice(0, 12)); break; }
    input.value = t; input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    log.push({ count: a.state.tasks.length, nextInputFocused: document.activeElement && document.activeElement.classList.contains('task-inline-input') });
    await sleep(30);
  }
  await sleep(300);
  const body = document.querySelector('#screen-card .card-dot-grid-body');
  const fs = parseFloat(getComputedStyle(document.querySelector('#task-list-container .task-title')).fontSize);
  // Edit item 2 and press Return -> should move to edit item 3
  const rows = document.querySelectorAll('#task-list-container .task-row');
  a.startInlineEditTask(rows[1], a.state.tasks[1], false); await sleep(40);
  const editInput = rows[1].querySelector('.task-inline-input');
  editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
  await sleep(40);
  const active = document.activeElement;
  const activeRowIdx = Array.from(document.querySelectorAll('#task-list-container .task-row')).findIndex(r => r.contains(active));
  return { log, finalCount: a.state.tasks.length, addRowHidden: a.els.addItemRow.classList.contains('hidden'),
           fontPx: fs, overflowing: body.classList.contains('is-overflowing'),
           bodyFits: body.scrollHeight <= body.clientHeight + 2, editMovedToRowIdx: activeRowIdx };
})(%s)""" % json.dumps(long_titles))
print(json.dumps(r))
c.shot(f'enter_full_{W}')
c.close()
