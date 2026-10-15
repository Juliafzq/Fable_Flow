/**
 * UNTO / FLOW (formerly Fable / Flow) — Phase 1 & Phase 2 Complete MVP Application Controller
 *
 * Implements all PRD v4.2, Phase 1 ("Core Tactile Loop") & Phase 2 ("Complete Daily Ritual & Memory Archive") requirements:
 * 1. Minimalist 2-Object Homepage (01-home-page.png): Wide-tracked 'UNTO / FLOW' header, exact 334x222 '06 OCT' mini-card, 3D Tomato.
 * 2. Photorealistic Hero Tomato 3D Dial (02-hero-timer.png) & 6-Tomato 2x3 Grid (03-grid-timer.png):
 *    - 1-minute notch snap, HH:MM:SS when > 60 min, Tap-on-Digits inline time editor (0-180 min / HH:MM).
 *    - Mirror-polished silver metallic completion state (End -> Silver -> Reset ↺).
 *    - Authentic mechanical 2-strike Pomodoro bell ring + WebAudio tactile foley.
 * 3. Dual-Sided Today's Index Card:
 *    - Clean White Front (04-card-front.png) with up to 8 tasks, glossy single-highlight mini tomatoes,
 *      adaptive task font size (24px -> 18px floor) + word/character cap (max 6 words / 36 chars),
 *      and multi-line Left -> Right dry-graphite pencil strikethrough & erase that crosses out EVERY wrapped line.
 *    - Two-way 3D Card Flip gesture (both Right -> Left and Left -> Right swipes flip the card on Front and Back).
 *    - Matte Black Back (05-card-back.png) Evening Reflection Journal with 100% user-authored adaptive
 *      typography (21px -> 13px floor + word/char cap) and 0-2 framed photo slots with client-side <= 1600px compression.
 * 4. Chronological Card Stack Viewer (06-stack-detail.png):
 *    - Horizontal date strip ('OCT 01 02 03 04 (05) 06'), interactive horizontal drag/swipe & wheel/trackpad scrolling
 *      through the stack, cardstock riffle ticks, full retroactive editing of Front & Back, and 4-icon bottom bar.
 * 5. Monthly Calendar Zoom-Out View (07-calendar-view.png) & 5:00 AM Daily Rollover Engine.
 */

import { OdometerDialPhysics } from './odometerPhysics.js?v=20261015_v76';
import { CardGestureMath } from './cardGestureMath.js?v=20261015_v76';
import { SensoryEngine } from './sensoryEngine.js?v=20261015_v76';
import { HeroTomato3DView, GridTomatoRenderer } from './tomato3D.js?v=20261015_v76';
import { SupabaseSyncService } from './supabaseSync.js?v=20261015_v76';
import {
  t as i18nT,
  setLanguage,
  getLanguage,
  registerStaticI18n,
  applyStaticI18n,
} from './i18n.js?v=20261015_v76';

const STORAGE_KEY = 'fable_flow_phase2_mvp_v10';
const NUM_GRID_SLOTS = 6;

const MAX_CARD_TASKS = 8;
const MAX_TASK_WORDS = 18;
const MAX_TASK_CHARS = 110;
const MAX_REFLECTION_WORDS = 95;
const MAX_REFLECTION_CHARS = 520;

export class FableFlowApp {
  constructor() {
    this.sensory = new SensoryEngine();
    // User #2: Keep hardware haptics active without showing debug "Haptic: ..." telemetry toasts
    this.sensory.onHapticPulse = null;

    this.supabaseSync = new SupabaseSyncService();
    this._authMode = 'signin'; // 'signin' | 'signup'
    this.supabaseSync.onAuthStateChange = () => {
      this.syncFromAuthenticatedAccount(true);
    };

    this.state = this.loadInitialState();
    this.sensory.isSilentMode = Boolean(this.state.isSilentMode);
    this.hero3D = null;
    this.gridRenderer = null;
    this.tickInterval = null;
    this._photoUploadTarget = 'today'; // 'today' | 'stack'
    this._photoReplaceIndex = null;
    this._todayFlipDeg = this.state.isCardFlipped ? -180 : 0;
    this._stackFlipDeg = this.state.isStackCardFlipped ? -180 : 0;
    this._lastStackWheelTime = 0;
    this._portraitLockAngle = 0;
    this._isDraggingDateStrip = false;

    this.initDOM();
    this.initLanguage();
    this.initMobilePortraitLock();
    this.initDesktopAppWindow();
    this.init3DRenderers();
    this.bindGlobalEvents();
    this.startWallClockTicker();
    this.armTimerDueAlarm();
    // Any tap or key press silences a ringing timer bell
    const silenceTimerBell = () => this.sensory.stopCompletionAlarm();
    window.addEventListener('pointerdown', silenceTimerBell, { capture: true, passive: true });
    window.addEventListener('keydown', silenceTimerBell, { capture: true });
    if (!this.state.hasCompletedOnboarding) {
      this.state.activePillar = 'home';
    }
    this.renderAll();
    this.refitTypographyWhenFontsLoad();
    this.initFirstTimeOnboarding();
    if (this.supabaseSync.isLoggedIn()) {
      this.syncFromAuthenticatedAccount(false);
    }
    this.registerServiceWorker();
  }

  /**
   * The English UI uses the EB Garamond web font. Card text is sized to fit by measuring it,
   * so re-fit once the font has actually loaded (otherwise sizes are computed with the fallback font).
   */
  refitTypographyWhenFontsLoad() {
    if (typeof document === 'undefined' || !document.fonts) return;
    const refit = () => {
      const pillar = this.state.activePillar;
      if (pillar === 'card') {
        this.fitUnifiedCardTaskTypography(this.els.taskListContainer, this.els.addItemRow);
        this.adjustReflectionTypography(this.els.cardBackReflection);
      } else if (pillar === 'stack') {
        this.fitUnifiedCardTaskTypography(this.els.stackTaskListContainer, this.els.stackAddItemRow);
        this.adjustReflectionTypography(this.els.stackCardBackReflection);
      }
      this.fitAboutCardTypography();
    };
    document.fonts.ready.then(refit).catch(() => {});
    if (typeof document.fonts.addEventListener === 'function') {
      document.fonts.addEventListener('loadingdone', refit);
    }
  }

  /**
   * Installed as a desktop app (Chrome "Install UNTO / FLOW" on a Mac or PC): the first time it
   * opens, shape the window like the phone app instead of a large mostly-empty window.
   * Runs once; Chrome remembers any size the user picks after that.
   */
  initDesktopAppWindow() {
    try {
      if (typeof window.matchMedia !== 'function') return;
      const standalone = window.matchMedia('(display-mode: standalone)').matches;
      const desktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (!standalone || !desktop || window.innerWidth <= 520) return;
      const sizedKey = 'fable_flow_desktop_window_sized';
      if (localStorage.getItem(sizedKey)) return;
      localStorage.setItem(sizedKey, '1');
      const frameW = Math.max(0, window.outerWidth - window.innerWidth);
      const frameH = Math.max(0, window.outerHeight - window.innerHeight);
      const availW = (window.screen && window.screen.availWidth) || 1280;
      const availH = (window.screen && window.screen.availHeight) || 900;
      const w = 430 + frameW;
      const h = Math.min(852 + frameH, availH - 40);
      window.resizeTo(w, h);
      window.moveTo(Math.max(0, Math.round((availW - w) / 2)), Math.max(0, Math.round((availH - h) / 2)));
    } catch (_) {}
  }

  initMobilePortraitLock() {
    const tryNativeLock = () => {
      try {
        if (
          screen.orientation &&
          typeof screen.orientation.lock === 'function'
        ) {
          screen.orientation.lock('portrait-primary').catch(() => {});
        }
      } catch (_) {}
    };

    const updatePortraitLockState = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // A short desktop window (mouse/trackpad) is not a phone on its side: never rotate it.
      const isDesktopPointer =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      const isMobileLandscape = w > h && h <= 560 && !isDesktopPointer;
      const root = document.documentElement;
      if (isMobileLandscape) {
        let rawAngle = 90;
        if (typeof window.orientation === 'number' && Math.abs(window.orientation) === 90) {
          rawAngle = window.orientation;
        } else if (
          screen.orientation &&
          typeof screen.orientation.angle === 'number'
        ) {
          rawAngle = screen.orientation.angle;
        }
        const counterDeg = rawAngle === -90 || rawAngle === 270 ? 90 : -90;
        this._portraitLockAngle = counterDeg;
        root.style.setProperty('--portrait-lock-deg', `${counterDeg}deg`);
        root.classList.add('mobile-landscape-locked');
      } else {
        this._portraitLockAngle = 0;
        root.classList.remove('mobile-landscape-locked');
        root.style.removeProperty('--portrait-lock-deg');
      }
    };

    tryNativeLock();
    updatePortraitLockState();
    window.addEventListener('resize', updatePortraitLockState);
    window.addEventListener('orientationchange', () => {
      updatePortraitLockState();
      setTimeout(updatePortraitLockState, 120);
    });
    window.addEventListener('pointerdown', tryNativeLock, { once: true, passive: true });
  }

  // =========================================================================
  // LANGUAGE (English / 简体中文)
  // =========================================================================

  t(key, params = null) {
    return i18nT(key, params);
  }

  /** Translates built-in default titles only; user-typed titles are returned unchanged. */
  displayTaskTitle(title) {
    if (title === 'Example Task' || title === 'Focus Session') return this.t(title);
    return title;
  }

  initLanguage() {
    let lang = this.state && this.state.language;
    if (lang !== 'en' && lang !== 'zh') {
      try {
        lang = localStorage.getItem('fable_flow_language');
      } catch (_) {}
    }
    if (lang !== 'en' && lang !== 'zh') lang = 'en';
    this.state.language = lang;
    registerStaticI18n(document.getElementById('app-viewport'));
    this.applyLanguage(lang, false);
  }

  applyLanguage(lang, rerender = true) {
    const safe = lang === 'zh' ? 'zh' : 'en';
    this.state.language = safe;
    setLanguage(safe);
    try {
      localStorage.setItem('fable_flow_language', safe);
    } catch (_) {}
    applyStaticI18n();
    if (this.els.profileLanguageSelect) {
      this.els.profileLanguageSelect.value = safe;
    }
    if (this.els.profileAudioStateLabel && this.sensory) {
      this.els.profileAudioStateLabel.textContent = this.t(this.sensory.isSilentMode ? 'Off' : 'On');
    }
    this.updateProfileAccountLabel();
    if (typeof this.renderAuthModalState === 'function' && this.supabaseSync) {
      this.renderAuthModalState();
    }
    if (rerender) {
      this.renderAll();
      if (this._isGuidedTourActive && typeof this._guidedTourStep === 'number') {
        this.goToGuidedTourStep(this._guidedTourStep);
      }
    }
  }

  toggleLanguage() {
    const next = getLanguage() === 'zh' ? 'en' : 'zh';
    this.applyLanguage(next, true);
    this.saveState();
    this.showTelemetryToast(next === 'zh' ? '语言：简体中文' : 'Language: English');
  }

  getPointerXY(e) {
    const cx = e && typeof e.clientX === 'number' ? e.clientX : 0;
    const cy = e && typeof e.clientY === 'number' ? e.clientY : 0;
    if (this._portraitLockAngle === -90) {
      return { x: window.innerHeight - cy, y: cx };
    }
    if (this._portraitLockAngle === 90) {
      return { x: cy, y: window.innerWidth - cx };
    }
    return { x: cx, y: cy };
  }

  getCurrentLogicalDateString(resetHour = 5) {
    const hr = typeof resetHour === 'number' ? resetHour : 5;
    const shifted = new Date(Date.now() - hr * 3600 * 1000);
    const y = shifted.getFullYear();
    const m = String(shifted.getMonth() + 1).padStart(2, '0');
    const d = String(shifted.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getOffsetDateKey(baseDateKey, deltaDays = -1) {
    const fallback = this.getCurrentLogicalDateString(
      this.state && typeof this.state.dailyResetHour === 'number'
        ? this.state.dailyResetHour
        : 5
    );
    const raw =
      typeof baseDateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(baseDateKey)
        ? baseDateKey
        : fallback;
    const [yStr, mStr, dStr] = raw.split('-');
    const dt = new Date(
      parseInt(yStr, 10) || 2026,
      (parseInt(mStr, 10) || 10) - 1,
      (parseInt(dStr, 10) || 1) + deltaDays
    );
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getDefaultArchiveCards() {
    return {};
  }

  getDefaultState() {
    const todayKey = this.getCurrentLogicalDateString(5);
    const todayMeta = this.formatDateMetadataForKey(todayKey);
    return {
      activePillar: 'card', // 'home' | 'card' | 'timer' | 'stack' | 'calendar'
      timerSubMode: 'grid', // 'grid' | 'hero'
      selectedQuadrant: 0,
      openDropdownQuadrant: null,
      isHeroDropdownOpen: false,
      isCardFlipped: false,
      isStackCardFlipped: false,
      selectedStackDateKey: null,
      cardDateKey: todayMeta.dateKey,
      cardHeaderDate: todayMeta.headerDate,
      cardShortDate: todayMeta.shortDate,
      dailyResetHour: 5,
      dailyTomatoReset: false,
      isSilentMode: false,
      hasCompletedOnboarding: false,
      seenPageHints: {},
      lastRolloverLogicalDate: todayMeta.dateKey,
      reflectionText: '',
      reflectionPhotos: [],
      archiveCards: this.getDefaultArchiveCards(),
      tasks: [
        {
          id: 'task-1',
          orderIndex: 1,
          title: 'Example Task',
          isCompleted: false,
          assignedQuadrant: null,
        },
      ],
      timers: [
        {
          quadrant: 0,
          assignedTaskId: null,
          assignedTaskOrder: null,
          customTitle: null,
          mode: 'countdown', // 'countdown' | 'stopwatch'
          runState: 'idle', // 'idle' | 'running' | 'paused' | 'completed'
          configuredMinutes: 0,
          remainingSeconds: 0,
          angleDegrees: 0,
          lastTickTimestamp: null,
        },
        {
          quadrant: 1,
          assignedTaskId: null,
          assignedTaskOrder: null,
          customTitle: null,
          mode: 'countdown',
          runState: 'idle',
          configuredMinutes: 0,
          remainingSeconds: 0,
          angleDegrees: 0,
          lastTickTimestamp: null,
        },
        {
          quadrant: 2,
          assignedTaskId: null,
          assignedTaskOrder: null,
          customTitle: null,
          mode: 'countdown',
          runState: 'idle',
          configuredMinutes: 0,
          remainingSeconds: 0,
          angleDegrees: 0,
          lastTickTimestamp: null,
        },
        {
          quadrant: 3,
          assignedTaskId: null,
          assignedTaskOrder: null,
          customTitle: null,
          mode: 'countdown',
          runState: 'idle',
          configuredMinutes: 0,
          remainingSeconds: 0,
          angleDegrees: 0,
          lastTickTimestamp: null,
        },
        {
          quadrant: 4,
          assignedTaskId: null,
          assignedTaskOrder: null,
          customTitle: null,
          mode: 'countdown',
          runState: 'idle',
          configuredMinutes: 0,
          remainingSeconds: 0,
          angleDegrees: 0,
          lastTickTimestamp: null,
        },
        {
          quadrant: 5,
          assignedTaskId: null,
          assignedTaskOrder: null,
          customTitle: null,
          mode: 'countdown',
          runState: 'idle',
          configuredMinutes: 0,
          remainingSeconds: 0,
          angleDegrees: 0,
          lastTickTimestamp: null,
        },
      ],
    };
  }

  loadInitialState() {
    try {
      [
        'fable_flow_phase1_beta_v1',
        'fable_flow_phase1_beta_v2',
        'fable_flow_phase1_beta_v3',
        'fable_flow_phase1_beta_v4',
        'fable_flow_phase2_mvp_v1',
        'fable_flow_phase2_mvp_v2',
        'fable_flow_phase2_mvp_v3',
        'fable_flow_phase2_mvp_v4',
        'fable_flow_phase2_mvp_v5',
        'fable_flow_phase2_mvp_v6',
        'fable_flow_phase2_mvp_v7',
        'fable_flow_phase2_mvp_v8',
      ].forEach((k) => localStorage.removeItem(k));
      const raw =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem('fable_flow_phase2_mvp_v9');
      localStorage.removeItem('fable_flow_phase2_mvp_v9');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          Array.isArray(parsed.tasks) &&
          Array.isArray(parsed.timers) &&
          parsed.timers.length === NUM_GRID_SLOTS
        ) {
          if (!parsed.archiveCards || typeof parsed.archiveCards !== 'object') {
            parsed.archiveCards = this.getDefaultArchiveCards();
          }
          if (typeof parsed.reflectionText !== 'string') {
            parsed.reflectionText = '';
          }
          if (!Array.isArray(parsed.reflectionPhotos)) {
            parsed.reflectionPhotos = [];
          }
          if (!parsed.selectedStackDateKey) {
            parsed.selectedStackDateKey = null;
          }
          if (typeof parsed.dailyResetHour !== 'number') {
            parsed.dailyResetHour = 5;
          }
          parsed.dailyTomatoReset = Boolean(parsed.dailyTomatoReset);
          const currentLogicalKey = this.getCurrentLogicalDateString(parsed.dailyResetHour);
          const todayMeta = this.formatDateMetadataForKey(currentLogicalKey);
          if (!parsed.cardDateKey || parsed.cardDateKey !== currentLogicalKey) {
            const prevKey = parsed.cardDateKey;
            // Reopened on a new day: reset the tomatoes too when the user chose "Tomato Reset: Yes"
            if (
              parsed.dailyTomatoReset &&
              prevKey &&
              /^\d{4}-\d{2}-\d{2}$/.test(prevKey) &&
              prevKey < currentLogicalKey
            ) {
              this.resetAllTomatoesInState(parsed);
            }
            const hasCustomTasks =
              Array.isArray(parsed.tasks) &&
              (parsed.tasks.length !== 1 ||
                parsed.tasks[0].title !== 'Example Task' ||
                Boolean(parsed.tasks[0].isCompleted));
            const hasReflection =
              Boolean(parsed.reflectionText && parsed.reflectionText.trim()) ||
              (Array.isArray(parsed.reflectionPhotos) && parsed.reflectionPhotos.length > 0);
            if (
              prevKey &&
              /^\d{4}-\d{2}-\d{2}$/.test(prevKey) &&
              prevKey < currentLogicalKey &&
              parsed.lastRolloverLogicalDate &&
              parsed.lastRolloverLogicalDate !== currentLogicalKey &&
              (hasCustomTasks || hasReflection) &&
              !parsed.archiveCards[prevKey]
            ) {
              const prevMeta = this.formatDateMetadataForKey(prevKey);
              parsed.archiveCards[prevKey] = {
                dateKey: prevMeta.dateKey,
                headerDate: parsed.cardHeaderDate || prevMeta.headerDate,
                shortDate: parsed.cardShortDate || prevMeta.shortDate,
                monthKey: prevMeta.monthKey,
                dayNum: prevMeta.dayNum,
                tasks: parsed.tasks.map((t, idx) => ({
                  id: `${prevKey}-task-${idx + 1}`,
                  orderIndex: idx + 1,
                  title: t.title,
                  isCompleted: Boolean(t.isCompleted),
                })),
                reflectionText: parsed.reflectionText || '',
                reflectionPhotos: Array.isArray(parsed.reflectionPhotos)
                  ? [...parsed.reflectionPhotos]
                  : [],
              };
              // Tomatoes that keep going into the new day keep their name, but are no longer
              // linked to yesterday's (now archived) card items
              this.unlinkTomatoesFromTasks(parsed);
              parsed.tasks = [
                {
                  id: 'task-' + Date.now(),
                  orderIndex: 1,
                  title: 'Example Task',
                  isCompleted: false,
                  assignedQuadrant: null,
                },
              ];
              parsed.reflectionText = '';
              parsed.reflectionPhotos = [];
            }
            parsed.cardDateKey = todayMeta.dateKey;
            parsed.cardHeaderDate = todayMeta.headerDate;
            parsed.cardShortDate = todayMeta.shortDate;
          } else {
            parsed.cardHeaderDate = todayMeta.headerDate;
            parsed.cardShortDate = todayMeta.shortDate;
          }
          parsed.isSilentMode = Boolean(parsed.isSilentMode);
          parsed.hasCompletedOnboarding = Boolean(parsed.hasCompletedOnboarding);
          if (!parsed.seenPageHints || typeof parsed.seenPageHints !== 'object') {
            parsed.seenPageHints = {};
          }
          parsed.lastRolloverLogicalDate = currentLogicalKey;
          this.reconcileElapsedTimers(parsed);
          return parsed;
        }
      }
    } catch (_) {}
    return this.getDefaultState();
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (_) {}
    if (this.supabaseSync && this.supabaseSync.isLoggedIn()) {
      this.supabaseSync.schedulePushCloudState(this.state);
    }
  }

  resetToMockupDefault() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = this.getDefaultState();
    this._todayFlipDeg = 0;
    this._stackFlipDeg = 0;
    this.saveState();
    this.renderAll();
    this.showNotificationBanner(this.t('Restored clean default state with Example Task.'));
  }

  reconcileElapsedTimers(stateObj) {
    const now = Date.now();
    for (const slot of stateObj.timers) {
      if (slot.runState === 'running' && slot.lastTickTimestamp) {
        const elapsedSec = Math.floor((now - slot.lastTickTimestamp) / 1000);
        if (elapsedSec > 0) {
          if (slot.mode === 'countdown') {
            slot.remainingSeconds = Math.max(0, slot.remainingSeconds - elapsedSec);
            slot.angleDegrees = OdometerDialPhysics.secondsToAngleDegrees(slot.remainingSeconds);
            if (slot.remainingSeconds === 0) {
              slot.runState = 'completed';
              slot.lastTickTimestamp = null;
            } else {
              slot.lastTickTimestamp = now;
            }
          } else {
            slot.remainingSeconds += elapsedSec;
            slot.angleDegrees = OdometerDialPhysics.stopwatchSecondsToMinuteAngleDegrees(
              slot.remainingSeconds
            );
            slot.lastTickTimestamp = now;
          }
        }
      }
    }
  }

  initDOM() {
    this.els = {
      homeBrandTitle: document.getElementById('home-brand-title'),
      topSegmentedPill: document.getElementById('top-segmented-pill'),
      pillCardBtn: document.getElementById('pill-card-btn'),
      pillTimerBtn: document.getElementById('pill-timer-btn'),
      profileBtn: document.getElementById('profile-btn'),

      homeScreen: document.getElementById('screen-home'),
      homeMiniCard: document.getElementById('home-mini-card'),
      homeMiniDate: document.getElementById('home-mini-date'),
      homeTomatoBtn: document.getElementById('home-tomato-btn'),

      cardScreen: document.getElementById('screen-card'),
      gridScreen: document.getElementById('screen-grid'),
      heroScreen: document.getElementById('screen-hero'),
      stackScreen: document.getElementById('screen-stack'),
      calendarScreen: document.getElementById('screen-calendar'),

      card3DWrapper: document.getElementById('daily-card-3d'),
      cardDateHeader: document.getElementById('card-date-header'),
      cardBackDateHeader: document.getElementById('card-back-date-header'),
      taskListContainer: document.getElementById('task-list-container'),
      addItemRow: document.getElementById('add-item-row'),
      cardBackReflection: document.getElementById('card-back-reflection'),
      cardBackPhotos: document.getElementById('card-back-photos'),
      journalPhotoFileInput: document.getElementById('journal-photo-file-input'),

      cardStackBtn: document.getElementById('card-stack-btn'),
      cardFlipBtn: document.getElementById('card-flip-btn'),
      cardPlusBtn: document.getElementById('card-plus-btn'),

      gridQuadrants: [
        document.getElementById('grid-quad-0'),
        document.getElementById('grid-quad-1'),
        document.getElementById('grid-quad-2'),
        document.getElementById('grid-quad-3'),
        document.getElementById('grid-quad-4'),
        document.getElementById('grid-quad-5'),
      ],

      heroReadout: document.getElementById('hero-readout'),
      heroTimeEditor: document.getElementById('hero-time-editor'),
      heroTimeInput: document.getElementById('hero-time-input'),
      heroTimeUnitBadge: document.getElementById('hero-time-unit-badge'),
      heroTimeSetBtn: document.getElementById('hero-time-set-btn'),
      heroSubtitleWrap: document.getElementById('hero-subtitle-wrap'),
      heroSubtitleRow: document.getElementById('hero-subtitle-row'),
      heroSubtitle: document.getElementById('hero-subtitle'),
      heroSyncToCardBtn: document.getElementById('hero-sync-to-card-btn'),
      heroTitleEditor: document.getElementById('hero-title-editor'),
      heroTitleOrderPrefix: document.getElementById('hero-title-order-prefix'),
      heroTitleInput: document.getElementById('hero-title-input'),
      heroTitleSetBtn: document.getElementById('hero-title-set-btn'),
      heroSubtitleDropdownMount: document.getElementById('hero-subtitle-dropdown-mount'),
      heroTomatoStage: document.getElementById('hero-tomato-stage'),
      heroBtnGrid: document.getElementById('hero-btn-grid'),
      heroBtnPlayPause: document.getElementById('hero-btn-playpause'),
      heroBtnStop: document.getElementById('hero-btn-stop'),
      heroBtnStopwatch: document.getElementById('hero-btn-stopwatch'),

      stackDateStrip: document.getElementById('stack-date-strip'),
      stackCarouselStage: document.getElementById('stack-carousel-stage'),
      stackPeekLeft: document.getElementById('stack-peek-left'),
      stackPeekRight: document.getElementById('stack-peek-right'),
      stackCard3D: document.getElementById('stack-card-3d'),
      stackCardDateHeader: document.getElementById('stack-card-date-header'),
      stackCardBackDateHeader: document.getElementById('stack-card-back-date-header'),
      stackFrontEditBtn: document.getElementById('stack-front-edit-btn'),
      stackBackEditBtn: document.getElementById('stack-back-edit-btn'),
      stackTaskListContainer: document.getElementById('stack-task-list-container'),
      stackAddItemRow: document.getElementById('stack-add-item-row'),
      stackCardBackReflection: document.getElementById('stack-card-back-reflection'),
      stackCardBackPhotos: document.getElementById('stack-card-back-photos'),
      stackBtnReturn: document.getElementById('stack-btn-return'),
      stackBtnZoomout: document.getElementById('stack-btn-zoomout'),
      stackBtnFlip: document.getElementById('stack-btn-flip'),
      stackBtnTrash: document.getElementById('stack-btn-trash'),

      photoLightboxOverlay: document.getElementById('photo-lightbox-overlay'),
      photoLightboxImg: document.getElementById('photo-lightbox-img'),
      photoLightboxClose: document.getElementById('photo-lightbox-close'),

      calendarMonthsContainer: document.getElementById('calendar-months-container'),
      calendarBtnReturn: document.getElementById('calendar-btn-return'),
      calendarBtnZoomin: document.getElementById('calendar-btn-zoomin'),

      toastPill: document.getElementById('telemetry-toast'),
      notificationBanner: document.getElementById('notification-banner'),

      demoBtnHome: document.getElementById('demo-view-home'),
      demoBtnCard: document.getElementById('demo-view-card'),
      demoBtnBack: document.getElementById('demo-view-back'),
      demoBtnGrid: document.getElementById('demo-view-grid'),
      demoBtnHero: document.getElementById('demo-view-hero'),
      demoBtnStack: document.getElementById('demo-view-stack'),
      demoBtnCalendar: document.getElementById('demo-view-calendar'),
      demoBtnSilent: document.getElementById('demo-toggle-silent'),
      demoBtnReset: document.getElementById('demo-reset-state'),

      modalOverlay: document.getElementById('modal-overlay'),
      modalTitle: document.getElementById('modal-title'),
      modalInput: document.getElementById('modal-input'),
      modalDelete: document.getElementById('modal-delete'),
      modalCancel: document.getElementById('modal-cancel'),
      modalConfirm: document.getElementById('modal-confirm'),

      deleteModalOverlay: document.getElementById('delete-modal-overlay'),
      deleteModalTitle: document.getElementById('delete-modal-title'),
      deleteModalDesc: document.getElementById('delete-modal-desc'),
      deleteModalCancel: document.getElementById('delete-modal-cancel'),
      deleteModalConfirm: document.getElementById('delete-modal-confirm'),

      profileModalOverlay: document.getElementById('profile-modal-overlay'),
      profileAccountBtn: document.getElementById('profile-account-btn'),
      profileAccountStateLabel: document.getElementById('profile-account-state-label'),
      profileOpenHomeBtn: document.getElementById('profile-open-home-btn'),
      profileGuidedTourBtn: document.getElementById('profile-guided-tour-btn'),
      profileResetTimeSelect: document.getElementById('profile-reset-time-select'),
      profileTomatoResetSelect: document.getElementById('profile-tomato-reset-select'),
      profileToggleAudioBtn: document.getElementById('profile-toggle-audio-btn'),
      profileAudioStateLabel: document.getElementById('profile-audio-state-label'),
      profileLanguageSelect: document.getElementById('profile-language-select'),
      profileSimulate5amBtn: document.getElementById('profile-simulate-5am-btn'),
      profileModalClose: document.getElementById('profile-modal-close'),

      authModalOverlay: document.getElementById('auth-modal-overlay'),
      authModalCloseBtn: document.getElementById('auth-modal-close-btn'),
      authViewSignedOut: document.getElementById('auth-view-signed-out'),
      authViewSignedIn: document.getElementById('auth-view-signed-in'),
      authTabSignin: document.getElementById('auth-tab-signin'),
      authTabSignup: document.getElementById('auth-tab-signup'),
      authForm: document.getElementById('auth-form'),
      authEmailInput: document.getElementById('auth-email-input'),
      authPasswordInput: document.getElementById('auth-password-input'),
      authErrorMsg: document.getElementById('auth-error-msg'),
      authSubmitBtn: document.getElementById('auth-submit-btn'),
      authGoogleBtn: document.getElementById('auth-google-btn'),
      authAppleBtn: document.getElementById('auth-apple-btn'),
      authUserEmailDisplay: document.getElementById('auth-user-email-display'),
      authSyncModeBadge: document.getElementById('auth-sync-mode-badge'),
      authLastSyncedLabel: document.getElementById('auth-last-synced-label'),
      authSyncNowBtn: document.getElementById('auth-sync-now-btn'),
      authSignoutBtn: document.getElementById('auth-signout-btn'),
      authConfigToggleBtn: document.getElementById('auth-config-toggle-btn'),
      authConfigPanel: document.getElementById('auth-config-panel'),
      authSupabaseUrlInput: document.getElementById('auth-supabase-url-input'),
      authSupabaseKeyInput: document.getElementById('auth-supabase-key-input'),
      authSaveConfigBtn: document.getElementById('auth-save-config-btn'),

      onboardingOverlay: document.getElementById('onboarding-overlay'),
      onboardingDismissBtn: document.getElementById('onboarding-dismiss-btn'),
      tourPageDot: document.getElementById('tour-page-dot'),
      tourPageDot2: document.getElementById('tour-page-dot-2'),
      tourStepTitle: document.getElementById('tour-step-title'),
      tourStepDesc: document.getElementById('tour-step-desc'),
      tourPrevBtn: document.getElementById('tour-prev-btn'),
      tourNextBtn: document.getElementById('tour-next-btn'),

      aboutModalOverlay: document.getElementById('about-modal-overlay'),
      aboutLetterCard: document.getElementById('about-letter-card'),
      aboutLetterBlocks: document.getElementById('about-letter-blocks'),
      aboutModalCloseBtn: document.getElementById('about-modal-close-btn'),
      aboutStartTourBtn: document.getElementById('about-start-tour-btn'),
    };
  }

  init3DRenderers() {
    this.gridRenderer = new GridTomatoRenderer();
    this.hero3D = new HeroTomato3DView(this.els.heroTomatoStage);
    window.addEventListener('resize', () => {
      if (this.hero3D) this.hero3D.resize();
      if (this.state.activePillar === 'card') {
        this.fitUnifiedCardTaskTypography(this.els.taskListContainer, this.els.addItemRow);
        this.adjustReflectionTypography(this.els.cardBackReflection);
      } else if (this.state.activePillar === 'stack') {
        this.fitUnifiedCardTaskTypography(
          this.els.stackTaskListContainer,
          this.els.stackAddItemRow
        );
        this.adjustReflectionTypography(this.els.stackCardBackReflection);
      }
    });
  }

  bindGlobalEvents() {
    // 0. Minimalist 2-Object Homepage (01-home-page.png)
    if (this.els.homeMiniCard) {
      const openTodayCardFromHome = () => {
        this.sensory.playCardFlipSwoosh();
        this.state.activePillar = 'card';
        this.state.isCardFlipped = false;
        this._todayFlipDeg = 0;
        this.saveState();
        this.renderAll();
      };
      this.els.homeMiniCard.addEventListener('click', openTodayCardFromHome);
      this.els.homeMiniCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTodayCardFromHome();
        }
      });
    }

    if (this.els.homeTomatoBtn) {
      const openTimerFromHome = () => {
        this.sensory.playMechanicalTick();
        const freeSlot =
          this.state.timers.find(
            (s) =>
              !s.assignedTaskId &&
              !s.customTitle &&
              s.runState === 'idle' &&
              s.remainingSeconds === 0
          ) ||
          this.state.timers.find((s) => !s.assignedTaskId && !s.customTitle);
        if (freeSlot) {
          this.state.selectedQuadrant = freeSlot.quadrant;
        }
        this.state.activePillar = 'timer';
        this.state.timerSubMode = 'hero';
        this.saveState();
        this.renderAll();
      };
      this.els.homeTomatoBtn.addEventListener('click', openTimerFromHome);
      this.els.homeTomatoBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTimerFromHome();
        }
      });
    }

    // 1. Top Segmented Pill: Card | Timer
    this.els.pillCardBtn.addEventListener('click', () => {
      this.state.activePillar = 'card';
      this.saveState();
      this.renderAll();
    });

    this.els.pillTimerBtn.addEventListener('click', () => {
      this.state.activePillar = 'timer';
      this.saveState();
      this.renderAll();
    });

    // Minimal Profile Popover: Home, Reset Time, Sound On/Off
    this.els.profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (
        this.els.profileModalOverlay &&
        !this.els.profileModalOverlay.classList.contains('hidden')
      ) {
        this.els.profileModalOverlay.classList.add('hidden');
      } else {
        this.openProfileModal();
      }
    });

    if (this.els.profileModalOverlay) {
      this.els.profileModalOverlay.addEventListener('click', (e) => {
        if (!e.target.closest('.profile-popover-card')) {
          this.els.profileModalOverlay.classList.add('hidden');
        }
      });
    }
    if (this.els.profileModalClose) {
      this.els.profileModalClose.addEventListener('click', () => {
        this.els.profileModalOverlay.classList.add('hidden');
      });
    }
    if (this.els.profileAccountBtn) {
      this.els.profileAccountBtn.addEventListener('click', () => {
        this.els.profileModalOverlay.classList.add('hidden');
        this.openAuthModal();
      });
    }
    this.bindAuthModalEvents();
    if (this.els.profileOpenHomeBtn) {
      this.els.profileOpenHomeBtn.addEventListener('click', () => {
        this.els.profileModalOverlay.classList.add('hidden');
        this.state.activePillar = 'home';
        this.saveState();
        this.renderAll();
      });
    }
    if (this.els.profileGuidedTourBtn) {
      this.els.profileGuidedTourBtn.addEventListener('click', () => {
        this.els.profileModalOverlay.classList.add('hidden');
        this.openAboutModal();
      });
    }
    if (this.els.profileResetTimeSelect) {
      this.els.profileResetTimeSelect.addEventListener('change', (e) => {
        const hourVal = Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0));
        this.state.dailyResetHour = hourVal;
        const newLogicalKey = this.getCurrentLogicalDateString(hourVal);
        const newMeta = this.formatDateMetadataForKey(newLogicalKey);
        this.state.lastRolloverLogicalDate = newLogicalKey;
        this.state.cardDateKey = newMeta.dateKey;
        this.state.cardHeaderDate = newMeta.headerDate;
        this.state.cardShortDate = newMeta.shortDate;
        this.saveState();
        this.renderAll();
        const padded = String(hourVal).padStart(2, '0') + ':00';
        this.showTelemetryToast(this.t('Daily reset time: {time}', { time: padded }));
      });
    }
    if (this.els.profileTomatoResetSelect) {
      this.els.profileTomatoResetSelect.addEventListener('change', (e) => {
        this.state.dailyTomatoReset = e.target.value === 'yes';
        this.saveState();
        this.showTelemetryToast(
          this.t(
            this.state.dailyTomatoReset
              ? 'Tomatoes reset daily with the card'
              : 'Tomatoes keep running across days'
          )
        );
      });
    }
    if (this.els.profileLanguageSelect) {
      // Opens a dropdown like Daily Reset; the language only changes once an option is picked
      this.els.profileLanguageSelect.addEventListener('change', (e) => {
        const next = e.target.value === 'zh' ? 'zh' : 'en';
        if (next === getLanguage()) return;
        this.applyLanguage(next, true);
        this.saveState();
        this.showTelemetryToast(next === 'zh' ? '语言：简体中文' : 'Language: English');
      });
    }
    if (this.els.profileToggleAudioBtn) {
      this.els.profileToggleAudioBtn.addEventListener('click', () => {
        this.toggleSilentAudioMode();
        if (this.els.profileAudioStateLabel) {
          this.els.profileAudioStateLabel.textContent = this.t(this.sensory.isSilentMode ? 'Off' : 'On');
        }
      });
    }
    if (this.els.profileSimulate5amBtn) {
      this.els.profileSimulate5amBtn.addEventListener('click', () => {
        this.els.profileModalOverlay.classList.add('hidden');
        this.simulateFiveAmRollover();
      });
    }

    // 2. Card Bottom Action Bar: [Stack] [Flip]
    if (this.els.cardStackBtn) {
      this.els.cardStackBtn.addEventListener('click', () => {
        this.sensory.playStackRiffleTick();
        this.state.activePillar = 'stack';
        this.state.isStackCardFlipped = false;
        this.state.isStackEditMode = false;
        this._stackFlipDeg = 0;
        this.saveState();
        this.renderAll();
      });
    }

    if (this.els.cardFlipBtn) {
      this.els.cardFlipBtn.addEventListener('click', () => {
        this.triggerCardFlip(-1);
      });
    }

    // Flip button printed on every card face (Today front/back, past card front/back)
    document.querySelectorAll('.card-face-flip-btn').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.flipTarget === 'stack') {
          this.triggerStackCardFlip(-1);
        } else {
          this.triggerCardFlip(-1);
        }
      });
    });

    if (this.els.cardPlusBtn) {
      this.els.cardPlusBtn.addEventListener('click', () => {
        if (this.state.isCardFlipped) {
          this.triggerPhotoAttachment('today');
        } else {
          this.startInlineAddTask(false, true);
        }
      });
    }

    this.els.addItemRow.addEventListener('click', () => {
      if (this._justFinishedCardSwipe) return;
      this.startInlineAddTask(false, true);
    });

    // 2b. Matte Black Back of Card — Evening Reflection Journal & Photo Upload
    if (this.els.cardBackReflection) {
      let reflectionComposing = false;
      const syncTodayReflection = (isFromCompositionEnd = false) => {
        if (reflectionComposing && !isFromCompositionEnd) return;
        const clamped = this.clampReflectionInputText(this.els.cardBackReflection.value);
        if (this.els.cardBackReflection.value !== clamped) {
          this.els.cardBackReflection.value = clamped;
          this.showTelemetryToast(this.t('Reflection limit reached'));
        }
        this.state.reflectionText = this.els.cardBackReflection.value;
        this.adjustReflectionTypography(this.els.cardBackReflection);
        this.saveState();
      };
      this.els.cardBackReflection.addEventListener('compositionstart', () => {
        reflectionComposing = true;
      });
      this.els.cardBackReflection.addEventListener('compositionend', () => {
        reflectionComposing = false;
        syncTodayReflection(true);
      });
      this.els.cardBackReflection.addEventListener('input', (e) => {
        if (reflectionComposing || e.isComposing) {
          this.state.reflectionText = this.els.cardBackReflection.value;
          return;
        }
        syncTodayReflection(false);
      });
    }

    if (this.els.journalPhotoFileInput) {
      this.els.journalPhotoFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const compressedDataUrl = await this.compressImageFileToDataURL(file, 1600);
          const repIdx = this._photoReplaceIndex;
          this._photoReplaceIndex = null;

          if (this._photoUploadTarget === 'stack') {
            const card = this.getSelectedStackCard();
            if (card) {
              if (!Array.isArray(card.reflectionPhotos)) card.reflectionPhotos = [];
              if (
                typeof repIdx === 'number' &&
                repIdx >= 0 &&
                repIdx < card.reflectionPhotos.length
              ) {
                card.reflectionPhotos[repIdx] = compressedDataUrl;
              } else if (card.reflectionPhotos.length < 2) {
                card.reflectionPhotos.push(compressedDataUrl);
              } else {
                card.reflectionPhotos[1] = compressedDataUrl;
              }
              this.saveState();
              this.renderStackScreen();
              this.showTelemetryToast(this.t('Photo updated on archived card'));
            }
          } else {
            if (!Array.isArray(this.state.reflectionPhotos)) {
              this.state.reflectionPhotos = [];
            }
            if (
              typeof repIdx === 'number' &&
              repIdx >= 0 &&
              repIdx < this.state.reflectionPhotos.length
            ) {
              this.state.reflectionPhotos[repIdx] = compressedDataUrl;
            } else if (this.state.reflectionPhotos.length < 2) {
              this.state.reflectionPhotos.push(compressedDataUrl);
            } else {
              this.state.reflectionPhotos[1] = compressedDataUrl;
            }
            this.saveState();
            this.renderCardScreen();
            this.showTelemetryToast(this.t('Photo updated in Evening Journal'));
          }
        } catch (_) {
          this.showNotificationBanner(this.t('Could not process selected image file.'));
        } finally {
          this.els.journalPhotoFileInput.value = '';
        }
      });
    }

    // Close open grid or hero dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (
        this.state.openDropdownQuadrant !== null &&
        !e.target.closest('.task-assign-dropdown') &&
        !e.target.closest('.grid-tomato-wrap')
      ) {
        this.state.openDropdownQuadrant = null;
        if (this.state.activePillar === 'timer' && this.state.timerSubMode === 'grid') {
          this.renderGridScreen();
        }
      }
      if (
        (this.state.isHeroDropdownOpen ||
          (this.els.heroTitleEditor && !this.els.heroTitleEditor.classList.contains('hidden'))) &&
        !e.target.closest('.hero-subtitle-wrap')
      ) {
        if (this.els.heroTitleEditor && !this.els.heroTitleEditor.classList.contains('hidden')) {
          this.commitHeroTitleEditor();
        } else {
          this.state.isHeroDropdownOpen = false;
          if (this.state.activePillar === 'timer' && this.state.timerSubMode === 'hero') {
            this.renderHeroScreen();
          }
        }
      }
    });

    // 3. Bidirectional Card Surface Flip Gesture Detector (flips both ways: Left->Right & Right->Left)
    this.bindCardSurfaceFlipGesture();

    // 4. Hero Tomato 3D Dial Horizontal Drag Gesture (Right->Left winds up, Left->Right unwinds)
    this.bindHeroDialDragGesture();

    // 5. Hero Bottom Bar Controls: [Grid] [Play/Pause] [End/Stop] [Stopwatch]
    this.els.heroBtnGrid.addEventListener('click', () => {
      this.state.timerSubMode = 'grid';
      this.saveState();
      this.renderAll();
    });

    this.els.heroBtnPlayPause.addEventListener('click', () => {
      this.togglePlayPause(this.state.selectedQuadrant);
    });

    this.els.heroBtnStop.addEventListener('click', () => {
      this.handleEndOrResetButton(this.state.selectedQuadrant);
    });

    this.els.heroBtnStopwatch.addEventListener('click', () => {
      this.toggleStopwatchMode(this.state.selectedQuadrant);
    });

    // Clicking the task subtitle ("01 / TAP TO ASSIGN" or "01 / Title") opens the inline title box ready to type
    this.els.heroSubtitle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openHeroTitleEditor();
    });
    this.els.heroSubtitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openHeroTitleEditor();
      }
    });

    if (this.els.heroSyncToCardBtn) {
      this.els.heroSyncToCardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.syncCustomTomatoToCard(this.state.selectedQuadrant);
      });
    }

    // 5b. Tap-on-Digits Time Entry & Inline Title Entry on Hero Page
    this.bindHeroReadoutTimeEntry();
    this.bindHeroTitleEntry();

    // 6. Chronological Card Stack Viewer Controls (Mockup 06-stack-detail.png)
    this.bindStackViewerEvents();

    // 7. Monthly Calendar Zoom-Out Controls (Mockup 07-calendar-view.png)
    this.bindCalendarViewerEvents();

    // 8. Demo / Evaluation Toolbar Buttons (All 7 Mockups)
    if (this.els.demoBtnHome) {
      this.els.demoBtnHome.addEventListener('click', () => {
        this.state.activePillar = 'home';
        this.saveState();
        this.renderAll();
      });
    }
    if (this.els.demoBtnCard) {
      this.els.demoBtnCard.addEventListener('click', () => {
        this.state.activePillar = 'card';
        this.state.isCardFlipped = false;
        this._todayFlipDeg = 0;
        this.saveState();
        this.renderAll();
      });
    }
    if (this.els.demoBtnBack) {
      this.els.demoBtnBack.addEventListener('click', () => {
        this.state.activePillar = 'card';
        this.state.isCardFlipped = true;
        this._todayFlipDeg = -180;
        this.saveState();
        this.renderAll();
      });
    }
    if (this.els.demoBtnGrid) {
      this.els.demoBtnGrid.addEventListener('click', () => {
        this.state.activePillar = 'timer';
        this.state.timerSubMode = 'grid';
        this.saveState();
        this.renderAll();
      });
    }
    if (this.els.demoBtnHero) {
      this.els.demoBtnHero.addEventListener('click', () => {
        this.state.activePillar = 'timer';
        this.state.timerSubMode = 'hero';
        this.saveState();
        this.renderAll();
      });
    }
    if (this.els.demoBtnStack) {
      this.els.demoBtnStack.addEventListener('click', () => {
        this.state.activePillar = 'stack';
        this.state.isStackCardFlipped = false;
        this._stackFlipDeg = 0;
        this.saveState();
        this.renderAll();
      });
    }
    if (this.els.demoBtnCalendar) {
      this.els.demoBtnCalendar.addEventListener('click', () => {
        this.state.activePillar = 'calendar';
        this.saveState();
        this.renderAll();
      });
    }
    if (this.els.demoBtnSilent) {
      this.els.demoBtnSilent.addEventListener('click', () => {
        this.toggleSilentAudioMode();
      });
    }
    if (this.els.demoBtnReset) {
      this.els.demoBtnReset.addEventListener('click', () => {
        this.resetToMockupDefault();
      });
    }
  }

  toggleSilentAudioMode() {
    this.sensory.isSilentMode = !this.sensory.isSilentMode;
    this.state.isSilentMode = this.sensory.isSilentMode;
    if (this.sensory.isSilentMode) {
      this.sensory.stopCompletionAlarm();
      this.sensory.disarmHardwareCountdownAlarm();
    }
    this.armTimerDueAlarm();
    this.saveState();
    if (this.els.demoBtnSilent) {
      this.els.demoBtnSilent.textContent = this.sensory.isSilentMode
        ? '🔇 Silent Mode: ON'
        : '🔊 Foley Audio: ON';
      this.els.demoBtnSilent.classList.toggle('active-pill', this.sensory.isSilentMode);
    }
    this.showTelemetryToast(
      this.t(this.sensory.isSilentMode ? 'Sound: Off' : 'Sound: On')
    );
  }

  openProfileModal() {
    if (!this.els.profileModalOverlay) return;
    this.updateProfileAccountLabel();
    if (this.els.profileAudioStateLabel) {
      this.els.profileAudioStateLabel.textContent = this.t(this.sensory.isSilentMode ? 'Off' : 'On');
    }
    if (this.els.profileResetTimeSelect) {
      const hr = typeof this.state.dailyResetHour === 'number' ? this.state.dailyResetHour : 5;
      this.els.profileResetTimeSelect.value = String(hr);
    }
    if (this.els.profileTomatoResetSelect) {
      this.els.profileTomatoResetSelect.value = this.state.dailyTomatoReset ? 'yes' : 'no';
    }
    this.els.profileModalOverlay.classList.remove('hidden');
  }

  updateProfileAccountLabel() {
    if (!this.els.profileAccountStateLabel) return;
    const user = this.supabaseSync ? this.supabaseSync.getCurrentUser() : null;
    if (user && user.email) {
      const shortHandle = user.email.split('@')[0].slice(0, 12);
      this.els.profileAccountStateLabel.textContent = `${shortHandle} ✓`;
    } else {
      this.els.profileAccountStateLabel.textContent = this.t('Sign In ↗');
    }
  }

  bindAuthModalEvents() {
    if (this.els.authModalCloseBtn) {
      this.els.authModalCloseBtn.addEventListener('click', () => {
        this.closeAuthModal();
      });
    }
    if (this.els.authModalOverlay) {
      this.els.authModalOverlay.addEventListener('click', (e) => {
        if (!e.target.closest('.auth-modal-box')) {
          this.closeAuthModal();
        }
      });
    }
    if (this.els.authTabSignin) {
      this.els.authTabSignin.addEventListener('click', () => {
        this._authMode = 'signin';
        this.hideAuthError();
        this.renderAuthModalState();
      });
    }
    if (this.els.authTabSignup) {
      this.els.authTabSignup.addEventListener('click', () => {
        this._authMode = 'signup';
        this.hideAuthError();
        this.renderAuthModalState();
      });
    }
    if (this.els.authForm) {
      this.els.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAuthFormSubmit();
      });
    }
    if (this.els.authGoogleBtn) {
      this.els.authGoogleBtn.addEventListener('click', async () => {
        await this.handleOAuthProviderLogin('google');
      });
    }
    if (this.els.authAppleBtn) {
      this.els.authAppleBtn.addEventListener('click', async () => {
        await this.handleOAuthProviderLogin('apple');
      });
    }
    if (this.els.authSyncNowBtn) {
      this.els.authSyncNowBtn.addEventListener('click', async () => {
        await this.supabaseSync.pushCloudState(this.state);
        this.renderAuthModalState();
        this.showTelemetryToast(this.t('Synced to account'));
      });
    }
    if (this.els.authSignoutBtn) {
      this.els.authSignoutBtn.addEventListener('click', async () => {
        await this.handleAuthSignOut();
      });
    }
    if (this.els.authConfigToggleBtn && this.els.authConfigPanel) {
      this.els.authConfigToggleBtn.addEventListener('click', () => {
        this.els.authConfigPanel.classList.toggle('hidden');
      });
    }
    if (this.els.authSaveConfigBtn) {
      this.els.authSaveConfigBtn.addEventListener('click', async () => {
        const url = this.els.authSupabaseUrlInput ? this.els.authSupabaseUrlInput.value : '';
        const key = this.els.authSupabaseKeyInput ? this.els.authSupabaseKeyInput.value : '';
        this.supabaseSync.saveConfig(url, key);
        if (this.supabaseSync.isLoggedIn()) {
          await this.supabaseSync.pushCloudState(this.state);
        }
        this.renderAuthModalState();
        this.showTelemetryToast(
          this.supabaseSync.isCloudConfigured()
            ? this.t('Supabase Cloud connected')
            : this.t('Saved local vault mode')
        );
      });
    }
  }

  openAuthModal(mode = null) {
    if (!this.els.authModalOverlay) return;
    if (mode === 'signin' || mode === 'signup') {
      this._authMode = mode;
    }
    this.hideAuthError();
    if (this.els.authSupabaseUrlInput) {
      this.els.authSupabaseUrlInput.value = (this.supabaseSync.config && this.supabaseSync.config.url) || '';
    }
    if (this.els.authSupabaseKeyInput) {
      this.els.authSupabaseKeyInput.value = (this.supabaseSync.config && this.supabaseSync.config.anonKey) || '';
    }
    this.renderAuthModalState();
    this.els.authModalOverlay.classList.remove('hidden');
  }

  closeAuthModal() {
    if (!this.els.authModalOverlay) return;
    this.els.authModalOverlay.classList.add('hidden');
    this.hideAuthError();
  }

  showAuthError(msg) {
    if (!this.els.authErrorMsg) return;
    this.els.authErrorMsg.textContent = msg;
    this.els.authErrorMsg.classList.remove('hidden');
  }

  hideAuthError() {
    if (!this.els.authErrorMsg) return;
    this.els.authErrorMsg.textContent = '';
    this.els.authErrorMsg.classList.add('hidden');
  }

  renderAuthModalState() {
    const isLogged = this.supabaseSync && this.supabaseSync.isLoggedIn();
    const user = isLogged ? this.supabaseSync.getCurrentUser() : null;
    if (this.els.authViewSignedOut) {
      this.els.authViewSignedOut.classList.toggle('hidden', Boolean(isLogged));
    }
    if (this.els.authViewSignedIn) {
      this.els.authViewSignedIn.classList.toggle('hidden', !isLogged);
    }

    if (!isLogged) {
      const isSignup = this._authMode === 'signup';
      if (this.els.authTabSignin) {
        this.els.authTabSignin.classList.toggle('active', !isSignup);
        this.els.authTabSignin.setAttribute('aria-selected', !isSignup ? 'true' : 'false');
      }
      if (this.els.authTabSignup) {
        this.els.authTabSignup.classList.toggle('active', isSignup);
        this.els.authTabSignup.setAttribute('aria-selected', isSignup ? 'true' : 'false');
      }
      if (this.els.authSubmitBtn) {
        this.els.authSubmitBtn.textContent = this.t(isSignup ? 'Create Account' : 'Sign In');
      }
    } else if (user) {
      if (this.els.authUserEmailDisplay) {
        this.els.authUserEmailDisplay.textContent = user.email;
      }
      if (this.els.authSyncModeBadge) {
        this.els.authSyncModeBadge.textContent = this.supabaseSync.isCloudConfigured()
          ? this.t('Supabase Cloud')
          : this.t('Synced');
      }
      if (this.els.authLastSyncedLabel) {
        this.els.authLastSyncedLabel.textContent = this.t('Up to date');
      }
    }
    this.updateProfileAccountLabel();
  }

  async handleAuthFormSubmit() {
    this.hideAuthError();
    const email = this.els.authEmailInput ? this.els.authEmailInput.value : '';
    const password = this.els.authPasswordInput ? this.els.authPasswordInput.value : '';
    try {
      if (this._authMode === 'signup') {
        const { user } = await this.supabaseSync.signUp(email, password);
        await this.supabaseSync.pushCloudState(this.state);
        if (this.els.authPasswordInput) this.els.authPasswordInput.value = '';
        this.renderAuthModalState();
        this.closeAuthModal();
        this.showTelemetryToast(this.t('Account created: {email}', { email: user.email }));
      } else {
        const { user } = await this.supabaseSync.signIn(email, password);
        if (this.els.authPasswordInput) this.els.authPasswordInput.value = '';
        await this.syncFromAuthenticatedAccount(true);
        this.renderAuthModalState();
        this.closeAuthModal();
        this.showTelemetryToast(this.t('Signed in as {email}', { email: user.email }));
      }
    } catch (err) {
      this.showAuthError(err && err.message ? this.t(err.message) : this.t('Authentication failed'));
    }
  }

  async handleOAuthProviderLogin(provider) {
    this.hideAuthError();
    try {
      const emailHint = this.els.authEmailInput ? this.els.authEmailInput.value.trim() : '';
      const res = await this.supabaseSync.signInWithProvider(provider, emailHint);
      if (res && res.redirecting) return;
      if (res && res.isNewUser) {
        await this.supabaseSync.pushCloudState(this.state);
      } else {
        await this.syncFromAuthenticatedAccount(true);
      }
      this.renderAuthModalState();
      this.closeAuthModal();
      const user = this.supabaseSync.getCurrentUser();
      if (user) {
        this.showTelemetryToast(this.t('Signed in as {email}', { email: user.email }));
      }
    } catch (err) {
      if (this.els.authEmailInput && !this.els.authEmailInput.value.trim()) {
        this.els.authEmailInput.focus();
      }
      this.showAuthError(err && err.message ? this.t(err.message) : this.t('Sign-in failed'));
    }
  }

  async handleAuthSignOut() {
    if (this.supabaseSync && this.supabaseSync.isLoggedIn()) {
      await this.supabaseSync.pushCloudState(this.state);
      await this.supabaseSync.signOut();
    }
    const fresh = this.getDefaultState();
    fresh.hasCompletedOnboarding = true;
    fresh.isSilentMode = this.sensory.isSilentMode;
    fresh.language = getLanguage();
    this.state = fresh;
    this._todayFlipDeg = 0;
    this._stackFlipDeg = 0;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (_) {}
    this.renderAuthModalState();
    this.closeAuthModal();
    this.renderAll();
    this.showTelemetryToast(this.t('Signed out'));
  }

  async syncFromAuthenticatedAccount(renderImmediately = true) {
    if (!this.supabaseSync || !this.supabaseSync.isLoggedIn()) return;
    const prevPillar = this.state && this.state.activePillar ? this.state.activePillar : 'card';
    const cloudState = await this.supabaseSync.pullCloudState();
    if (
      cloudState &&
      Array.isArray(cloudState.tasks) &&
      Array.isArray(cloudState.timers) &&
      cloudState.timers.length === NUM_GRID_SLOTS
    ) {
      const hr = typeof cloudState.dailyResetHour === 'number' ? cloudState.dailyResetHour : 5;
      const currentLogicalKey = this.getCurrentLogicalDateString(hr);
      const todayMeta = this.formatDateMetadataForKey(currentLogicalKey);
      cloudState.cardDateKey = todayMeta.dateKey;
      cloudState.cardHeaderDate = todayMeta.headerDate;
      cloudState.cardShortDate = todayMeta.shortDate;
      cloudState.lastRolloverLogicalDate = currentLogicalKey;
      cloudState.hasCompletedOnboarding = true;
      cloudState.activePillar = prevPillar;
      this.reconcileElapsedTimers(cloudState);
      if (cloudState.language !== 'en' && cloudState.language !== 'zh') {
        cloudState.language = getLanguage();
      }
      this.state = cloudState;
      setLanguage(cloudState.language);
      applyStaticI18n();
      if (this.els.profileLanguageSelect) {
        this.els.profileLanguageSelect.value = cloudState.language;
      }
      this.sensory.isSilentMode = Boolean(this.state.isSilentMode);
      this._todayFlipDeg = this.state.isCardFlipped ? -180 : 0;
      this._stackFlipDeg = this.state.isStackCardFlipped ? -180 : 0;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (_) {}
      if (renderImmediately) {
        this.renderAll();
      }
    } else {
      await this.supabaseSync.pushCloudState(this.state);
    }
    this.updateProfileAccountLabel();
  }

  registerServiceWorker() {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1')
    ) {
      // Register after the page has loaded, so the offline precache doesn't compete with the
      // first-visit tomato downloads on a slow phone connection.
      const doRegister = () =>
        navigator.serviceWorker
          .register('./sw.js', { updateViaCache: 'none' })
          .then((reg) => {
            if (reg && typeof reg.update === 'function') {
              reg.update().catch(() => {});
              document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                  reg.update().catch(() => {});
                }
              });
            }
          })
          .catch(() => {});
      const later = () => setTimeout(doRegister, navigator.serviceWorker.controller ? 0 : 2500);
      if (document.readyState === 'complete') later();
      else window.addEventListener('load', later, { once: true });
    }
  }

  /** Clears all 6 tomatoes back to empty grey 00:00 (used by the daily "Tomato Reset" option). */
  resetAllTomatoesInState(state) {
    if (!state || !Array.isArray(state.timers)) return;
    state.timers.forEach((s) => {
      s.assignedTaskId = null;
      s.assignedTaskOrder = null;
      s.customTitle = null;
      s.runState = 'idle';
      s.mode = 'countdown';
      s.configuredMinutes = 0;
      s.remainingSeconds = 0;
      s.angleDegrees = 0;
      s.lastTickTimestamp = null;
    });
    if (Array.isArray(state.tasks)) {
      state.tasks.forEach((t) => {
        t.assignedQuadrant = null;
      });
    }
  }

  /** Keeps every tomato (title, time, running state) but detaches it from card items. */
  unlinkTomatoesFromTasks(state) {
    if (!state || !Array.isArray(state.timers)) return;
    state.timers.forEach((s) => {
      s.assignedTaskId = null;
      s.assignedTaskOrder = null;
    });
  }

  simulateFiveAmRollover(targetDateKey = null) {
    const currentKey =
      this.state.cardDateKey || this.getCurrentLogicalDateString(this.state.dailyResetHour);
    const currentMeta = this.formatDateMetadataForKey(currentKey);

    this.state.archiveCards[currentKey] = {
      dateKey: currentMeta.dateKey,
      headerDate: this.state.cardHeaderDate || currentMeta.headerDate,
      shortDate: this.state.cardShortDate || currentMeta.shortDate,
      monthKey: currentMeta.monthKey,
      dayNum: currentMeta.dayNum,
      tasks: this.state.tasks.map((t, idx) => ({
        id: `${currentKey}-task-${idx + 1}`,
        orderIndex: idx + 1,
        title: t.title,
        isCompleted: Boolean(t.isCompleted),
      })),
      reflectionText: this.state.reflectionText || '',
      reflectionPhotos: Array.isArray(this.state.reflectionPhotos)
        ? [...this.state.reflectionPhotos]
        : [],
    };

    const nextKey =
      targetDateKey && /^\d{4}-\d{2}-\d{2}$/.test(targetDateKey)
        ? targetDateKey
        : this.getOffsetDateKey(currentKey, 1);
    const nextMeta = this.formatDateMetadataForKey(nextKey);
    const nextDayPadded = String(nextMeta.dayNum).padStart(2, '0');

    this.state.selectedStackDateKey = currentKey;
    this.state.cardDateKey = nextMeta.dateKey;
    this.state.cardHeaderDate = nextMeta.headerDate;
    this.state.cardShortDate = nextMeta.shortDate;
    this.state.lastRolloverLogicalDate = nextMeta.dateKey;
    this.state.isCardFlipped = false;
    this._todayFlipDeg = 0;
    this.state.tasks = [
      {
        id: 'task-' + Date.now(),
        orderIndex: 1,
        title: 'Morning Focus Priority',
        isCompleted: false,
        assignedQuadrant: null,
      },
    ];
    this.state.reflectionText = '';
    this.state.reflectionPhotos = [];

    if (this.state.dailyTomatoReset) {
      this.resetAllTomatoesInState(this.state);
    } else {
      // Tomatoes keep running into the new day; they keep their names but are unlinked
      // from yesterday's (now archived) card items
      this.unlinkTomatoesFromTasks(this.state);
    }
    this.closeHeroTimeEditorDOM();
    this.closeHeroTitleEditorDOM();
    this.state.openDropdownQuadrant = null;
    this.state.isHeroDropdownOpen = false;
    this.armTimerDueAlarm();

    this.sensory.playCardFlipSwoosh();
    this.saveState();
    this.renderAll();
    this.showNotificationBanner(
      getLanguage() === 'zh'
        ? this.t('New day: yesterday’s card moved to your stack')
        : `5:00 AM Rollover: Archived ${currentKey} to Stack & created fresh card for ${nextMeta.shortMonth} ${nextDayPadded}.`
    );
  }

  // =========================================================================
  // ADAPTIVE TYPOGRAPHY, WORD/CHAR CAPS & PHOTO COMPRESSION (<= 1600px)
  // =========================================================================

  /**
   * Limits task input to at most MAX_TASK_WORDS (18 words) and MAX_TASK_CHARS (110 chars)
   * so users can enter full task descriptions in any keyboard language (including Chinese
   * Pinyin / Handwriting, Japanese, Korean, Arabic, and European languages) without
   * mutating internal IME whitespace (\u2006) or adding extra spaces.
   */
  clampTaskInputText(rawText) {
    // Strip stray iOS Pinyin Six-Per-Em spaces (\u2006) and convert line breaks to a single space
    // without collapsing spaces mid-typing.
    let text = String(rawText || '')
      .replace(/\u2006/g, '')
      .replace(/\r?\n/g, ' ');
    const leadingTrimmed = text.trimStart();
    if (leadingTrimmed) {
      const words = leadingTrimmed.split(/[ \t]+/).filter(Boolean);
      if (words.length > MAX_TASK_WORDS) {
        text = words.slice(0, MAX_TASK_WORDS).join(' ');
      }
    }
    if (text.length > MAX_TASK_CHARS) {
      text = text.slice(0, MAX_TASK_CHARS);
    }
    return text;
  }

  /**
   * Returns the unified baseline task font size (24px).
   * Individual tasks NEVER shrink independently; `fitUnifiedCardTaskTypography()`
   * keeps all items on a card at the exact same unified font size (24px) and only
   * steps down uniformly if the whole vertical card page is filled.
   */
  computeTaskFontSizePx(title, totalTasksCount = 1) {
    return 24;
  }

  /**
   * Unifies the text size of EVERY item on a card (`.task-index`, `.task-title`, and `.add-item-row`)
   * to the exact same font size (`24px` default).
   * Does NOT decrease the font size unless the whole card page is vertically filled
   * (`bodyEl.scrollHeight > bodyEl.clientHeight + 2`). When the whole page is filled,
   * decreases the unified font size uniformly for all items on that card together down to a 16.5px floor.
   */
  /**
   * Sizes a task text box to exactly N text lines (N x line-height), the same height the
   * task title text has. scrollHeight is rounded up to whole pixels, which made the editor a
   * fraction of a pixel taller than the title and could tip a full card into a smaller font size.
   */
  setTextareaHeightToLines(el) {
    if (!el) return;
    el.style.height = 'auto';
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight);
    const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    if (!(lh > 0)) {
      el.style.height = `${el.scrollHeight}px`;
      return;
    }
    const lines = Math.max(1, Math.round((el.scrollHeight - padV) / lh));
    const borderV = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    el.style.height = `${lines * lh + padV + borderV}px`;
  }

  fitUnifiedCardTaskTypography(containerEl, addItemEl) {
    if (!containerEl) return 24;
    const bodyEl =
      containerEl.closest('.card-dot-grid-body') ||
      containerEl.closest('.card-body-tasks') ||
      containerEl;
    const indexNodes = Array.from(containerEl.querySelectorAll('.task-index'));
    const titleNodes = Array.from(
      containerEl.querySelectorAll('.task-title, .task-inline-input')
    );
    const rowNodes = Array.from(containerEl.querySelectorAll('.task-row'));

    const applyUnifiedSize = (sizePx, padY) => {
      const sizeStr = `${sizePx}px`;
      indexNodes.forEach((el) => {
        el.style.fontSize = sizeStr;
      });
      titleNodes.forEach((el) => {
        el.style.fontSize = sizeStr;
        if (el.classList.contains('task-inline-input')) {
          // Re-fit the text box height to this font size before measuring the card
          this.setTextareaHeightToLines(el);
        }
      });
      if (addItemEl) {
        addItemEl.style.fontSize = sizeStr;
      }
      rowNodes.forEach((row) => {
        row.style.paddingTop = `${padY}px`;
        row.style.paddingBottom = `${padY}px`;
        row.style.setProperty('--task-fs', sizeStr);
        row.style.setProperty('--row-pad-top', `${padY}px`);
      });
    };

    // Minimum readable size; below this the card scrolls instead of shrinking further
    const MIN_TASK_FONT_PX = 15;
    let unifiedSize = 24.0;
    let unifiedPadY = 9;
    applyUnifiedSize(unifiedSize, unifiedPadY);
    if (bodyEl) bodyEl.classList.remove('is-overflowing');

    // Only decrease the unified font size if the whole card page is actually filled
    if (bodyEl && bodyEl.clientHeight > 0) {
      while (bodyEl.scrollHeight > bodyEl.clientHeight + 2 && unifiedSize > MIN_TASK_FONT_PX) {
        unifiedSize = Math.max(MIN_TASK_FONT_PX, Number((unifiedSize - 0.5).toFixed(1)));
        unifiedPadY =
          unifiedSize < 17 ? 3 : unifiedSize < 19 ? 4 : unifiedSize < 21.5 ? 6 : unifiedSize < 23.0 ? 7 : 8;
        applyUnifiedSize(unifiedSize, unifiedPadY);
      }
      if (bodyEl.scrollHeight > bodyEl.clientHeight + 2) {
        bodyEl.classList.add('is-overflowing');
      }
    }

    // Re-render every multi-line graphite strikethrough canvas to match the unified layout rects
    rowNodes.forEach((row) => {
      const canvas = row.querySelector('.pencil-strike-canvas');
      const isDone = row.dataset.completed === 'true';
      if (canvas) {
        this.drawGraphiteStroke(canvas, 0.0, isDone ? 1.0 : 0.0);
      }
    });

    return unifiedSize;
  }

  /**
   * Limits Evening Reflection text to MAX_REFLECTION_WORDS and MAX_REFLECTION_CHARS
   * so the reflection stops once the minimum font size floor is reached, while
   * preserving multi-line formatting and multi-language / IME input.
   */
  clampReflectionInputText(rawText) {
    let text = String(rawText || '').replace(/\u2006/g, '');
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length > MAX_REFLECTION_WORDS) {
      text = words.slice(0, MAX_REFLECTION_WORDS).join(' ');
    }
    if (text.length > MAX_REFLECTION_CHARS) {
      text = text.slice(0, MAX_REFLECTION_CHARS);
    }
    return text;
  }

  /**
   * Keeps the Evening Reflection font size at a unified 21px unless the whole reflection
   * area is filled (`textareaEl.scrollHeight > textareaEl.clientHeight + 2`), then steps
   * down uniformly to a 13px minimum floor.
   */
  adjustReflectionTypography(textareaEl) {
    if (!textareaEl) return;
    const bodyEl = textareaEl.closest('.card-back-body');
    const isSinglePhoto =
      bodyEl && bodyEl.classList.contains('single-photo-layout');
    const textLen = (textareaEl.value || '').length;
    let targetSize = 21;
    textareaEl.style.overflowY = 'hidden';
    textareaEl.style.fontSize = `${targetSize}px`;

    if (isSinglePhoto && !textareaEl.classList.contains('empty-readonly')) {
      const maxTextH =
        bodyEl && bodyEl.clientHeight > 0
          ? Math.floor(bodyEl.clientHeight * 0.46)
          : 170;
      textareaEl.style.height = 'auto';
      while (textareaEl.scrollHeight > maxTextH && targetSize > 13) {
        targetSize = Math.max(13, targetSize - 1);
        textareaEl.style.fontSize = `${targetSize}px`;
        textareaEl.style.height = 'auto';
      }
      const finalH = Math.max(36, Math.min(maxTextH, textareaEl.scrollHeight + 4));
      textareaEl.style.height = `${finalH}px`;
      return;
    }

    textareaEl.style.height = '';
    if (textareaEl.clientHeight > 0) {
      while (textareaEl.scrollHeight > textareaEl.clientHeight + 2 && targetSize > 13) {
        targetSize = Math.max(13, targetSize - 1);
        textareaEl.style.fontSize = `${targetSize}px`;
      }
    } else if (textLen > 315) {
      targetSize = 13;
      textareaEl.style.fontSize = `${targetSize}px`;
    }
  }

  triggerPhotoAttachment(target = 'today', replaceIndex = null) {
    this._photoUploadTarget = target;
    this._photoReplaceIndex = typeof replaceIndex === 'number' ? replaceIndex : null;
    if (this.els.journalPhotoFileInput) {
      this.els.journalPhotoFileInput.click();
    }
  }

  compressImageFileToDataURL(file, maxDimension = 1600) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('File read error'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image decode error'));
        img.onload = () => {
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (w > maxDimension || h > maxDimension) {
            if (w >= h) {
              h = Math.round((h * maxDimension) / w);
              w = maxDimension;
            } else {
              w = Math.round((w * maxDimension) / h);
              h = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Bidirectional finger motion to flip BOTH Today's Card (`#daily-card-3d`) and
   * the Stack Card (`#stack-card-3d`) over both ways:
   * - Swiping Right -> Left (dx < -22px) flips the card leftwards (-180°).
   * - Swiping Left -> Right (dx > +22px) flips the card rightwards (+180°).
   * Uses `window`-level pointermove/pointerup/pointercancel listeners so the card
   * NEVER gets stuck mid-rotation even if the pointer leaves the narrowing 3D card!
   */
  bindCardSurfaceFlipGesture() {
    this.bindTwoWayCardFlipOnWrapper(this.els.card3DWrapper, false);
    this.bindTwoWayCardFlipOnWrapper(this.els.stackCard3D, true);
  }

  /** Ignore the next click anywhere (within `ms`), e.g. the click that trails a tap which already acted. */
  swallowNextClick(ms = 500) {
    const blocker = (e) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
    };
    const cleanup = () => {
      document.removeEventListener('click', blocker, true);
      clearTimeout(timer);
    };
    document.addEventListener('click', blocker, true);
    const timer = setTimeout(cleanup, ms);
  }

  /** True when the pointer is on a text field the user is currently typing in (keeps IME / handwriting safe). */
  isActivelyTypingIn(target) {
    const field = target && target.closest ? target.closest('textarea, input') : null;
    return Boolean(field && !field.readOnly && document.activeElement === field);
  }

  bindTwoWayCardFlipOnWrapper(wrapper, isStackCard = false) {
    if (!wrapper) return;

    let startX = null;
    let startY = null;
    let activePointerId = null;
    let isDraggingFlip = false;
    let lastX = null;
    let lastY = null;
    let startTime = 0;

    const getBaseDeg = () => (isStackCard ? this._stackFlipDeg : this._todayFlipDeg);
    const getIsFlipped = () =>
      isStackCard ? this.state.isStackCardFlipped : this.state.isCardFlipped;

    wrapper.addEventListener('pointerdown', (e) => {
      if (
        e.target.closest('.task-tomato-btn') ||
        e.target.closest('.journal-photo-remove-btn') ||
        e.target.closest('.journal-photo-add-second-pill') ||
        e.target.closest('.stack-card-edit-btn') ||
        e.target.closest('.task-inline-input') ||
        e.target.closest('.task-inline-edit-wrap') ||
        e.target.closest('.task-inline-delete-btn') ||
        e.target.closest('.card-face-flip-btn') ||
        this.isActivelyTypingIn(e.target) ||
        wrapper.querySelector('.task-inline-input')
      ) {
        return;
      }
      // Past cards: a swipe that starts on the card's left/right edge scrolls the stack, never flips
      if (isStackCard && this.isInStackCardEdgeZone(e)) {
        return;
      }
      // Past cards: touching a card that is still gliding into place catches it (no flip)
      if (isStackCard && this._stackFilm) {
        return;
      }
      const pt = this.getPointerXY(e);
      startX = pt.x;
      startY = pt.y;
      lastX = pt.x;
      lastY = pt.y;
      startTime = performance.now();
      activePointerId = e.pointerId;
      isDraggingFlip = false;
    });

    const onWindowPointerMove = (e) => {
      if (startX === null || startY === null) return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;

      const pt = this.getPointerXY(e);
      const dx = pt.x - startX;
      const dy = pt.y - startY;
      lastX = pt.x;
      lastY = pt.y;

      if (!isDraggingFlip && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 0.9) {
        isDraggingFlip = true;
        const activeEl = document.activeElement;
        if (
          activeEl &&
          activeEl.blur &&
          activeEl.tagName !== 'TEXTAREA' &&
          activeEl.tagName !== 'INPUT'
        ) {
          activeEl.blur();
        }
      }

      if (isDraggingFlip) {
        if (e.cancelable) e.preventDefault();
        const tiltOffset = Math.max(-65, Math.min(65, (dx / 180) * 65));
        const liveDeg = getBaseDeg() + tiltOffset;
        wrapper.style.transition = 'none';
        wrapper.style.transform = `rotateY(${liveDeg.toFixed(1)}deg)`;
      }
    };

    const endCardSwipe = (e) => {
      if (startX === null || startY === null) return;
      if (
        activePointerId !== null &&
        e.pointerId !== undefined &&
        e.pointerId !== activePointerId
      ) {
        return;
      }

      // pointercancel (browser took over the touch) reports unreliable coords: use the last move
      const pt =
        e.type === 'pointercancel' || e.clientX === undefined
          ? { x: lastX !== null ? lastX : startX, y: lastY !== null ? lastY : startY }
          : this.getPointerXY(e);
      const dx = pt.x - startX;
      const dy = pt.y - startY;
      const elapsed = Math.max(1, performance.now() - startTime);
      const isFlick = Math.abs(dx) >= 10 && Math.abs(dx) / elapsed > 0.35;
      startX = null;
      startY = null;
      activePointerId = null;

      const wasDragging = isDraggingFlip;
      isDraggingFlip = false;
      wrapper.style.transition = '';
      wrapper.style.transform = '';

      if (wasDragging) {
        this._justFinishedCardSwipe = true;
        clearTimeout(this._swipeGuardTimer);
        this._swipeGuardTimer = setTimeout(() => {
          this._justFinishedCardSwipe = false;
        }, 220);
      }

      const classification = CardGestureMath.classifyGesture(dx, dy, false);
      if (
        classification === 'flipCard' ||
        ((Math.abs(dx) >= 16 || isFlick) && Math.abs(dx) > Math.abs(dy) * 0.9)
      ) {
        const dir = dx >= 0 ? 1 : -1;
        if (isStackCard) {
          this.triggerStackCardFlip(dir);
        } else {
          this.triggerCardFlip(dir);
        }
      } else {
        this.applyCard3DRotation(wrapper, getIsFlipped(), getBaseDeg());
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', endCardSwipe);
    window.addEventListener('pointercancel', endCardSwipe);
  }

  /** True when the pointer is within the left/right edge band of the past (stack) card. */
  isInStackCardEdgeZone(e) {
    const cardEl = this.els.stackCard3D;
    if (!cardEl || !e || e.clientX === undefined) return false;
    const r = cardEl.getBoundingClientRect();
    if (r.width <= 0) return false;
    const band = Math.max(28, r.width * 0.1);
    return e.clientX - r.left < band || r.right - e.clientX < band;
  }

  applyCard3DRotation(wrapperEl, isFlipped, degValue) {
    if (!wrapperEl) return;
    wrapperEl.classList.toggle('is-flipped', Boolean(isFlipped));
    wrapperEl.style.setProperty('--card-flip-deg', `${degValue}deg`);
    wrapperEl.style.setProperty('--card-front-deg', `${degValue}deg`);
  }

  triggerCardFlip(direction = -1) {
    const step = direction >= 0 ? 180 : -180;
    this._todayFlipDeg += step;
    this.state.isCardFlipped = !this.state.isCardFlipped;
    this.sensory.playCardFlipSwoosh();
    this.saveState();
    this.applyCard3DRotation(
      this.els.card3DWrapper,
      this.state.isCardFlipped,
      this._todayFlipDeg
    );
    if (this.els.demoBtnCard) {
      this.els.demoBtnCard.classList.toggle(
        'active-pill',
        this.state.activePillar === 'card' && !this.state.isCardFlipped
      );
    }
    if (this.els.demoBtnBack) {
      this.els.demoBtnBack.classList.toggle(
        'active-pill',
        this.state.activePillar === 'card' && Boolean(this.state.isCardFlipped)
      );
    }
    if (this.state.isCardFlipped && this.els.cardBackReflection) {
      this.adjustReflectionTypography(this.els.cardBackReflection);
    }
    this.redrawStrikesAfterFlip(this.els.card3DWrapper, this.els.taskListContainer);
    this.checkFirstTimePageHint();
  }

  /**
   * Pencil strikethroughs are positioned from the on-screen text, which is squashed/mirrored
   * while the card is mid-rotation. Redraw them once the flip animation has finished.
   */
  redrawStrikesAfterFlip(wrapperEl, containerEl) {
    if (!wrapperEl || !containerEl) return;
    const redraw = () => {
      if (wrapperEl.classList.contains('is-flipped')) return;
      containerEl.querySelectorAll('.task-row').forEach((row) => {
        const canvas = row.querySelector('.pencil-strike-canvas');
        if (canvas) {
          this.drawGraphiteStroke(canvas, 0.0, row.dataset.completed === 'true' ? 1.0 : 0.0);
        }
      });
    };
    if (!wrapperEl.classList.contains('is-flipped')) {
      redraw();
    }
    clearTimeout(wrapperEl._strikeRedrawTimer);
    if (wrapperEl._strikeRedrawOnEnd) {
      wrapperEl.removeEventListener('transitionend', wrapperEl._strikeRedrawOnEnd);
      wrapperEl._strikeRedrawOnEnd = null;
    }
    const onEnd = (e) => {
      if (e.target !== wrapperEl || e.propertyName !== 'transform') return;
      wrapperEl.removeEventListener('transitionend', onEnd);
      wrapperEl._strikeRedrawOnEnd = null;
      clearTimeout(wrapperEl._strikeRedrawTimer);
      redraw();
    };
    wrapperEl._strikeRedrawOnEnd = onEnd;
    wrapperEl.addEventListener('transitionend', onEnd);
    // Fallback in case transitionend doesn't fire (e.g. reduced motion / interrupted flip)
    wrapperEl._strikeRedrawTimer = setTimeout(() => {
      wrapperEl.removeEventListener('transitionend', onEnd);
      wrapperEl._strikeRedrawOnEnd = null;
      redraw();
    }, 650);
  }

  triggerStackCardFlip(direction = -1) {
    const step = direction >= 0 ? 180 : -180;
    this._stackFlipDeg += step;
    this.state.isStackCardFlipped = !this.state.isStackCardFlipped;
    this.sensory.playCardFlipSwoosh();
    this.saveState();
    this.applyCard3DRotation(
      this.els.stackCard3D,
      this.state.isStackCardFlipped,
      this._stackFlipDeg
    );
    if (this.state.isStackCardFlipped && this.els.stackCardBackReflection) {
      this.adjustReflectionTypography(this.els.stackCardBackReflection);
    }
    this.redrawStrikesAfterFlip(this.els.stackCard3D, this.els.stackTaskListContainer);
    this.checkFirstTimePageHint();
  }

  // =========================================================================
  // CHRONOLOGICAL CARD STACK VIEWER & CALENDAR ZOOM-OUT (Mockups 06 & 07)
  // =========================================================================

  getSortedArchiveKeys() {
    return Object.keys(this.state.archiveCards || {}).sort();
  }

  formatDateMetadataForKey(dateKey) {
    const fallbackKey = this.getCurrentLogicalDateString(
      this.state && typeof this.state.dailyResetHour === 'number'
        ? this.state.dailyResetHour
        : 5
    );
    const raw = typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : fallbackKey;
    const parts = raw.split('-');
    const y = parseInt(parts[0], 10) || 2026;
    const m = parseInt(parts[1], 10) || 10;
    const d = parseInt(parts[2], 10) || 5;
    const dPadded = String(d).padStart(2, '0');
    const mPadded = String(m).padStart(2, '0');
    const shortMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const weekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dt = new Date(y, m - 1, d);
    const weekday = weekdays[dt.getDay()] || 'MONDAY';
    const shortMonth = shortMonths[(m - 1 + 12) % 12] || 'OCT';
    return {
      dateKey: `${y}-${mPadded}-${dPadded}`,
      monthKey: `${y}-${mPadded}`,
      dayNum: d,
      shortMonth,
      headerDate: `${weekday} — ${shortMonth} ${dPadded}`,
      shortDate: `${dPadded} ${shortMonth}`,
    };
  }

  createRetrospectiveCardForDate(dateKey) {
    const meta = this.formatDateMetadataForKey(dateKey || this.state.selectedStackDateKey);
    if (!this.state.archiveCards) {
      this.state.archiveCards = {};
    }
    if (!this.state.archiveCards[meta.dateKey]) {
      this.state.archiveCards[meta.dateKey] = {
        dateKey: meta.dateKey,
        headerDate: meta.headerDate,
        shortDate: meta.shortDate,
        monthKey: meta.monthKey,
        dayNum: meta.dayNum,
        tasks: [],
        reflectionText: '',
        reflectionPhotos: [],
      };
    }
    this.state.selectedStackDateKey = meta.dateKey;
    this.state.activePillar = 'stack';
    this.state.isStackCardFlipped = false;
    this.state.isStackEditMode = true;
    this._stackFlipDeg = 0;
    this.sensory.playCardFlipSwoosh();
    this.saveState();
    this.renderAll();
    this.showTelemetryToast(
      this.t('Card added for {date}', {
        date: `${meta.shortMonth} ${String(meta.dayNum).padStart(2, '0')}`,
      })
    );
  }

  toggleStackEditMode() {
    this.state.isStackEditMode = !this.state.isStackEditMode;
    this.sensory.playMechanicalTick();
    this.saveState();
    this.renderStackScreen();
  }

  openPhotoLightbox(photoSrc) {
    if (!photoSrc || !this.els.photoLightboxOverlay || !this.els.photoLightboxImg) return;
    this.els.photoLightboxImg.src = photoSrc;
    this.els.photoLightboxOverlay.classList.remove('hidden');
  }

  closePhotoLightbox() {
    if (!this.els.photoLightboxOverlay) return;
    this.els.photoLightboxOverlay.classList.add('hidden');
    if (this.els.photoLightboxImg) {
      this.els.photoLightboxImg.src = '';
    }
  }

  getSelectedStackCard() {
    const keys = this.getSortedArchiveKeys();
    const curKey = this.state.selectedStackDateKey;
    if (curKey && this.state.archiveCards && this.state.archiveCards[curKey]) {
      return this.state.archiveCards[curKey];
    }
    // If curKey is a valid past date explicitly selected (e.g. from Calendar or Date Strip),
    // preserve selectedStackDateKey and return null so the retrospective "+ Add Card" slot renders!
    const todayKey =
      this.state.cardDateKey || this.getCurrentLogicalDateString(this.state.dailyResetHour);
    if (curKey && /^\d{4}-\d{2}-\d{2}$/.test(curKey) && curKey < todayKey) {
      return null;
    }
    if (keys.length > 0) {
      this.state.selectedStackDateKey = keys[keys.length - 1];
      return this.state.archiveCards[this.state.selectedStackDateKey] || null;
    }
    this.state.selectedStackDateKey = this.getOffsetDateKey(todayKey, -1);
    return null;
  }

  _spawnOutgoingStackCardClone(direction = 1, initialOffsetPx = 0) {
    if (!this.els.stackCarouselStage) return;
    const centerPerspective = this.els.stackCarouselStage.querySelector(
      '.stack-center-perspective'
    );
    if (!centerPerspective) return;

    // Remove any existing outgoing clones first
    this.els.stackCarouselStage
      .querySelectorAll('.stack-outgoing-card-clone')
      .forEach((el) => el.remove());

    const clone = centerPerspective.cloneNode(true);
    clone.classList.remove(
      'stack-center-perspective',
      'anim-slide-next',
      'anim-slide-prev',
      'anim-bounce-next',
      'anim-bounce-prev'
    );
    clone.classList.add('stack-outgoing-card-clone');
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));

    // Copy canvas bitmaps (pencil strikethroughs) onto the cloned card
    const origCanvases = centerPerspective.querySelectorAll('canvas');
    const cloneCanvases = clone.querySelectorAll('canvas');
    origCanvases.forEach((origC, idx) => {
      const destC = cloneCanvases[idx];
      if (destC && origC.width > 0 && origC.height > 0) {
        destC.width = origC.width;
        destC.height = origC.height;
        const dCtx = destC.getContext('2d');
        if (dCtx) dCtx.drawImage(origC, 0, 0);
      }
    });

    clone.style.transition = 'none';
    clone.style.transform = `translateX(${initialOffsetPx.toFixed(1)}px) scale(1)`;
    clone.style.opacity = '1';
    this.els.stackCarouselStage.appendChild(clone);

    // Force reflow, then glide outgoing clone smoothly off-screen in the scroll direction
    void clone.offsetWidth;
    const exitX = direction >= 0 ? '-106%' : '106%';
    clone.style.transition =
      'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.34s cubic-bezier(0.22, 1, 0.36, 1)';
    clone.style.transform = `translateX(${exitX}) scale(0.92)`;
    clone.style.opacity = '0';

    setTimeout(() => {
      if (clone.parentNode) clone.remove();
    }, 390);
  }

  animateStackCardScroll(direction = 1) {
    if (!this.els.stackCarouselStage) return;
    const centerPerspective = this.els.stackCarouselStage.querySelector(
      '.stack-center-perspective'
    );
    if (!centerPerspective) return;

    clearTimeout(this._stackSlideCleanupTimer);
    centerPerspective.style.transition = '';
    centerPerspective.style.transform = '';
    centerPerspective.classList.remove(
      'anim-slide-next',
      'anim-slide-prev',
      'anim-bounce-next',
      'anim-bounce-prev'
    );
    // Force reflow so rapid consecutive scrolls re-trigger the sliding motion
    void centerPerspective.offsetWidth;
    centerPerspective.classList.add(
      direction >= 0 ? 'anim-slide-next' : 'anim-slide-prev'
    );
    this._stackSlideCleanupTimer = setTimeout(() => {
      centerPerspective.classList.remove('anim-slide-next', 'anim-slide-prev');
    }, 370);

    if (!this._isDraggingDateStrip) {
      this.centerActiveDatePill(true);
    }
  }

  // =========================================================================
  // STACK FILMSTRIP: past cards move under the finger 1:1 (direct manipulation)
  // The real card element (R) renders one date at a time; when a second date becomes
  // visible, R is snapshotted into a static clone and re-rendered as the neighbour.
  // Position is a continuous card index `c`; card j sits at x = (j - c) * width.
  // =========================================================================

  _beginStackFilmstrip() {
    if (this._stackFilm) return this._stackFilm;
    const stage = this.els.stackCarouselStage;
    const real = stage && stage.querySelector('.stack-center-perspective');
    if (!stage || !real || this.state.activePillar !== 'stack' || this._isZoomTransitioning) {
      return null;
    }
    const keys = this.getNavigableStackDateKeys();
    if (keys.length === 0) return null;
    let idx = keys.indexOf(this.state.selectedStackDateKey);
    if (idx < 0) idx = keys.length - 1;

    // Clear any button/peek slide animation still running
    stage.querySelectorAll('.stack-outgoing-card-clone').forEach((el) => el.remove());
    clearTimeout(this._stackSlideCleanupTimer);
    real.classList.remove('anim-slide-next', 'anim-slide-prev', 'anim-bounce-next', 'anim-bounce-prev');

    const film = {
      stage,
      real,
      keys,
      w: real.offsetWidth + 16,
      c: idx,
      rIdx: idx,
      clones: new Map(),
      origIdx: idx,
      origKey: keys[idx],
      origFlipped: Boolean(this.state.isStackCardFlipped),
      origFlipDeg: this._stackFlipDeg,
      origEdit: Boolean(this.state.isStackEditMode),
      downIdx: idx,
      settling: false,
      target: idx,
      raf: null,
      fromWheel: false,
      lastWheelT: 0,
      wheelRaw: null,
      wheelSamples: [],
      wheelTimer: null,
    };
    this._stackFilm = film;
    real.style.transition = 'none';
    stage.classList.add('is-filmstrip');
    return film;
  }

  /** iOS-style resistance past the first / last card (c in card units). */
  _stackFilmRubberBand(film, c) {
    const max = film.keys.length - 1;
    if (c < 0) return -(1 - 1 / (-c * 0.55 + 1));
    if (c > max) return max + (1 - 1 / ((c - max) * 0.55 + 1));
    return c;
  }

  _snapshotStackFilmCard(film) {
    const src = film.real;
    const clone = src.cloneNode(true);
    clone.classList.remove(
      'stack-center-perspective',
      'anim-slide-next',
      'anim-slide-prev',
      'anim-bounce-next',
      'anim-bounce-prev'
    );
    clone.classList.add('stack-filmstrip-clone');
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((node) => {
      node.dataset.cloneId = node.id;
      node.removeAttribute('id');
    });
    // Keep the pencil strikethroughs (canvas bitmaps aren't copied by cloneNode)
    const srcCanvases = src.querySelectorAll('canvas');
    const dstCanvases = clone.querySelectorAll('canvas');
    srcCanvases.forEach((c, i) => {
      const d = dstCanvases[i];
      if (d && c.width > 0 && c.height > 0) {
        d.width = c.width;
        d.height = c.height;
        const ctx = d.getContext('2d');
        if (ctx) ctx.drawImage(c, 0, 0);
      }
    });
    clone.style.cssText = '';
    clone.style.left = `${src.offsetLeft}px`;
    clone.style.top = `${src.offsetTop}px`;
    clone.style.width = `${src.offsetWidth}px`;
    clone.style.height = `${src.offsetHeight}px`;
    film.stage.appendChild(clone);
    return clone;
  }

  _renderStackFilmIndex(film, j) {
    this.state.selectedStackDateKey = film.keys[j];
    if (j === film.origIdx) {
      this.state.isStackCardFlipped = film.origFlipped;
      this._stackFlipDeg = film.origFlipDeg;
      this.state.isStackEditMode = film.origEdit;
    } else {
      this.state.isStackCardFlipped = false;
      this._stackFlipDeg = 0;
      this.state.isStackEditMode = false;
    }
    film.rIdx = j;
    this.renderStackScreen();
  }

  _layoutStackFilmstrip() {
    const film = this._stackFilm;
    if (!film) return;
    const max = film.keys.length - 1;
    const needed = [];
    [Math.floor(film.c), Math.ceil(film.c)].forEach((j) => {
      if (j >= 0 && j <= max && Math.abs(j - film.c) < 1 && !needed.includes(j)) needed.push(j);
    });
    // Every card that is (even partly) on screen needs a layer showing it
    needed.forEach((j) => {
      if (j === film.rIdx || film.clones.has(j)) return;
      if (needed.includes(film.rIdx) && !film.clones.has(film.rIdx)) {
        film.clones.set(film.rIdx, this._snapshotStackFilmCard(film));
      }
      this._renderStackFilmIndex(film, j);
    });
    film.clones.forEach((el, j) => {
      if (Math.abs(j - film.c) >= 1.5) {
        el.remove();
        film.clones.delete(j);
      }
    });
    const xOf = (j) => ((j - film.c) * film.w).toFixed(2);
    film.real.style.transform = `translate3d(${xOf(film.rIdx)}px, 0, 0)`;
    film.clones.forEach((el, j) => {
      el.style.transform = `translate3d(${xOf(j)}px, 0, 0)`;
    });
  }

  /**
   * Glide to card `target`, starting at exactly the finger's release speed (vC, cards per ms)
   * and easing to a stop on the card, so the motion is a seamless continuation of the gesture
   * (a cubic Hermite curve: matches position + velocity at release, zero velocity on arrival).
   */
  _settleStackFilmstrip(target, vC = 0) {
    const film = this._stackFilm;
    if (!film) return;
    cancelAnimationFrame(film.raf);
    film.settling = true;
    film.target = target;
    film.wheelRaw = null;
    if (target !== film.downIdx) this.sensory.playStackRiffleTick();
    const x0 = film.c - target; // cards from the target
    const v0 = vC; // cards per ms
    const dist = Math.abs(x0);
    const towards = v0 * -x0 > 0;
    let T;
    if (dist < 0.001) {
      T = 1;
    } else if (towards) {
      // Constant-deceleration time for this speed, kept within a natural range
      T = Math.max(220, Math.min(420, (2 * dist) / Math.abs(v0)));
      if ((Math.abs(v0) * T) / dist > 3) T = (3 * dist) / Math.abs(v0); // no overshoot
    } else {
      T = 360;
    }
    const t0 = performance.now();
    const step = (now) => {
      if (this._stackFilm !== film || !film.settling) return;
      const s = Math.min(1, (now - t0) / T);
      const h00 = 2 * s * s * s - 3 * s * s + 1;
      const h10 = s * s * s - 2 * s * s + s;
      film.c = target + h00 * x0 + h10 * T * v0;
      this._layoutStackFilmstrip();
      if (s >= 1) {
        film.c = target;
        this._finishStackFilmstrip();
        return;
      }
      film.raf = requestAnimationFrame(step);
    };
    film.raf = requestAnimationFrame(step);
  }

  /** Lands on the settle target (or nearest card), removes snapshots and commits the date. */
  _finishStackFilmstrip() {
    const film = this._stackFilm;
    if (!film) return;
    cancelAnimationFrame(film.raf);
    clearTimeout(film.wheelTimer);
    const max = film.keys.length - 1;
    const target = film.settling
      ? film.target
      : Math.max(0, Math.min(max, Math.round(film.c)));
    if (film.rIdx !== target) this._renderStackFilmIndex(film, target);
    film.clones.forEach((el) => el.remove());
    film.clones.clear();
    film.real.style.transform = '';
    void film.real.offsetWidth;
    film.real.style.transition = '';
    film.stage.classList.remove('is-filmstrip');
    this._stackFilm = null;
    this._stackStripSmoothOnce = true;
    this.saveState();
    this.renderAll();
  }

  /** Trackpad two-finger horizontal swipe: same 1:1 filmstrip, one card per gesture. */
  _onStackFilmstripWheel(deltaX) {
    const now = performance.now();
    let film = this._stackFilm;
    if (film && film.settling) {
      // Ignore the momentum tail of the swipe that just settled
      if (film.fromWheel && now - film.lastWheelT < 180) {
        film.lastWheelT = now;
        return;
      }
      cancelAnimationFrame(film.raf);
      film.raf = null;
      film.settling = false;
      film.downIdx = Math.round(film.c);
      film.wheelRaw = null;
    }
    if (!film) {
      film = this._beginStackFilmstrip();
      if (!film) return;
      film.downIdx = film.rIdx;
    }
    film.fromWheel = true;
    film.lastWheelT = now;
    film.wheelSamples = film.wheelSamples.filter((s) => now - s.t < 100);
    film.wheelSamples.push({ t: now, d: deltaX });
    const raw = (film.wheelRaw === null ? film.c : film.wheelRaw) + deltaX / film.w;
    film.wheelRaw = Math.max(film.downIdx - 1, Math.min(film.downIdx + 1, raw));
    film.c = this._stackFilmRubberBand(film, film.wheelRaw);
    this._layoutStackFilmstrip();

    clearTimeout(film.wheelTimer);
    film.wheelTimer = setTimeout(() => {
      if (this._stackFilm !== film || film.settling) return;
      const recent = film.wheelSamples.filter((s) => film.lastWheelT - s.t < 100);
      const span = recent.length > 1 ? Math.max(16, recent[recent.length - 1].t - recent[0].t) : 16;
      const vPx = recent.reduce((sum, s) => sum + s.d, 0) / span; // px per ms, + = towards later cards
      const vC = vPx / film.w;
      let target;
      if (Math.abs(vPx) > 0.3) {
        target = vC > 0 ? Math.floor(film.c + 0.02) + 1 : Math.ceil(film.c - 0.02) - 1;
      } else {
        target = Math.round(film.c);
      }
      target = Math.max(film.downIdx - 1, Math.min(film.downIdx + 1, target));
      target = Math.max(0, Math.min(film.keys.length - 1, target));
      this._settleStackFilmstrip(target, vC);
    }, 90);
  }

  centerActiveDatePill(smooth = true) {
    if (!this.els.stackDateStrip) return;
    const pillsTrack = this.els.stackDateStrip.querySelector('.stack-date-pills-track');
    const activePill = pillsTrack && pillsTrack.querySelector('.stack-date-pill.active');
    if (!pillsTrack || !activePill) return;
    const targetLeft = Math.max(
      0,
      activePill.offsetLeft - pillsTrack.clientWidth / 2 + activePill.offsetWidth / 2
    );
    if (typeof pillsTrack.scrollTo === 'function') {
      pillsTrack.scrollTo({ left: targetLeft, behavior: smooth ? 'smooth' : 'auto' });
    } else {
      pillsTrack.scrollLeft = targetLeft;
    }
  }

  animateStackBoundaryBounce(direction = 1) {
    if (!this.els.stackCarouselStage) return;
    const centerPerspective = this.els.stackCarouselStage.querySelector(
      '.stack-center-perspective'
    );
    if (!centerPerspective) return;

    clearTimeout(this._stackSlideCleanupTimer);
    centerPerspective.classList.remove(
      'anim-slide-next',
      'anim-slide-prev',
      'anim-bounce-next',
      'anim-bounce-prev'
    );
    void centerPerspective.offsetWidth;
    centerPerspective.classList.add(
      direction >= 0 ? 'anim-bounce-next' : 'anim-bounce-prev'
    );
    this._stackSlideCleanupTimer = setTimeout(() => {
      centerPerspective.classList.remove('anim-bounce-next', 'anim-bounce-prev');
    }, 280);
  }

  zoomOutStackToCalendar() {
    if (this._isZoomTransitioning) return;
    if (this._stackFilm) this._finishStackFilmstrip();
    const stackEl = this.els.stackScreen;
    const calEl = this.els.calendarScreen;
    const centerPerspective =
      this.els.stackCarouselStage &&
      this.els.stackCarouselStage.querySelector('.stack-center-perspective');

    if (!stackEl || !calEl || !centerPerspective || this.state.activePillar !== 'stack') {
      this.state.activePillar = 'calendar';
      this.saveState();
      this.renderAll();
      return;
    }

    this._isZoomTransitioning = true;
    this.renderCalendarScreen();
    calEl.classList.remove('hidden');
    stackEl.classList.remove('hidden');
    stackEl.classList.add('is-zoom-transitioning');

    calEl.style.transition = 'none';
    calEl.style.opacity = '0';
    calEl.style.transform = 'scale(0.95)';

    centerPerspective.classList.remove(
      'anim-slide-next',
      'anim-slide-prev',
      'anim-bounce-next',
      'anim-bounce-prev'
    );
    centerPerspective.style.transition = 'none';
    centerPerspective.style.transform = 'scale(1)';
    centerPerspective.style.opacity = '1';

    void stackEl.offsetWidth;

    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
    centerPerspective.style.transition = `transform 0.36s ${ease}, opacity 0.32s ${ease}`;
    centerPerspective.style.transform = 'scale(0.24)';
    centerPerspective.style.opacity = '0';

    if (this.els.stackDateStrip) {
      this.els.stackDateStrip.style.transition = `opacity 0.24s ${ease}`;
      this.els.stackDateStrip.style.opacity = '0';
    }
    if (this.els.stackPeekLeft) this.els.stackPeekLeft.style.opacity = '0';
    if (this.els.stackPeekRight) this.els.stackPeekRight.style.opacity = '0';

    calEl.style.transition = `transform 0.36s ${ease}, opacity 0.34s ${ease}`;
    calEl.style.opacity = '1';
    calEl.style.transform = 'scale(1)';

    setTimeout(() => {
      this._isZoomTransitioning = false;
      stackEl.classList.remove('is-zoom-transitioning');
      centerPerspective.style.transition = '';
      centerPerspective.style.transform = '';
      centerPerspective.style.opacity = '';
      if (this.els.stackDateStrip) {
        this.els.stackDateStrip.style.transition = '';
        this.els.stackDateStrip.style.opacity = '';
      }
      if (this.els.stackPeekLeft) this.els.stackPeekLeft.style.opacity = '';
      if (this.els.stackPeekRight) this.els.stackPeekRight.style.opacity = '';
      calEl.style.transition = '';
      calEl.style.opacity = '';
      calEl.style.transform = '';

      this.state.activePillar = 'calendar';
      this.saveState();
      this.renderAll();
    }, 370);
  }

  zoomInCalendarToStack(dateKey = null) {
    if (this._isZoomTransitioning) return;
    if (dateKey) {
      this.state.selectedStackDateKey = dateKey;
    }
    this.state.isStackCardFlipped = false;
    this._stackFlipDeg = 0;

    const stackEl = this.els.stackScreen;
    const calEl = this.els.calendarScreen;
    const centerPerspective =
      this.els.stackCarouselStage &&
      this.els.stackCarouselStage.querySelector('.stack-center-perspective');

    const wasOnCalendar = this.state.activePillar === 'calendar';
    this.state.activePillar = 'stack';
    this.saveState();
    this.renderAll();

    if (!wasOnCalendar || !stackEl || !calEl || !centerPerspective) {
      return;
    }

    this._isZoomTransitioning = true;
    calEl.classList.remove('hidden');
    stackEl.classList.remove('hidden');
    stackEl.classList.add('is-zoom-transitioning');

    centerPerspective.classList.remove(
      'anim-slide-next',
      'anim-slide-prev',
      'anim-bounce-next',
      'anim-bounce-prev'
    );
    centerPerspective.style.transition = 'none';
    centerPerspective.style.transform = 'scale(0.28)';
    centerPerspective.style.opacity = '0';

    calEl.style.transition = 'none';
    calEl.style.opacity = '1';
    calEl.style.transform = 'scale(1)';

    void stackEl.offsetWidth;

    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
    centerPerspective.style.transition = `transform 0.36s ${ease}, opacity 0.32s ${ease}`;
    centerPerspective.style.transform = 'scale(1)';
    centerPerspective.style.opacity = '1';

    calEl.style.transition = `transform 0.36s ${ease}, opacity 0.32s ${ease}`;
    calEl.style.opacity = '0';
    calEl.style.transform = 'scale(0.95)';

    setTimeout(() => {
      this._isZoomTransitioning = false;
      stackEl.classList.remove('is-zoom-transitioning');
      centerPerspective.style.transition = '';
      centerPerspective.style.transform = '';
      centerPerspective.style.opacity = '';
      calEl.style.transition = '';
      calEl.style.opacity = '';
      calEl.style.transform = '';
      this.renderAll();
    }, 370);
  }

  selectStackDate(dateKey, explicitDirection = null, initialOffsetPx = 0, options = {}) {
    if (this._stackFilm) this._finishStackFilmstrip();
    if (dateKey === this.state.cardDateKey) {
      if (options && options.stayOnStack) return;
      this.sensory.playStackRiffleTick();
      this.state.activePillar = 'card';
      this.state.isCardFlipped = false;
      this._todayFlipDeg = 0;
      this.saveState();
      this.renderAll();
      return;
    }
    const todayKey =
      this.state.cardDateKey || this.getCurrentLogicalDateString(this.state.dailyResetHour);
    if (!this.state.archiveCards[dateKey] && dateKey > todayKey) return;
    if (this.state.selectedStackDateKey === dateKey && this.state.activePillar === 'stack') {
      return;
    }
    const prevKey = this.state.selectedStackDateKey || '';
    const dir =
      explicitDirection !== null
        ? explicitDirection
        : dateKey > prevKey
        ? 1
        : -1;
    const wasOnStack = this.state.activePillar === 'stack';

    if (wasOnStack) {
      this._spawnOutgoingStackCardClone(dir, initialOffsetPx);
    }

    this.state.selectedStackDateKey = dateKey;
    this.state.isStackCardFlipped = false;
    this.state.isStackEditMode = false;
    this._stackFlipDeg = 0;
    this.sensory.playStackRiffleTick();
    this.saveState();
    this.renderAll();

    if (wasOnStack) {
      this.animateStackCardScroll(dir);
    }
  }

  getStackStripDateKeys() {
    const todayKey =
      this.state.cardDateKey || this.getCurrentLogicalDateString(this.state.dailyResetHour);
    const keySet = new Set(this.getSortedArchiveKeys());
    // Include continuous 45-day history + current month + previous month so strip & stack scroll smoothly
    for (let i = -45; i <= 0; i++) {
      keySet.add(this.getOffsetDateKey(todayKey, i));
    }
    if (this.state.selectedStackDateKey && this.state.selectedStackDateKey <= todayKey) {
      keySet.add(this.state.selectedStackDateKey);
    }
    return Array.from(keySet).sort();
  }

  getNavigableStackDateKeys() {
    const todayKey =
      this.state.cardDateKey || this.getCurrentLogicalDateString(this.state.dailyResetHour);
    return this.getStackStripDateKeys().filter((k) => k < todayKey);
  }

  stepStackCard(direction, initialOffsetPx = 0) {
    const keys = this.getNavigableStackDateKeys();
    if (keys.length === 0) return;
    const currentKey =
      this.state.selectedStackDateKey || keys[keys.length - 1];
    let idx = keys.indexOf(currentKey);
    if (idx < 0) idx = keys.length - 1;
    const nextIdx = Math.max(0, Math.min(keys.length - 1, idx + direction));
    if (nextIdx !== idx) {
      this.selectStackDate(keys[nextIdx], direction, initialOffsetPx);
    } else {
      this.animateStackBoundaryBounce(direction);
    }
  }

  bindStackViewerEvents() {
    if (this.els.stackBtnReturn) {
      this.els.stackBtnReturn.addEventListener('click', () => {
        this.sensory.playCardFlipSwoosh();
        this.state.activePillar = 'card';
        this.saveState();
        this.renderAll();
      });
    }

    if (this.els.stackBtnZoomout) {
      this.els.stackBtnZoomout.addEventListener('click', () => {
        this.sensory.playMechanicalTick();
        this.zoomOutStackToCalendar();
      });
    }

    if (this.els.stackBtnFlip) {
      this.els.stackBtnFlip.addEventListener('click', () => {
        this.triggerStackCardFlip(-1);
      });
    }

    if (this.els.stackBtnTrash) {
      this.els.stackBtnTrash.addEventListener('click', () => {
        this.confirmPermanentDeleteArchivedCard();
      });
    }

    if (this.els.stackPeekLeft) {
      this.els.stackPeekLeft.addEventListener('click', () => {
        this.stepStackCard(-1);
      });
    }

    if (this.els.stackPeekRight) {
      this.els.stackPeekRight.addEventListener('click', () => {
        this.stepStackCard(1);
      });
    }

    if (this.els.stackAddItemRow) {
      this.els.stackAddItemRow.addEventListener('click', () => {
        if (this._justFinishedCardSwipe) return;
        this.startInlineAddTask(true, true);
      });
    }

    if (this.els.stackFrontEditBtn) {
      this.els.stackFrontEditBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleStackEditMode();
      });
    }

    if (this.els.stackBackEditBtn) {
      this.els.stackBackEditBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleStackEditMode();
      });
    }

    if (this.els.photoLightboxOverlay) {
      this.els.photoLightboxOverlay.addEventListener('click', () => {
        this.closePhotoLightbox();
      });
    }

    if (this.els.photoLightboxClose) {
      this.els.photoLightboxClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePhotoLightbox();
      });
    }

    if (this.els.stackCardBackReflection) {
      let stackReflectionComposing = false;
      const syncStackReflection = (isFromCompositionEnd = false) => {
        if (stackReflectionComposing && !isFromCompositionEnd) return;
        const card = this.getSelectedStackCard();
        if (!card) return;
        const clamped = this.clampReflectionInputText(this.els.stackCardBackReflection.value);
        if (this.els.stackCardBackReflection.value !== clamped) {
          this.els.stackCardBackReflection.value = clamped;
        }
        card.reflectionText = this.els.stackCardBackReflection.value;
        this.adjustReflectionTypography(this.els.stackCardBackReflection);
        this.saveState();
      };
      this.els.stackCardBackReflection.addEventListener('compositionstart', () => {
        stackReflectionComposing = true;
      });
      this.els.stackCardBackReflection.addEventListener('compositionend', () => {
        stackReflectionComposing = false;
        syncStackReflection(true);
      });
      this.els.stackCardBackReflection.addEventListener('input', (e) => {
        const card = this.getSelectedStackCard();
        if (stackReflectionComposing || e.isComposing) {
          if (card) card.reflectionText = this.els.stackCardBackReflection.value;
          return;
        }
        syncStackReflection(false);
      });
    }

    // 1. Natural-Direction Horizontal Scroll & Momentum on the Top Short Calendar Bar (#stack-date-strip)
    if (this.els.stackDateStrip) {
      let stripStartX = null;
      let stripStartScrollLeft = 0;
      let stripStartNavIdx = 0;
      let lastMoveX = 0;
      let lastMoveTime = 0;
      let velocityX = 0;
      let inertiaRaf = null;
      let tappedPill = null;

      const getPillsTrack = () =>
        this.els.stackDateStrip.querySelector('.stack-date-pills-track');

      const stepDateFromDragDelta = (dx) => {
        const navKeys = this.getNavigableStackDateKeys();
        if (navKeys.length === 0) return;
        // Natural direction: dragging right (dx > 0) pulls earlier dates from the left (-stepDelta)
        // Dragging left (dx < 0) pulls later dates from the right (+stepDelta)
        const stepDelta = Math.trunc(dx / 34);
        const targetIdx = Math.max(
          0,
          Math.min(navKeys.length - 1, stripStartNavIdx - stepDelta)
        );
        const targetKey = navKeys[targetIdx];
        if (targetKey && targetKey !== this.state.selectedStackDateKey) {
          const dir = targetKey > (this.state.selectedStackDateKey || '') ? 1 : -1;
          this.selectStackDate(targetKey, dir, 0, { stayOnStack: true });
        }
      };

      this.els.stackDateStrip.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.stack-month-label')) return;
        const track = getPillsTrack();
        if (!track) return;
        if (inertiaRaf) {
          cancelAnimationFrame(inertiaRaf);
          inertiaRaf = null;
        }
        const pt = this.getPointerXY(e);
        stripStartX = pt.x;
        lastMoveX = pt.x;
        lastMoveTime = performance.now();
        velocityX = 0;
        stripStartScrollLeft = track.scrollLeft;
        const navKeys = this.getNavigableStackDateKeys();
        const curIdx = navKeys.indexOf(this.state.selectedStackDateKey);
        stripStartNavIdx = curIdx >= 0 ? curIdx : Math.max(0, navKeys.length - 1);
        this._isDraggingDateStrip = false;
        tappedPill = e.target.closest('.stack-date-pill');
      });

      window.addEventListener(
        'pointermove',
        (e) => {
          if (stripStartX === null) return;
          const track = getPillsTrack();
          if (!track) return;
          const pt = this.getPointerXY(e);
          const dx = pt.x - stripStartX;
          const now = performance.now();
          const dt = Math.max(1, now - lastMoveTime);

          if (!this._isDraggingDateStrip && Math.abs(dx) > 6) {
            this._isDraggingDateStrip = true;
          }

          if (this._isDraggingDateStrip) {
            if (e.cancelable) e.preventDefault();
            velocityX = 0.7 * ((pt.x - lastMoveX) / dt) + 0.3 * velocityX;
            lastMoveX = pt.x;
            lastMoveTime = now;
            const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
            track.scrollLeft = Math.max(0, Math.min(maxScroll, stripStartScrollLeft - dx));
            stepDateFromDragDelta(dx);
          }
        },
        { passive: false }
      );

      const finishStripDrag = (e) => {
        if (stripStartX === null) return;
        const track = getPillsTrack();
        const pt = e && e.clientX !== undefined ? this.getPointerXY(e) : { x: lastMoveX };
        const totalDx = pt.x - stripStartX;
        const wasDragging = this._isDraggingDateStrip;
        stripStartX = null;

        if (!wasDragging || Math.abs(totalDx) <= 6) {
          this._isDraggingDateStrip = false;
          if (tappedPill && tappedPill.dataset.dateKey) {
            this.selectStackDate(tappedPill.dataset.dateKey);
          }
          tappedPill = null;
          return;
        }

        tappedPill = null;
        let accumDx = totalDx;
        if (track && Math.abs(velocityX) > 0.22) {
          let v = velocityX * 15;
          const stepInertia = () => {
            if (!track || Math.abs(v) < 0.7) {
              this._isDraggingDateStrip = false;
              this.centerActiveDatePill(true);
              inertiaRaf = null;
              return;
            }
            accumDx += v;
            const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
            track.scrollLeft = Math.max(0, Math.min(maxScroll, stripStartScrollLeft - accumDx));
            stepDateFromDragDelta(accumDx);
            v *= 0.9;
            inertiaRaf = requestAnimationFrame(stepInertia);
          };
          inertiaRaf = requestAnimationFrame(stepInertia);
        } else {
          this._isDraggingDateStrip = false;
          this.centerActiveDatePill(true);
        }
      };

      window.addEventListener('pointerup', finishStripDrag);
      window.addEventListener('pointercancel', finishStripDrag);
    }

    // 2. Direct-manipulation filmstrip: the past cards follow the finger 1:1 (the neighbouring card,
    //    with its content, slides in alongside), then settle with the finger's release velocity.
    if (this.els.stackCarouselStage) {
      let startX = null;
      let startY = null;
      let activePointerId = null;
      let isDraggingCarousel = false;
      let cAtDown = 0;
      let samples = [];

      this.els.stackCarouselStage.addEventListener('pointerdown', (e) => {
        // A card still gliding into place can be caught anywhere and dragged on from where it is
        const film = this._stackFilm;
        if (film && film.settling) {
          cancelAnimationFrame(film.raf);
          film.raf = null;
          film.settling = false;
          film.fromWheel = false;
          const pt = this.getPointerXY(e);
          startX = pt.x;
          startY = pt.y;
          activePointerId = e.pointerId;
          isDraggingCarousel = true;
          cAtDown = film.c;
          film.downIdx = Math.round(film.c);
          samples = [{ t: performance.now(), x: pt.x }];
          return;
        }
        if (
          e.target.closest('.stack-card-edit-btn') ||
          e.target.closest('.journal-photo-remove-btn') ||
          e.target.closest('.journal-photo-add-second-pill') ||
          e.target.closest('.stack-retro-empty-slot') ||
          e.target.closest('.task-inline-input') ||
          e.target.closest('.task-inline-edit-wrap') ||
          e.target.closest('.task-inline-delete-btn') ||
          (e.target.closest('#stack-card-3d') && !this.isInStackCardEdgeZone(e)) ||
          e.target.closest('textarea, input') ||
          this.els.stackCarouselStage.querySelector('.task-inline-input')
        ) {
          return;
        }
        // In Edit Mode, allow swiping on a task row to cross it out
        if (
          this.state.isStackEditMode &&
          e.target.closest('.task-row') &&
          !this.isInStackCardEdgeZone(e)
        ) {
          return;
        }
        const pt = this.getPointerXY(e);
        startX = pt.x;
        startY = pt.y;
        activePointerId = e.pointerId;
        isDraggingCarousel = false;
        samples = [{ t: performance.now(), x: pt.x }];
      });

      window.addEventListener(
        'pointermove',
        (e) => {
          if (startX === null || startY === null) return;
          if (activePointerId !== null && e.pointerId !== activePointerId) return;
          const pt = this.getPointerXY(e);
          const dx = pt.x - startX;
          const dy = pt.y - startY;

          if (!isDraggingCarousel) {
            if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy) * 1.1) {
              const film = this._beginStackFilmstrip();
              if (!film) {
                startX = null;
                startY = null;
                return;
              }
              isDraggingCarousel = true;
              cAtDown = film.c;
              film.downIdx = Math.round(film.c);
              // Swallow only the 7px touch slop, then the card follows the finger exactly
              startX += Math.sign(dx) * 7;
              startY = pt.y;
              samples = [{ t: performance.now(), x: pt.x }];
              const activeEl = document.activeElement;
              if (
                activeEl &&
                activeEl.blur &&
                activeEl.tagName !== 'TEXTAREA' &&
                activeEl.tagName !== 'INPUT'
              ) {
                activeEl.blur();
              }
            } else {
              return;
            }
          }

          if (e.cancelable) e.preventDefault();
          const now = performance.now();
          if (samples.length === 0 || samples[samples.length - 1].t !== now) samples.push({ t: now, x: pt.x });
          while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
          const film = this._stackFilm;
          if (!film) return;
          // 1:1 — the card moves exactly as far as the finger (rubber band past the first/last card)
          const dxNow = pt.x - startX;
          film.c = this._stackFilmRubberBand(film, cAtDown - dxNow / film.w);
          this._layoutStackFilmstrip();
        },
        { passive: false }
      );

      const endCarouselDrag = (e) => {
        if (startX === null || startY === null) return;
        if (e && activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) {
          return;
        }
        const wasDragging = isDraggingCarousel;
        startX = null;
        startY = null;
        activePointerId = null;
        isDraggingCarousel = false;
        if (!wasDragging) return;

        this._justFinishedCardSwipe = true;
        clearTimeout(this._swipeGuardTimer);
        this._swipeGuardTimer = setTimeout(() => {
          this._justFinishedCardSwipe = false;
        }, 220);

        // Release velocity from the last ~100ms of movement (px per ms)
        let vx = 0;
        if (samples.length >= 2) {
          const a = samples[0];
          const b = samples[samples.length - 1];
          const dt = b.t - a.t;
          if (dt > 0 && performance.now() - b.t < 120) vx = (b.x - a.x) / dt;
        }
        const film = this._stackFilm;
        if (!film) return;
        const vC = -vx / film.w; // cards per ms
        let target;
        if (Math.abs(vx) > 0.3) {
          target = vC > 0 ? Math.floor(film.c + 0.02) + 1 : Math.ceil(film.c - 0.02) - 1;
        } else {
          target = Math.round(film.c);
        }
        // One card per flick, never past the first/last card
        target = Math.max(film.downIdx - 1, Math.min(film.downIdx + 1, target));
        target = Math.max(0, Math.min(film.keys.length - 1, target));
        this._settleStackFilmstrip(target, vC);
      };

      window.addEventListener('pointerup', endCarouselDrag);
      window.addEventListener('pointercancel', endCarouselDrag);
    }

    // 3. Mouse Wheel / Trackpad Scrolling through the Stack + Two-Finger Pinch-to-Zoom Out to Calendar
    if (this.els.stackScreen) {
      this.els.stackScreen.addEventListener(
        'wheel',
        (e) => {
          if (e.ctrlKey && e.deltaY > 0) {
            e.preventDefault();
            this.zoomOutStackToCalendar();
            return;
          }

          // Trackpad two-finger horizontal swipe: cards follow the fingers 1:1, then settle
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaMode === 0) {
            e.preventDefault();
            this._onStackFilmstripWheel(e.deltaX);
            return;
          }

          // Mouse wheel (vertical): step through the chronological stack of cards
          const now = Date.now();
          if (now - this._lastStackWheelTime < 220) return;
          const dominantDelta = e.deltaY;
          if (Math.abs(dominantDelta) > 14) {
            e.preventDefault();
            this._lastStackWheelTime = now;
            this.stepStackCard(dominantDelta > 0 ? 1 : -1);
          }
        },
        { passive: false }
      );

      let pinchStartDist = null;
      this.els.stackScreen.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchStartDist = Math.hypot(dx, dy);
          } else {
            pinchStartDist = null;
          }
        },
        { passive: true }
      );
      this.els.stackScreen.addEventListener(
        'touchmove',
        (e) => {
          if (pinchStartDist && e.touches && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const curDist = Math.hypot(dx, dy);
            if (curDist < pinchStartDist * 0.78) {
              pinchStartDist = null;
              this.sensory.playMechanicalTick();
              this.zoomOutStackToCalendar();
            }
          }
        },
        { passive: true }
      );
      this.els.stackScreen.addEventListener(
        'touchend',
        () => {
          pinchStartDist = null;
        },
        { passive: true }
      );
    }
  }

  bindCalendarViewerEvents() {
    if (this.els.calendarBtnReturn) {
      this.els.calendarBtnReturn.addEventListener('click', () => {
        this.sensory.playCardFlipSwoosh();
        this.state.activePillar = 'card';
        this.saveState();
        this.renderAll();
      });
    }

    if (this.els.calendarBtnZoomin) {
      this.els.calendarBtnZoomin.addEventListener('click', () => {
        this.sensory.playMechanicalTick();
        this.zoomInCalendarToStack();
      });
    }

    if (this.els.calendarScreen) {
      this.els.calendarScreen.addEventListener(
        'wheel',
        (e) => {
          if (e.ctrlKey && e.deltaY < 0) {
            e.preventDefault();
            this.zoomInCalendarToStack();
          }
        },
        { passive: false }
      );

      let spreadStartDist = null;
      this.els.calendarScreen.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            spreadStartDist = Math.hypot(dx, dy);
          } else {
            spreadStartDist = null;
          }
        },
        { passive: true }
      );
      this.els.calendarScreen.addEventListener(
        'touchmove',
        (e) => {
          if (spreadStartDist && e.touches && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const curDist = Math.hypot(dx, dy);
            if (curDist > spreadStartDist * 1.24) {
              spreadStartDist = null;
              this.sensory.playMechanicalTick();
              this.zoomInCalendarToStack();
            }
          }
        },
        { passive: true }
      );
      this.els.calendarScreen.addEventListener(
        'touchend',
        () => {
          spreadStartDist = null;
        },
        { passive: true }
      );
    }
  }

  confirmPermanentDeleteArchivedCard() {
    const card = this.getSelectedStackCard();
    if (!card) {
      this.showNotificationBanner(this.t('No archived card remaining to delete.'));
      return;
    }

    if (this.els.deleteModalTitle) {
      this.els.deleteModalTitle.textContent = this.t('Permanently delete {date} card?', { date: card.shortDate });
    }
    if (this.els.deleteModalDesc) {
      this.els.deleteModalDesc.textContent =
        this.t('This action cannot be undone. This archived card and its reflection will be permanently removed from your stack.');
    }

    this.els.deleteModalOverlay.classList.remove('hidden');

    const onCancel = () => {
      this.els.deleteModalOverlay.classList.add('hidden');
      cleanup();
    };
    const onConfirm = () => {
      this.els.deleteModalOverlay.classList.add('hidden');
      cleanup();

      const deletedKey = card.dateKey;
      delete this.state.archiveCards[deletedKey];
      const remainingKeys = this.getSortedArchiveKeys();
      this.state.selectedStackDateKey =
        remainingKeys.length > 0 ? remainingKeys[remainingKeys.length - 1] : null;
      this.state.isStackCardFlipped = false;
      this._stackFlipDeg = 0;

      this.sensory.playTrashDelete();
      this.saveState();
      this.renderAll();
      this.showNotificationBanner(this.t('Card permanently deleted'));
    };
    const cleanup = () => {
      this.els.deleteModalCancel.removeEventListener('click', onCancel);
      this.els.deleteModalConfirm.removeEventListener('click', onConfirm);
    };

    this.els.deleteModalCancel.addEventListener('click', onCancel);
    this.els.deleteModalConfirm.addEventListener('click', onConfirm);
  }

  // =========================================================================
  // HERO TOMATO DIAL DRAG & TAP-ON-DIGITS TIME ENTRY
  // =========================================================================

  bindHeroDialDragGesture() {
    const stage = this.els.heroTomatoStage;
    let isDragging = false;
    let hasDragged = false;
    let dragStartX = 0;
    let dragStartAngle = 0;
    let lastNotchIndex = 0;
    let warnedStopwatchDrag = false;

    stage.addEventListener('pointerdown', (e) => {
      this.closeHeroTimeEditorDOM();
      this.closeHeroTitleEditorDOM();
      const slot = this.state.timers[this.state.selectedQuadrant];
      if (!slot) return;

      isDragging = true;
      hasDragged = false;
      warnedStopwatchDrag = false;
      dragStartX = this.getPointerXY(e).x;
      dragStartAngle = slot.angleDegrees;
      lastNotchIndex = Math.round(dragStartAngle / OdometerDialPhysics.DEGREES_PER_NOTCH);
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const slot = this.state.timers[this.state.selectedQuadrant];
      if (!slot) return;

      const translationX = this.getPointerXY(e).x - dragStartX;
      if (!hasDragged && Math.abs(translationX) <= 3) return;
      hasDragged = true;

      if (slot.mode === 'stopwatch') {
        if (!warnedStopwatchDrag && Math.abs(translationX) > 6) {
          warnedStopwatchDrag = true;
          this.showTelemetryToast(this.t('Switch to Countdown to set duration'));
        }
        return;
      }

      const update = OdometerDialPhysics.computeDragUpdate(
        dragStartAngle,
        translationX,
        lastNotchIndex
      );

      if (update.crossedNotch) {
        const isWindingUp = update.notchIndex > lastNotchIndex;
        lastNotchIndex = update.notchIndex;
        this.sensory.playDialRatchetNotch(isWindingUp);
      }

      if (slot.runState === 'completed') {
        slot.runState = 'idle';
      }
      slot.angleDegrees = update.rawAngleDegrees;
      slot.configuredMinutes = update.snappedMinutes;
      slot.remainingSeconds = update.snappedMinutes * 60;

      const readoutStr = OdometerDialPhysics.formatMockupReadout(
        slot.remainingSeconds
      );
      this.els.heroReadout.textContent = readoutStr;
      this.els.heroReadout.classList.toggle('has-hours', slot.remainingSeconds > 3600);
      this.hero3D.updateOdometer(
        slot.angleDegrees,
        slot.quadrant,
        Boolean(slot.assignedTaskId || slot.customTitle),
        slot.runState === 'completed'
      );
    });

    const endDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      try {
        stage.releasePointerCapture(e.pointerId);
      } catch (_) {}

      if (!hasDragged) return;
      hasDragged = false;

      const slot = this.state.timers[this.state.selectedQuadrant];
      if (!slot || slot.mode === 'stopwatch') return;

      const snapped = OdometerDialPhysics.snapAngleToNotch(slot.angleDegrees);
      slot.angleDegrees = snapped.snappedAngle;
      slot.configuredMinutes = snapped.minutes;
      slot.remainingSeconds = snapped.minutes * 60;

      if (snapped.minutes > 0) {
        this.ensureSlotAssignedForActiveTimer(slot.quadrant);
      }

      if (slot.remainingSeconds === 0 && slot.runState === 'running') {
        slot.runState = 'idle';
        slot.lastTickTimestamp = null;
      }
      this.armTimerDueAlarm();

      this.saveState();
      this.renderHeroScreen();
    };

    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
  }

  bindHeroReadoutTimeEntry() {
    if (!this.els.heroReadout || !this.els.heroTimeEditor || !this.els.heroTimeInput) return;

    this.els.heroReadout.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openHeroTimeEditor();
    });

    this.els.heroReadout.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openHeroTimeEditor();
      }
    });

    this.els.heroTimeEditor.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    let heroTimeComposing = false;
    let heroTimeCompEnd = 0;
    this.els.heroTimeInput.addEventListener('compositionstart', () => {
      heroTimeComposing = true;
    });
    this.els.heroTimeInput.addEventListener('compositionend', () => {
      heroTimeComposing = false;
      heroTimeCompEnd = Date.now();
    });

    this.els.heroTimeInput.addEventListener('input', (e) => {
      if (heroTimeComposing || e.isComposing) return;
      const rawVal = this.els.heroTimeInput.value;
      if (this.els.heroTimeUnitBadge) {
        this.els.heroTimeUnitBadge.textContent =
          this.t(rawVal.includes(':') || rawVal.includes('：') ? 'HH:MM' : 'MIN');
      }
      const parsedMins = OdometerDialPhysics.parseTypedTimeInput(rawVal);
      if (parsedMins !== null && this.hero3D) {
        const slot = this.state.timers[this.state.selectedQuadrant] || this.state.timers[0];
        const isAssigned = Boolean(slot.assignedTaskId || slot.customTitle);
        this.hero3D.updateOdometer(
          parsedMins * OdometerDialPhysics.DEGREES_PER_MINUTE,
          slot.quadrant,
          isAssigned,
          false
        );
      }
    });

    this.els.heroTimeInput.addEventListener('keydown', (e) => {
      const imeActive =
        heroTimeComposing ||
        e.isComposing ||
        e.keyCode === 229 ||
        Date.now() - heroTimeCompEnd < 120;
      if (e.key === 'Enter') {
        if (imeActive) return;
        e.preventDefault();
        this.commitHeroTimeEditor();
      } else if (e.key === 'Escape') {
        if (imeActive) return;
        e.preventDefault();
        this.cancelHeroTimeEditor();
      }
    });

    if (this.els.heroTimeSetBtn) {
      this.els.heroTimeSetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.commitHeroTimeEditor();
      });
    }

    const presetButtons = this.els.heroTimeEditor.querySelectorAll('.hero-preset-pill');
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mins = Number(btn.dataset.mins);
        if (Number.isFinite(mins)) {
          this.closeHeroTimeEditorDOM();
          this.setCustomTimerMinutes(this.state.selectedQuadrant, mins);
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (
        this.els.heroTimeEditor &&
        !this.els.heroTimeEditor.classList.contains('hidden') &&
        !e.target.closest('#hero-time-editor') &&
        !e.target.closest('#hero-readout')
      ) {
        this.commitHeroTimeEditor();
      }
    });
  }

  openHeroTimeEditor() {
    this.closeHeroTitleEditorDOM();
    const slot = this.state.timers[this.state.selectedQuadrant] || this.state.timers[0];
    if (!slot || !this.els.heroTimeEditor || !this.els.heroTimeInput) return;

    if (slot.mode === 'stopwatch') {
      this.showTelemetryToast(this.t('Switch to Countdown to set duration'));
      return;
    }

    const currentMinutes = Math.round(slot.remainingSeconds / 60);
    this.els.heroReadout.classList.add('hidden');
    this.els.heroTimeEditor.classList.remove('hidden');
    this.els.heroTimeInput.value = String(currentMinutes);
    if (this.els.heroTimeUnitBadge) {
      this.els.heroTimeUnitBadge.textContent = this.t('MIN');
    }

    setTimeout(() => {
      this.els.heroTimeInput.focus();
      this.els.heroTimeInput.select();
    }, 20);
  }

  closeHeroTimeEditorDOM() {
    if (!this.els.heroTimeEditor || !this.els.heroReadout) return;
    this.els.heroTimeEditor.classList.add('hidden');
    this.els.heroReadout.classList.remove('hidden');
  }

  commitHeroTimeEditor() {
    if (!this.els.heroTimeEditor || this.els.heroTimeEditor.classList.contains('hidden')) return;
    const rawVal = this.els.heroTimeInput ? this.els.heroTimeInput.value : '';
    const parsedMins = OdometerDialPhysics.parseTypedTimeInput(rawVal);
    this.closeHeroTimeEditorDOM();

    if (parsedMins !== null) {
      this.setCustomTimerMinutes(this.state.selectedQuadrant, parsedMins);
    } else {
      this.renderHeroScreen();
    }
  }

  cancelHeroTimeEditor() {
    if (!this.els.heroTimeEditor || this.els.heroTimeEditor.classList.contains('hidden')) return;
    this.closeHeroTimeEditorDOM();
    this.renderHeroScreen();
  }

  bindHeroTitleEntry() {
    if (!this.els.heroTitleEditor || !this.els.heroTitleInput) return;

    this.els.heroTitleEditor.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    let heroTitleComposing = false;
    let heroTitleCompEnd = 0;
    this.els.heroTitleInput.addEventListener('compositionstart', () => {
      heroTitleComposing = true;
    });
    this.els.heroTitleInput.addEventListener('compositionend', () => {
      heroTitleComposing = false;
      heroTitleCompEnd = Date.now();
      const clamped = this.clampTaskInputText(this.els.heroTitleInput.value);
      if (this.els.heroTitleInput.value !== clamped) {
        this.els.heroTitleInput.value = clamped;
      }
    });

    this.els.heroTitleInput.addEventListener('input', (e) => {
      if (heroTitleComposing || e.isComposing) return;
      const clamped = this.clampTaskInputText(this.els.heroTitleInput.value);
      if (this.els.heroTitleInput.value !== clamped) {
        this.els.heroTitleInput.value = clamped;
        if (clamped.length >= MAX_TASK_CHARS) {
          this.showTelemetryToast('Task length limit reached');
        }
      }
    });

    this.els.heroTitleInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const imeActive =
        heroTitleComposing ||
        e.isComposing ||
        e.keyCode === 229 ||
        Date.now() - heroTitleCompEnd < 120;
      if (e.key === 'Enter') {
        if (imeActive) return;
        e.preventDefault();
        this.commitHeroTitleEditor();
      } else if (e.key === 'Escape') {
        if (imeActive) return;
        e.preventDefault();
        this.cancelHeroTitleEditor();
      }
    });

    if (this.els.heroTitleSetBtn) {
      this.els.heroTitleSetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.commitHeroTitleEditor();
      });
    }
  }

  openHeroTitleEditor() {
    const slot = this.state.timers[this.state.selectedQuadrant] || this.state.timers[0];
    if (!slot || !this.els.heroTitleEditor || !this.els.heroTitleInput) return;

    this.closeHeroTimeEditorDOM();
    if (this.els.heroSubtitleWrap) {
      this.els.heroSubtitleWrap.classList.add('is-editing-title');
    }
    if (this.els.heroSubtitleRow) {
      this.els.heroSubtitleRow.classList.add('hidden');
    }
    this.els.heroTitleEditor.classList.remove('hidden');

    const orderStr = String(slot.assignedTaskOrder || slot.quadrant + 1).padStart(2, '0');
    if (this.els.heroTitleOrderPrefix) {
      this.els.heroTitleOrderPrefix.textContent = `${orderStr} /`;
    }
    this.els.heroTitleInput.value = slot.customTitle || '';

    this.state.isHeroDropdownOpen = true;
    if (this.els.heroSubtitleDropdownMount) {
      this.els.heroSubtitleDropdownMount.innerHTML = '';
      this.els.heroSubtitleDropdownMount.appendChild(
        this.buildTaskDropdownDOM(slot.quadrant)
      );
    }

    try {
      this.els.heroTitleInput.focus();
      this.els.heroTitleInput.select();
    } catch (_) {}
    setTimeout(() => {
      if (this.els.heroTitleEditor && !this.els.heroTitleEditor.classList.contains('hidden')) {
        this.els.heroTitleInput.focus();
        this.els.heroTitleInput.select();
      }
    }, 20);
  }

  closeHeroTitleEditorDOM() {
    if (this.els.heroSubtitleWrap) {
      this.els.heroSubtitleWrap.classList.remove('is-editing-title');
    }
    if (this.els.heroTitleEditor) {
      this.els.heroTitleEditor.classList.add('hidden');
    }
    if (this.els.heroSubtitleRow) {
      this.els.heroSubtitleRow.classList.remove('hidden');
    }
  }

  commitHeroTitleEditor() {
    if (!this.els.heroTitleEditor || this.els.heroTitleEditor.classList.contains('hidden')) return;
    const rawVal = this.els.heroTitleInput ? this.els.heroTitleInput.value : '';
    const cleanVal = this.clampTaskInputText(rawVal).trim();
    const quadrant = this.state.selectedQuadrant;
    const slot = this.state.timers[quadrant] || this.state.timers[0];

    this.closeHeroTitleEditorDOM();
    this.state.isHeroDropdownOpen = false;

    if (cleanVal && slot) {
      const linkedTask =
        slot.assignedTaskId &&
        this.state.tasks.find((t) => t.id === slot.assignedTaskId);
      if (linkedTask) {
        linkedTask.title = cleanVal;
        slot.customTitle = cleanVal;
        this.state.openDropdownQuadrant = null;
        this.sensory.playMechanicalTick();
        this.saveState();
        this.renderAll();
      } else {
        this.assignCustomTitleToQuadrant(slot.quadrant, cleanVal);
      }
    } else {
      this.renderHeroScreen();
    }
  }

  cancelHeroTitleEditor() {
    if (!this.els.heroTitleEditor || this.els.heroTitleEditor.classList.contains('hidden')) return;
    this.closeHeroTitleEditorDOM();
    this.state.isHeroDropdownOpen = false;
    this.renderHeroScreen();
  }

  isSlotCustomUnlinkedTitle(slot) {
    if (!slot || !slot.customTitle || !slot.customTitle.trim()) return false;
    if (!slot.assignedTaskId) return true;
    return !this.state.tasks.some((t) => t.id === slot.assignedTaskId);
  }

  syncCustomTomatoToCard(quadrant) {
    const slot = this.state.timers[quadrant] || this.state.timers[this.state.selectedQuadrant];
    if (!slot || !slot.customTitle || !slot.customTitle.trim()) return;

    const existingLinked =
      slot.assignedTaskId &&
      this.state.tasks.find((t) => t.id === slot.assignedTaskId);
    if (existingLinked) {
      this.showTelemetryToast(this.t('Synced to Today’s Card'));
      this.renderAll();
      return;
    }

    if (this.state.tasks.length >= MAX_CARD_TASKS) {
      this.showNotificationBanner(this.t('Maximum 8 tasks per card reached.'));
      return;
    }

    const newOrder = this.state.tasks.length + 1;
    const newTask = {
      id: 'task-' + Date.now(),
      orderIndex: newOrder,
      title: slot.customTitle.trim(),
      isCompleted: slot.runState === 'completed',
      assignedQuadrant: slot.quadrant,
    };
    this.state.tasks.push(newTask);
    slot.assignedTaskId = newTask.id;
    slot.assignedTaskOrder = newOrder;

    this.sensory.playMechanicalTick();
    this.showTelemetryToast(this.t('Synced to Today’s Card'));
    this.saveState();
    this.renderAll();
  }

  setCustomTimerMinutes(quadrant, minutes) {
    const slot = this.state.timers[quadrant];
    if (!slot) return;

    const clampedMins = Math.max(
      0,
      Math.min(OdometerDialPhysics.MAX_MINUTES, Math.round(Number(minutes) || 0))
    );

    slot.mode = 'countdown';
    slot.runState = 'idle';
    slot.lastTickTimestamp = null;
    slot.configuredMinutes = clampedMins;
    slot.remainingSeconds = clampedMins * 60;
    slot.angleDegrees = clampedMins * OdometerDialPhysics.DEGREES_PER_MINUTE;

    if (clampedMins > 0) {
      this.ensureSlotAssignedForActiveTimer(quadrant);
    }

    this.sensory.playDialRatchetNotch(true);
    this.showTelemetryToast(this.t('Timer set to {n} min', { n: clampedMins }));
    this.armTimerDueAlarm();
    this.saveState();
    this.renderAll();
  }

  // =========================================================================
  // TIMER COORDINATOR LOGIC (1-Active-Timer + Stopwatch Turns on Minutes)
  // =========================================================================

  ensureSlotAssignedForActiveTimer(quadrant) {
    const slot = this.state.timers[quadrant];
    if (!slot || slot.assignedTaskId || slot.customTitle) return;

    const freeTask = this.state.tasks.find(
      (t) => t.assignedQuadrant === null || t.assignedQuadrant === undefined
    );
    if (freeTask) {
      freeTask.assignedQuadrant = quadrant;
      slot.assignedTaskId = freeTask.id;
      slot.assignedTaskOrder = freeTask.orderIndex;
      slot.customTitle = freeTask.title;
    } else {
      slot.customTitle = 'Focus Session';
    }
  }

  startWallClockTicker() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    const checkSystemDateRefresh = () => {
      const currentLogicalDate = this.getCurrentLogicalDateString(this.state.dailyResetHour);
      if (
        (this.state.lastRolloverLogicalDate &&
          currentLogicalDate !== this.state.lastRolloverLogicalDate) ||
        this.state.cardDateKey !== currentLogicalDate
      ) {
        this.state.lastRolloverLogicalDate = currentLogicalDate;
        this.simulateFiveAmRollover(currentLogicalDate);
        return true;
      }
      return false;
    };

    if (!this._boundVisibilityRefresh) {
      this._boundVisibilityRefresh = () => {
        if (document.visibilityState === 'visible') {
          checkSystemDateRefresh();
          // Timers keep real time while the app was hidden or the phone slept
          this.applyTimerTick(this.syncRunningTimersToClock(Date.now()));
          this.armTimerDueAlarm();
        } else {
          this.saveState();
          // Re-arm from this event so the end-of-timer wake-up isn't throttled in the background
          this.armTimerDueAlarm();
        }
      };
      document.addEventListener('visibilitychange', this._boundVisibilityRefresh);
      window.addEventListener('focus', this._boundVisibilityRefresh);
      window.addEventListener('pageshow', this._boundVisibilityRefresh);
      window.addEventListener('pagehide', () => this.saveState());
    }

    this.tickInterval = setInterval(() => {
      // QA #3: Automatically roll over / refresh the daily card when the system logical date advances
      if (checkSystemDateRefresh()) {
        return;
      }

      this.applyTimerTick(this.syncRunningTimersToClock(Date.now()));
    }, 1000);
  }

  /**
   * Advances every running timer by the REAL time elapsed since its last tick (not by "1 per tick"),
   * so time keeps counting while the app is in the background or the phone is asleep
   * (iOS pauses or throttles JS timers there). Keeps the sub-second remainder to avoid drift.
   */
  syncRunningTimersToClock(now) {
    const result = { anyUpdated: false, completed: [], lateMs: new Map() };
    for (const slot of this.state.timers) {
      if (slot.runState !== 'running') continue;
      if (!slot.lastTickTimestamp) {
        slot.lastTickTimestamp = now;
        continue;
      }
      const elapsedSec = Math.floor((now - slot.lastTickTimestamp) / 1000);
      if (elapsedSec <= 0) continue;
      const dueAt = slot.lastTickTimestamp + slot.remainingSeconds * 1000;
      slot.lastTickTimestamp += elapsedSec * 1000;
      result.anyUpdated = true;
      if (slot.mode === 'countdown') {
        slot.remainingSeconds = Math.max(0, slot.remainingSeconds - elapsedSec);
        slot.angleDegrees = OdometerDialPhysics.secondsToAngleDegrees(slot.remainingSeconds);
        if (slot.remainingSeconds === 0) {
          result.completed.push(slot);
          result.lateMs.set(slot, Math.max(0, now - dueAt));
        }
      } else {
        const prevWholeMinutes = Math.floor(slot.remainingSeconds / 60);
        slot.remainingSeconds += elapsedSec;
        slot.angleDegrees = OdometerDialPhysics.stopwatchSecondsToMinuteAngleDegrees(
          slot.remainingSeconds
        );
        if (Math.floor(slot.remainingSeconds / 60) > prevWholeMinutes) {
          this.sensory.playDialRatchetNotch(true);
        }
      }
    }
    return result;
  }

  applyTimerTick({ anyUpdated, completed, lateMs }) {
    if (!anyUpdated) return;
    completed.forEach((slot) => {
      this.endTimerToSilver(slot.quadrant, true, lateMs ? lateMs.get(slot) || 0 : 0);
      this.showNotificationBanner(
        this.t('Timer completed: {title}', {
          title: this.displayTaskTitle(slot.customTitle || this.t('Timer')),
        })
      );
    });
    this.saveState();
    if (this.state.activePillar === 'timer') {
      if (this.state.timerSubMode === 'hero') {
        if (completed.length) {
          this.renderHeroScreen();
        } else {
          this.updateHeroTimerInPlace();
        }
      } else if (completed.length) {
        this.renderGridScreen();
      } else {
        this.updateGridTimersInPlace();
      }
    }
  }

  updateHeroTimerInPlace() {
    const slot =
      this.state.timers[this.state.selectedQuadrant] || this.state.timers[0];
    if (!slot) return;
    const nextReadout = OdometerDialPhysics.formatMockupReadout(slot.remainingSeconds);
    if (this.els.heroReadout) {
      if (this.els.heroReadout.textContent !== nextReadout) {
        this.els.heroReadout.textContent = nextReadout;
      }
      this.els.heroReadout.classList.toggle('has-hours', slot.remainingSeconds > 3600);
    }
    const isAssigned = Boolean(slot.assignedTaskId || slot.customTitle);
    const isCompleted = slot.runState === 'completed';
    if (this.hero3D) {
      this.hero3D.updateOdometer(
        slot.angleDegrees,
        slot.quadrant,
        isAssigned,
        isCompleted
      );
    }
  }

  updateGridTimersInPlace() {
    this.state.timers.forEach((slot, qIdx) => {
      const quadEl = this.els.gridQuadrants[qIdx];
      if (!quadEl) return;
      const timeEl = quadEl.querySelector('.grid-tomato-time');
      if (timeEl) {
        const readoutText = OdometerDialPhysics.formatMockupReadout(
          slot.remainingSeconds
        );
        timeEl.textContent = readoutText;
        timeEl.classList.toggle('has-hours', slot.remainingSeconds > 3600);
      }
    });
  }

  togglePlayPause(quadrant) {
    this.closeHeroTimeEditorDOM();
    const slot = this.state.timers[quadrant];
    if (!slot) return;

    if (slot.runState === 'running') {
      slot.runState = 'paused';
      slot.lastTickTimestamp = null;
      this.sensory.playMechanicalTick();
    } else {
      for (const other of this.state.timers) {
        if (other.quadrant !== quadrant && other.runState === 'running') {
          other.runState = 'paused';
          other.lastTickTimestamp = null;
        }
      }

      this.ensureSlotAssignedForActiveTimer(quadrant);

      if (slot.mode === 'countdown' && slot.remainingSeconds <= 0) {
        slot.configuredMinutes = 25;
        slot.remainingSeconds = 25 * 60;
        slot.angleDegrees = 25 * 6.0;
      }

      slot.runState = 'running';
      slot.lastTickTimestamp = Date.now();
      this.sensory.playMechanicalTick();
    }
    this.armTimerDueAlarm();

    this.saveState();
    this.renderAll();
  }

  isTimerSlotSet(slot) {
    if (!slot) return false;
    if (
      slot.runState === 'running' ||
      slot.runState === 'paused' ||
      slot.runState === 'completed'
    ) {
      return true;
    }
    const isAssigned = Boolean(slot.assignedTaskId || slot.customTitle);
    return isAssigned && slot.remainingSeconds > 0;
  }

  handleEndOrResetButton(quadrant) {
    const slot = this.state.timers[quadrant];
    if (!slot || !this.isTimerSlotSet(slot)) return;

    if (slot.runState === 'completed') {
      this.resetCompletedTimer(quadrant);
    } else {
      this.endTimerToSilver(quadrant, false);
    }
  }

  endTimerToSilver(quadrant, completedNaturally = false, lateMs = 0) {
    this.closeHeroTimeEditorDOM();
    const slot = this.state.timers[quadrant];
    if (!slot) return;

    slot._justTransitionedSilver = slot.runState !== 'completed';
    slot.runState = 'completed';
    slot.lastTickTimestamp = null;

    // If a pre-armed hardware WebAudio alarm already rang (or is mid-ring) at 00:00 while
    // the user was stepped away from the app, don't ring a second time upon re-entry.
    const hwStatus =
      completedNaturally && this.sensory && this.sensory.consumeHardwareAlarmStatus
        ? this.sensory.consumeHardwareAlarmStatus()
        : 'did_not_ring';

    if (hwStatus === 'did_not_ring') {
      // Reached 00:00 just now (or while you're away on another tab/app): ring the bell several times.
      // Found finished only when you came back long after (phone was asleep): one soft chime.
      // Ended it yourself: one chime.
      const userAway = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      if (completedNaturally && (userAway || lateMs < 4000)) {
        this.sensory.playCompletionAlarm();
      } else {
        this.sensory.playCompletionChime();
      }
    }
    if (!completedNaturally) {
      this.showTelemetryToast(this.t('Timer ended'));
    }
    this.armTimerDueAlarm();

    this.saveState();
    this.renderAll();
  }

  /**
   * One-shot wake-up at the exact moment the soonest running countdown reaches 00:00,
   * plus hardware WebAudio pre-scheduling (`armHardwareCountdownAlarm`) and native iOS
   * `UNUserNotificationCenter` scheduling when running inside the iPhone app wrapper
   * so the bell rings while stepped away with zero battery drain when idle or audio interruption.
   */
  armTimerDueAlarm() {
    if (this._dueTimeout) {
      clearTimeout(this._dueTimeout);
      this._dueTimeout = null;
    }
    const nativeBridge =
      typeof window !== 'undefined'
        ? (window.webkit &&
            window.webkit.messageHandlers &&
            window.webkit.messageHandlers.untoNative) ||
          window.__untoNativeBridge ||
          null
        : null;

    let soonest = Infinity;
    for (const slot of this.state.timers) {
      const isRunningCountdown =
        slot.runState === 'running' &&
        slot.mode === 'countdown' &&
        Boolean(slot.lastTickTimestamp) &&
        slot.remainingSeconds > 0;
      if (isRunningCountdown) {
        const dueAt = slot.lastTickTimestamp + slot.remainingSeconds * 1000;
        soonest = Math.min(soonest, dueAt);
        if (nativeBridge && !(this.sensory && this.sensory.isSilentMode)) {
          try {
            const taskTitle = this.displayTaskTitle(slot.customTitle || this.t('Timer'));
            nativeBridge.postMessage({
              action: 'scheduleTimer',
              slotIndex: slot.quadrant,
              title: 'UNTO / FLOW',
              body: this.t('Timer completed: {title}', { title: taskTitle }),
              endsAtMs: dueAt,
            });
          } catch (_) {}
        } else if (nativeBridge) {
          try {
            nativeBridge.postMessage({ action: 'cancelTimer', slotIndex: slot.quadrant });
          } catch (_) {}
        }
      } else if (nativeBridge) {
        try {
          nativeBridge.postMessage({ action: 'cancelTimer', slotIndex: slot.quadrant });
        } catch (_) {}
      }
    }
    if (!Number.isFinite(soonest)) {
      if (this.sensory && this.sensory.disarmHardwareCountdownAlarm) {
        this.sensory.disarmHardwareCountdownAlarm();
      }
      return;
    }
    const waitMs = Math.max(0, soonest - Date.now()) + 60;
    if (this.sensory && this.sensory.armHardwareCountdownAlarm) {
      const waitSec = Math.max(0.05, (soonest - Date.now()) / 1000);
      this.sensory.armHardwareCountdownAlarm(waitSec, () => {
        if (this._dueTimeout) {
          clearTimeout(this._dueTimeout);
          this._dueTimeout = null;
        }
        this.applyTimerTick(this.syncRunningTimersToClock(Date.now()));
        this.armTimerDueAlarm();
      });
    }
    this._dueTimeout = setTimeout(() => {
      this._dueTimeout = null;
      this.applyTimerTick(this.syncRunningTimersToClock(Date.now()));
      this.armTimerDueAlarm();
    }, waitMs);
  }

  resetCompletedTimer(quadrant) {
    this.closeHeroTimeEditorDOM();
    const slot = this.state.timers[quadrant];
    if (!slot) return;

    slot._justTransitionedFromSilver = slot.runState === 'completed';
    slot.runState = 'idle';
    slot.remainingSeconds = 0;
    slot.configuredMinutes = 0;
    slot.angleDegrees = 0.0;
    slot.lastTickTimestamp = null;

    this.sensory.playDialRatchetNotch(false);
    this.showTelemetryToast(this.t('Tomato reset to 00:00'));
    this.armTimerDueAlarm();

    this.saveState();
    this.renderAll();
  }

  endAndResetTimer(quadrant, completedNaturally = false) {
    this.endTimerToSilver(quadrant, completedNaturally);
  }

  toggleStopwatchMode(quadrant) {
    this.closeHeroTimeEditorDOM();
    const slot = this.state.timers[quadrant];
    if (!slot) return;

    slot.runState = 'idle';
    slot.lastTickTimestamp = null;
    if (slot.mode === 'countdown') {
      slot.mode = 'stopwatch';
      slot.remainingSeconds = 0;
      slot.angleDegrees = 0;
      this.showTelemetryToast(this.t('Stopwatch mode'));
    } else {
      slot.mode = 'countdown';
      slot.configuredMinutes = 25;
      slot.remainingSeconds = 25 * 60;
      slot.angleDegrees = 25 * 6.0;
      this.showTelemetryToast(this.t('Countdown mode'));
    }
    this.sensory.playDialRatchetNotch(true);
    this.armTimerDueAlarm();
    this.saveState();
    this.renderAll();
  }

  assignTaskToQuadrant(quadrant, task) {
    const slot = this.state.timers[quadrant];
    if (!slot) return;

    if (
      task.assignedQuadrant !== null &&
      task.assignedQuadrant !== undefined &&
      task.assignedQuadrant !== quadrant
    ) {
      this.clearQuadrantAssignment(task.assignedQuadrant);
    }

    for (const t of this.state.tasks) {
      if (t.assignedQuadrant === quadrant) {
        t.assignedQuadrant = null;
      }
    }

    task.assignedQuadrant = quadrant;
    slot.assignedTaskId = task.id;
    slot.assignedTaskOrder = task.orderIndex;
    slot.customTitle = task.title;
    if (slot.remainingSeconds === 0 && slot.mode === 'countdown') {
      slot.configuredMinutes = 25;
      slot.remainingSeconds = 25 * 60;
      slot.angleDegrees = 25 * 6.0;
    }

    this.closeHeroTitleEditorDOM();
    this.state.openDropdownQuadrant = null;
    this.state.isHeroDropdownOpen = false;
    this.sensory.playDialRatchetNotch(true);
    this.armTimerDueAlarm();
    this.saveState();
    this.renderAll();
  }

  assignCustomTitleToQuadrant(quadrant, customTitle) {
    const slot = this.state.timers[quadrant];
    if (!slot || !customTitle.trim()) return;

    for (const t of this.state.tasks) {
      if (t.assignedQuadrant === quadrant) {
        t.assignedQuadrant = null;
      }
    }

    slot.assignedTaskId = null;
    slot.assignedTaskOrder = null;
    slot.customTitle = customTitle.trim();
    if (slot.remainingSeconds === 0 && slot.mode === 'countdown') {
      slot.configuredMinutes = 25;
      slot.remainingSeconds = 25 * 60;
      slot.angleDegrees = 25 * 6.0;
    }

    this.closeHeroTitleEditorDOM();
    this.state.openDropdownQuadrant = null;
    this.state.isHeroDropdownOpen = false;
    this.sensory.playDialRatchetNotch(true);
    this.armTimerDueAlarm();
    this.saveState();
    this.renderAll();
  }

  clearQuadrantAssignment(quadrant) {
    const slot = this.state.timers[quadrant];
    if (!slot) return;

    for (const t of this.state.tasks) {
      if (t.assignedQuadrant === quadrant) {
        t.assignedQuadrant = null;
      }
    }

    slot.assignedTaskId = null;
    slot.assignedTaskOrder = null;
    slot.customTitle = null;
    slot.runState = 'idle';
    slot.remainingSeconds = 0;
    slot.configuredMinutes = 0;
    slot.angleDegrees = 0;
    slot.lastTickTimestamp = null;

    this.closeHeroTitleEditorDOM();
    this.state.openDropdownQuadrant = null;
    this.state.isHeroDropdownOpen = false;
    this.sensory.playDialRatchetNotch(false);
    this.showTelemetryToast(this.t('Tomato unassigned'));
    this.saveState();
    this.renderAll();
  }

  handleCardTaskTomatoClick(task) {
    // A lit (assigned) mini tomato opens that tomato's timer page. Unassigning lives only on the
    // tomato page and the grid page (their dropdown "✕ Unassign Tomato"), so a tap can't wipe a timer.
    if (task.assignedQuadrant !== null && task.assignedQuadrant !== undefined) {
      this.state.selectedQuadrant = task.assignedQuadrant;
      this.state.activePillar = 'timer';
      this.state.timerSubMode = 'hero';
      this.saveState();
      this.renderAll();
      return;
    }

    const freeSlot = this.state.timers.find(
      (s) => !s.assignedTaskId && !s.customTitle
    );
    if (!freeSlot) {
      this.showNotificationBanner(this.t('Maximum 6 active tomatoes reached.'));
      return;
    }
    const targetQuad = freeSlot.quadrant;
    this.assignTaskToQuadrant(targetQuad, task);

    this.state.selectedQuadrant = targetQuad;
    this.state.activePillar = 'timer';
    this.state.timerSubMode = 'hero';
    this.saveState();
    this.renderAll();
  }

  // =========================================================================
  // RENDERING: ALL 7 MOCKUP SCREENS (01..07)
  // =========================================================================

  renderAll() {
    const pillar = this.state.activePillar;
    const isHome = pillar === 'home';
    const isCard = pillar === 'card';
    const isTimer = pillar === 'timer';
    const isStack = pillar === 'stack';
    const isCalendar = pillar === 'calendar';

    // Automatically close transient dropdowns or editors that belong to inactive screens
    if (!isTimer || this.state.timerSubMode !== 'grid') {
      this.state.openDropdownQuadrant = null;
    }
    if (!isTimer || this.state.timerSubMode !== 'hero') {
      this.state.isHeroDropdownOpen = false;
      this.closeHeroTimeEditorDOM();
      this.closeHeroTitleEditorDOM();
    }
    if (this._lastRenderedPillar && this._lastRenderedPillar !== pillar) {
      if (this.els.notificationBanner) {
        this.els.notificationBanner.classList.remove('visible');
      }
    }
    this._lastRenderedPillar = pillar;

    if (this.els.homeBrandTitle && this.els.topSegmentedPill) {
      this.els.homeBrandTitle.classList.toggle('hidden', !isHome);
      this.els.topSegmentedPill.classList.toggle('hidden', isHome);
    }

    const isCardSegmentActive = isCard || isStack || isCalendar;
    this.els.pillCardBtn.classList.toggle('active', isCardSegmentActive);
    this.els.pillTimerBtn.classList.toggle('active', isTimer);

    if (this.els.homeScreen) {
      this.els.homeScreen.classList.toggle('hidden', !isHome);
    }
    this.els.cardScreen.classList.toggle('hidden', !isCard);
    this.els.gridScreen.classList.toggle(
      'hidden',
      !isTimer || this.state.timerSubMode !== 'grid'
    );
    this.els.heroScreen.classList.toggle(
      'hidden',
      !isTimer || this.state.timerSubMode !== 'hero'
    );
    if (this.els.stackScreen) {
      this.els.stackScreen.classList.toggle('hidden', !isStack);
    }
    if (this.els.calendarScreen) {
      this.els.calendarScreen.classList.toggle('hidden', !isCalendar);
    }

    if (this.els.demoBtnHome) {
      this.els.demoBtnHome.classList.toggle('active-pill', isHome);
    }
    if (this.els.demoBtnCard) {
      this.els.demoBtnCard.classList.toggle(
        'active-pill',
        isCard && !this.state.isCardFlipped
      );
    }
    if (this.els.demoBtnBack) {
      this.els.demoBtnBack.classList.toggle(
        'active-pill',
        isCard && Boolean(this.state.isCardFlipped)
      );
    }
    if (this.els.demoBtnGrid) {
      this.els.demoBtnGrid.classList.toggle(
        'active-pill',
        isTimer && this.state.timerSubMode === 'grid'
      );
    }
    if (this.els.demoBtnHero) {
      this.els.demoBtnHero.classList.toggle(
        'active-pill',
        isTimer && this.state.timerSubMode === 'hero'
      );
    }
    if (this.els.demoBtnStack) {
      this.els.demoBtnStack.classList.toggle('active-pill', isStack);
    }
    if (this.els.demoBtnCalendar) {
      this.els.demoBtnCalendar.classList.toggle('active-pill', isCalendar);
    }

    if (isHome) {
      this.renderHomeScreen();
    } else if (isCard) {
      this.renderCardScreen();
    } else if (isTimer) {
      if (this.state.timerSubMode === 'grid') {
        this.renderGridScreen();
      } else {
        this.renderHeroScreen();
      }
    } else if (isStack) {
      this.renderStackScreen();
    } else if (isCalendar) {
      this.renderCalendarScreen();
    }

    this.checkFirstTimePageHint();
  }

  /**
   * Renders Screen 0: Minimalist 2-Object Homepage (Mockup 01-home-page.png)
   */
  renderHomeScreen() {
    if (this.els.homeMiniDate) {
      this.els.homeMiniDate.textContent = this.state.cardShortDate || '06 OCT';
    }
  }

  /**
   * Renders Screen 1: Today's Dual-Sided Card (Front 04-card-front.png & Back 05-card-back.png)
   */
  renderCardScreen() {
    this.els.cardDateHeader.textContent = this.state.cardHeaderDate;
    if (this.els.cardBackDateHeader) {
      this.els.cardBackDateHeader.textContent = this.state.cardHeaderDate;
    }

    if (this.state.isCardFlipped && Math.abs(this._todayFlipDeg % 360) !== 180) {
      this._todayFlipDeg = -180;
    } else if (!this.state.isCardFlipped && Math.abs(this._todayFlipDeg % 360) !== 0) {
      this._todayFlipDeg = 0;
    }
    this.applyCard3DRotation(
      this.els.card3DWrapper,
      this.state.isCardFlipped,
      this._todayFlipDeg
    );

    const container = this.els.taskListContainer;
    const existingRowsById = new Map();
    Array.from(container.children).forEach((child) => {
      if (
        child.classList.contains('task-row') &&
        child.dataset.taskId &&
        !child.classList.contains('is-inline-editing') &&
        !child.classList.contains('task-row-inline-adding') &&
        !child.querySelector('.task-inline-input')
      ) {
        existingRowsById.set(child.dataset.taskId, child);
      }
    });

    const totalTasks = this.state.tasks.length;
    const rowVertPad = 9;
    const desiredRows = [];

    this.state.tasks.forEach((task, idx) => {
      task.orderIndex = idx + 1;
      const fontSizePx = this.computeTaskFontSizePx(task.title, totalTasks);
      const isLit =
        task.assignedQuadrant !== null && task.assignedQuadrant !== undefined;
      const assignedSlot = isLit ? this.state.timers[task.assignedQuadrant] : null;
      const miniPaletteKey = !isLit
        ? 'unassigned'
        : assignedSlot && assignedSlot.runState === 'completed'
        ? 'completed'
        : task.assignedQuadrant;
      const miniPaletteKeyStr = String(miniPaletteKey);
      const nextIndexText = String(task.orderIndex).padStart(2, '0');
      const nextTitleText = this.displayTaskTitle(task.title);
      const nextCompleted = task.isCompleted ? 'true' : 'false';
      const nextBtnTitle = isLit
        ? this.t('Open this tomato timer')
        : this.t('Click grey tomato to light up and open Timer page');
      const nextImgAlt = isLit
        ? this.t('Assigned Tomato')
        : this.t('Unassigned Grey Tomato');

      let row = existingRowsById.get(task.id);
      if (row) {
        existingRowsById.delete(task.id);
        row._taskRef = task;
        row.dataset.completed = nextCompleted;
        row.style.paddingTop = `${rowVertPad}px`;
        row.style.paddingBottom = `${rowVertPad}px`;

        const numSpan = row.querySelector('.task-index');
        if (numSpan) {
          numSpan.style.fontSize = `${fontSizePx}px`;
          if (numSpan.textContent !== nextIndexText) {
            numSpan.textContent = nextIndexText;
          }
        }
        const titleSpan = row.querySelector('.task-title');
        if (titleSpan) {
          titleSpan.style.fontSize = `${fontSizePx}px`;
          if (titleSpan.textContent !== nextTitleText) {
            titleSpan.textContent = nextTitleText;
          }
        }
        const tomatoBtn = row.querySelector('.task-tomato-btn');
        if (tomatoBtn && tomatoBtn.title !== nextBtnTitle) {
          tomatoBtn.title = nextBtnTitle;
        }
        const miniImg = row.querySelector('.task-mini-tomato-img');
        if (miniImg) {
          if (miniImg.dataset.paletteKey !== miniPaletteKeyStr) {
            miniImg.dataset.paletteKey = miniPaletteKeyStr;
            miniImg.src = this.gridRenderer.getMiniDataURL(miniPaletteKey);
          }
          if (miniImg.alt !== nextImgAlt) {
            miniImg.alt = nextImgAlt;
          }
        }
      } else {
        row = document.createElement('div');
        row.className = 'task-row';
        row.dataset.taskId = task.id;
        row.dataset.completed = nextCompleted;
        row.style.paddingTop = `${rowVertPad}px`;
        row.style.paddingBottom = `${rowVertPad}px`;
        row._taskRef = task;

        const numSpan = document.createElement('span');
        numSpan.className = 'task-index';
        numSpan.style.fontSize = `${fontSizePx}px`;
        numSpan.textContent = nextIndexText;

        const titleWrap = document.createElement('div');
        titleWrap.className = 'task-title-wrap';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'task-title';
        titleSpan.style.fontSize = `${fontSizePx}px`;
        titleSpan.textContent = nextTitleText;
        titleWrap.appendChild(titleSpan);

        const strikeCanvas = document.createElement('canvas');
        strikeCanvas.className = 'pencil-strike-canvas';
        strikeCanvas.width = 720;
        strikeCanvas.height = 120;

        const tomatoBtn = document.createElement('button');
        tomatoBtn.className = 'task-tomato-btn';
        tomatoBtn.type = 'button';
        tomatoBtn.title = nextBtnTitle;

        const miniImg = document.createElement('img');
        miniImg.className = 'task-mini-tomato-img';
        miniImg.decoding = 'sync';
        miniImg.dataset.paletteKey = miniPaletteKeyStr;
        miniImg.src = this.gridRenderer.getMiniDataURL(miniPaletteKey);
        miniImg.alt = nextImgAlt;
        tomatoBtn.appendChild(miniImg);

        tomatoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleCardTaskTomatoClick(row._taskRef || task);
        });

        row.appendChild(numSpan);
        row.appendChild(titleWrap);
        row.appendChild(strikeCanvas);
        row.appendChild(tomatoBtn);

        this.bindTaskRowPencilGesture(row, task, strikeCanvas, false);
      }
      desiredRows.push(row);
    });

    // Reconcile container children in-place without destroying reused rows
    Array.from(container.children).forEach((child) => {
      if (!desiredRows.includes(child)) {
        child.remove();
      }
    });
    desiredRows.forEach((row, idx) => {
      if (container.children[idx] !== row) {
        container.insertBefore(row, container.children[idx] || null);
      }
    });

    this.els.addItemRow.classList.remove('add-row-reserved');
    if (this.state.tasks.length < MAX_CARD_TASKS) {
      this.els.addItemRow.classList.remove('hidden');
    } else {
      this.els.addItemRow.classList.add('hidden');
    }

    // Unify font size across all items on Today's Card; only shrink if the whole card page is filled
    this.fitUnifiedCardTaskTypography(container, this.els.addItemRow);
    requestAnimationFrame(() => {
      this.fitUnifiedCardTaskTypography(container, this.els.addItemRow);
    });

    this.renderPhotoSlotsDOM(
      this.els.cardBackPhotos,
      this.state.reflectionPhotos || [],
      'today'
    );

    if (this.els.cardBackReflection) {
      if (this.els.cardBackReflection.value !== (this.state.reflectionText || '')) {
        this.els.cardBackReflection.value = this.state.reflectionText || '';
      }
      this.els.cardBackReflection.classList.remove('empty-readonly');
      this.adjustReflectionTypography(this.els.cardBackReflection);
      requestAnimationFrame(() => {
        this.adjustReflectionTypography(this.els.cardBackReflection);
      });
    }
  }

  renderPhotoSlotsDOM(containerEl, photosArray, targetType) {
    if (!containerEl) return;

    const photos = Array.isArray(photosArray) ? photosArray.slice(0, 2) : [];
    const isStackViewMode = targetType === 'stack' && !this.state.isStackEditMode;
    const bodyEl = containerEl.closest('.card-back-body');

    // 1. If 0 photos on a Past Card when NOT in Edit mode: hide photo boxes completely
    if (photos.length === 0 && isStackViewMode) {
      containerEl._photoSig = null;
      if (containerEl.firstChild) containerEl.innerHTML = '';
      containerEl.classList.add('hidden');
      containerEl.classList.remove('empty-photos', 'single-photo-expanded');
      if (bodyEl) bodyEl.classList.remove('single-photo-layout');
      return;
    }

    containerEl.classList.remove('hidden');
    containerEl.classList.toggle('empty-photos', photos.length === 0);
    // Expand single photo when there is only 1 picture (unless in Stack Edit mode where the 2nd add-photo box is shown)
    const expandSinglePhoto =
      photos.length === 1 && (isStackViewMode || targetType === 'today');
    containerEl.classList.toggle('single-photo-expanded', expandSinglePhoto);
    if (bodyEl) {
      bodyEl.classList.toggle('single-photo-layout', expandSinglePhoto);
    }

    const photoSig = `${targetType}|${isStackViewMode ? 1 : 0}|${this.state.language || 'en'}|${photos.join('||')}`;
    if (containerEl._photoSig === photoSig && containerEl.children.length > 0) {
      return;
    }
    containerEl._photoSig = photoSig;
    containerEl.innerHTML = '';

    if (photos.length === 0) {
      const addSlot = document.createElement('div');
      addSlot.className = 'journal-photo-slot';
      addSlot.title = this.t('Click to attach a photo');
      const label = document.createElement('span');
      label.className = 'journal-photo-add-label';
      label.textContent = this.t('+ Attach Photo (up to 2)');
      addSlot.appendChild(label);
      addSlot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._justFinishedCardSwipe) return;
        this.triggerPhotoAttachment(targetType);
      });
      containerEl.appendChild(addSlot);
      return;
    }

    photos.forEach((photoSrc, idx) => {
      const slot = document.createElement('div');
      slot.className = 'journal-photo-slot';
      slot.title = isStackViewMode
        ? this.t('Tap photo to view in detail')
        : this.t('Tap photo to view in detail, or tap × to remove');

      const img = document.createElement('img');
      img.className = 'journal-photo-img';
      img.decoding = 'sync';
      img.src = photoSrc;
      img.alt = `Evening journal memory photo ${idx + 1}`;
      slot.appendChild(img);

      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._justFinishedCardSwipe) return;
        if (targetType === 'stack' && this.state.isStackEditMode) {
          this.triggerPhotoAttachment(targetType, idx);
        } else {
          this.openPhotoLightbox(photoSrc);
        }
      });

      if (!isStackViewMode) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'journal-photo-remove-btn';
        removeBtn.setAttribute('aria-label', `Remove photo ${idx + 1}`);
        removeBtn.title = 'Remove photo';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (targetType === 'stack') {
            const card = this.getSelectedStackCard();
            if (card && Array.isArray(card.reflectionPhotos)) {
              card.reflectionPhotos.splice(idx, 1);
              this.saveState();
              this.renderStackScreen();
            }
          } else {
            this.state.reflectionPhotos.splice(idx, 1);
            this.saveState();
            this.renderCardScreen();
          }
        });
        slot.appendChild(removeBtn);

        if (targetType === 'today' && photos.length === 1) {
          const addSecondPill = document.createElement('button');
          addSecondPill.type = 'button';
          addSecondPill.className = 'journal-photo-add-second-pill';
          addSecondPill.textContent = this.t('+ 2nd Photo');
          addSecondPill.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._justFinishedCardSwipe) return;
            this.triggerPhotoAttachment(targetType);
          });
          slot.appendChild(addSecondPill);
        }
      }

      containerEl.appendChild(slot);
    });

    if (photos.length === 1 && targetType === 'stack' && this.state.isStackEditMode) {
      const secondSlot = document.createElement('div');
      secondSlot.className = 'journal-photo-slot';
      secondSlot.title = this.t('Click to attach a second photo');
      const label = document.createElement('span');
      label.className = 'journal-photo-add-label';
      label.textContent = this.t('+ Add 2nd Photo');
      secondSlot.appendChild(label);
      secondSlot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._justFinishedCardSwipe) return;
        this.triggerPhotoAttachment(targetType);
      });
      containerEl.appendChild(secondSlot);
    }
  }

  /**
   * Renders Screen 4: Chronological Card Stack Viewer (Mockup 06-stack-detail.png)
   */
  renderStackScreen() {
    const selectedCard = this.getSelectedStackCard();
    const sortedKeys = this.getSortedArchiveKeys();
    const navKeys = this.getNavigableStackDateKeys();
    const todayKey =
      this.state.cardDateKey || this.getCurrentLogicalDateString(this.state.dailyResetHour);
    const todayMeta = this.formatDateMetadataForKey(todayKey);
    const currentDateKey =
      (selectedCard && selectedCard.dateKey) ||
      this.state.selectedStackDateKey ||
      this.getOffsetDateKey(todayKey, -1);
    const curMeta = this.formatDateMetadataForKey(currentDateKey);

    if (this.els.stackDateStrip && !this._stackFilm) {
      const stripKeys = this.getStackStripDateKeys();
      const stripSignature = stripKeys.join(',');
      let monthBtn = this.els.stackDateStrip.querySelector('.stack-month-label');
      let pillsTrack = this.els.stackDateStrip.querySelector('.stack-date-pills-track');

      if (!monthBtn || !pillsTrack || pillsTrack.dataset.keysSignature !== stripSignature) {
        this.els.stackDateStrip.innerHTML = '';
        monthBtn = document.createElement('button');
        monthBtn.type = 'button';
        monthBtn.className = 'stack-month-label';
        monthBtn.title = this.t('Tap to jump between months');
        monthBtn.addEventListener('click', () => {
          const curM = this.formatDateMetadataForKey(
            this.state.selectedStackDateKey || this.getOffsetDateKey(todayKey, -1)
          ).monthKey;
          const prevMonth = curM === todayMeta.monthKey ? '2026-09' : todayMeta.monthKey;
          const monthDates = this.getNavigableStackDateKeys().filter((k) =>
            k.startsWith(`${prevMonth}-`)
          );
          if (monthDates.length > 0) {
            this.selectStackDate(monthDates[monthDates.length - 1]);
          }
        });
        this.els.stackDateStrip.appendChild(monthBtn);

        pillsTrack = document.createElement('div');
        pillsTrack.className = 'stack-date-pills-track';
        pillsTrack.dataset.keysSignature = stripSignature;

        stripKeys.forEach((dKey) => {
          const metaObj = this.formatDateMetadataForKey(dKey);
          const dPadded = String(metaObj.dayNum).padStart(2, '0');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'stack-date-pill';
          btn.textContent = dPadded;
          btn.dataset.dateKey = dKey;
          pillsTrack.appendChild(btn);
        });

        this.els.stackDateStrip.appendChild(pillsTrack);
      }

      monthBtn.textContent = curMeta.shortMonth;
      const pills = pillsTrack.querySelectorAll('.stack-date-pill');
      pills.forEach((btn) => {
        const dKey = btn.dataset.dateKey;
        const hasCard =
          Boolean(this.state.archiveCards[dKey]) || dKey === this.state.cardDateKey;
        const isSelected = currentDateKey === dKey;
        btn.classList.toggle('has-card', hasCard);
        btn.classList.toggle('active', isSelected);
      });

      if (!this._isDraggingDateStrip) {
        const smoothStrip = Boolean(this._stackStripSmoothOnce);
        this._stackStripSmoothOnce = false;
        requestAnimationFrame(() => {
          this.centerActiveDatePill(smoothStrip);
        });
      }
    }

    const curNavIdx = navKeys.indexOf(currentDateKey);
    if (this.els.stackPeekLeft) {
      this.els.stackPeekLeft.classList.toggle('disabled-peek', curNavIdx <= 0);
    }
    if (this.els.stackPeekRight) {
      this.els.stackPeekRight.classList.toggle(
        'disabled-peek',
        curNavIdx < 0 || curNavIdx >= navKeys.length - 1
      );
    }

    if (!selectedCard) {
      this.state.isStackCardFlipped = false;
      this.state.isStackEditMode = false;
      this._stackFlipDeg = 0;
      this.applyCard3DRotation(this.els.stackCard3D, false, 0);
      if (this.els.stackBtnFlip) this.els.stackBtnFlip.classList.add('hidden');
      if (this.els.stackBtnFlip && this.els.stackBtnFlip.parentElement) {
        this.els.stackBtnFlip.parentElement.classList.add('two-buttons');
      }
      if (this.els.stackBtnTrash) this.els.stackBtnTrash.classList.add('hidden');
      if (this.els.stackFrontEditBtn) this.els.stackFrontEditBtn.classList.add('hidden');
      if (this.els.stackBackEditBtn) this.els.stackBackEditBtn.classList.add('hidden');

      const meta = this.formatDateMetadataForKey(currentDateKey);
      if (this.els.stackCardDateHeader) {
        this.els.stackCardDateHeader.textContent = meta.headerDate;
      }
      if (this.els.stackCardBackDateHeader) {
        this.els.stackCardBackDateHeader.textContent = meta.headerDate;
      }
      if (this.els.stackTaskListContainer) {
        this.els.stackTaskListContainer.innerHTML = '';
        const emptySlotBtn = document.createElement('button');
        emptySlotBtn.type = 'button';
        emptySlotBtn.className = 'stack-retro-empty-slot';
        emptySlotBtn.id = 'stack-retro-add-card-btn';
        emptySlotBtn.innerHTML = `
          <span class="stack-retro-plus-icon">+</span>
          <span class="stack-retro-slot-title">${this.t('Add tasks / reflections retrospectively')}</span>
        `;
        emptySlotBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.createRetrospectiveCardForDate(meta.dateKey);
        });
        this.els.stackTaskListContainer.appendChild(emptySlotBtn);
      }
      if (this.els.stackAddItemRow) {
        this.els.stackAddItemRow.classList.add('hidden');
      }
      if (this.els.stackCardBackReflection) {
        this.els.stackCardBackReflection.value = '';
      }
      if (this.els.stackCardBackPhotos) {
        this.els.stackCardBackPhotos.innerHTML = '';
      }
      return;
    }

    if (this.els.stackBtnFlip) this.els.stackBtnFlip.classList.remove('hidden');
    if (this.els.stackBtnFlip && this.els.stackBtnFlip.parentElement) {
      this.els.stackBtnFlip.parentElement.classList.remove('two-buttons');
    }
    if (this.els.stackBtnTrash) this.els.stackBtnTrash.classList.remove('hidden');
    const isEditing = Boolean(this.state.isStackEditMode);
    if (this.els.stackFrontEditBtn) {
      this.els.stackFrontEditBtn.classList.remove('hidden');
      this.els.stackFrontEditBtn.textContent = this.t(isEditing ? 'Done' : 'Edit');
      this.els.stackFrontEditBtn.classList.toggle('is-editing', isEditing);
    }
    if (this.els.stackBackEditBtn) {
      this.els.stackBackEditBtn.classList.remove('hidden');
      this.els.stackBackEditBtn.textContent = this.t(isEditing ? 'Done' : 'Edit');
      this.els.stackBackEditBtn.classList.toggle('is-editing', isEditing);
    }

    if (this.state.isStackCardFlipped && Math.abs(this._stackFlipDeg % 360) !== 180) {
      this._stackFlipDeg = -180;
    } else if (!this.state.isStackCardFlipped && Math.abs(this._stackFlipDeg % 360) !== 0) {
      this._stackFlipDeg = 0;
    }
    this.applyCard3DRotation(
      this.els.stackCard3D,
      this.state.isStackCardFlipped,
      this._stackFlipDeg
    );

    this.els.stackCardDateHeader.textContent = selectedCard.headerDate;
    if (this.els.stackCardBackDateHeader) {
      this.els.stackCardBackDateHeader.textContent = selectedCard.headerDate;
    }

    const listEl = this.els.stackTaskListContainer;
    const existingStackRowsById = new Map();
    if (listEl._renderedDateKey === selectedCard.dateKey) {
      Array.from(listEl.children).forEach((child) => {
        if (
          child.classList.contains('task-row') &&
          child.dataset.taskId &&
          !child.classList.contains('is-inline-editing') &&
          !child.classList.contains('task-row-inline-adding') &&
          !child.querySelector('.task-inline-input')
        ) {
          existingStackRowsById.set(child.dataset.taskId, child);
        }
      });
    } else {
      listEl.innerHTML = '';
    }
    listEl._renderedDateKey = selectedCard.dateKey;

    const stackTasks = selectedCard.tasks || [];
    const totalTasks = stackTasks.length;
    const rowVertPad = 9;
    const desiredStackRows = [];

    stackTasks.forEach((task, idx) => {
      task.orderIndex = idx + 1;
      const fontSizePx = this.computeTaskFontSizePx(task.title, totalTasks);
      const nextIndexText = String(task.orderIndex).padStart(2, '0');
      const nextTitleText = this.displayTaskTitle(task.title);
      const nextCompleted = task.isCompleted ? 'true' : 'false';

      let row = existingStackRowsById.get(task.id);
      if (row) {
        existingStackRowsById.delete(task.id);
        row._taskRef = task;
        row.dataset.completed = nextCompleted;
        row.style.paddingTop = `${rowVertPad}px`;
        row.style.paddingBottom = `${rowVertPad}px`;

        const numSpan = row.querySelector('.task-index');
        if (numSpan) {
          numSpan.style.fontSize = `${fontSizePx}px`;
          if (numSpan.textContent !== nextIndexText) {
            numSpan.textContent = nextIndexText;
          }
        }
        const titleSpan = row.querySelector('.task-title');
        if (titleSpan) {
          titleSpan.style.fontSize = `${fontSizePx}px`;
          if (titleSpan.textContent !== nextTitleText) {
            titleSpan.textContent = nextTitleText;
          }
        }
      } else {
        row = document.createElement('div');
        row.className = 'task-row';
        row.dataset.taskId = task.id;
        row.dataset.completed = nextCompleted;
        row.style.paddingTop = `${rowVertPad}px`;
        row.style.paddingBottom = `${rowVertPad}px`;
        row._taskRef = task;

        const numSpan = document.createElement('span');
        numSpan.className = 'task-index';
        numSpan.style.fontSize = `${fontSizePx}px`;
        numSpan.textContent = nextIndexText;

        const titleWrap = document.createElement('div');
        titleWrap.className = 'task-title-wrap';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'task-title';
        titleSpan.style.fontSize = `${fontSizePx}px`;
        titleSpan.textContent = nextTitleText;
        titleWrap.appendChild(titleSpan);

        const strikeCanvas = document.createElement('canvas');
        strikeCanvas.className = 'pencil-strike-canvas';
        strikeCanvas.width = 720;
        strikeCanvas.height = 120;

        row.appendChild(numSpan);
        row.appendChild(titleWrap);
        row.appendChild(strikeCanvas);

        this.bindTaskRowPencilGesture(row, task, strikeCanvas, true);
      }
      desiredStackRows.push(row);
    });

    Array.from(listEl.children).forEach((child) => {
      if (!desiredStackRows.includes(child)) {
        child.remove();
      }
    });
    desiredStackRows.forEach((row, idx) => {
      if (listEl.children[idx] !== row) {
        listEl.insertBefore(row, listEl.children[idx] || null);
      }
    });

    if (this.els.stackAddItemRow) {
      this.els.stackAddItemRow.classList.remove('add-row-reserved');
      this.els.stackAddItemRow.classList.toggle(
        'hidden',
        !isEditing || stackTasks.length >= MAX_CARD_TASKS
      );
    }

    // Unify font size across all items on the Stack Card; only shrink if the whole card page is filled
    this.fitUnifiedCardTaskTypography(listEl, this.els.stackAddItemRow);
    requestAnimationFrame(() => {
      this.fitUnifiedCardTaskTypography(listEl, this.els.stackAddItemRow);
    });

    this.renderPhotoSlotsDOM(
      this.els.stackCardBackPhotos,
      selectedCard.reflectionPhotos || [],
      'stack'
    );

    if (this.els.stackCardBackReflection) {
      const refText = selectedCard.reflectionText || '';
      if (this.els.stackCardBackReflection.value !== refText) {
        this.els.stackCardBackReflection.value = refText;
      }
      this.els.stackCardBackReflection.readOnly = !isEditing;
      this.els.stackCardBackReflection.placeholder = isEditing
        ? this.t('Write or update your reflection for this day...')
        : '';
      const hasPhotos =
        Array.isArray(selectedCard.reflectionPhotos) &&
        selectedCard.reflectionPhotos.length > 0;
      this.els.stackCardBackReflection.classList.toggle(
        'empty-readonly',
        !isEditing && !refText.trim() && hasPhotos
      );
      this.adjustReflectionTypography(this.els.stackCardBackReflection);
      requestAnimationFrame(() => {
        this.adjustReflectionTypography(this.els.stackCardBackReflection);
      });
    }
  }

  /**
   * Renders Screen 5: Monthly Calendar Zoom-Out View (Mockup 07-calendar-view.png)
   * Loads dates from Sept 1, 2026 to Dec 31, 2026 (always showing 2 additional months after the current month).
   */
  renderCalendarScreen() {
    const container = this.els.calendarMonthsContainer;
    if (!container) return;

    const fullMonthNames = [
      'JANUARY',
      'FEBRUARY',
      'MARCH',
      'APRIL',
      'MAY',
      'JUNE',
      'JULY',
      'AUGUST',
      'SEPTEMBER',
      'OCTOBER',
      'NOVEMBER',
      'DECEMBER',
    ];

    // Base range: SEPTEMBER 2026 through DECEMBER 2026, always guaranteeing 2 additional months after current card month
    const activeDateKey =
      this.state.cardDateKey || this.getCurrentLogicalDateString(this.state.dailyResetHour);
    const [curYearStr, curMonthStr] = activeDateKey.split('-');
    const curYear = parseInt(curYearStr, 10) || 2026;
    const curMonthIdx = (parseInt(curMonthStr, 10) || 10) - 1;

    const startTotalMonths = 2026 * 12 + 8; // Sep 2026 (index 8)
    const minEndTotalMonths = 2026 * 12 + 11; // Dec 2026 (index 11)
    const dynamicEndTotalMonths = curYear * 12 + curMonthIdx + 2; // Always +2 months after current month
    const endTotalMonths = Math.max(minEndTotalMonths, dynamicEndTotalMonths);
    const rangeSig = `${startTotalMonths}:${endTotalMonths}`;

    if (container._calRangeSig === rangeSig && container.children.length > 0) {
      container.querySelectorAll('.cal-day-btn').forEach((btn) => {
        const dateKey = btn.dataset.dateKey;
        if (!dateKey) return;
        const hasArchivedCard = Boolean(this.state.archiveCards[dateKey]);
        const isTodayCard = dateKey === activeDateKey;
        const isSelected = dateKey === this.state.selectedStackDateKey;
        const isFutureDate = dateKey > activeDateKey && !hasArchivedCard;
        btn.classList.toggle('has-card', hasArchivedCard || isTodayCard);
        btn.classList.toggle('is-today', isTodayCard);
        btn.classList.toggle('is-selected', isSelected);
        btn.classList.toggle('is-future', isFutureDate);
      });
      return;
    }

    container._calRangeSig = rangeSig;
    container.innerHTML = '';

    const months = [];
    for (let totalM = startTotalMonths; totalM <= endTotalMonths; totalM++) {
      const y = Math.floor(totalM / 12);
      const mIdx = totalM % 12;
      const mNumPadded = String(mIdx + 1).padStart(2, '0');
      const monthKey = `${y}-${mNumPadded}`;
      const title =
        monthKey === '2026-09'
          ? 'SEPTEMBER 2026'
          : monthKey === '2026-10'
          ? 'OCTOBER 2026'
          : `${fullMonthNames[mIdx]} ${y}`;
      const daysInMonth = new Date(y, mIdx + 1, 0).getDate();
      const startDayOfWeek = new Date(y, mIdx, 1).getDay();
      months.push({
        monthKey,
        title,
        daysInMonth,
        startDayOfWeek,
      });
    }

    const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    months.forEach((m) => {
      const block = document.createElement('div');
      block.className = 'cal-month-block';

      const titleEl = document.createElement('h2');
      titleEl.className = 'cal-month-title';
      titleEl.textContent = m.title;
      block.appendChild(titleEl);

      const wkRow = document.createElement('div');
      wkRow.className = 'cal-weekday-row';
      weekdays.forEach((w) => {
        const span = document.createElement('span');
        span.textContent = w;
        wkRow.appendChild(span);
      });
      block.appendChild(wkRow);

      const grid = document.createElement('div');
      grid.className = 'cal-days-grid';

      for (let e = 0; e < m.startDayOfWeek; e++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day-empty';
        grid.appendChild(empty);
      }

      for (let d = 1; d <= m.daysInMonth; d++) {
        const dPadded = String(d).padStart(2, '0');
        const dateKey = `${m.monthKey}-${dPadded}`;
        const hasArchivedCard = Boolean(this.state.archiveCards[dateKey]);
        const isTodayCard = dateKey === activeDateKey;
        const isSelected = dateKey === this.state.selectedStackDateKey;
        const isFutureDate = dateKey > activeDateKey && !hasArchivedCard;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cal-day-btn';
        btn.dataset.dateKey = dateKey;
        btn.textContent = String(d);

        if (hasArchivedCard || isTodayCard) {
          btn.classList.add('has-card');
        }
        if (isTodayCard) {
          btn.classList.add('is-today');
        }
        if (isSelected) {
          btn.classList.add('is-selected');
        }
        if (isFutureDate) {
          btn.classList.add('is-future');
        }

        btn.addEventListener('click', () => {
          const curActiveDateKey =
            this.state.cardDateKey || this.getCurrentLogicalDateString(this.state.dailyResetHour);
          const curHasArchived = Boolean(this.state.archiveCards[dateKey]);
          const curIsToday = dateKey === curActiveDateKey;
          const curIsFuture = dateKey > curActiveDateKey && !curHasArchived;
          if (curIsToday) {
            this.sensory.playCardFlipSwoosh();
            this.state.activePillar = 'card';
            this.state.isCardFlipped = false;
            this._todayFlipDeg = 0;
            this.saveState();
            this.renderAll();
          } else if (curIsFuture) {
            this.showTelemetryToast(this.t('Future date'));
          } else {
            this.sensory.playStackRiffleTick();
            this.zoomInCalendarToStack(dateKey);
          }
        });

        grid.appendChild(btn);
      }

      block.appendChild(grid);
      container.appendChild(block);
    });
  }

  /**
   * Computes the horizontal and vertical line segments for every wrapped line of text
   * inside a `.task-row`, ensuring that:
   * 1. Line 1 starts across the `01` task index and crosses out the full first line of text.
   * 2. Line 2 (and any subsequent line) starts at the left edge of `.task-title` and crosses out
   *    that line of text (matching Mockup 06-stack-detail.png).
   * 3. No strikethrough line ever gets too close to the right edge of the card or the mini-tomato icon.
   */
  getTaskRowLineSegments(canvas) {
    const rowEl = canvas.parentElement;
    if (!rowEl) {
      return [{ minX: 24, maxX: 260, centerY: 16 }];
    }

    const rowRect = rowEl.getBoundingClientRect();
    const rowW = Math.max(280, rowEl.clientWidth || rowEl.offsetWidth || rowRect.width || 362);
    const rowH = Math.max(36, rowEl.clientHeight || rowEl.offsetHeight || rowRect.height || 48);

    const numSpan = rowEl.querySelector('.task-index');
    const titleSpan = rowEl.querySelector('.task-title');
    const tomatoBtn = rowEl.querySelector('.task-tomato-btn');

    // Use untransformed local offsetLeft/offsetWidth so 3D card rotation never shifts boundaries
    let maxSafeRightX = rowW - 30;
    if (tomatoBtn && tomatoBtn.offsetWidth > 0) {
      maxSafeRightX = Math.min(maxSafeRightX, tomatoBtn.offsetLeft - 16);
    }

    const indexLeftX =
      numSpan && numSpan.offsetWidth > 0
        ? Math.max(18, numSpan.offsetLeft - 3)
        : 22;

    const segKey = `${rowW}|${rowH}|${titleSpan ? titleSpan.textContent : ''}|${
      titleSpan ? titleSpan.style.fontSize : ''
    }|${indexLeftX}|${maxSafeRightX}`;

    const wrapperEl = rowEl.closest('.daily-card-3d');
    const numRect = numSpan ? numSpan.getBoundingClientRect() : null;
    const titleRect = titleSpan ? titleSpan.getBoundingClientRect() : null;
    const isMirrored = Boolean(
      (wrapperEl && wrapperEl.classList.contains('is-flipped')) ||
        (numRect && titleRect && numRect.width > 0 && titleRect.width > 0 && numRect.left > titleRect.left)
    );
    const isMidRotation = rowRect.width > 0 && Math.abs(rowRect.width - rowW) > 1.5;

    if ((isMirrored || isMidRotation) && rowEl._cachedLineSegments && rowEl._cachedLineSegmentsKey === segKey) {
      return rowEl._cachedLineSegments;
    }

    if (titleSpan) {
      const clientRects = Array.from(titleSpan.getClientRects()).filter(
        (r) => r.width > 2 && r.height > 4
      );
      if (clientRects.length > 0 && rowRect.width > 4) {
        const scaleX = rowW / rowRect.width;
        const scaleY = rowRect.height > 4 ? rowH / rowRect.height : 1;
        const segments = clientRects.map((r, lineIdx) => {
          const localLeft = isMirrored
            ? (rowRect.right - r.right) * scaleX
            : (r.left - rowRect.left) * scaleX;
          const localRight = isMirrored
            ? (rowRect.right - r.left) * scaleX
            : (r.right - rowRect.left) * scaleX;
          const lineStartX =
            lineIdx === 0
              ? indexLeftX
              : Math.max(58, localLeft - 3);
          const rawEndX = localRight + 14;
          const lineEndX = Math.max(
            lineStartX + 36,
            Math.min(maxSafeRightX, rawEndX)
          );
          const lineCenterY = ((r.top + r.bottom) * 0.5 - rowRect.top) * scaleY;
          return {
            minX: lineStartX,
            maxX: lineEndX,
            centerY: lineCenterY,
          };
        });
        if (!isMirrored && !isMidRotation) {
          rowEl._cachedLineSegments = segments;
          rowEl._cachedLineSegmentsKey = segKey;
        }
        return segments;
      }
    }

    // Fallback when called before layout rects are populated
    return [{ minX: indexLeftX, maxX: maxSafeRightX, centerY: rowH * 0.5 }];
  }

  /**
   * Draws a straight horizontal dry-graphite pencil strikethrough across EVERY wrapped line
   * of a task item between normalized [startProgress, endProgress].
   */
  drawGraphiteStroke(canvas, startProgress = 0.0, endProgress = 0.0) {
    const rowEl = canvas.parentElement;
    const cssW = Math.max(280, (rowEl && rowEl.clientWidth) || 362);
    const cssH = Math.max(36, (rowEl && rowEl.clientHeight) || 48);

    const dpr = 2;
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sProg = Math.max(0.0, Math.min(1.0, startProgress));
    const eProg = Math.max(0.0, Math.min(1.0, endProgress));
    if (eProg - sProg <= 0.01) return;

    const lineSegments = this.getTaskRowLineSegments(canvas);

    ctx.save();
    ctx.scale(dpr, dpr);

    lineSegments.forEach((seg, segIdx) => {
      const minX = seg.minX;
      const maxX = seg.maxX;
      const totalSpan = Math.max(20, maxX - minX);
      const currentStartX = minX + totalSpan * sProg;
      const currentEndX = minX + totalSpan * eProg;
      const centerY = seg.centerY;

      const grad = ctx.createLinearGradient(minX, centerY, maxX, centerY);
      grad.addColorStop(0.0, 'rgba(65, 63, 60, 0.88)');
      grad.addColorStop(0.72, 'rgba(72, 70, 66, 0.82)');
      grad.addColorStop(0.90, 'rgba(110, 108, 104, 0.56)');
      grad.addColorStop(1.0, 'rgba(150, 148, 144, 0.14)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.35;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(currentStartX, centerY);
      ctx.lineTo(currentEndX, centerY);
      ctx.stroke();

      const numGrains = Math.floor(totalSpan * 2.4);
      for (let i = 0; i < numGrains; i++) {
        const t = i / Math.max(1, numGrains);
        if (t < sProg || t > eProg) continue;
        const gx = minX + t * totalSpan;
        const seed = i + segIdx * 137;
        const hash1 = Math.sin(seed * 12.9898 + 4.1) * 43758.5453;
        const frac1 = hash1 - Math.floor(hash1);
        const hash2 = Math.cos(seed * 78.233 + 1.7) * 24634.6345;
        const frac2 = hash2 - Math.floor(hash2);

        const offsetY = (frac1 - 0.5) * 3.4;
        const tailFade = t > 0.74 ? (1.0 - (t - 0.74) / 0.26) * 0.85 : 1.0;
        const alpha = (0.22 + 0.36 * frac2) * tailFade;

        ctx.fillStyle = `rgba(58, 56, 53, ${alpha.toFixed(3)})`;
        ctx.fillRect(gx, centerY + offsetY - 0.45, 1.15, 0.95);
      }
    });

    ctx.restore();
  }

  bindTaskRowPencilGesture(rowEl, task, strikeCanvas, isStackCard = false) {
    rowEl._taskRef = task;
    let startX = null;
    let startY = null;
    let isTracking = false;
    // True when the swipe began on the blank part of the row (right of the text): that is
    // empty card space, so it may flip the card. Swipes on the task text only cross out / undo.
    let startedOnBlankSpace = false;

    rowEl.addEventListener('pointerdown', (e) => {
      if (isStackCard && !this.state.isStackEditMode) {
        return;
      }
      if (
        rowEl.querySelector('.task-inline-input') ||
        e.target.closest('.task-tomato-btn') ||
        e.target.closest('.task-inline-input') ||
        e.target.closest('.task-inline-edit-wrap') ||
        e.target.closest('.task-inline-delete-btn') ||
        e.target.closest('textarea, input')
      ) {
        return;
      }
      // Past cards: swipes from the card's left/right edge scroll the stack instead
      if (isStackCard && this.isInStackCardEdgeZone(e)) {
        return;
      }
      e.stopPropagation(); // QA #1: Prevent bubbling to #daily-card-3d / #stack-card-3d so flip doesn't double-toggle
      const pt = this.getPointerXY(e);
      startX = pt.x;
      startY = pt.y;
      const rowRect = rowEl.getBoundingClientRect();
      const relX = e.clientX - rowRect.left;

      // Determine where the actual task text ends so swiping on empty white space to the right flips the card!
      let maxTextRightX = rowRect.width - 52;
      const titleSpan = rowEl.querySelector('.task-title');
      if (titleSpan) {
        const rects = Array.from(titleSpan.getClientRects()).filter((r) => r.width > 2);
        if (rects.length > 0) {
          maxTextRightX = Math.max(...rects.map((r) => r.right - rowRect.left));
        }
      }

      startedOnBlankSpace = relX > maxTextRightX + 18;
      isTracking = true;
      try {
        rowEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    rowEl.addEventListener('pointermove', (e) => {
      if (!isTracking || startX === null) return;
      const curTask = rowEl._taskRef || task;
      const pt = this.getPointerXY(e);
      const dx = pt.x - startX;
      const dy = pt.y - startY;

      const activeWrapper = isStackCard ? this.els.stackCard3D : this.els.card3DWrapper;
      const baseDeg = isStackCard ? this._stackFlipDeg : this._todayFlipDeg;

      if (startedOnBlankSpace) {
        if (activeWrapper && Math.abs(dx) > Math.abs(dy) * 1.15) {
          const tiltOffset = Math.max(-65, Math.min(65, (dx / 180) * 65));
          const liveDeg = baseDeg + tiltOffset;
          activeWrapper.style.transition = 'none';
          activeWrapper.style.transform = `rotateY(${liveDeg.toFixed(1)}deg)`;
        }
        return;
      }

      const progress = CardGestureMath.strikethroughProgress(
        dx,
        dy,
        rowEl.clientWidth || 280
      );
      if (progress > 0) {
        if (!curTask.isCompleted) {
          this.drawGraphiteStroke(strikeCanvas, 0.0, progress);
        } else {
          this.drawGraphiteStroke(strikeCanvas, progress, 1.0);
        }
      }
    });

    const finishGesture = (e) => {
      if (!isTracking || startX === null) return;
      const curTask = rowEl._taskRef || task;
      e.stopPropagation();
      isTracking = false;
      try {
        rowEl.releasePointerCapture(e.pointerId);
      } catch (_) {}

      const activeWrapper = isStackCard ? this.els.stackCard3D : this.els.card3DWrapper;
      if (activeWrapper) {
        activeWrapper.style.transition = '';
        activeWrapper.style.transform = '';
      }

      const pt = this.getPointerXY(e);
      const dx = pt.x - startX;
      const dy = pt.y - startY;
      startX = null;
      startY = null;

      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
        this.drawGraphiteStroke(strikeCanvas, 0.0, curTask.isCompleted ? 1.0 : 0.0);
        if (!isStackCard || this.state.isStackEditMode) {
          // The touchend that follows must not produce iOS's delayed mousedown/click,
          // which would land on the freshly changed layout and steal focus.
          rowEl._suppressCompatClick = true;
          clearTimeout(rowEl._suppressCompatTimer);
          // iOS may deliver that touchend to the replaced title node (never reaching the row),
          // so the flag must expire on its own instead of lingering until the next tap.
          rowEl._suppressCompatTimer = setTimeout(() => {
            rowEl._suppressCompatClick = false;
          }, 350);
          this.startInlineEditTask(rowEl, curTask, isStackCard, true);
        }
        return;
      }

      const gesture = CardGestureMath.classifyGesture(dx, dy, !startedOnBlankSpace);
      if (!startedOnBlankSpace && gesture === 'strikethrough') {
        curTask.isCompleted = !curTask.isCompleted;
        rowEl.dataset.completed = curTask.isCompleted ? 'true' : 'false';
        this.sensory.playPencilStrikethrough(!curTask.isCompleted);
        this.drawGraphiteStroke(strikeCanvas, 0.0, curTask.isCompleted ? 1.0 : 0.0);
        this.saveState();
      } else if (
        startedOnBlankSpace &&
        (gesture === 'flipCard' ||
          (Math.abs(dx) >= 22 && Math.abs(dx) > Math.abs(dy) * 1.15))
      ) {
        this.drawGraphiteStroke(strikeCanvas, 0.0, curTask.isCompleted ? 1.0 : 0.0);
        const dir = dx >= 0 ? 1 : -1;
        if (isStackCard) {
          this.triggerStackCardFlip(dir);
        } else {
          this.triggerCardFlip(dir);
        }
      } else {
        this.drawGraphiteStroke(strikeCanvas, 0.0, curTask.isCompleted ? 1.0 : 0.0);
      }
    };

    rowEl.addEventListener('pointerup', finishGesture);
    rowEl.addEventListener('pointercancel', finishGesture);
    rowEl.addEventListener(
      'touchend',
      (e) => {
        if (!rowEl._suppressCompatClick) return;
        rowEl._suppressCompatClick = false;
        clearTimeout(rowEl._suppressCompatTimer);
        // Never swallow a tap on the × delete button
        if (e.target && e.target.closest && e.target.closest('.task-inline-delete-btn')) return;
        if (e.cancelable) e.preventDefault();
      },
      { passive: false }
    );
  }

  /**
   * Renders Screen 2: 6-Pomodoro 2x3 Grid View (Mockup 03-grid-timer.png)
   * Updates each quadrant in-place without destroying/recreating existing tomato DOM nodes
   * so other tomatoes never flash or reload when clicking or editing on the grid.
   */
  renderGridScreen() {
    this.state.timers.forEach((slot, qIdx) => {
      const quadEl = this.els.gridQuadrants[qIdx];
      if (!quadEl) return;

      const isAssigned = Boolean(slot.assignedTaskId || slot.customTitle);
      const isCompleted = slot.runState === 'completed';
      const paletteKey = isAssigned ? qIdx : 'unassigned';
      const imgDataUrl = this.gridRenderer.getDataURL(paletteKey);
      const silverImgDataUrl = this.gridRenderer.getDataURL('completed');

      const readoutText = OdometerDialPhysics.formatMockupReadout(
        slot.remainingSeconds
      );
      const shortTitleText = OdometerDialPhysics.formatShortTomatoTitle(
        this.displayTaskTitle(slot.customTitle || ''),
        2,
        13
      );
      const isDropdownOpen = this.state.openDropdownQuadrant === qIdx;

      // Build persistent quadrant DOM once per quadrant
      if (!quadEl._tomatoWrap) {
        quadEl.innerHTML = '';

        const tomatoWrap = document.createElement('div');
        tomatoWrap.className = 'grid-tomato-wrap';

        const baseImg = document.createElement('img');
        baseImg.className = 'grid-tomato-img grid-tomato-base-img';
        baseImg.decoding = 'sync';
        tomatoWrap.appendChild(baseImg);

        const silverImg = document.createElement('img');
        silverImg.className = 'grid-tomato-img grid-tomato-silver-img';
        silverImg.decoding = 'sync';
        silverImg.src = silverImgDataUrl;
        silverImg.alt = '';
        silverImg.setAttribute('aria-hidden', 'true');
        tomatoWrap.appendChild(silverImg);

        const overlay = document.createElement('div');
        overlay.className = 'grid-tomato-overlay';
        tomatoWrap.appendChild(overlay);

        tomatoWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          const curSlot = this.state.timers[qIdx];
          const curAssigned = Boolean(curSlot && (curSlot.assignedTaskId || curSlot.customTitle));
          this.state.openDropdownQuadrant = null;
          this.state.selectedQuadrant = qIdx;
          this.state.timerSubMode = 'hero';
          this.saveState();
          this.renderAll();
          if (!curAssigned) {
            this.openHeroTitleEditor();
          }
        });

        const controlsRow = document.createElement('div');
        controlsRow.className = 'grid-controls-row';

        quadEl.appendChild(tomatoWrap);
        quadEl.appendChild(controlsRow);

        quadEl._tomatoWrap = tomatoWrap;
        quadEl._baseImg = baseImg;
        quadEl._silverImg = silverImg;
        quadEl._overlay = overlay;
        quadEl._controlsRow = controlsRow;
      }

      const tomatoWrap = quadEl._tomatoWrap;
      const baseImg = quadEl._baseImg;
      const overlay = quadEl._overlay;
      const controlsRow = quadEl._controlsRow;

      // Only update baseImg.src when paletteKey actually changes so the image never re-decodes/flashes
      const paletteKeyStr = String(paletteKey);
      if (baseImg.dataset.paletteKey !== paletteKeyStr) {
        baseImg.dataset.paletteKey = paletteKeyStr;
        baseImg.src = imgDataUrl;
      }
      const nextAlt = isAssigned
        ? `${shortTitleText} Tomato Timer`
        : 'Unassigned Tomato Timer';
      if (baseImg.alt !== nextAlt) {
        baseImg.alt = nextAlt;
      }

      // Smoothly transition or maintain silver completion state without resetting unchanged tomatoes
      if (slot._justTransitionedSilver) {
        slot._justTransitionedSilver = false;
        tomatoWrap.classList.remove('is-silver-completed');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            tomatoWrap.classList.add('is-silver-completed');
          });
        });
      } else if (slot._justTransitionedFromSilver) {
        slot._justTransitionedFromSilver = false;
        tomatoWrap.classList.add('is-silver-completed');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            tomatoWrap.classList.remove('is-silver-completed');
          });
        });
      } else {
        tomatoWrap.classList.toggle('is-silver-completed', Boolean(isAssigned && isCompleted));
      }

      // Update overlay in-place
      if (isAssigned) {
        tomatoWrap.title = this.t('Tap tomato body to open Hero Timer; tap title text to edit/reassign');
        if (overlay._tapLabel) {
          overlay._tapLabel.remove();
          overlay._tapLabel = null;
        }
        if (!overlay._titleEl) {
          const titleEl = document.createElement('div');
          titleEl.className = 'grid-tomato-title';
          titleEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.state.openDropdownQuadrant =
              this.state.openDropdownQuadrant === qIdx ? null : qIdx;
            this.renderGridScreen();
          });
          overlay.appendChild(titleEl);
          overlay._titleEl = titleEl;
        }
        overlay._titleEl.title = this.t('Tap title to edit or reassign task');
        if (overlay._titleEl.textContent !== shortTitleText) {
          overlay._titleEl.textContent = shortTitleText;
        }

        if (!overlay._timeEl) {
          const timeEl = document.createElement('div');
          timeEl.className = 'grid-tomato-time';
          overlay.appendChild(timeEl);
          overlay._timeEl = timeEl;
        }
        overlay._timeEl.classList.toggle('has-hours', slot.remainingSeconds > 3600);
        if (overlay._timeEl.textContent !== readoutText) {
          overlay._timeEl.textContent = readoutText;
        }
      } else {
        tomatoWrap.title = this.t('Tap to assign a task to this tomato');
        if (overlay._titleEl) {
          overlay._titleEl.remove();
          overlay._titleEl = null;
        }
        if (overlay._timeEl) {
          overlay._timeEl.remove();
          overlay._timeEl = null;
        }
        if (!isDropdownOpen) {
          if (!overlay._tapLabel) {
            const tapLabel = document.createElement('div');
            tapLabel.className = 'grid-tap-to-assign';
            overlay.appendChild(tapLabel);
            overlay._tapLabel = tapLabel;
          }
          const tapText = this.t('Tap to assign');
          if (overlay._tapLabel.textContent !== tapText) {
            overlay._tapLabel.textContent = tapText;
          }
        } else if (overlay._tapLabel) {
          overlay._tapLabel.remove();
          overlay._tapLabel = null;
        }
      }

      // Update task assignment dropdown on this quadrant only
      const existingDropdown = tomatoWrap.querySelector('.task-assign-dropdown');
      if (existingDropdown) {
        existingDropdown.remove();
      }
      if (isDropdownOpen) {
        const dropdown = this.buildTaskDropdownDOM(qIdx);
        tomatoWrap.appendChild(dropdown);
      }

      // Update controls row in-place
      if (isAssigned) {
        if (!controlsRow._playPauseBtn) {
          const playPauseBtn = document.createElement('button');
          playPauseBtn.type = 'button';
          playPauseBtn.className = 'grid-ctrl-btn';
          playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause(qIdx);
          });
          controlsRow._playPauseBtn = playPauseBtn;
        }
        const playPauseBtn = controlsRow._playPauseBtn;
        const isRunning = slot.runState === 'running';
        playPauseBtn.setAttribute(
          'aria-label',
          isRunning ? this.t('Pause Timer') : this.t('Start Timer')
        );
        const desiredPlayState = isRunning ? 'running' : 'idle';
        if (playPauseBtn.dataset.iconState !== desiredPlayState) {
          playPauseBtn.dataset.iconState = desiredPlayState;
          playPauseBtn.innerHTML = isRunning
            ? `<svg width="20" height="24" viewBox="0 0 24 28"><rect x="3" y="2" width="6.5" height="24" rx="1.5" fill="#0F0F0F"/><rect x="14.5" y="2" width="6.5" height="24" rx="1.5" fill="#0F0F0F"/></svg>`
            : `<svg width="20" height="24" viewBox="0 0 24 28"><path d="M4 2.5 L22 14 L4 25.5 Z" fill="#0F0F0F" stroke="#0F0F0F" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
        }
        if (playPauseBtn.parentElement !== controlsRow) {
          controlsRow.appendChild(playPauseBtn);
        }

        if (this.isTimerSlotSet(slot)) {
          if (!controlsRow._stopBtn) {
            const stopBtn = document.createElement('button');
            stopBtn.type = 'button';
            stopBtn.className = 'grid-ctrl-btn';
            stopBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.handleEndOrResetButton(qIdx);
            });
            controlsRow._stopBtn = stopBtn;
          }
          const stopBtn = controlsRow._stopBtn;
          stopBtn.setAttribute(
            'aria-label',
            isCompleted ? this.t('Reset Timer to 00:00') : this.t('End Timer (Turn Silver Metallic)')
          );
          stopBtn.title = isCompleted
            ? this.t('Reset Tomato Timer to 00:00')
            : this.t('End Timer (Turns tomato Silver Metallic without clearing)');
          const desiredStopState = isCompleted ? 'completed' : 'active';
          if (stopBtn.dataset.iconState !== desiredStopState) {
            stopBtn.dataset.iconState = desiredStopState;
            stopBtn.innerHTML = isCompleted
              ? `<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M4.8 9.8C6.2 6.1 9.8 3.6 13.8 3.6C18.9 3.6 22.4 7.8 22.4 12.6C22.4 17.6 18.4 21.4 13.5 21.4C9.5 21.4 6.1 18.9 4.9 15.3" stroke="#0F0F0F" stroke-width="2.3" stroke-linecap="round"/><path d="M3.5 4.5V10.3H9.3" stroke="#0F0F0F" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
              : `<svg width="20" height="20" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2.5" fill="#0F0F0F"/></svg>`;
          }
          if (stopBtn.parentElement !== controlsRow) {
            controlsRow.appendChild(stopBtn);
          }
        } else if (controlsRow._stopBtn && controlsRow._stopBtn.parentElement === controlsRow) {
          controlsRow._stopBtn.remove();
        }
      } else {
        if (controlsRow._playPauseBtn && controlsRow._playPauseBtn.parentElement === controlsRow) {
          controlsRow._playPauseBtn.remove();
        }
        if (controlsRow._stopBtn && controlsRow._stopBtn.parentElement === controlsRow) {
          controlsRow._stopBtn.remove();
        }
      }
    });
  }

  buildTaskDropdownDOM(quadrant) {
    const slot = this.state.timers[quadrant];
    const hasExistingTitle = Boolean(slot && (slot.assignedTaskId || slot.customTitle));

    const menu = document.createElement('div');
    menu.className = 'task-assign-dropdown';
    menu.addEventListener('click', (e) => e.stopPropagation());

    const customBtn = document.createElement('button');
    customBtn.type = 'button';
    customBtn.className = 'dropdown-custom-header';
    const headerLabel = this.t(hasExistingTitle ? '✎ Edit Title...' : '+ Custom Title...');
    customBtn.innerHTML = `
      <span>${headerLabel}</span>
      <svg width="14" height="9" viewBox="0 0 14 9" fill="none">
        <path d="M1.5 1.5L7 7L12.5 1.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    customBtn.addEventListener('click', () => {
      this.openCustomTitleModal(quadrant);
    });
    menu.appendChild(customBtn);

    const listBody = document.createElement('div');
    listBody.className = 'dropdown-task-list';

    const availableTasks = this.state.tasks.filter(
      (t) => t.assignedQuadrant === null || t.assignedQuadrant === undefined
    );

    availableTasks.forEach((t) => {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'dropdown-task-item';
      itemBtn.textContent = this.displayTaskTitle(t.title);
      itemBtn.addEventListener('click', () => {
        this.assignTaskToQuadrant(quadrant, t);
      });
      listBody.appendChild(itemBtn);
    });

    if (hasExistingTitle) {
      const unassignBtn = document.createElement('button');
      unassignBtn.type = 'button';
      unassignBtn.className = 'dropdown-task-item';
      unassignBtn.style.color = '#8B1E24';
      unassignBtn.textContent = this.t('✕ Unassign Tomato');
      unassignBtn.addEventListener('click', () => {
        this.clearQuadrantAssignment(quadrant);
      });
      listBody.appendChild(unassignBtn);
    }

    if (availableTasks.length === 0 && !hasExistingTitle) {
      menu.classList.add('has-no-task-items');
    }

    menu.appendChild(listBody);
    return menu;
  }

  /**
   * Renders Screen 3: Single Big Hero Tomato View (Mockup 02-hero-timer.png)
   */
  renderHeroScreen() {
    const slot =
      this.state.timers[this.state.selectedQuadrant] || this.state.timers[0];

    const nextReadout = OdometerDialPhysics.formatMockupReadout(
      slot.remainingSeconds
    );
    if (this.els.heroReadout.textContent !== nextReadout) {
      this.els.heroReadout.textContent = nextReadout;
    }
    this.els.heroReadout.classList.toggle('has-hours', slot.remainingSeconds > 3600);

    let nextSubtitle = '';
    if (slot.assignedTaskId || slot.customTitle) {
      const orderStr = String(slot.assignedTaskOrder || slot.quadrant + 1).padStart(
        2,
        '0'
      );
      const shortTitle = OdometerDialPhysics.formatShortTomatoTitle(
        this.displayTaskTitle(slot.customTitle || '') || this.t('Example Task'),
        4,
        22
      );
      nextSubtitle = `${orderStr} / ${shortTitle}`;
    } else {
      const orderStr = String(slot.quadrant + 1).padStart(2, '0');
      nextSubtitle = `${orderStr} / ${this.t('TAP TO ASSIGN')}`;
    }
    if (this.els.heroSubtitle.textContent !== nextSubtitle) {
      this.els.heroSubtitle.textContent = nextSubtitle;
    }

    if (this.els.heroSyncToCardBtn) {
      const canSyncToCard = this.isSlotCustomUnlinkedTitle(slot);
      this.els.heroSyncToCardBtn.classList.toggle('hidden', !canSyncToCard);
      const syncLabel = this.els.heroSyncToCardBtn.querySelector('.hero-sync-to-card-label');
      const nextSyncText = this.t('+ Card');
      if (syncLabel && syncLabel.textContent !== nextSyncText) {
        syncLabel.textContent = nextSyncText;
      }
    }

    if (this.els.heroSubtitleDropdownMount) {
      if (this.state.isHeroDropdownOpen) {
        this.els.heroSubtitleDropdownMount.innerHTML = '';
        this.els.heroSubtitleDropdownMount.appendChild(
          this.buildTaskDropdownDOM(slot.quadrant)
        );
      } else if (this.els.heroSubtitleDropdownMount.firstChild) {
        this.els.heroSubtitleDropdownMount.innerHTML = '';
      }
    }

    const isAssigned = Boolean(slot.assignedTaskId || slot.customTitle);
    const isCompleted = slot.runState === 'completed';
    if (this.hero3D) {
      this.hero3D.updateOdometer(
        slot.angleDegrees,
        slot.quadrant,
        isAssigned,
        isCompleted
      );
    }

    const playIconState = slot.runState === 'running' ? 'running' : 'paused';
    if (this.els.heroBtnPlayPause.dataset.iconState !== playIconState) {
      this.els.heroBtnPlayPause.dataset.iconState = playIconState;
      this.els.heroBtnPlayPause.innerHTML =
        playIconState === 'running'
          ? `<svg width="36" height="44" viewBox="0 0 36 44"><rect x="4" y="2" width="10" height="40" rx="3" fill="#0F0F0F"/><rect x="22" y="2" width="10" height="40" rx="3" fill="#0F0F0F"/></svg>`
          : `<svg width="36" height="44" viewBox="0 0 36 44"><path d="M6 3 L33 22 L6 41 Z" fill="#0F0F0F" stroke="#0F0F0F" stroke-width="2" stroke-linejoin="round"/></svg>`;
    }

    if (this.els.heroBtnStop) {
      const isSet = this.isTimerSlotSet(slot);
      this.els.heroBtnStop.classList.toggle('hidden', !isSet);
      this.els.heroBtnStop.setAttribute(
        'aria-label',
        isCompleted ? this.t('Reset Timer to 00:00') : this.t('End Timer (Turn Silver Metallic)')
      );
      this.els.heroBtnStop.title = isCompleted
        ? this.t('Reset Tomato Timer to 00:00')
        : this.t('End Timer (Turns tomato Silver Metallic without clearing)');
      const stopIconState = isCompleted ? 'completed' : 'active';
      if (this.els.heroBtnStop.dataset.iconState !== stopIconState) {
        this.els.heroBtnStop.dataset.iconState = stopIconState;
        this.els.heroBtnStop.innerHTML = isCompleted
          ? `<svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M7.5 14.5C9.5 9.2 14.6 5.5 20.5 5.5C28.2 5.5 33.5 11.8 33.5 18.8C33.5 26.2 27.6 31.8 20.2 31.8C14.2 31.8 9.2 28.1 7.4 22.8" stroke="#0F0F0F" stroke-width="3.0" stroke-linecap="round"/><path d="M5.5 6.8V15.2H13.9" stroke="#0F0F0F" stroke-width="3.0" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<svg width="36" height="36" viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="4.5" fill="#0F0F0F"/></svg>`;
      }
    }

    this.els.heroBtnStopwatch.classList.toggle(
      'stopwatch-active',
      slot.mode === 'stopwatch'
    );
  }

  // =========================================================================
  // INLINE CARD TASK TYPING & EDITING (NO POPUP BOX ON CARD)
  // =========================================================================

  startInlineAddTask(isStackCard = false, focusNow = false) {
    const card = isStackCard ? this.getSelectedStackCard() : null;
    if (isStackCard && !card) return;
    if (isStackCard && !Array.isArray(card.tasks)) card.tasks = [];

    const tasksArr = isStackCard ? card.tasks : this.state.tasks;
    if (tasksArr.length >= MAX_CARD_TASKS) {
      this.showNotificationBanner(this.t('Maximum 8 tasks per card reached.'));
      return;
    }

    const container = isStackCard
      ? this.els.stackTaskListContainer
      : this.els.taskListContainer;
    const addItemEl = isStackCard ? this.els.stackAddItemRow : this.els.addItemRow;
    if (!container) return;

    const existingInput = container.querySelector('.task-inline-input');
    if (existingInput) {
      existingInput.focus();
      return;
    }

    const nextOrder = tasksArr.length + 1;
    const row = document.createElement('div');
    row.className = 'task-row task-row-inline-adding';
    row.style.paddingTop = '9px';
    row.style.paddingBottom = '9px';

    const numSpan = document.createElement('span');
    numSpan.className = 'task-index';
    numSpan.textContent = String(nextOrder).padStart(2, '0');

    const titleWrap = document.createElement('div');
    titleWrap.className = 'task-title-wrap task-inline-edit-wrap';

    const input = document.createElement('textarea');
    input.rows = 1;
    input.className = 'task-inline-input';
    input.setAttribute('aria-label', this.t('Type task directly on card'));

    const syncHeight = (collapseFirst = true) => {
      if (collapseFirst || input.scrollHeight > input.clientHeight + 2) {
        this.setTextareaHeightToLines(input);
      }
    };

    titleWrap.appendChild(input);
    row.appendChild(numSpan);
    row.appendChild(titleWrap);
    container.appendChild(row);

    if (addItemEl) {
      if (tasksArr.length + 1 < MAX_CARD_TASKS) {
        // Keep its space so saving the item doesn't change the layout (no extra shrink step)
        addItemEl.classList.add('add-row-reserved');
      } else {
        addItemEl.classList.add('hidden');
      }
    }

    this.fitUnifiedCardTaskTypography(container, addItemEl);
    syncHeight(true);
    if (focusNow) {
      // Focus synchronously inside the key event so the phone keyboard stays open
      input.focus();
    }
    setTimeout(() => {
      syncHeight(true);
      input.focus();
    }, 10);

    let finished = false;
    let isComposing = false;
    let lastCompositionEndTime = 0;
    let blurTimer = null;

    const commitOrCancel = (shouldSave) => {
      if (finished) return;
      finished = true;
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
      const cleanVal = this.clampTaskInputText(input.value).trim();
      if (shouldSave && cleanVal) {
        if (isStackCard) {
          card.tasks.push({
            id: `${card.dateKey}-task-${Date.now()}`,
            orderIndex: card.tasks.length + 1,
            title: cleanVal,
            isCompleted: false,
          });
          this.sensory.playMechanicalTick();
          this.saveState();
          this.renderStackScreen();
        } else {
          this.state.tasks.push({
            id: 'task-' + Date.now(),
            orderIndex: this.state.tasks.length + 1,
            title: cleanVal,
            isCompleted: false,
            assignedQuadrant: null,
          });
          this.sensory.playMechanicalTick();
          this.saveState();
          this.renderAll();
        }
      } else {
        if (isStackCard) {
          this.renderStackScreen();
        } else {
          this.renderCardScreen();
        }
      }
    };

    const sanitizeAndFit = () => {
      const clamped = this.clampTaskInputText(input.value);
      if (input.value !== clamped) {
        input.value = clamped;
        if (clamped.length >= MAX_TASK_CHARS) {
          this.showTelemetryToast('Task length limit reached');
        }
      }
      syncHeight(true);
      this.fitUnifiedCardTaskTypography(container, addItemEl);
      syncHeight(true);
    };

    input.addEventListener('compositionstart', () => {
      isComposing = true;
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
    });

    input.addEventListener('compositionend', () => {
      isComposing = false;
      lastCompositionEndTime = Date.now();
      sanitizeAndFit();
    });

    input.addEventListener('input', (e) => {
      if (isComposing || e.isComposing) {
        // Never mutate input.value or collapse height during active IME (Pinyin / Handwriting) composition
        syncHeight(false);
        return;
      }
      sanitizeAndFit();
    });

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const imeActive =
        isComposing ||
        e.isComposing ||
        e.keyCode === 229 ||
        Date.now() - lastCompositionEndTime < 120;
      if (e.key === 'Enter') {
        if (imeActive) return;
        e.preventDefault();
        const hasText = Boolean(this.clampTaskInputText(input.value).trim());
        commitOrCancel(true);
        // Return key moves straight on to a new item (until the card is full)
        if (hasText) {
          const arr = isStackCard ? (this.getSelectedStackCard() || {}).tasks || [] : this.state.tasks;
          if (arr.length < MAX_CARD_TASKS) {
            this.startInlineAddTask(isStackCard, true);
          }
        }
      } else if (e.key === 'Escape') {
        if (imeActive) return;
        e.preventDefault();
        commitOrCancel(false);
      }
    });

    input.addEventListener('focus', () => {
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
    });

    const openedAt = performance.now();
    input.addEventListener('blur', () => {
      if (blurTimer) clearTimeout(blurTimer);
      // A blur within the first moments after opening is a stray tap event, not the user leaving
      if (performance.now() - openedAt < 600 && !finished) {
        setTimeout(() => {
          if (!finished && document.body.contains(input)) input.focus();
        }, 0);
        return;
      }
      blurTimer = setTimeout(() => {
        blurTimer = null;
        if (finished || isComposing || document.activeElement === input) return;
        commitOrCancel(true);
      }, 150);
    });
  }

  startInlineEditTask(rowEl, task, isStackCard = false, focusNow = false) {
    if (!rowEl || !task) return;
    const container = isStackCard
      ? this.els.stackTaskListContainer
      : this.els.taskListContainer;
    const addItemEl = isStackCard ? this.els.stackAddItemRow : this.els.addItemRow;
    if (!container) return;

    if (rowEl.querySelector('.task-inline-input')) return;

    const titleWrap = rowEl.querySelector('.task-title-wrap');
    const strikeCanvas = rowEl.querySelector('.pencil-strike-canvas');
    if (!titleWrap) return;

    if (strikeCanvas) {
      strikeCanvas.style.opacity = '0';
    }

    titleWrap.innerHTML = '';
    titleWrap.classList.add('task-inline-edit-wrap');

    const input = document.createElement('textarea');
    input.rows = 1;
    input.className = 'task-inline-input';
    input.value = task.title || '';
    input.setAttribute('aria-label', this.t('Edit task directly on card'));

    const syncEditHeight = (collapseFirst = true) => {
      if (collapseFirst || input.scrollHeight > input.clientHeight + 2) {
        this.setTextareaHeightToLines(input);
      }
    };

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'task-inline-delete-btn';
    delBtn.title = this.t('Delete item');
    delBtn.setAttribute('aria-label', this.t('Delete item'));
    delBtn.textContent = '×';

    titleWrap.appendChild(input);
    // The × sits in the row's tomato slot (or right margin on past cards) so the text keeps its
    // full width and nothing rewraps or shrinks when editing starts.
    rowEl.classList.add('is-inline-editing');
    rowEl.appendChild(delBtn);

    this.fitUnifiedCardTaskTypography(container, addItemEl);
    syncEditHeight(true);
    if (focusNow) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    setTimeout(() => {
      syncEditHeight(true);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 10);

    let finished = false;
    let isComposing = false;
    let lastCompositionEndTime = 0;
    let blurTimer = null;

    const deleteThisTask = () => {
      if (finished) return;
      finished = true;
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
      if (isStackCard) {
        const card = this.getSelectedStackCard();
        if (card && Array.isArray(card.tasks)) {
          card.tasks = card.tasks.filter((t) => t.id !== task.id);
          card.tasks.forEach((t, i) => {
            t.orderIndex = i + 1;
          });
          this.saveState();
          this.renderStackScreen();
        }
      } else {
        this.state.tasks = this.state.tasks.filter((t) => t.id !== task.id);
        this.state.tasks.forEach((t, i) => {
          t.orderIndex = i + 1;
        });
        for (const s of this.state.timers) {
          if (s.assignedTaskId === task.id) {
            s.assignedTaskId = null;
            s.assignedTaskOrder = null;
            s.customTitle = null;
            s.runState = 'idle';
            s.remainingSeconds = 0;
            s.configuredMinutes = 0;
            s.angleDegrees = 0;
            s.lastTickTimestamp = null;
          } else if (s.assignedTaskId) {
            const rem = this.state.tasks.find((t) => t.id === s.assignedTaskId);
            if (rem) s.assignedTaskOrder = rem.orderIndex;
          }
        }
        this.saveState();
        this.renderAll();
      }
    };

    const commitOrCancel = (shouldSave) => {
      if (finished) return;
      finished = true;
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
      if (!shouldSave) {
        if (isStackCard) this.renderStackScreen();
        else this.renderCardScreen();
        return;
      }
      const cleanVal = this.clampTaskInputText(input.value).trim();
      if (!cleanVal) {
        finished = false;
        deleteThisTask();
        return;
      }
      task.title = cleanVal;
      if (!isStackCard) {
        for (const s of this.state.timers) {
          if (s.assignedTaskId === task.id) {
            s.customTitle = task.title;
          }
        }
        this.saveState();
        this.renderAll();
      } else {
        this.saveState();
        this.renderStackScreen();
      }
    };

    let delPressedId = null;
    delBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      delPressedId = e.pointerId;
    });
    delBtn.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (delPressedId === null || e.pointerId !== delPressedId) return;
      delPressedId = null;
      // The tap's own click arrives afterwards at the same spot, where the next item now sits
      this.swallowNextClick(500);
      deleteThisTask();
    });
    delBtn.addEventListener('pointercancel', () => {
      delPressedId = null;
    });
    delBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteThisTask(); // no-op if pointerup already deleted
    });

    const sanitizeAndFitEdit = () => {
      const clamped = this.clampTaskInputText(input.value);
      if (input.value !== clamped) {
        input.value = clamped;
        if (clamped.length >= MAX_TASK_CHARS) {
          this.showTelemetryToast('Task length limit reached');
        }
      }
      syncEditHeight(true);
      this.fitUnifiedCardTaskTypography(container, addItemEl);
      syncEditHeight(true);
    };

    input.addEventListener('compositionstart', () => {
      isComposing = true;
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
    });

    input.addEventListener('compositionend', () => {
      isComposing = false;
      lastCompositionEndTime = Date.now();
      sanitizeAndFitEdit();
    });

    input.addEventListener('input', (e) => {
      if (isComposing || e.isComposing) {
        // Never mutate input.value or collapse height during active IME (Pinyin / Handwriting) composition
        syncEditHeight(false);
        return;
      }
      sanitizeAndFitEdit();
    });

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const imeActive =
        isComposing ||
        e.isComposing ||
        e.keyCode === 229 ||
        Date.now() - lastCompositionEndTime < 120;
      if (e.key === 'Enter') {
        if (imeActive) return;
        e.preventDefault();
        const arrBefore = isStackCard ? (this.getSelectedStackCard() || {}).tasks || [] : this.state.tasks;
        const idx = arrBefore.indexOf(task);
        commitOrCancel(true);
        // Return key moves on to the next item, or starts a new one after the last item
        const arr = isStackCard ? (this.getSelectedStackCard() || {}).tasks || [] : this.state.tasks;
        const nextIdx = arr.indexOf(task) >= 0 ? arr.indexOf(task) + 1 : idx;
        const nextTask = nextIdx >= 0 ? arr[nextIdx] : null;
        if (nextTask) {
          const rows = container.querySelectorAll('.task-row');
          if (rows[nextIdx]) this.startInlineEditTask(rows[nextIdx], nextTask, isStackCard, true);
        } else if (arr.length < MAX_CARD_TASKS) {
          this.startInlineAddTask(isStackCard, true);
        }
      } else if (e.key === 'Escape') {
        if (imeActive) return;
        e.preventDefault();
        commitOrCancel(false);
      }
    });

    input.addEventListener('focus', () => {
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
    });

    const openedAt = performance.now();
    input.addEventListener('blur', () => {
      if (blurTimer) clearTimeout(blurTimer);
      // A blur within the first moments after opening is a stray tap event, not the user leaving
      if (performance.now() - openedAt < 600 && !finished) {
        setTimeout(() => {
          if (!finished && document.body.contains(input)) input.focus();
        }, 0);
        return;
      }
      blurTimer = setTimeout(() => {
        blurTimer = null;
        if (finished || isComposing || document.activeElement === input) return;
        commitOrCancel(true);
      }, 150);
    });
  }

  openAddTaskModal() {
    if (this.state.tasks.length >= MAX_CARD_TASKS) {
      this.showNotificationBanner(this.t('Maximum 8 tasks per card reached.'));
      return;
    }
    this.openInputModal(
      this.t('Add Task'),
      '',
      (val) => {
        const cleanVal = this.clampTaskInputText(val).trim();
        if (!cleanVal) return;
        const newOrder = this.state.tasks.length + 1;
        this.state.tasks.push({
          id: 'task-' + Date.now(),
          orderIndex: newOrder,
          title: cleanVal,
          isCompleted: false,
          assignedQuadrant: null,
        });
        this.sensory.playMechanicalTick();
        this.saveState();
        this.renderAll();
      },
      null,
      true
    );
  }

  openAddStackTaskModal() {
    const card = this.getSelectedStackCard();
    if (!card) return;
    if (!Array.isArray(card.tasks)) card.tasks = [];
    if (card.tasks.length >= MAX_CARD_TASKS) {
      this.showNotificationBanner(this.t('Maximum 8 tasks per card reached.'));
      return;
    }
    this.openInputModal(
      this.t('Add Task to {date}', { date: card.shortDate }),
      '',
      (val) => {
        const cleanVal = this.clampTaskInputText(val).trim();
        if (!cleanVal) return;
        card.tasks.push({
          id: `${card.dateKey}-task-${Date.now()}`,
          orderIndex: card.tasks.length + 1,
          title: cleanVal,
          isCompleted: false,
        });
        this.sensory.playMechanicalTick();
        this.saveState();
        this.renderStackScreen();
      },
      null,
      true
    );
  }

  openEditStackTaskModal(task) {
    const card = this.getSelectedStackCard();
    if (!card) return;
    this.openInputModal(
      this.t('Edit {date} Task {n}', {
        date: card.shortDate,
        n: String(task.orderIndex).padStart(2, '0'),
      }),
      task.title,
      (val) => {
        const cleanVal = this.clampTaskInputText(val).trim();
        if (!cleanVal) {
          card.tasks = card.tasks.filter((t) => t.id !== task.id);
          card.tasks.forEach((t, idx) => {
            t.orderIndex = idx + 1;
          });
          this.saveState();
          this.renderStackScreen();
          this.showNotificationBanner(this.t('Task removed from archived card'));
          return;
        }
        task.title = cleanVal;
        this.saveState();
        this.renderStackScreen();
      },
      () => {
        card.tasks = card.tasks.filter((t) => t.id !== task.id);
        card.tasks.forEach((t, idx) => {
          t.orderIndex = idx + 1;
        });
        this.saveState();
        this.renderStackScreen();
        this.showNotificationBanner(this.t('Task removed from archived card'));
      },
      true
    );
  }

  openEditTaskModal(task) {
    this.openInputModal(
      this.t('Edit Task {n}', { n: String(task.orderIndex).padStart(2, '0') }),
      task.title,
      (val) => {
        const cleanVal = this.clampTaskInputText(val).trim();
        if (!cleanVal) {
          this.confirmPermanentDeleteTask(task);
          return;
        }
        task.title = cleanVal;
        for (const s of this.state.timers) {
          if (s.assignedTaskId === task.id) {
            s.customTitle = task.title;
          }
        }
        this.saveState();
        this.renderAll();
      },
      () => {
        this.confirmPermanentDeleteTask(task);
      },
      true
    );
  }

  confirmPermanentDeleteTask(task) {
    if (this.els.deleteModalTitle) {
      this.els.deleteModalTitle.textContent = this.t('Permanently delete this item?');
    }
    if (this.els.deleteModalDesc) {
      this.els.deleteModalDesc.textContent =
        this.t('This action cannot be undone. The item will be permanently removed from Today’s Card.');
    }
    this.els.deleteModalOverlay.classList.remove('hidden');
    const onCancel = () => {
      this.els.deleteModalOverlay.classList.add('hidden');
      cleanup();
    };
    const onConfirm = () => {
      this.els.deleteModalOverlay.classList.add('hidden');
      cleanup();
      this.state.tasks = this.state.tasks.filter((t) => t.id !== task.id);
      this.state.tasks.forEach((t, i) => {
        t.orderIndex = i + 1;
      });
      for (const s of this.state.timers) {
        if (s.assignedTaskId === task.id) {
          s.assignedTaskId = null;
          s.assignedTaskOrder = null;
          s.customTitle = null;
          s.runState = 'idle';
          s.remainingSeconds = 0;
          s.configuredMinutes = 0;
          s.angleDegrees = 0;
          s.lastTickTimestamp = null;
        } else if (s.assignedTaskId) {
          const remainingTask = this.state.tasks.find((t) => t.id === s.assignedTaskId);
          if (remainingTask) {
            s.assignedTaskOrder = remainingTask.orderIndex;
          }
        }
      }
      this.saveState();
      this.renderAll();
      this.showNotificationBanner(this.t('Task deleted'));
    };
    const cleanup = () => {
      this.els.deleteModalCancel.removeEventListener('click', onCancel);
      this.els.deleteModalConfirm.removeEventListener('click', onConfirm);
    };
    this.els.deleteModalCancel.addEventListener('click', onCancel);
    this.els.deleteModalConfirm.addEventListener('click', onConfirm);
  }

  openCustomTitleModal(quadrant) {
    const slot = this.state.timers[quadrant];
    const current = slot?.customTitle || '';
    const isEditingExisting = Boolean(slot && (slot.assignedTaskId || slot.customTitle));
    this.openInputModal(
      isEditingExisting ? this.t('Edit Timer Title') : this.t('Assign Custom Timer Title'),
      current,
      (val) => {
        const cleanVal = this.clampTaskInputText(val).trim();
        if (!cleanVal) return;
        if (slot && slot.assignedTaskId) {
          const linkedTask = this.state.tasks.find((t) => t.id === slot.assignedTaskId);
          if (linkedTask) {
            linkedTask.title = cleanVal;
          }
          slot.customTitle = cleanVal;
          this.state.openDropdownQuadrant = null;
          this.state.isHeroDropdownOpen = false;
          this.saveState();
          this.renderAll();
        } else {
          this.assignCustomTitleToQuadrant(quadrant, cleanVal);
        }
      },
      null,
      true
    );
  }

  openInputModal(title, initialValue, onSave, onDelete = null, enforceTaskCap = true) {
    this.els.modalTitle.textContent = title;
    this.els.modalInput.value = initialValue;
    this.els.modalInput.removeAttribute('maxlength');
    if (this.els.modalDelete) {
      this.els.modalDelete.classList.toggle('hidden', !onDelete);
    }
    this.els.modalOverlay.classList.remove('hidden');
    setTimeout(() => this.els.modalInput.focus(), 30);

    let isComposing = false;
    let lastCompositionEndTime = 0;

    const sanitizeModalInput = () => {
      if (enforceTaskCap) {
        const clamped = this.clampTaskInputText(this.els.modalInput.value);
        if (this.els.modalInput.value !== clamped) {
          this.els.modalInput.value = clamped;
          if (clamped.length >= MAX_TASK_CHARS) {
            this.showTelemetryToast('Task length limit reached');
          }
        }
      }
      const len = this.els.modalInput.value.length;
      this.els.modalInput.style.fontSize = len > 26 ? '14.5px' : len > 18 ? '15.5px' : '16.5px';
    };

    const onCompStart = () => {
      isComposing = true;
    };
    const onCompEnd = () => {
      isComposing = false;
      lastCompositionEndTime = Date.now();
      sanitizeModalInput();
    };
    const onInput = (e) => {
      if (isComposing || (e && e.isComposing)) return;
      sanitizeModalInput();
    };
    sanitizeModalInput();

    const close = () => {
      this.els.modalOverlay.classList.add('hidden');
      cleanup();
    };
    const confirm = () => {
      const val = this.els.modalInput.value;
      close();
      onSave(val);
    };
    const handleDelete = () => {
      close();
      if (onDelete) onDelete();
    };
    const onKey = (e) => {
      const imeActive =
        isComposing ||
        e.isComposing ||
        e.keyCode === 229 ||
        Date.now() - lastCompositionEndTime < 120;
      if (e.key === 'Enter') {
        if (imeActive) return;
        e.preventDefault();
        confirm();
      }
      if (e.key === 'Escape') {
        if (imeActive) return;
        e.preventDefault();
        close();
      }
    };
    const cleanup = () => {
      this.els.modalCancel.removeEventListener('click', close);
      this.els.modalConfirm.removeEventListener('click', confirm);
      if (this.els.modalDelete) {
        this.els.modalDelete.removeEventListener('click', handleDelete);
      }
      this.els.modalInput.removeEventListener('keydown', onKey);
      this.els.modalInput.removeEventListener('input', onInput);
      this.els.modalInput.removeEventListener('compositionstart', onCompStart);
      this.els.modalInput.removeEventListener('compositionend', onCompEnd);
    };

    this.els.modalCancel.addEventListener('click', close);
    this.els.modalConfirm.addEventListener('click', confirm);
    if (this.els.modalDelete && onDelete) {
      this.els.modalDelete.addEventListener('click', handleDelete);
    }
    this.els.modalInput.addEventListener('keydown', onKey);
    this.els.modalInput.addEventListener('input', onInput);
    this.els.modalInput.addEventListener('compositionstart', onCompStart);
    this.els.modalInput.addEventListener('compositionend', onCompEnd);
  }

  setInstantCardRotation(wrapperEl, isFlipped, degValue) {
    if (!wrapperEl) return;
    wrapperEl.style.transition = 'none';
    this.applyCard3DRotation(wrapperEl, isFlipped, degValue);
    void wrapperEl.offsetWidth;
    wrapperEl.style.transition = '';
  }

  ensureTourDemoArchiveCards() {
    if (!this._tourSavedArchiveState) {
      this._tourSavedArchiveState = {
        archiveCards: JSON.parse(JSON.stringify(this.state.archiveCards || {})),
        selectedStackDateKey: this.state.selectedStackDateKey,
      };
    }
    const todayKey =
      this.state.cardDateKey || this.getCurrentLogicalDateString(this.state.dailyResetHour);
    const yesterdayKey = this.getOffsetDateKey(todayKey, -1);
    const twoDaysAgoKey = this.getOffsetDateKey(todayKey, -2);
    this._tourYesterdayKey = yesterdayKey;
    this._tourTwoDaysAgoKey = twoDaysAgoKey;

    const keys = Object.keys(this.state.archiveCards || {});
    if (keys.length < 2) {
      const twoDaysMeta = this.formatDateMetadataForKey(twoDaysAgoKey);
      const yesterdayMeta = this.formatDateMetadataForKey(yesterdayKey);
      this.state.archiveCards = {
        ...this.state.archiveCards,
        [twoDaysAgoKey]: {
          dateKey: twoDaysMeta.dateKey,
          headerDate: twoDaysMeta.headerDate,
          shortDate: twoDaysMeta.shortDate,
          monthKey: twoDaysMeta.monthKey,
          dayNum: twoDaysMeta.dayNum,
          tasks: [
            {
              id: `tour-${twoDaysAgoKey}-1`,
              orderIndex: 1,
              title: 'Sketch weekend notes',
              isCompleted: true,
            },
          ],
          reflectionText: 'Quiet afternoon reading.',
          reflectionPhotos: [],
        },
        [yesterdayKey]: {
          dateKey: yesterdayMeta.dateKey,
          headerDate: yesterdayMeta.headerDate,
          shortDate: yesterdayMeta.shortDate,
          monthKey: yesterdayMeta.monthKey,
          dayNum: yesterdayMeta.dayNum,
          tasks: [
            {
              id: `tour-${yesterdayKey}-1`,
              orderIndex: 1,
              title: 'Example Task',
              isCompleted: true,
            },
          ],
          reflectionText: 'Focused morning session.',
          reflectionPhotos: [],
        },
      };
      if (!this.state.selectedStackDateKey || !this.state.archiveCards[this.state.selectedStackDateKey]) {
        this.state.selectedStackDateKey = yesterdayKey;
      }
    }
  }

  restoreTourDemoArchiveCards() {
    if (this._tourSavedArchiveState) {
      this.state.archiveCards = JSON.parse(
        JSON.stringify(this._tourSavedArchiveState.archiveCards || {})
      );
      this.state.selectedStackDateKey = this._tourSavedArchiveState.selectedStackDateKey;
      this._tourSavedArchiveState = null;
    }
  }

  getElementBoxInTourOverlay(targetEl) {
    const overlay = this.els.onboardingOverlay;
    if (!targetEl || !overlay) return null;
    const rect = targetEl.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    const left = rect.left - overlayRect.left;
    const top = rect.top - overlayRect.top;
    return {
      left,
      top,
      width: rect.width,
      height: rect.height,
      x: left + rect.width * 0.5,
      y: top + rect.height * 0.5,
    };
  }

  setTourDotState(dotEl, x, y, opacity, scale = 1, pulseRing = false) {
    if (!dotEl) return;
    if (opacity <= 0.01 || x === null || y === null) {
      dotEl.style.opacity = '0';
      dotEl.classList.add('hidden');
      dotEl.classList.remove('dot-pulse-ring');
      return;
    }
    dotEl.classList.remove('hidden');
    dotEl.classList.toggle('dot-pulse-ring', Boolean(pulseRing));
    dotEl.style.left = `${x.toFixed(1)}px`;
    dotEl.style.top = `${y.toFixed(1)}px`;
    dotEl.style.opacity = `${Math.max(0, Math.min(1, opacity)).toFixed(3)}`;
    dotEl.style.transform = `scale(${scale.toFixed(3)})`;
  }

  easeInOutCubic(t) {
    const c = Math.max(0, Math.min(1, t));
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
  }

  getGuidedTourSteps() {
    return [
      // STEP 1: HOME PAGE (Dots strictly aligned on vertical center line & 0 marker on tomato)
      {
        title: 'Tap Card or Tomato',
        desc: 'Open today’s card or focus timer',
        applyPage: () => {
          this.restoreTourDemoArchiveCards();
          this.state.activePillar = 'home';
        },
        animateFrame: (elapsedMs) => {
          const period = 2400;
          const half = period / 2;
          const isSecond = (elapsedMs % period) >= half;
          const subT = ((elapsedMs % half) / half);
          const targetEl = isSecond ? this.els.homeTomatoBtn : this.els.homeMiniCard;
          const box = this.getElementBoxInTourOverlay(targetEl);
          if (!box) return;
          const overlayEl = this.els.onboardingOverlay;
          const overlayRect = overlayEl ? overlayEl.getBoundingClientRect() : null;
          // Strictly align both dots on the exact vertical center line of the viewport
          const centerX = overlayRect && overlayRect.width > 0 ? overlayRect.width * 0.5 : box.x;
          // On the tomato, place the dot directly on the '0' marker (45.7% of tomato image height)
          const targetY = isSecond ? box.top + box.height * 0.457 : box.y;
          const fade = 0.08 + 0.92 * Math.pow(Math.sin(subT * Math.PI), 1.15);
          const scale = 0.88 + 0.16 * Math.sin(subT * Math.PI);
          this.setTourDotState(this.els.tourPageDot, centerX, targetY, fade, scale, true);
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
      // STEP 2: FRONT OF CARD (DAILY TO-DOS)
      {
        title: 'Front Page · Daily To-Dos',
        desc: 'Add up to 8 tasks. Swipe to cross out, swipe again to undo',
        applyPage: () => {
          this.restoreTourDemoArchiveCards();
          this.state.activePillar = 'card';
          this.state.isCardFlipped = false;
          this._todayFlipDeg = 0;
          this.setInstantCardRotation(this.els.card3DWrapper, false, 0);
        },
        animateFrame: (elapsedMs) => {
          const row =
            this.els.taskListContainer &&
            this.els.taskListContainer.querySelector('.task-row');
          const titleEl =
            (row && row.querySelector('.task-title')) ||
            (row && row.querySelector('.task-title-wrap')) ||
            row;
          const canvas = row && row.querySelector('.pencil-strike-canvas');
          const box = this.getElementBoxInTourOverlay(titleEl);
          if (!box) return;

          // Two swipes per loop: 1st swipe crosses the task out, 2nd swipe (same
          // left -> right motion) erases the pencil line to uncross it.
          const period = 4600;
          const t = (elapsedMs % period) / period;
          const startX = box.left + 4;
          const endX = box.left + Math.max(76, box.width + 8);
          const centerY = box.y;

          let dotX = startX;
          let opacity = 0;
          let scale = 1;
          let strokeFrom = 0;
          let strokeTo = 0;

          if (t < 0.07) {
            // Dot appears at the start of the text
            const p = t / 0.07;
            opacity = p;
            scale = 1.06 - 0.12 * p;
          } else if (t < 0.35) {
            // Swipe 1: cross out
            const p = this.easeInOutCubic((t - 0.07) / 0.28);
            opacity = 1;
            scale = 0.94;
            dotX = startX + p * (endX - startX);
            strokeTo = p;
          } else if (t < 0.45) {
            // Lift finger; task stays crossed out
            const p = (t - 0.35) / 0.1;
            opacity = 1 - p;
            scale = 0.94 + 0.08 * p;
            dotX = endX;
            strokeTo = 1;
          } else if (t < 0.52) {
            // Dot comes back to the start, line still drawn
            const p = (t - 0.45) / 0.07;
            opacity = p;
            scale = 1.06 - 0.12 * p;
            strokeTo = 1;
          } else if (t < 0.8) {
            // Swipe 2: erase the pencil line (uncross)
            const p = this.easeInOutCubic((t - 0.52) / 0.28);
            opacity = 1;
            scale = 0.94;
            dotX = startX + p * (endX - startX);
            strokeFrom = p;
            strokeTo = 1;
          } else if (t < 0.9) {
            const p = (t - 0.8) / 0.1;
            opacity = 1 - p;
            scale = 0.94 + 0.08 * p;
            dotX = endX;
          } else {
            opacity = 0;
          }

          if (canvas) {
            if (strokeTo > 0 && strokeFrom < 1) {
              this.drawGraphiteStroke(canvas, strokeFrom, strokeTo);
            } else {
              this.drawGraphiteStroke(canvas, 0.0, 0.0);
            }
          }
          this.setTourDotState(this.els.tourPageDot, dotX, centerY, opacity, scale, false);
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
      // STEP 3: BACK OF CARD (DAILY REFLECTION)
      {
        title: 'Flip Page · Daily Reflection',
        desc: 'Flip with the flip button or by swiping empty card space (not on items) to write reflection & attach photos',
        applyPage: () => {
          this.restoreTourDemoArchiveCards();
          this.state.activePillar = 'card';
          this.state.isCardFlipped = false;
          this._todayFlipDeg = 0;
          this.setInstantCardRotation(this.els.card3DWrapper, false, 0);
        },
        animateFrame: (elapsedMs) => {
          const cardEl = this.els.card3DWrapper;
          const box = this.getElementBoxInTourOverlay(cardEl);
          if (!box || !cardEl) return;

          const period = 3400;
          const t = (elapsedMs % period) / period;
          const rightX = box.x + 62;
          const leftX = box.x - 62;
          // Demonstrate the flip swipe on EMPTY card space (below the to-do items), never on a task
          const swipeY = box.top + box.height * 0.8;

          if (t < 0.28) {
            // Dot moves Right -> Left while turning card 0deg -> -180deg
            const p = this.easeInOutCubic(t / 0.28);
            const deg = -180 * p;
            const flipped = deg <= -90;
            this.state.isCardFlipped = flipped;
            this._todayFlipDeg = deg;
            cardEl.style.transition = 'none';
            this.applyCard3DRotation(cardEl, flipped, deg);

            const dotX = rightX + (leftX - rightX) * p;
            const opacity = t < 0.05 ? t / 0.05 : 1;
            this.setTourDotState(this.els.tourPageDot, dotX, swipeY, opacity, 0.94, false);
          } else if (t < 0.76) {
            // Card rests on Matte Black Back (-180deg); dot fades on & off pointing at reflection/photos
            this.state.isCardFlipped = true;
            this._todayFlipDeg = -180;
            cardEl.style.transition = 'none';
            this.applyCard3DRotation(cardEl, true, -180);

            const backSubT = (t - 0.28) / 0.48;
            const pulse = Math.sin(backSubT * Math.PI * 2);
            const fade = 0.08 + 0.92 * Math.abs(pulse);
            const pointY = backSubT < 0.5 ? box.top + box.height * 0.36 : box.top + box.height * 0.78;
            this.setTourDotState(this.els.tourPageDot, box.x, pointY, fade, 0.92 + 0.12 * fade, true);
          } else {
            // Dot swipes Left -> Right while turning card -180deg -> 0deg
            const p = this.easeInOutCubic((t - 0.76) / 0.24);
            const deg = -180 * (1 - p);
            const flipped = deg <= -90;
            this.state.isCardFlipped = flipped;
            this._todayFlipDeg = deg;
            cardEl.style.transition = 'none';
            this.applyCard3DRotation(cardEl, flipped, deg);

            const dotX = leftX + (rightX - leftX) * p;
            const opacity = t > 0.95 ? (1 - t) / 0.05 : 1;
            this.setTourDotState(this.els.tourPageDot, dotX, swipeY, opacity, 0.94, false);
          }
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
      // STEP 4: TAP MINI TOMATO ON CARD FRONT (Immediately followed by Hero Tomato Page in Step 5!)
      {
        title: 'Tap Mini Tomato',
        desc: 'Link a daily to-do item to a focus timer',
        applyPage: () => {
          this.restoreTourDemoArchiveCards();
          this.state.activePillar = 'card';
          this.state.isCardFlipped = false;
          this._todayFlipDeg = 0;
          // Immediately snap card to 0deg without 3D transition lag so .task-tomato-btn rect is exact
          this.setInstantCardRotation(this.els.card3DWrapper, false, 0);
        },
        animateFrame: (elapsedMs) => {
          // Ensure card stays strictly unflipped at 0deg so the mini tomato is at its true right-side position
          if (this.els.card3DWrapper) {
            this.els.card3DWrapper.style.transition = 'none';
            this.applyCard3DRotation(this.els.card3DWrapper, false, 0);
          }
          const tomatoBtn =
            this.els.taskListContainer &&
            this.els.taskListContainer.querySelector('.task-tomato-btn');
          const miniImg =
            tomatoBtn && tomatoBtn.querySelector('.task-mini-tomato-img');
          const box = this.getElementBoxInTourOverlay(miniImg || tomatoBtn);
          if (!box) return;

          const period = 1500;
          const t = (elapsedMs % period) / period;
          // Fade on and off + tap press directly on the mini tomato
          const fade = 0.08 + 0.92 * Math.pow(Math.sin(t * Math.PI), 1.1);
          const isPressed = t > 0.36 && t < 0.78;
          const scale = isPressed ? 0.84 : 1.04;

          if (miniImg && this.gridRenderer) {
            const targetKey = isPressed ? 0 : 'unassigned';
            const expectedSrc = this.gridRenderer.getMiniDataURL(targetKey);
            if (miniImg.dataset.tourKey !== String(targetKey)) {
              miniImg.dataset.tourKey = String(targetKey);
              miniImg.src = expectedSrc;
            }
          }

          this.setTourDotState(this.els.tourPageDot, box.x, box.y, fade, scale, true);
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
      // STEP 5: HERO TOMATO PAGE (Immediately after "Tap Mini Tomato"!)
      {
        title: 'Turn Tomato Dial',
        desc: 'Swipe to turn the dial. Turn on phone ringtone & app sound to hear the chime',
        applyPage: () => {
          this.restoreTourDemoArchiveCards();
          this.state.activePillar = 'timer';
          this.state.timerSubMode = 'hero';
          this.state.isHeroDropdownOpen = false;
        },
        animateFrame: (elapsedMs) => {
          if (this.els.heroSubtitle) {
            this.els.heroSubtitle.textContent = `01 / ${this.t('Example Task')}`;
          }
          const box = this.getElementBoxInTourOverlay(this.els.heroTomatoStage);
          if (!box) return;

          const period = 2500;
          const t = (elapsedMs % period) / period;
          const equatorY = box.top + box.height * 0.46;
          const startX = box.x + 56;
          const endX = box.x - 56;

          let dotX = startX;
          let dotY = equatorY;
          let opacity = 0;
          let scale = 1;
          let demoMins = 25;

          if (t < 0.14) {
            // Dot fades in on the right side of the equator
            const p = t / 0.14;
            opacity = p;
            scale = 1.08 - 0.14 * p;
            dotX = startX;
            dotY = equatorY;
            demoMins = 25;
          } else if (t < 0.74) {
            // Dot moves along the tomato equator and turns the 3D tomato in 1:1 lockstep
            const p = this.easeInOutCubic((t - 0.14) / 0.60);
            opacity = 1;
            scale = 0.94;
            dotX = startX + (endX - startX) * p;
            dotY = equatorY + Math.sin(p * Math.PI) * 7;
            demoMins = 25 + p * 5;
          } else if (t < 0.90) {
            // Dot fades out at the left side while holding 30:00
            const p = (t - 0.74) / 0.16;
            opacity = 1 - p * 0.92;
            scale = 0.94 + 0.10 * p;
            dotX = endX;
            dotY = equatorY;
            demoMins = 30;
          } else {
            // Smoothly wind back to 25:00 for next cycle
            const p = (t - 0.90) / 0.10;
            opacity = 0.06;
            dotX = startX;
            dotY = equatorY;
            demoMins = 30 - p * 5;
          }

          if (this.hero3D) {
            this.hero3D.updateOdometer(demoMins * 6.0, 0, true, false);
          }
          if (this.els.heroReadout) {
            this.els.heroReadout.textContent = OdometerDialPhysics.formatMockupReadout(
              Math.round(demoMins) * 60
            );
          }

          this.setTourDotState(this.els.tourPageDot, dotX, dotY, opacity, scale, false);
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
      // STEP 5b: TAP THE DIGITAL READOUT AND TYPE A TIME
      {
        title: 'Tap Digits to Type Time',
        desc: 'Tap the numbers to type minutes, e.g. 45',
        applyPage: () => {
          this.restoreTourDemoArchiveCards();
          this.state.activePillar = 'timer';
          this.state.timerSubMode = 'hero';
          this.state.isHeroDropdownOpen = false;
          this.closeHeroTimeEditorDOM();
        },
        animateFrame: (elapsedMs) => {
          if (this.els.heroSubtitle) {
            this.els.heroSubtitle.textContent = `01 / ${this.t('Example Task')}`;
          }
          const readout = this.els.heroReadout;
          const editor = this.els.heroTimeEditor;
          const input = this.els.heroTimeInput;
          if (!readout || !editor || !input) return;

          const period = 4800;
          const t = (elapsedMs % period) / period;
          let demoMins = 25;
          let dot = null; // { x, y, opacity, scale, ring }

          if (t < 0.22) {
            // Dot pulses on the digital readout (tap)
            this.closeHeroTimeEditorDOM();
            readout.textContent = '25:00';
            const box = this.getElementBoxInTourOverlay(readout);
            if (box) {
              const p = t / 0.22;
              const pulse = Math.sin(p * Math.PI);
              dot = { x: box.x, y: box.y, opacity: 0.1 + 0.9 * pulse, scale: 0.9 + 0.16 * pulse, ring: true };
            }
          } else if (t < 0.62) {
            // Editor opens; digits get "typed" one by one
            readout.classList.add('hidden');
            editor.classList.remove('hidden');
            const typeP = (t - 0.22) / 0.4;
            input.value = typeP < 0.45 ? '4' : '45';
            if (this.els.heroTimeUnitBadge) this.els.heroTimeUnitBadge.textContent = this.t('MIN');
            demoMins = typeP < 0.45 ? 25 : 45;
          } else if (t < 0.8) {
            // Dot taps the Set button
            readout.classList.add('hidden');
            editor.classList.remove('hidden');
            input.value = '45';
            demoMins = 45;
            const box = this.getElementBoxInTourOverlay(this.els.heroTimeSetBtn);
            if (box) {
              const p = (t - 0.62) / 0.18;
              const pulse = Math.sin(p * Math.PI);
              dot = { x: box.x, y: box.y, opacity: 0.1 + 0.9 * pulse, scale: 0.9 + 0.16 * pulse, ring: true };
            }
          } else {
            // Editor closes, readout shows the new time
            this.closeHeroTimeEditorDOM();
            readout.textContent = '45:00';
            demoMins = 45;
          }

          if (this.hero3D) {
            this.hero3D.updateOdometer(demoMins * 6.0, 0, true, false);
          }
          if (dot) {
            this.setTourDotState(this.els.tourPageDot, dot.x, dot.y, dot.opacity, dot.scale, dot.ring);
          } else {
            this.setTourDotState(this.els.tourPageDot, null, null, 0);
          }
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
      // STEP 5c: TAP TO ASSIGN & SYNC CUSTOM TITLE TO CARD
      {
        title: 'Tap to Assign & Sync to Card',
        desc: 'Tap title to name your timer, then tap + Card to add it to today’s card',
        applyPage: () => {
          this.restoreTourDemoArchiveCards();
          this.state.activePillar = 'timer';
          this.state.timerSubMode = 'hero';
          this.state.isHeroDropdownOpen = false;
          this.closeHeroTimeEditorDOM();
          this.closeHeroTitleEditorDOM();
        },
        animateFrame: (elapsedMs) => {
          const subtitleRow = this.els.heroSubtitleRow;
          const subtitle = this.els.heroSubtitle;
          const syncBtn = this.els.heroSyncToCardBtn;
          const titleEditor = this.els.heroTitleEditor;
          const titleInput = this.els.heroTitleInput;
          const titleSetBtn = this.els.heroTitleSetBtn;
          if (!subtitle || !titleEditor || !titleInput) return;

          const period = 4800;
          const t = (elapsedMs % period) / period;
          const sampleTitle = this.t('Deep Work');
          let dot = null;
          let isAssignedDemo = false;

          if (t < 0.22) {
            // Phase 1: Unassigned tomato shows "01 / TAP TO ASSIGN"; dot pulses on it
            this.closeHeroTitleEditorDOM();
            subtitle.textContent = `01 / ${this.t('TAP TO ASSIGN')}`;
            if (syncBtn) syncBtn.classList.add('hidden');
            const box = this.getElementBoxInTourOverlay(subtitle);
            if (box) {
              const p = t / 0.22;
              const pulse = Math.sin(p * Math.PI);
              dot = { x: box.x, y: box.y, opacity: 0.12 + 0.88 * pulse, scale: 0.9 + 0.16 * pulse, ring: true };
            }
          } else if (t < 0.54) {
            // Phase 2: Inline title box opens; custom title is typed and Set is tapped
            if (subtitleRow) subtitleRow.classList.add('hidden');
            titleEditor.classList.remove('hidden');
            if (this.els.heroTitleOrderPrefix) this.els.heroTitleOrderPrefix.textContent = '01 /';
            const typeP = (t - 0.22) / 0.32;
            const charCount = Math.max(1, Math.min(sampleTitle.length, Math.ceil(typeP * 1.45 * sampleTitle.length)));
            titleInput.value = sampleTitle.slice(0, charCount);
            if (typeP > 0.65 && titleSetBtn) {
              const box = this.getElementBoxInTourOverlay(titleSetBtn);
              if (box) {
                const subP = (typeP - 0.65) / 0.35;
                const pulse = Math.sin(subP * Math.PI);
                dot = { x: box.x, y: box.y, opacity: 0.12 + 0.88 * pulse, scale: 0.9 + 0.16 * pulse, ring: true };
              }
            }
          } else if (t < 0.84) {
            // Phase 3: Custom title is set; "+ Card" button appears on the right of the title and dot taps it
            this.closeHeroTitleEditorDOM();
            subtitle.textContent = `01 / ${sampleTitle}`;
            isAssignedDemo = true;
            if (syncBtn) {
              syncBtn.classList.remove('hidden');
              const syncLabel = syncBtn.querySelector('.hero-sync-to-card-label');
              if (syncLabel) syncLabel.textContent = this.t('+ Card');
              const box = this.getElementBoxInTourOverlay(syncBtn);
              if (box) {
                const subP = (t - 0.54) / 0.30;
                const pulse = Math.sin(subP * Math.PI);
                dot = { x: box.x, y: box.y, opacity: 0.12 + 0.88 * pulse, scale: 0.9 + 0.16 * pulse, ring: true };
              }
            }
          } else {
            // Phase 4: Task is synced to Today's Card (+ Card button hides)
            this.closeHeroTitleEditorDOM();
            subtitle.textContent = `01 / ${sampleTitle}`;
            isAssignedDemo = true;
            if (syncBtn) syncBtn.classList.add('hidden');
          }

          if (this.hero3D) {
            this.hero3D.updateOdometer(25 * 6.0, 0, isAssignedDemo, false);
          }
          if (dot) {
            this.setTourDotState(this.els.tourPageDot, dot.x, dot.y, dot.opacity, dot.scale, dot.ring);
          } else {
            this.setTourDotState(this.els.tourPageDot, null, null, 0);
          }
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
      // STEP 6: 6-TOMATO GRID PAGE
      {
        title: 'Tomato Grid · 6 Focus Timers',
        desc: 'Tap tomato body for big timer, tap title to edit',
        applyPage: () => {
          this.restoreTourDemoArchiveCards();
          this.state.activePillar = 'timer';
          this.state.timerSubMode = 'grid';
          this.state.openDropdownQuadrant = null;
        },
        animateFrame: (elapsedMs) => {
          const quad0 = this.els.gridQuadrants[0];
          if (!quad0) return;
          const period = 2400;
          const half = period / 2;
          const isSecond = (elapsedMs % period) >= half;
          const subT = (elapsedMs % half) / half;

          const wrapEl = quad0.querySelector('.grid-tomato-wrap');
          const titleEl =
            quad0.querySelector('.grid-tomato-title') ||
            quad0.querySelector('.grid-tap-to-assign') ||
            wrapEl;
          const box = this.getElementBoxInTourOverlay(isSecond ? titleEl : wrapEl);
          if (!box) return;

          // Fade on and off to catch the user's attention
          const fade = 0.08 + 0.92 * Math.pow(Math.sin(subT * Math.PI), 1.15);
          const scale = 0.88 + 0.16 * Math.sin(subT * Math.PI);
          const offsetY = isSecond ? -4 : 10;
          this.setTourDotState(
            this.els.tourPageDot,
            box.x,
            box.y + offsetY,
            fade,
            scale,
            true
          );
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
      // STEP 7: STACK SCROLLING (Dot moves WITH the card scrolling smoothly to the next card)
      {
        title: 'Scroll Stack · Past Cards',
        desc: 'Swipe the date bar to browse past cards',
        applyPage: () => {
          this.ensureTourDemoArchiveCards();
          this.state.activePillar = 'stack';
          this.state.isStackCardFlipped = false;
          this._stackFlipDeg = 0;
          this.state.selectedStackDateKey =
            this._tourYesterdayKey ||
            this.getOffsetDateKey(this.state.cardDateKey, -1);
          this._tourStackLastSwitchedCycle = -1;
        },
        animateFrame: (elapsedMs) => {
          const centerPerspective =
            this.els.stackCarouselStage &&
            this.els.stackCarouselStage.querySelector('.stack-center-perspective');
          const stageBox = this.getElementBoxInTourOverlay(this.els.stackCarouselStage);
          if (!centerPerspective || !stageBox) return;

          const period = 2500;
          const cycleIdx = Math.floor(elapsedMs / period);
          const t = (elapsedMs % period) / period;
          // Alternate swiping left (to earlier card) and right (to later card)
          const swipeDir = cycleIdx % 2 === 0 ? -1 : 1;
          const startX = stageBox.x - swipeDir * 64;
          const endX = stageBox.x + swipeDir * 64;
          const stripBox = this.getElementBoxInTourOverlay(this.els.stackDateStrip);
          const centerY = stripBox ? stripBox.y : stageBox.y - 8;

          if (t < 0.14) {
            const p = t / 0.14;
            centerPerspective.classList.remove('anim-slide-next', 'anim-slide-prev');
            centerPerspective.style.transition = 'none';
            centerPerspective.style.transform = 'translateX(0px)';
            this.setTourDotState(
              this.els.tourPageDot,
              startX,
              centerY,
              p,
              1.05 - 0.10 * p,
              false
            );
          } else if (t < 0.56) {
            // Dot moves horizontally AND the card moves WITH the dot!
            const p = this.easeInOutCubic((t - 0.14) / 0.42);
            const dotX = startX + (endX - startX) * p;
            const cardShiftX = swipeDir * p * 92;
            centerPerspective.classList.remove('anim-slide-next', 'anim-slide-prev');
            centerPerspective.style.transition = 'none';
            centerPerspective.style.transform = `translateX(${cardShiftX.toFixed(1)}px) scale(${(1 - p * 0.03).toFixed(3)})`;
            this.setTourDotState(this.els.tourPageDot, dotX, centerY, 1, 0.94, false);
          } else {
            // Hand off to two-card slide transition once at t >= 0.56 without resetting transform!
            if (this._tourStackLastSwitchedCycle !== cycleIdx) {
              this._tourStackLastSwitchedCycle = cycleIdx;
              const yesterdayKey =
                this._tourYesterdayKey ||
                this.getOffsetDateKey(this.state.cardDateKey, -1);
              const twoDaysAgoKey =
                this._tourTwoDaysAgoKey ||
                this.getOffsetDateKey(this.state.cardDateKey, -2);
              const nextKey =
                this.state.selectedStackDateKey === yesterdayKey
                  ? twoDaysAgoKey
                  : yesterdayKey;
              this.selectStackDate(nextKey, -swipeDir, Math.round(swipeDir * 92));
            }
            const p = (t - 0.56) / 0.44;
            const fadeOut = Math.max(0.06, 1 - p * 1.45);
            this.setTourDotState(this.els.tourPageDot, endX, centerY, fadeOut, 0.98, false);
          }
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
      // STEP 8: ZOOM OUT TO CALENDAR (Card smoothly shrinks and disappears to reveal calendar)
      {
        title: 'Zoom Out · Monthly Calendar',
        desc: 'Pinch two fingers to zoom out to monthly calendar',
        applyPage: () => {
          this.ensureTourDemoArchiveCards();
          this.state.activePillar = 'stack';
          this.state.isStackCardFlipped = false;
          this._stackFlipDeg = 0;
          this.state.selectedStackDateKey =
            this._tourYesterdayKey ||
            this.getOffsetDateKey(this.state.cardDateKey, -1);
        },
        animateFrame: (elapsedMs) => {
          const period = 3500;
          const t = (elapsedMs % period) / period;
          const centerPerspective =
            this.els.stackCarouselStage &&
            this.els.stackCarouselStage.querySelector('.stack-center-perspective');

          if (t < 0.48) {
            // Phase A: Keep Calendar rendered underneath while Stack card smoothly shrinks & fades out!
            if (this.state.activePillar !== 'stack') {
              this.state.activePillar = 'stack';
              this.renderAll();
            }
            if (this.els.calendarScreen) {
              this.renderCalendarScreen();
              this.els.calendarScreen.classList.remove('hidden');
            }
            if (this.els.stackScreen) {
              this.els.stackScreen.classList.add('is-zoom-transitioning');
            }
            const stageBox = this.getElementBoxInTourOverlay(this.els.stackCarouselStage);
            if (!stageBox) return;

            const cx = stageBox.x;
            const cy = stageBox.y - 8;
            let spread = 68;
            let dotOpacity = 1;
            let cardScale = 1;
            let cardOpacity = 1;
            let stripOpacity = 1;
            let calOpacity = 0;

            if (t < 0.12) {
              const p = t / 0.12;
              dotOpacity = p;
              spread = 68;
              cardScale = 1;
              cardOpacity = 1;
              stripOpacity = 1;
              calOpacity = 0;
            } else if (t < 0.44) {
              const p = this.easeInOutCubic((t - 0.12) / 0.32);
              dotOpacity = 1 - Math.max(0, (p - 0.72) / 0.28);
              spread = 68 - p * 54; // Two dots pinch from ±68px inward to ±14px
              cardScale = 1 - p * 0.76; // Card shrinks continuously from 1.0 -> 0.24
              cardOpacity = 1 - Math.pow(p, 1.35); // Card fades out smoothly to reveal Calendar
              stripOpacity = Math.max(0, 1 - p * 2.6);
              calOpacity = Math.min(1, Math.max(0, (p - 0.18) / 0.82));
            } else {
              dotOpacity = 0;
              spread = 14;
              cardScale = 0.24;
              cardOpacity = 0;
              stripOpacity = 0;
              calOpacity = 1;
            }

            if (this.els.calendarScreen) {
              this.els.calendarScreen.style.transition = 'none';
              this.els.calendarScreen.style.opacity = `${calOpacity.toFixed(3)}`;
            }
            if (centerPerspective) {
              centerPerspective.classList.remove('anim-slide-next', 'anim-slide-prev');
              centerPerspective.style.transition = 'none';
              centerPerspective.style.transform = `scale(${cardScale.toFixed(3)})`;
              centerPerspective.style.opacity = `${Math.max(0, cardOpacity).toFixed(3)}`;
            }
            if (this.els.stackDateStrip) {
              this.els.stackDateStrip.style.opacity = `${stripOpacity.toFixed(3)}`;
            }

            this.setTourDotState(
              this.els.tourPageDot,
              cx - spread,
              cy - spread * 0.85,
              dotOpacity,
              0.94,
              false
            );
            this.setTourDotState(
              this.els.tourPageDot2,
              cx + spread,
              cy + spread * 0.85,
              dotOpacity,
              0.94,
              false
            );
          } else {
            // Phase B: Zoomed out to Monthly Calendar View — Single dot fades on and off on selected date
            if (this.els.stackScreen) {
              this.els.stackScreen.classList.remove('is-zoom-transitioning');
            }
            if (this.els.calendarScreen) {
              this.els.calendarScreen.style.transition = '';
              this.els.calendarScreen.style.opacity = '';
            }
            if (centerPerspective) {
              centerPerspective.style.transition = '';
              centerPerspective.style.transform = '';
              centerPerspective.style.opacity = '';
            }
            if (this.els.stackDateStrip) {
              this.els.stackDateStrip.style.opacity = '';
            }
            if (this.state.activePillar !== 'calendar') {
              this.state.activePillar = 'calendar';
              this.renderAll();
            }
            const calCell =
              (this.els.calendarMonthsContainer &&
                this.els.calendarMonthsContainer.querySelector('.cal-day-btn.is-selected')) ||
              (this.els.calendarMonthsContainer &&
                this.els.calendarMonthsContainer.querySelector('.cal-day-btn.is-today')) ||
              this.els.calendarMonthsContainer;
            const calBox = this.getElementBoxInTourOverlay(calCell);
            if (calBox) {
              const calSubT = (t - 0.48) / 0.52;
              const fade = 0.08 + 0.92 * Math.pow(Math.sin(calSubT * Math.PI), 1.15);
              const scale = 0.88 + 0.16 * Math.sin(calSubT * Math.PI);
              this.setTourDotState(this.els.tourPageDot, calBox.x, calBox.y, fade, scale, true);
            }
            this.setTourDotState(this.els.tourPageDot2, null, null, 0);
          }
        },
      },
      // STEP 9: PROFILE MENU (Sign in and change settings)
      {
        title: 'Profile & Settings',
        desc: 'Sign in and change settings here',
        applyPage: () => {
          this.restoreTourDemoArchiveCards();
          this.state.activePillar = 'card';
          this.state.isCardFlipped = false;
          this._todayFlipDeg = 0;
          this.setInstantCardRotation(this.els.card3DWrapper, false, 0);
          if (this.els.profileModalOverlay) {
            this.els.profileModalOverlay.classList.add('hidden');
          }
        },
        animateFrame: (elapsedMs) => {
          const period = 3200;
          const t = (elapsedMs % period) / period;
          if (t < 0.28) {
            if (this.els.profileModalOverlay) {
              this.els.profileModalOverlay.classList.add('hidden');
            }
            const btnBox = this.getElementBoxInTourOverlay(this.els.profileBtn);
            if (btnBox) {
              const p = t / 0.28;
              const fade = 0.12 + 0.88 * Math.sin(p * Math.PI);
              const scale = 0.88 + 0.16 * Math.sin(p * Math.PI);
              this.setTourDotState(this.els.tourPageDot, btnBox.x, btnBox.y, fade, scale, true);
            }
          } else {
            if (
              this.els.profileModalOverlay &&
              this.els.profileModalOverlay.classList.contains('hidden')
            ) {
              this.openProfileModal();
            }
            const targetEl = this.els.profileAccountBtn || this.els.profileBtn;
            const rowBox = this.getElementBoxInTourOverlay(targetEl);
            if (rowBox) {
              const subT = (t - 0.28) / 0.72;
              const fade = 0.12 + 0.88 * Math.pow(Math.sin(subT * Math.PI), 1.1);
              const scale = 0.9 + 0.14 * Math.sin(subT * Math.PI);
              this.setTourDotState(this.els.tourPageDot, rowBox.x, rowBox.y, fade, scale, true);
            }
          }
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
    ];
  }

  stopTourDemoLoop() {
    this.closeHeroTimeEditorDOM();
    this.closeHeroTitleEditorDOM();
    if (this.els.profileModalOverlay) {
      this.els.profileModalOverlay.classList.add('hidden');
    }
    if (this._tourDemoTimer) {
      clearInterval(this._tourDemoTimer);
      this._tourDemoTimer = null;
    }
    if (this._tourRafId) {
      cancelAnimationFrame(this._tourRafId);
      this._tourRafId = null;
    }
    if (this.els.card3DWrapper) {
      this.els.card3DWrapper.style.transition = '';
    }
    if (this.els.stackScreen) {
      this.els.stackScreen.classList.remove('is-zoom-transitioning');
    }
    if (this.els.calendarScreen) {
      this.els.calendarScreen.style.transition = '';
      this.els.calendarScreen.style.opacity = '';
    }
    if (this.els.stackDateStrip) {
      this.els.stackDateStrip.style.opacity = '';
    }
    const centerPerspective =
      this.els.stackCarouselStage &&
      this.els.stackCarouselStage.querySelector('.stack-center-perspective');
    if (centerPerspective) {
      centerPerspective.classList.remove(
        'anim-slide-next',
        'anim-slide-prev',
        'anim-bounce-next',
        'anim-bounce-prev'
      );
      centerPerspective.style.transition = '';
      centerPerspective.style.transform = '';
      centerPerspective.style.opacity = '';
    }
  }

  startGuidedTour(startStep = 0) {
    if (!this.els.onboardingOverlay) return;
    this._isGuidedTourActive = true;
    this._guidedTourStep = 0;
    const vp = document.getElementById('app-viewport');
    if (vp) vp.classList.add('tour-active');
    if (this.els.toastPill) {
      this.els.toastPill.classList.remove('visible');
    }
    this.els.onboardingOverlay.classList.remove('hidden');
    this.goToGuidedTourStep(startStep);
  }

  goToGuidedTourStep(stepIndex) {
    const steps = this.getGuidedTourSteps();
    const clampedIdx = Math.max(0, Math.min(steps.length - 1, stepIndex));
    this._guidedTourStep = clampedIdx;
    const step = steps[clampedIdx];

    this.stopTourDemoLoop();
    step.applyPage();
    this.renderAll();

    if (this.els.tourStepTitle) {
      this.els.tourStepTitle.textContent = this.t(step.title);
    }
    if (this.els.tourStepDesc) {
      this.els.tourStepDesc.textContent = this.t(step.desc);
    }
    if (this.els.tourPrevBtn) {
      this.els.tourPrevBtn.disabled = clampedIdx === 0;
    }
    if (this.els.tourNextBtn) {
      this.els.tourNextBtn.textContent =
        this.t(clampedIdx === steps.length - 1 ? 'Done' : 'Next');
    }

    const stepStartTime = performance.now();
    const tick = (now) => {
      if (!this._isGuidedTourActive || this._guidedTourStep !== clampedIdx) return;
      const elapsedMs = Math.max(0, now - stepStartTime);
      if (step.animateFrame) {
        step.animateFrame(elapsedMs);
      }
      this._tourRafId = requestAnimationFrame(tick);
    };
    this._tourRafId = requestAnimationFrame(tick);
  }

  finishGuidedTour() {
    this.stopTourDemoLoop();
    this.restoreTourDemoArchiveCards();
    const vp = document.getElementById('app-viewport');
    if (vp) vp.classList.remove('tour-active');
    this.setTourDotState(this.els.tourPageDot, null, null, 0);
    this.setTourDotState(this.els.tourPageDot2, null, null, 0);
    if (this.els.onboardingOverlay) {
      this.els.onboardingOverlay.classList.add('hidden');
    }
    this._isGuidedTourActive = false;
    this.state.hasCompletedOnboarding = true;
    this.state.activePillar = 'home';
    this.state.isCardFlipped = false;
    this._todayFlipDeg = 0;
    this.saveState();
    this.renderAll();
  }

  initFirstTimeOnboarding() {
    if (!this.els.onboardingOverlay) return;

    // Block all pointer/wheel interactions from reaching underlying pages while tutorial is open
    ['pointerdown', 'pointermove', 'pointerup', 'wheel'].forEach((evtName) => {
      this.els.onboardingOverlay.addEventListener(evtName, (e) => {
        e.stopPropagation();
      });
    });

    const advanceOrFinish = () => {
      const steps = this.getGuidedTourSteps();
      if ((this._guidedTourStep || 0) >= steps.length - 1) {
        this.finishGuidedTour();
      } else {
        this.goToGuidedTourStep((this._guidedTourStep || 0) + 1);
      }
    };

    if (this.els.onboardingDismissBtn) {
      this.els.onboardingDismissBtn.addEventListener('click', () => {
        this.finishGuidedTour();
      });
    }
    if (this.els.tourPrevBtn) {
      this.els.tourPrevBtn.addEventListener('click', () => {
        if ((this._guidedTourStep || 0) > 0) {
          this.goToGuidedTourStep((this._guidedTourStep || 0) - 1);
        }
      });
    }
    if (this.els.tourNextBtn) {
      this.els.tourNextBtn.addEventListener('click', advanceOrFinish);
    }

    this.initAboutModalEvents();

    if (!this.state.hasCompletedOnboarding) {
      if (this.state.activePillar !== 'home') {
        this.state.activePillar = 'home';
        this.renderAll();
      }
      this.openAboutModal();
    } else {
      this.checkFirstTimePageHint();
    }
  }

  initAboutModalEvents() {
    if (!this.els.aboutModalOverlay) return;

    // Clicking surrounding area outside the card closes About & exits to homepage
    this.els.aboutModalOverlay.addEventListener('click', (e) => {
      if (e.target === this.els.aboutModalOverlay) {
        this.closeAboutModalToHome();
      }
    });

    // Tapping inside the letter while blocks are still fading in reveals all blocks immediately
    if (this.els.aboutLetterCard) {
      this.els.aboutLetterCard.addEventListener('click', (e) => {
        if (
          e.target.closest('#about-modal-close-btn') ||
          e.target.closest('#about-start-tour-btn')
        ) {
          return;
        }
        this.revealAllAboutBlocksImmediately();
      });
    }

    if (this.els.aboutModalCloseBtn) {
      this.els.aboutModalCloseBtn.addEventListener('click', () => {
        this.closeAboutModalToHome();
      });
    }

    if (this.els.aboutStartTourBtn) {
      this.els.aboutStartTourBtn.addEventListener('click', () => {
        this.clearAboutBlockTimers();
        if (this.els.aboutModalOverlay) {
          this.els.aboutModalOverlay.classList.add('hidden');
        }
        this.startGuidedTour(0);
      });
    }
  }

  clearAboutBlockTimers() {
    if (Array.isArray(this._aboutTimers)) {
      this._aboutTimers.forEach((t) => clearTimeout(t));
    }
    this._aboutTimers = [];
  }

  revealAllAboutBlocksImmediately() {
    this.clearAboutBlockTimers();
    if (!this.els.aboutLetterBlocks) return;
    const blocks = this.els.aboutLetterBlocks.querySelectorAll('.about-block');
    blocks.forEach((b) => b.classList.add('visible'));
  }

  openAboutModal() {
    if (!this.els.aboutModalOverlay) return;
    this.clearAboutBlockTimers();
    const blocks = this.els.aboutLetterBlocks
      ? Array.from(this.els.aboutLetterBlocks.querySelectorAll('.about-block'))
      : [];
    // First visit: index.html already opened the letter and started the reveal before the
    // app scripts loaded. Keep that reveal going instead of restarting it (no flash).
    if (typeof window !== 'undefined' && window.__aboutBootReveal) {
      window.__aboutBootReveal = false;
      this._aboutTimers = Array.isArray(window.__aboutBootTimers) ? window.__aboutBootTimers : [];
      window.__aboutBootTimers = null;
      this.els.aboutModalOverlay.classList.remove('hidden');
      this.fitAboutCardTypography();
      return;
    }
    blocks.forEach((b) => b.classList.remove('visible'));
    this.els.aboutModalOverlay.classList.remove('hidden');
    this.fitAboutCardTypography();

    // Calm but brisk reading cadence: a new line every ~0.7s, each with a soft ~0.8s fade-in
    // (whole letter readable in ~5s; v36 used ~1.55s steps, which felt too slow)
    const firstMs = 200;
    const stepMs = 700;
    const revealStep = (idx) => {
      if (idx >= blocks.length) return;
      blocks[idx].classList.add('visible');
      if (idx + 1 < blocks.length) {
        const timerId = setTimeout(() => revealStep(idx + 1), stepMs);
        this._aboutTimers.push(timerId);
      }
    };
    if (blocks.length > 0) {
      const firstId = setTimeout(() => revealStep(0), firstMs);
      this._aboutTimers.push(firstId);
    }
  }

  fitAboutCardTypography() {
    if (!this.els.aboutLetterBlocks) return;
    const titleEl = this.els.aboutLetterBlocks.querySelector('.about-block-title');
    if (titleEl) {
      let tSize = 25.0;
      titleEl.style.fontSize = `${tSize}px`;
      while (tSize > 18 && titleEl.scrollWidth > titleEl.clientWidth) {
        tSize = Math.round((tSize - 0.5) * 10) / 10;
        titleEl.style.fontSize = `${tSize}px`;
      }
    }
  }

  closeAboutModalToHome() {
    this.clearAboutBlockTimers();
    if (this.els.aboutModalOverlay) {
      this.els.aboutModalOverlay.classList.add('hidden');
    }
    this.state.hasCompletedOnboarding = true;
    this.state.activePillar = 'home';
    this.state.isCardFlipped = false;
    this._todayFlipDeg = 0;
    this.saveState();
    this.renderAll();
  }

  checkFirstTimePageHint() {
    // Redundant auto-page hint toasts are disabled because the 7-step Guided Tour covers all pages visually without overlapping bottom controls.
  }

  showTelemetryToast(msg, durationMs = 1900) {
    if (!this.els.toastPill) return;
    this.els.toastPill.textContent = msg;
    this.els.toastPill.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.els.toastPill.classList.remove('visible');
    }, durationMs);
  }

  showNotificationBanner(msg) {
    if (!this.els.notificationBanner) return;
    this.els.notificationBanner.textContent = msg;
    this.els.notificationBanner.classList.add('visible');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => {
      this.els.notificationBanner.classList.remove('visible');
    }, 3200);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.fableFlowApp = new FableFlowApp();
});
