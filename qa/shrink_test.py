import sys, json, time
sys.path.insert(0, '.')
from cdp_helper import CDP
W, H, PORT = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
c = CDP(W, H, port=PORT)
c.js("""(() => { const a = window.fableFlowApp; document.getElementById('about-modal-overlay').classList.add('hidden');
  a.state.hasCompletedOnboarding = true; a.state.activePillar = 'card'; a.state.isCardFlipped = false; a._todayFlipDeg = 0;
  const t = ['Reply to the design review comments', 'Book dentist appointment and pick up prescription',
             'Draft the quarterly planning doc outline', 'Go for a run along the river before dinner',
             'Read two chapters of the novel', 'Call grandma about her trip'];
  a.state.tasks = t.map((x, i) => ({ id: 't' + i, orderIndex: i + 1, title: x, isCompleted: false, assignedQuadrant: null }));
  a.saveState(); a.renderAll(); })()""")
time.sleep(0.7)
r = c.js("""(async () => {
  const a = window.fableFlowApp; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // simulate a real tap on "+ Add item"
  document.getElementById('add-item-row').click();
  const focusedImmediately = document.activeElement && document.activeElement.classList.contains('task-inline-input');
  const input = document.querySelector('#task-list-container .task-inline-input');
  const placeholder = input.placeholder;
  const text = 'Prepare the slides for the Friday demo, rehearse it twice and send the deck to the whole team';
  const sizes = [];
  for (let i = 1; i <= text.length; i++) {
    input.value = text.slice(0, i);
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await sleep(0);
    sizes.push(parseFloat(getComputedStyle(input).fontSize));
  }
  let ups = 0; for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[i - 1]) ups++;
  const distinct = [...new Set(sizes)];
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
  await sleep(60);
  const afterCommit = parseFloat(getComputedStyle(document.querySelector('#task-list-container .task-title')).fontSize);
  await sleep(100);
  const afterRaf = parseFloat(getComputedStyle(document.querySelector('#task-list-container .task-title')).fontSize);
  return { focusedImmediately, placeholder, sizeIncreasesWhileTyping: ups, distinctSizes: distinct, lastTypingSize: sizes[sizes.length - 1], afterCommit, afterRaf };
})()""")
print(json.dumps(r))
c.close()
