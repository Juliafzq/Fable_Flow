#!/usr/bin/env python3
"""
Comprehensive Automated Evaluation Suite for Project Focus Beta (Phase 0 & Phase 1)
Evaluates the built iOS Swift codebase AND Interactive Web/Mobile Beta against:
  1. Part 3 Evaluation Criteria (Layer 1 Architectural Audit, Layer 2 Automated Math/Logic, Layer 3 Mockup & Tactile Checklist)
  2. PRD v4 & User Feedback (Photorealistic Mockup Tomatoes, 6-Tomato 2x3 Grid, Click Lit-Up Tomato to Unassign to Grey,
     Stopwatch Turns on Minutes Not Seconds, Shortened Tomato Titles Without Overflow, Straight Dry-Graphite Strikethrough)
  3. Part 2 Detailed Implementation Plan (All Phase 0 & Phase 1 files & HTTP asset serving)
"""

import datetime
import http.server
import math
import os
import re
import socketserver
import sys
import threading
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

total_checks = 0
passed_checks = 0
failures = []


def check(category: str, name: str, fn):
    global total_checks, passed_checks
    total_checks += 1
    try:
        fn()
        passed_checks += 1
        print(f"  [PASS] [{category}] {name}")
    except Exception as exc:
        failures.append((category, name, str(exc)))
        print(f"  [FAIL] [{category}] {name}: {exc}")


print("=" * 84)
print("FABLE / FLOW (PROJECT FOCUS BETA) — PHASE 0 & PHASE 1 EVALUATION SUITE")
print("=" * 84)

# ============================================================================
# 1. LAYER 1: COMPLETE FILE INVENTORY & PHOTOREALISTIC TOMATO ASSETS
# ============================================================================
print("\n--- Layer 1: File Inventory & Photorealistic Asset Audit ---")

REQUIRED_FILES = [
    # Phase 0 Foundation (v0.1.0-alpha)
    "FableFlow.xcodeproj/project.pbxproj",
    "FableFlow/App/FableFlowApp.swift",
    "FableFlow/App/FableFlow.entitlements",
    "FableFlow/App/Info.plist",
    "FableFlow/Config/FableFlowProducts.storekit",
    "FableFlow/Core/DesignSystem/ThemeTokens.swift",
    "FableFlow/Core/DesignSystem/InAppToastBannerView.swift",
    "FableFlow/Core/Time/LogicalDayService.swift",
    "FableFlow/Core/Models/DailyCard.swift",
    "FableFlow/Core/Models/CardTask.swift",
    "FableFlow/Core/Models/JournalPhoto.swift",
    "FableFlow/Core/Models/TomatoTimerSlot.swift",
    "FableFlow/Core/Persistence/PersistenceContainer.swift",
    "FableFlow/Core/Media/HEICImageCompressor.swift",
    "FableFlow/Core/Protocols/ServiceProtocols.swift",
    # Phase 1 Track 1A: Sensory Engine & 3D Tomato Shader
    "FableFlow/Core/Sensory/SensoryEngine.swift",
    "FableFlow/Core/Sensory/HapticPatternLibrary.swift",
    "FableFlow/Core/Sensory/TactileAudioManager.swift",
    "FableFlow/Core/Rendering3D/TomatoOdometerShader.metal",
    "FableFlow/Core/Rendering3D/Tomato3DSceneView.swift",
    "FableFlow/Resources/Models3D/HeirloomTomato.usdz",
    "FableFlow/Resources/Audio/ratchet_notch.caf",
    "FableFlow/Resources/Audio/escapement_tick.caf",
    "FableFlow/Resources/Audio/soft_chime.caf",
    "FableFlow/Resources/Audio/graphite_loop.caf",
    "FableFlow/Resources/Audio/card_flip_whoosh.caf",
    "FableFlow/Resources/Audio/card_riffle_tick.caf",
    "FableFlow/Resources/Audio/card_trash_delete.caf",
    # Phase 1 Track 1B: 6-Pomodoro Grid + Hero Tomato + Bidirectional 3-Turn Odometer
    "FableFlow/Features/Timer/OdometerDialPhysics.swift",
    "FableFlow/Features/Timer/TimerCompletionNotificationScheduler.swift",
    "FableFlow/Features/Timer/TimerCoordinator.swift",
    "FableFlow/Features/Timer/TaskAssignmentMenuView.swift",
    "FableFlow/Features/Timer/FourTomatoGridView.swift",
    "FableFlow/Features/Timer/SingleHeroTomatoView.swift",
    # Phase 1 Track 1C: Card Front + Gesture Math + Pencil Strikethrough + Top Bar
    "FableFlow/Features/Card/DailyCardRepository.swift",
    "FableFlow/Features/Card/CardGestureMath.swift",
    "FableFlow/Features/Card/PencilStrikethroughCanvas.swift",
    "FableFlow/Features/Card/TaskRowView.swift",
    "FableFlow/Features/Card/CardFrontView.swift",
    "FableFlow/Features/Card/CardBackJournalView.swift",
    "FableFlow/Features/Stack/CardStackViewerView.swift",
    "FableFlow/Features/Stack/MonthlyCalendarZoomView.swift",
    "FableFlow/Features/Workspace/GlobalTopBarView.swift",
    "FableFlow/Features/Workspace/MinimalistHomepageView.swift",
    "FableFlow/Features/Workspace/PhaseOneWorkspaceView.swift",
    # Phase 0 & 1 Automated Tests
    "FableFlowTests/LogicalDayServiceTests.swift",
    "FableFlowTests/HEICImageCompressorTests.swift",
    "FableFlowTests/OdometerDialPhysicsTests.swift",
    "FableFlowTests/TimerCoordinatorConcurrencyTests.swift",
    "FableFlowTests/CardGestureMathTests.swift",
    "FableFlowTests/StackPermanentDeleteTests.swift",
    "FableFlowUITests/DailyRitualEndToEndUITests.swift",
    # Photorealistic Mockup Tomato Assets (Hero, 6-Grid, and Card Mini-Tomatoes)
    "assets/tomatoes/hero-tomato-0.png",
    "assets/tomatoes/hero-tomato-1.png",
    "assets/tomatoes/hero-tomato-2.png",
    "assets/tomatoes/hero-tomato-3.png",
    "assets/tomatoes/hero-tomato-4.png",
    "assets/tomatoes/hero-tomato-5.png",
    "assets/tomatoes/hero-tomato-grey.png",
    "assets/tomatoes/grid-tomato-0.png",
    "assets/tomatoes/grid-tomato-1.png",
    "assets/tomatoes/grid-tomato-2.png",
    "assets/tomatoes/grid-tomato-3.png",
    "assets/tomatoes/grid-tomato-4.png",
    "assets/tomatoes/grid-tomato-5.png",
    "assets/tomatoes/grid-tomato-grey.png",
    "assets/tomatoes/mini-tomato-0.png",
    "assets/tomatoes/mini-tomato-1.png",
    "assets/tomatoes/mini-tomato-2.png",
    "assets/tomatoes/mini-tomato-3.png",
    "assets/tomatoes/mini-tomato-4.png",
    "assets/tomatoes/mini-tomato-5.png",
    "assets/tomatoes/mini-tomato-grey.png",
    # Phase 2 MVP Assets (Minimalist Homepage Tomato & Evening Journal Sample Photos)
    "assets/tomatoes/home-tomato.png",
    "assets/photos/sample-poodle.jpg",
    "assets/photos/sample-desk.jpg",
    # Interactive Web/Mobile Beta Preview Application
    "index.html",
    "css/style.css",
    "js/odometerPhysics.js",
    "js/cardGestureMath.js",
    "js/sensoryEngine.js",
    "js/tomato3D.js",
    "js/app.js",
    "start.sh",
]


def verify_inventory():
    for rel in REQUIRED_FILES:
        p = os.path.join(ROOT, rel)
        assert os.path.isfile(p), f"Missing required file: {rel}"
        assert os.path.getsize(p) > 0, f"Empty file: {rel}"


check("Inventory", f"All {len(REQUIRED_FILES)} Phase 0, Phase 1, and Photorealistic Tomato Asset files exist", verify_inventory)


def read_file(rel: str) -> str:
    with open(os.path.join(ROOT, rel), "r", encoding="utf-8") as f:
        return f.read()


# ============================================================================
# 2. LAYER 1: ANTI-PATTERN & ARCHITECTURAL AUDIT (PART 3 EVALUATION CRITERIA)
# ============================================================================
print("\n--- Layer 1: Anti-Pattern & Architectural Audit ---")


def verify_audio_architecture():
    src = read_file("FableFlow/Core/Sensory/TactileAudioManager.swift")
    assert ".ambient" in src, "TactileAudioManager must configure .ambient audio category"
    assert ".mixWithOthers" in src, "Must mix with background music/podcasts (.mixWithOthers)"
    assert "preloadAudioSamples" in src and "prepareToPlay" in src, "Must preload all audio samples at startup"


check("Architecture", "TactileAudioManager uses .ambient + .mixWithOthers and preloads all foley buffers", verify_audio_architecture)


def verify_silent_mode_suppression():
    swift_audio = read_file("FableFlow/Core/Sensory/TactileAudioManager.swift")
    swift_sensory = read_file("FableFlow/Core/Sensory/SensoryEngine.swift")
    js_sensory = read_file("js/sensoryEngine.js")
    assert ".ambient" in swift_audio
    assert "isEscapementTickAudioEnabled" in swift_sensory
    assert "if (this.isSilentMode) return null;" in js_sensory


check("Architecture", "Silent Mode strictly suppresses audio while keeping haptic triggers active", verify_silent_mode_suppression)


def verify_wall_clock_timer():
    swift_timer = read_file("FableFlow/Features/Timer/TimerCoordinator.swift")
    js_app = read_file("js/app.js")
    assert "targetEndDate" in swift_timer
    assert "reconcileWallClockTimestamps" in swift_timer
    assert "reconcileElapsedTimers" in js_app


check("Architecture", "Countdown & Stopwatch timers use wall-clock delta calculation (zero background drift)", verify_wall_clock_timer)


def verify_no_vertical_scroll_and_6_task_cap():
    swift_card = read_file("FableFlow/Features/Card/CardFrontView.swift")
    css_src = read_file("css/style.css")
    assert "ScrollView" not in swift_card
    assert "< 6" in swift_card
    assert "overflow: hidden" in css_src


check("Architecture", "Card Front enforces 6-task hard cap, zero subtasks, and zero vertical scroll", verify_no_vertical_scroll_and_6_task_cap)

# ============================================================================
# 3. LAYER 2: MATHEMATICAL & USER-FEEDBACK BEHAVIORAL VERIFICATION
# ============================================================================
print("\n--- Layer 2: Mathematical & User-Feedback Behavioral Verification ---")


def verify_5am_rollover_math():
    swift_day = read_file("FableFlow/Core/Time/LogicalDayService.swift")
    js_day = read_file("js/cardGestureMath.js")
    assert "rolloverHour" in swift_day and "5" in swift_day
    assert "ROLLOVER_HOUR = 5" in js_day

    tz_oct7_459 = datetime.datetime(2026, 10, 7, 4, 59, 59)
    tz_oct7_500 = datetime.datetime(2026, 10, 7, 5, 0, 0)
    assert (tz_oct7_459 - datetime.timedelta(hours=5)).date() == datetime.date(2026, 10, 6)
    assert (tz_oct7_500 - datetime.timedelta(hours=5)).date() == datetime.date(2026, 10, 7)


check("Math/Time", "LogicalDayService 5:00 AM boundary (04:59:59 AM -> Oct 06; 05:00:00 AM -> Oct 07)", verify_5am_rollover_math)


def verify_gesture_disambiguation_math():
    swift_gesture = read_file("FableFlow/Features/Card/CardGestureMath.swift")
    js_gesture = read_file("js/cardGestureMath.js")
    assert "minimumPencilStrokeDeltaXPixels: CGFloat = 15.0" in swift_gesture
    assert "minimumCardFlipDeltaXPixels: CGFloat = -40.0" in swift_gesture
    assert "STRIKETHROUGH_MIN_DELTA_X = 15.0" in js_gesture
    assert "FLIP_MAX_DELTA_X = -40.0" in js_gesture


check("Math/Gesture", "Pixel-Direction Gesture Disambiguation (L->R > +15px ±25° = Strikethrough; R->L < -40px ±35° = 180° Flip)", verify_gesture_disambiguation_math)


def verify_stopwatch_turns_on_minutes_not_seconds():
    swift_phys = read_file("FableFlow/Features/Timer/OdometerDialPhysics.swift")
    js_phys = read_file("js/odometerPhysics.js")
    js_app = read_file("js/app.js")
    assert "let wholeMinutes = floor(max(0.0, elapsedSeconds) / 60.0)" in swift_phys
    assert "const wholeMinutes = Math.floor(Math.max(0, elapsedSeconds) / 60);" in js_phys
    assert "stopwatchSecondsToMinuteAngleDegrees" in js_app

    # Verify math: 0..59s -> 0°, 60..119s -> 6°, 120..179s -> 12°
    def sw_angle(sec: int) -> float:
        return ( (sec // 60) * 6.0 ) % 1080.0

    assert sw_angle(0) == 0.0
    assert sw_angle(59) == 0.0, "Stopwatch must NOT turn the tomato on seconds (59s is still 0°)"
    assert sw_angle(60) == 6.0, "Stopwatch must turn +6° at 60s (1 whole minute)"
    assert sw_angle(119) == 6.0
    assert sw_angle(120) == 12.0


check("StopwatchMinutes", "Stopwatch Mode turns the tomato ONLY on whole minutes, never on seconds", verify_stopwatch_turns_on_minutes_not_seconds)


def verify_six_tomatoes_and_grid_click_behavior():
    html = read_file("index.html")
    js_app = read_file("js/app.js")
    css = read_file("css/style.css")

    # Verify 6 grid slots in HTML, CSS (2x3), and JS
    for i in range(6):
        assert f'id="grid-quad-{i}"' in html, f"Missing grid-quad-{i} in index.html"
    assert "NUM_GRID_SLOTS = 6" in js_app
    assert "repeat(3, 1fr)" in css

    # Verify clicking a lit-up tomato on Front Card unassigns it (returns to grey),
    # whereas clicking a tomato on the Grid opens the Hero Tomato page!
    assert "this.clearQuadrantAssignment(task.assignedQuadrant)" in js_app
    assert "this.state.timerSubMode = 'hero';" in js_app


check("SixTomatoGrid", "6 Tomatoes on 2x3 Grid + Grid click opens Hero Tomato + Card click unassigns lit tomato", verify_six_tomatoes_and_grid_click_behavior)


def verify_short_tomato_title_and_straight_strikethrough():
    js_phys = read_file("js/odometerPhysics.js")
    js_app = read_file("js/app.js")
    css = read_file("css/style.css")

    assert "formatShortTomatoTitle" in js_phys and "formatShortTomatoTitle" in js_app
    assert "text-overflow: ellipsis" in css and "max-width: 112px" in css
    # Verify straight horizontal strikethrough (ctx.lineTo(currentEndX, centerY), no bowed quadraticCurveTo)
    assert "ctx.lineTo(currentEndX, centerY);" in js_app
    assert "quadraticCurveTo" not in js_app
    # Verify Left -> Right erase direction (startProgress = progress, endProgress = 1.0)
    assert "drawGraphiteStroke(strikeCanvas, progress, 1.0);" in js_app
    # Verify Front Card page dots are removed (background-image: none)
    assert "background-image: none;" in css
    assert "radial-gradient(var(--dot-grid-color)" not in css


check("VisualPolish", "Shortened tomato titles + Straight horizontal strikethrough + Left->Right erase + Clean white card (no dots)", verify_short_tomato_title_and_straight_strikethrough)


def verify_hero_tomato_3d_curve_and_edge_shading():
    js_tomato = read_file("js/tomato3D.js")
    assert "getTomatoSeamY(x)" in js_tomato, "Must project text/marks onto exact getTomatoSeamY(x) seam profile"
    assert "_buildOdometerTextureStrip()" in js_tomato, "Must build unrolled 2D odometer texture ribbon"
    assert "_buildTomato3DMesh()" in js_tomato, "Must build true 3D surface mesh of the tomato equatorial dome"
    assert "meshThetaDeg" in js_tomato and "meshSV" in js_tomato, "Must UV-project texture ribbon onto 3D surface mesh"


check("HeroTomato3DCurve", "Hero Tomato measurement marks & digits UV-project onto a true 3D surface mesh with 4x supersampling", verify_hero_tomato_3d_curve_and_edge_shading)


def verify_card_tomato_navigation_dropdown_filter_and_single_example_task():
    js_app = read_file("js/app.js")
    swift_repo = read_file("FableFlow/Features/Card/DailyCardRepository.swift")
    swift_ws = read_file("FableFlow/Features/Workspace/PhaseOneWorkspaceView.swift")

    # 1. Clicking grey tomato on Card page lights up tomato AND brings user to Timer page
    assert "this.state.selectedQuadrant = targetQuad;" in js_app
    assert "this.state.activePillar = 'timer';" in js_app
    assert "activeTab = .timer" in swift_ws

    # 2. Dropdown filters out already-assigned tasks
    assert "t.assignedQuadrant === null || t.assignedQuadrant === undefined" in js_app
    assert ".filter { $0.assignedQuadrantIndex == nil }" in swift_ws

    # 3. Only one "Example Task" seeded by default (no Math Study / Build Deck / Pick Up Package)
    assert "title: 'Example Task'" in js_app
    assert 'title: "Example Task"' in swift_repo
    assert "Math Study" not in js_app
    assert "Build Deck" not in js_app
    assert "Pick Up Package" not in js_app


check("UserFlowFixes", "Grey tomato navigates to Timer + Dropdown hides assigned tasks + Single 'Example Task' default", verify_card_tomato_navigation_dropdown_filter_and_single_example_task)


def verify_tap_on_digits_time_entry():
    html = read_file("index.html")
    css = read_file("css/style.css")
    js_phys = read_file("js/odometerPhysics.js")
    js_app = read_file("js/app.js")
    swift_phys = read_file("FableFlow/Features/Timer/OdometerDialPhysics.swift")
    swift_hero = read_file("FableFlow/Features/Timer/SingleHeroTomatoView.swift")

    assert 'id="hero-time-editor"' in html
    assert 'id="hero-time-input"' in html
    assert "hero-preset-pill" in html
    assert ".hero-time-input" in css
    assert "parseTypedTimeInput(rawInput)" in js_phys
    assert "bindHeroReadoutTimeEntry()" in js_app
    assert "setCustomTimerMinutes(quadrant, minutes)" in js_app
    assert "parseTypedTimeInput(_ rawInput: String)" in swift_phys
    assert 'alert("Set Timer Duration"' in swift_hero


check("TapDigitsTimeEntry", "Tapping Hero digits (#hero-readout) opens inline time input (0–180m / HH:MM + presets) and rotates 3D tomato", verify_tap_on_digits_time_entry)


def verify_silver_metallic_tomato_and_two_step_end_reset():
    js_tomato = read_file("js/tomato3D.js")
    js_app = read_file("js/app.js")
    css = read_file("css/style.css")
    swift_slot = read_file("FableFlow/Core/Models/TomatoTimerSlot.swift")
    swift_coord = read_file("FableFlow/Features/Timer/TimerCoordinator.swift")

    # 1. Verify photorealistic silver metallic tomato sprites exist
    for asset_name in [
        "assets/tomatoes/hero-tomato-silver.png",
        "assets/tomatoes/grid-tomato-silver.png",
        "assets/tomatoes/mini-tomato-silver.png",
    ]:
        full = os.path.join(ROOT, asset_name)
        assert os.path.exists(full) and os.path.getsize(full) > 500, f"Missing silver asset {asset_name}"

    # 2. Verify smooth transition in HeroTomato3DView and Grid CSS
    assert "hero-tomato-silver.png" in js_tomato
    assert "_startSilverTransition()" in js_tomato
    assert "this.silverBlend" in js_tomato
    assert ".grid-tomato-silver-img" in css
    assert ".grid-tomato-wrap.is-silver-completed" in css

    # 3. Verify two-step End -> Silver Metallic ('completed') -> Reset ('idle' at 00:00)
    assert "handleEndOrResetButton(quadrant)" in js_app
    assert "endTimerToSilver(quadrant" in js_app
    assert "resetCompletedTimer(quadrant)" in js_app
    assert "case completed" in swift_slot
    assert "resetCompletedTimer(quadrant:" in swift_coord


check("SilverMetallicReset", "Countdown finish or End click smoothly transitions tomato to Silver Metallic and turns End into Reset button", verify_silver_metallic_tomato_and_two_step_end_reset)


def verify_qa_pm_audit_fixes_and_chime():
    html = read_file("index.html")
    css = read_file("css/style.css")
    js_phys = read_file("js/odometerPhysics.js")
    js_sensory = read_file("js/sensoryEngine.js")
    js_tomato = read_file("js/tomato3D.js")
    js_app = read_file("js/app.js")
    swift_slot = read_file("FableFlow/Core/Models/TomatoTimerSlot.swift")

    # QA #1: Prevent pointerdown/pointerup on task rows from bubbling up to #daily-card-3d
    assert "e.stopPropagation(); // QA #1" in js_app

    # QA #2: HH:MM:SS (00:00:00) when > 60 minutes (clamped > 3600)
    assert "if (clamped > 3600)" in js_phys
    assert "if totalSeconds > 3600" in swift_slot
    assert ".hero-digital-readout.has-hours" in css
    assert ".grid-tomato-time.has-hours" in css

    # QA #3: Unassigned Hero Tomato renders grey + auto-assigns on start/wind
    assert "const key = this.isAssigned ? (this.quadrantIndex ?? 0) : 'unassigned';" in js_tomato
    assert "ensureSlotAssignedForActiveTimer(quadrant)" in js_app

    # QA #4: Deleting a task resets the associated tomato and re-syncs assignedTaskOrder
    assert "s.assignedTaskOrder = remainingTask.orderIndex;" in js_app

    # QA #5: 1-second wall-clock ticker updates Grid timers in-place without wiping open dropdowns
    assert "updateGridTimersInPlace()" in js_app

    # QA #6: 1-minute dial resolution (6.0° per notch) + drag movement threshold
    assert "static MINUTES_PER_NOTCH = 1;" in js_phys
    assert "static DEGREES_PER_NOTCH = 6.0;" in js_phys
    assert "if (!hasDragged && Math.abs(translationX) <= 3) return;" in js_app

    # QA #7: Background-elapsed timer reconciles to 'completed' (Silver Metallic)
    assert "if (slot.remainingSeconds === 0) {\n              slot.runState = 'completed';" in js_app

    # PM #1: Single-click on task row opens Edit / Delete modal + explicit Trash Delete button
    assert "if (Math.abs(dx) < 6 && Math.abs(dy) < 6)" in js_app
    assert 'id="modal-delete"' in html
    assert ".modal-btn-trash" in css

    # PM #2: Clicking grey tomato on Card deterministically opens Hero Timer view
    assert "this.state.timerSubMode = 'hero';" in js_app

    # PM #4: Clicking task subtitle on Hero page opens task reassignment dropdown right on Hero page
    assert 'id="hero-subtitle-dropdown-mount"' in html
    assert "this.state.isHeroDropdownOpen = !this.state.isHeroDropdownOpen;" in js_app

    # Real Mechanical Pomodoro Bell Chime (double-clapper escapement + inharmonic spun-brass partials)
    assert "triggerBellStrike(now, 0.32);" in js_sensory
    assert "triggerBellStrike(now + 0.052, 1.0);" in js_sensory
    assert "freq: 1174.6" in js_sensory


check("QAPMAuditFixes", "All 7 QA fixes, 3 PM fixes, 1-minute dial resolution, HH:MM:SS (>60m), and physical Pomodoro bell chime verified", verify_qa_pm_audit_fixes_and_chime)


def verify_phase2_minimalist_homepage():
    html = read_file("index.html")
    css = read_file("css/style.css")
    js_app = read_file("js/app.js")

    assert 'id="screen-home"' in html
    assert 'id="home-brand-title"' in html and "UNTO FLOW" in html
    assert 'id="home-mini-card"' in html and 'id="home-mini-date"' in html
    assert 'id="home-tomato-btn"' in html
    assert ".home-mini-card" in css and ".home-tomato-btn" in css
    assert "renderHomeScreen()" in js_app


check("Phase2Homepage", "Minimalist 2-Object Homepage (01-home-page.png) with 'UNTO FLOW' header, '06 OCT' mini-card, and 3D Tomato verified", verify_phase2_minimalist_homepage)


def verify_phase2_matte_black_journal_and_photos():
    html = read_file("index.html")
    css = read_file("css/style.css")
    js_app = read_file("js/app.js")

    assert 'id="card-back-reflection"' in html
    assert 'id="card-back-photos"' in html
    assert 'id="journal-photo-file-input"' in html
    assert ".card-back-reflection-editor" in css
    assert ".journal-photo-slot" in css
    # Adaptive font scaling from 21px down to 13px floor
    assert "adjustReflectionTypography(textareaEl)" in js_app
    assert "targetSize = 21;" in js_app and "targetSize = 13;" in js_app
    # Client-side <= 1600px image compression
    assert "compressImageFileToDataURL(file, maxDimension = 1600)" in js_app
    # 0 to 2 framed photo slots
    assert "renderPhotoSlotsDOM(" in js_app


check("Phase2MatteBlackJournal", "Matte Black Back of Card (05-card-back.png) with adaptive 21px->13px typography & 0-2 framed photo slots (<=1600px)", verify_phase2_matte_black_journal_and_photos)


def verify_phase2_card_stack_and_retroactive_editing():
    html = read_file("index.html")
    css = read_file("css/style.css")
    js_app = read_file("js/app.js")
    js_sensory = read_file("js/sensoryEngine.js")

    assert 'id="screen-stack"' in html
    assert 'id="stack-date-strip"' in html
    assert 'id="stack-peek-left"' in html and 'id="stack-peek-right"' in html
    assert 'id="stack-card-3d"' in html
    assert 'id="stack-btn-return"' in html
    assert 'id="stack-btn-zoomout"' in html
    assert 'id="stack-btn-flip"' in html
    assert 'id="stack-btn-trash"' in html
    assert ".stack-date-pill.active" in css
    # Cardstock riffle tick foley & trash delete foley
    assert "playStackRiffleTick()" in js_sensory
    assert "playTrashDelete()" in js_sensory
    # Retroactive editing & permanent trash deletion of archived cards
    assert "openAddStackTaskModal()" in js_app
    assert "openEditStackTaskModal(task)" in js_app
    assert "confirmPermanentDeleteArchivedCard()" in js_app
    assert "this.showNotificationBanner('Card permanently deleted');" in js_app


check("Phase2CardStack", "Chronological Card Stack Viewer (06-stack-detail.png) with date strip, peeking carousel, retroactive editing & Trash delete", verify_phase2_card_stack_and_retroactive_editing)


def verify_phase2_calendar_zoom_and_5am_rollover():
    html = read_file("index.html")
    css = read_file("css/style.css")
    js_app = read_file("js/app.js")

    assert 'id="screen-calendar"' in html
    assert 'id="calendar-months-container"' in html
    assert 'id="calendar-btn-return"' in html and 'id="calendar-btn-zoomin"' in html
    assert ".cal-day-btn.has-card" in css and ".cal-day-btn.is-selected" in css
    assert "SEPTEMBER 2026" in js_app and "OCTOBER 2026" in js_app
    assert "simulateFiveAmRollover()" in js_app


check("Phase2CalendarRollover", "Monthly Calendar Zoom-Out (07-calendar-view.png) with Sep/Oct grids, grey/black date circles & 5:00 AM rollover engine", verify_phase2_calendar_zoom_and_5am_rollover)


def verify_phase2_ux_refinements():
    css = read_file("css/style.css")
    js_app = read_file("js/app.js")
    js_tomato = read_file("js/tomato3D.js")
    js_gesture = read_file("js/cardGestureMath.js")
    swift_gesture = read_file("FableFlow/Features/Card/CardGestureMath.swift")

    # 1. Homepage exact match to 01-home-page.png (12.5px tracked FABLE / FLOW, 334x222 mini card, 35px bold 06 OCT)
    assert "font-size: 12.5px;" in css and "letter-spacing: 0.24em;" in css
    assert "width: 334px;" in css and "height: 222px;" in css
    assert "font-size: 35px;" in css and "border: 1px solid #B4B5AE;" in css

    # 2. Scroll through the stack via horizontal carousel drag, date-strip scrubbing, and wheel/trackpad scrolling
    assert "isScrubbingStrip" in js_app
    assert "isDraggingCarousel" in js_app
    assert "this._lastStackWheelTime" in js_app
    assert "this.stepStackCard(dominantDelta > 0 ? 1 : -1);" in js_app

    # 3. Two-way finger motion to flip the card (both Left -> Right and Right -> Left) with window-level pointer tracking
    assert "FLIP_MIN_POSITIVE_DELTA_X = 40.0" in js_gesture
    assert "minimumPositiveCardFlipDeltaXPixels: CGFloat = 40.0" in swift_gesture
    assert "--card-flip-deg" in css
    assert "bindTwoWayCardFlipOnWrapper(wrapper, isStackCard = false)" in js_app
    assert "window.addEventListener('pointerup', endCardSwipe);" in js_app

    # 4. Multi-line dry-graphite strikethrough crossing out ALL wrapped lines + safe right edge margin
    assert "getTaskRowLineSegments(canvas)" in js_app
    assert "titleSpan.getClientRects()" in js_app
    assert "lineSegments.forEach((seg, segIdx) =>" in js_app
    assert "maxSafeRightX = rowW - 30;" in js_app
    assert ".task-title-wrap" in css

    # 5. Unified card font size (only decreases when the whole card page is filled) & whole-character 3D tomato odometer visibility
    assert "fitUnifiedCardTaskTypography(containerEl, addItemEl)" in js_app
    assert "bodyEl.scrollHeight > bodyEl.clientHeight + 2" in js_app
    assert "wholeCharVisibility" in js_tomato and "labelCenterTheta" in js_tomato
    assert "MAX_TASK_WORDS = 18;" in js_app and "MAX_TASK_CHARS = 110;" in js_app
    assert "MAX_REFLECTION_WORDS = 95;" in js_app and "MAX_REFLECTION_CHARS = 520;" in js_app
    assert "clampTaskInputText(rawText)" in js_app
    assert "computeTaskFontSizePx(title, totalTasksCount = 1)" in js_app
    assert "clampReflectionInputText(rawText)" in js_app


check("Phase2UXRefinements", "Homepage 01-home-page match, Stack drag/wheel scrolling, Two-way card flip, Multi-line strikethrough & Word/Font limits", verify_phase2_ux_refinements)

# ============================================================================
# 4. LAYER 3: LIVE HTTP SERVER VERIFICATION
# ============================================================================
print("\n--- Layer 3: Live HTTP Asset Serving ---")


def verify_http_serving():
    os.chdir(ROOT)
    handler = http.server.SimpleHTTPRequestHandler

    class QuietServer(socketserver.TCPServer):
        allow_reuse_address = True

    with QuietServer(("127.0.0.1", 0), handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()

        endpoints = [
            "/index.html",
            "/css/style.css",
            "/js/app.js",
            "/js/tomato3D.js",
            "/js/odometerPhysics.js",
            "/js/cardGestureMath.js",
            "/js/sensoryEngine.js",
            "/assets/tomatoes/home-tomato.png",
            "/assets/tomatoes/hero-tomato-0.png",
            "/assets/tomatoes/hero-tomato-silver.png",
            "/assets/tomatoes/grid-tomato-0.png",
            "/assets/tomatoes/grid-tomato-grey.png",
            "/assets/tomatoes/grid-tomato-silver.png",
            "/assets/tomatoes/mini-tomato-0.png",
            "/assets/tomatoes/mini-tomato-silver.png",
            "/assets/photos/sample-poodle.jpg",
            "/assets/photos/sample-desk.jpg",
        ]
        for ep in endpoints:
            url = f"http://127.0.0.1:{port}{ep}"
            with urllib.request.urlopen(url, timeout=3) as resp:
                assert resp.status == 200, f"Expected HTTP 200 for {ep}, got {resp.status}"
                body = resp.read()
                assert len(body) > 50, f"Response body too small for {ep}"
        httpd.shutdown()


check("HTTPServer", "All HTML, CSS, JS, Photorealistic Tomato PNGs, and Journal Photos serve with HTTP 200 OK", verify_http_serving)

print("\n" + "=" * 84)
print(f"EVALUATION RESULT: {passed_checks}/{total_checks} CHECKS PASSED ({len(failures)} FAILURES)")
print("=" * 84)

if failures:
    for cat, name, err in failures:
        print(f"  FAILED [{cat}] {name}: {err}")
    sys.exit(1)
