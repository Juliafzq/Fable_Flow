import json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from cdp_helper import CDP, OVERFLOW_JS, OUT

os.makedirs(OUT, exist_ok=True)
W, H = int(sys.argv[1]), int(sys.argv[2])
c = CDP(W, H, port=int(sys.argv[3]) if len(sys.argv) > 3 else 9233)
tag = f'{W}x{H}'
report = {}

def reset_ui():
    c.js("""(() => { const a = window.fableFlowApp;
      document.querySelectorAll('.modal-overlay, .profile-popover-overlay, .about-letter-overlay, #onboarding-overlay')
        .forEach(o => o.classList.add('hidden'));
      if (a._isGuidedTourActive && a.endGuidedTour) a.endGuidedTour();
      a._isGuidedTourActive = false; a.stopTourDemoLoop && a.stopTourDemoLoop();
      document.getElementById('app-viewport').classList.remove('tour-active');
      a.state.openDropdownQuadrant = null; a.state.isHeroDropdownOpen = false;
      a.closeHeroTimeEditorDOM(); a.closeHeroTitleEditorDOM && a.closeHeroTitleEditorDOM(); })()""")

def snap(name, setup, wait=0.6):
    reset_ui()
    c.js(setup)
    time.sleep(wait)
    issues = c.js(OVERFLOW_JS)
    report[name] = issues
    c.shot(f'{tag}_{name}')

# switch to zh, mark onboarding done, add a long-ish Chinese task + demo archive cards
c.js("""(() => { const a = window.fableFlowApp;
  a.state.hasCompletedOnboarding = true;
  a.applyLanguage('zh', true);
  a.state.tasks = [
    { id: 'task-1', orderIndex: 1, title: 'Example Task', isCompleted: false, assignedQuadrant: 0 },
    { id: 'task-2', orderIndex: 2, title: '读完《人类简史》第三章', isCompleted: true, assignedQuadrant: null }];
  a.state.timers[0].assignedTaskId = 'task-1'; a.state.timers[0].customTitle = 'Example Task';
  a.state.timers[0].remainingSeconds = 1500; a.state.timers[0].angleDegrees = 150;
  a.state.activePillar = 'card'; a.saveState(); a.renderAll(); })()""")
time.sleep(0.5)

snap('01_home', "(() => { const a = window.fableFlowApp; a.state.activePillar = 'home'; a.renderAll(); })()")
snap('02_card_front', "(() => { const a = window.fableFlowApp; a.state.activePillar = 'card'; a.state.isCardFlipped = false; a._todayFlipDeg = 0; a.renderAll(); a.setInstantCardRotation(a.els.card3DWrapper, false, 0); })()")
snap('03_card_front_adding', "(() => { const a = window.fableFlowApp; a.startInlineAddTask(false); })()")
snap('04_card_back', "(() => { const a = window.fableFlowApp; a.renderAll(); a.state.isCardFlipped = true; a._todayFlipDeg = -180; a.renderAll(); a.setInstantCardRotation(a.els.card3DWrapper, true, -180); })()")
snap('05_grid', "(() => { const a = window.fableFlowApp; a.state.isCardFlipped = false; a._todayFlipDeg = 0; a.setInstantCardRotation(a.els.card3DWrapper, false, 0); a.state.activePillar = 'timer'; a.state.timerSubMode = 'grid'; a.renderAll(); })()")
snap('06_grid_dropdown', "(() => { const a = window.fableFlowApp; a.state.activePillar = 'timer'; a.state.timerSubMode = 'grid'; a.state.openDropdownQuadrant = 1; a.renderGridScreen(); })()")
snap('07_hero', "(() => { const a = window.fableFlowApp; a.state.activePillar = 'timer'; a.state.timerSubMode = 'hero'; a.state.selectedQuadrant = 0; a.renderAll(); })()")
snap('08_hero_unassigned', "(() => { const a = window.fableFlowApp; a.state.activePillar = 'timer'; a.state.timerSubMode = 'hero'; a.state.selectedQuadrant = 3; a.renderAll(); })()")
snap('09_hero_time_editor', "(() => { const a = window.fableFlowApp; a.state.activePillar = 'timer'; a.state.timerSubMode = 'hero'; a.state.selectedQuadrant = 0; a.renderAll(); a.openHeroTimeEditor(); })()")
snap('10_stack', "(() => { const a = window.fableFlowApp; a.ensureTourDemoArchiveCards(); a.state.activePillar = 'stack'; a.state.isStackEditMode = false; a.renderAll(); })()")
snap('11_stack_edit', "(() => { const a = window.fableFlowApp; a.state.activePillar = 'stack'; a.state.isStackEditMode = true; a.renderAll(); })()")
snap('12_stack_retro_slot', """(() => { const a = window.fableFlowApp; a.state.activePillar = 'stack'; a.state.isStackEditMode = false;
   const k = a.getOffsetDateKey(a.state.cardDateKey, -9); delete a.state.archiveCards[k]; a.state.selectedStackDateKey = k; a.renderAll(); })()""")
snap('13_profile', "(() => { const a = window.fableFlowApp; a.state.activePillar = 'card'; a.renderAll(); a.openProfileModal(); })()")
snap('14_auth', "(() => { const a = window.fableFlowApp; a.openAuthModal('signin'); a.showAuthError(a.t('Account not found — switch to Create Account')); })()")
snap('15_about', "(() => { const a = window.fableFlowApp; a.openAboutModal(); })()", wait=11.5)
snap('16_add_task_modal', "(() => { const a = window.fableFlowApp; a.openCustomTitleModal(2); })()")
snap('17_delete_modal', "(() => { const a = window.fableFlowApp; a.confirmPermanentDeleteTask(a.state.tasks[1]); })()")
for i in range(11):
    snap(f'2{i:02d}_tour_step{i+1}', f"(() => {{ const a = window.fableFlowApp; a.startGuidedTour({i}); }})()", wait=1.4)
# front-page tour mid-uncross frame
snap('2y_tour_type_digits', "(() => { const a = window.fableFlowApp; a.startGuidedTour(5); })()", wait=2.3)
snap('2x_tour_step2_uncross', "(() => { const a = window.fableFlowApp; a.startGuidedTour(1); })()", wait=3.1)

c.js("(() => { const a = window.fableFlowApp; a._isGuidedTourActive = false; a.applyLanguage('en', true); })()")
c.close()
bad = {k: v for k, v in report.items() if v}
for k, v in bad.items():
    print('##', k)
    seen=set()
    for i in v:
        key=(i['kind'], i['label'])
        if key in seen: continue
        seen.add(key); print('  ', json.dumps(i, ensure_ascii=False))
if not bad: print('NO OVERFLOW ISSUES')
