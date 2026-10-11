/**
 * Fable / Flow — Phase 1 & Phase 2 Complete MVP Application Controller
 *
 * Implements all PRD v4.2, Phase 1 ("Core Tactile Loop") & Phase 2 ("Complete Daily Ritual & Memory Archive") requirements:
 * 1. Minimalist 2-Object Homepage (01-home-page.png): Wide-tracked 'FABLE / FLOW' header, exact 334x222 '06 OCT' mini-card, 3D Tomato.
 * 2. Photorealistic Hero Tomato 3D Dial (02-hero-timer.png) & 6-Tomato 2x3 Grid (03-grid-timer.png):
 *    - 1-minute notch snap, HH:MM:SS when > 60 min, Tap-on-Digits inline time editor (0-180 min / HH:MM).
 *    - Mirror-polished silver metallic completion state (End -> Silver -> Reset ↺).
 *    - Authentic mechanical 2-strike Pomodoro bell ring + WebAudio tactile foley.
 * 3. Dual-Sided Today's Index Card:
 *    - Clean White Front (04-card-front.png) with up to 6 tasks, glossy single-highlight mini tomatoes,
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

import { OdometerDialPhysics } from './odometerPhysics.js?v=20261011_v39';
import { CardGestureMath } from './cardGestureMath.js?v=20261011_v39';
import { SensoryEngine } from './sensoryEngine.js?v=20261011_v39';
import { HeroTomato3DView, GridTomatoRenderer } from './tomato3D.js?v=20261011_v39';
import { SupabaseSyncService } from './supabaseSync.js?v=20261011_v39';

const STORAGE_KEY = 'fable_flow_phase2_mvp_v10';
const NUM_GRID_SLOTS = 6;

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
    this.initMobilePortraitLock();
    this.init3DRenderers();
    this.bindGlobalEvents();
    this.startWallClockTicker();
    this.renderAll();
    this.initFirstTimeOnboarding();
    if (this.supabaseSync.isLoggedIn()) {
      this.syncFromAuthenticatedAccount(false);
    }
    this.registerServiceWorker();
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
      const isMobileLandscape = w > h && h <= 560;
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
          const currentLogicalKey = this.getCurrentLogicalDateString(parsed.dailyResetHour);
          const todayMeta = this.formatDateMetadataForKey(currentLogicalKey);
          if (!parsed.cardDateKey || parsed.cardDateKey !== currentLogicalKey) {
            const prevKey = parsed.cardDateKey;
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
    this.showNotificationBanner('Restored clean default state with Example Task.');
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
      heroSubtitle: document.getElementById('hero-subtitle'),
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
      profileToggleAudioBtn: document.getElementById('profile-toggle-audio-btn'),
      profileAudioStateLabel: document.getElementById('profile-audio-state-label'),
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
        this.state.activePillar = 'timer';
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
        this.showTelemetryToast(`Daily reset time: ${padded}`);
      });
    }
    if (this.els.profileToggleAudioBtn) {
      this.els.profileToggleAudioBtn.addEventListener('click', () => {
        this.toggleSilentAudioMode();
        if (this.els.profileAudioStateLabel) {
          this.els.profileAudioStateLabel.textContent = this.sensory.isSilentMode ? 'Off' : 'On';
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

    if (this.els.cardPlusBtn) {
      this.els.cardPlusBtn.addEventListener('click', () => {
        if (this.state.isCardFlipped) {
          this.triggerPhotoAttachment('today');
        } else {
          this.startInlineAddTask(false);
        }
      });
    }

    this.els.addItemRow.addEventListener('click', () => {
      if (this._justFinishedCardSwipe) return;
      this.startInlineAddTask(false);
    });

    // 2b. Matte Black Back of Card — Evening Reflection Journal & Photo Upload
    if (this.els.cardBackReflection) {
      this.els.cardBackReflection.addEventListener('input', () => {
        const clamped = this.clampReflectionInputText(this.els.cardBackReflection.value);
        if (this.els.cardBackReflection.value !== clamped) {
          this.els.cardBackReflection.value = clamped;
          this.showTelemetryToast('Reflection limit reached');
        }
        this.state.reflectionText = this.els.cardBackReflection.value;
        this.adjustReflectionTypography(this.els.cardBackReflection);
        this.saveState();
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
              this.showTelemetryToast('Photo updated on archived card');
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
            this.showTelemetryToast('Photo updated in Evening Journal');
          }
        } catch (_) {
          this.showNotificationBanner('Could not process selected image file.');
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
        this.state.isHeroDropdownOpen &&
        !e.target.closest('.hero-subtitle-wrap')
      ) {
        this.state.isHeroDropdownOpen = false;
        if (this.state.activePillar === 'timer' && this.state.timerSubMode === 'hero') {
          this.renderHeroScreen();
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

    // PM #4: Clicking the task subtitle on the Hero page opens the reassignment dropdown right on the Hero page
    this.els.heroSubtitle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cancelHeroTimeEditor();
      this.state.isHeroDropdownOpen = !this.state.isHeroDropdownOpen;
      this.saveState();
      this.renderHeroScreen();
    });

    // 5b. Tap-on-Digits Time Entry on Hero Readout (0–180 min or HH:MM)
    this.bindHeroReadoutTimeEntry();

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
    this.saveState();
    if (this.els.demoBtnSilent) {
      this.els.demoBtnSilent.textContent = this.sensory.isSilentMode
        ? '🔇 Silent Mode: ON'
        : '🔊 Foley Audio: ON';
      this.els.demoBtnSilent.classList.toggle('active-pill', this.sensory.isSilentMode);
    }
    this.showTelemetryToast(
      this.sensory.isSilentMode ? 'Sound: Off' : 'Sound: On'
    );
  }

  openProfileModal() {
    if (!this.els.profileModalOverlay) return;
    this.updateProfileAccountLabel();
    if (this.els.profileAudioStateLabel) {
      this.els.profileAudioStateLabel.textContent = this.sensory.isSilentMode ? 'Off' : 'On';
    }
    if (this.els.profileResetTimeSelect) {
      const hr = typeof this.state.dailyResetHour === 'number' ? this.state.dailyResetHour : 5;
      this.els.profileResetTimeSelect.value = String(hr);
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
      this.els.profileAccountStateLabel.textContent = 'Sign In ↗';
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
        this.showTelemetryToast('Synced to account');
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
            ? 'Supabase Cloud connected'
            : 'Saved local vault mode'
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
        this.els.authSubmitBtn.textContent = isSignup ? 'Create Account' : 'Sign In';
      }
    } else if (user) {
      if (this.els.authUserEmailDisplay) {
        this.els.authUserEmailDisplay.textContent = user.email;
      }
      if (this.els.authSyncModeBadge) {
        this.els.authSyncModeBadge.textContent = this.supabaseSync.isCloudConfigured()
          ? 'Supabase Cloud'
          : 'Synced';
      }
      if (this.els.authLastSyncedLabel) {
        this.els.authLastSyncedLabel.textContent = 'Up to date';
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
        this.showTelemetryToast(`Account created: ${user.email}`);
      } else {
        const { user } = await this.supabaseSync.signIn(email, password);
        if (this.els.authPasswordInput) this.els.authPasswordInput.value = '';
        await this.syncFromAuthenticatedAccount(true);
        this.renderAuthModalState();
        this.closeAuthModal();
        this.showTelemetryToast(`Signed in as ${user.email}`);
      }
    } catch (err) {
      this.showAuthError(err && err.message ? err.message : 'Authentication failed');
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
        this.showTelemetryToast(`Signed in as ${user.email}`);
      }
    } catch (err) {
      this.showAuthError(err && err.message ? err.message : 'Sign-in failed');
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
    this.state = fresh;
    this._todayFlipDeg = 0;
    this._stackFlipDeg = 0;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (_) {}
    this.renderAuthModalState();
    this.closeAuthModal();
    this.renderAll();
    this.showTelemetryToast('Signed out');
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
      this.state = cloudState;
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
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
      navigator.serviceWorker
        .register('./sw.js?v=20261011_v39', { updateViaCache: 'none' })
        .then((reg) => {
          if (reg && typeof reg.update === 'function') {
            reg.update().catch(() => {});
          }
        })
        .catch(() => {});
    }
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

    this.state.timers.forEach((s) => {
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

    this.sensory.playCardFlipSwoosh();
    this.saveState();
    this.renderAll();
    this.showNotificationBanner(
      `5:00 AM Rollover: Archived ${currentKey} to Stack & created fresh card for ${nextMeta.shortMonth} ${nextDayPadded}.`
    );
  }

  // =========================================================================
  // ADAPTIVE TYPOGRAPHY, WORD/CHAR CAPS & PHOTO COMPRESSION (<= 1600px)
  // =========================================================================

  /**
   * Limits task input to at most MAX_TASK_WORDS (18 words) and MAX_TASK_CHARS (110 chars)
   * so users can enter full task descriptions while keeping card margins clean.
   */
  clampTaskInputText(rawText) {
    let text = String(rawText || '').replace(/\s+/g, ' ');
    const leadingTrimmed = text.trimStart();
    if (leadingTrimmed) {
      const words = leadingTrimmed.split(' ');
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
      });
      if (addItemEl) {
        addItemEl.style.fontSize = sizeStr;
      }
      rowNodes.forEach((row) => {
        row.style.paddingTop = `${padY}px`;
        row.style.paddingBottom = `${padY}px`;
      });
    };

    let unifiedSize = 24.0;
    let unifiedPadY = 9;
    applyUnifiedSize(unifiedSize, unifiedPadY);

    // Only decrease the unified font size if the whole card page is actually filled
    if (bodyEl && bodyEl.clientHeight > 0) {
      while (bodyEl.scrollHeight > bodyEl.clientHeight + 2 && unifiedSize > 16.5) {
        unifiedSize = Math.max(16.5, Number((unifiedSize - 0.5).toFixed(1)));
        unifiedPadY = unifiedSize < 21.5 ? 6 : unifiedSize < 23.0 ? 7 : 8;
        applyUnifiedSize(unifiedSize, unifiedPadY);
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
   * so the reflection stops once the minimum font size floor is reached.
   */
  clampReflectionInputText(rawText) {
    let text = String(rawText || '');
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
  }

  bindTwoWayCardFlipOnWrapper(wrapper, isStackCard = false) {
    if (!wrapper) return;

    let startX = null;
    let startY = null;
    let activePointerId = null;
    let isDraggingFlip = false;

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
        e.target.closest('.task-inline-delete-btn')
      ) {
        return;
      }
      const pt = this.getPointerXY(e);
      startX = pt.x;
      startY = pt.y;
      activePointerId = e.pointerId;
      isDraggingFlip = false;
    });

    const onWindowPointerMove = (e) => {
      if (startX === null || startY === null) return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;

      const pt = this.getPointerXY(e);
      const dx = pt.x - startX;
      const dy = pt.y - startY;

      if (!isDraggingFlip && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        isDraggingFlip = true;
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
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

      const pt = e.clientX !== undefined ? this.getPointerXY(e) : { x: startX, y: startY };
      const dx = pt.x - startX;
      const dy = pt.y - startY;
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
        (Math.abs(dx) >= 22 && Math.abs(dx) > Math.abs(dy) * 1.15)
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
    this.renderCardScreen();
    this.checkFirstTimePageHint();
  }

  triggerStackCardFlip(direction = -1) {
    const step = direction >= 0 ? 180 : -180;
    this._stackFlipDeg += step;
    this.state.isStackCardFlipped = !this.state.isStackCardFlipped;
    this.sensory.playCardFlipSwoosh();
    this.saveState();
    this.renderStackScreen();
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
    this.showTelemetryToast(`Card added for ${meta.shortMonth} ${String(meta.dayNum).padStart(2, '0')}`);
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
        this.startInlineAddTask(true);
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
      this.els.stackCardBackReflection.addEventListener('input', () => {
        const card = this.getSelectedStackCard();
        if (!card) return;
        const clamped = this.clampReflectionInputText(this.els.stackCardBackReflection.value);
        if (this.els.stackCardBackReflection.value !== clamped) {
          this.els.stackCardBackReflection.value = clamped;
        }
        card.reflectionText = this.els.stackCardBackReflection.value;
        this.adjustReflectionTypography(this.els.stackCardBackReflection);
        this.saveState();
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

    // 2. Smooth 1:1 Horizontal Swipe / Drag anywhere on #stack-carousel-stage (including #stack-card-3d)
    if (this.els.stackCarouselStage) {
      let startX = null;
      let startY = null;
      let lastX = 0;
      let lastTime = 0;
      let vx = 0;
      let isDraggingCarousel = false;
      const centerPerspective = this.els.stackCarouselStage.querySelector(
        '.stack-center-perspective'
      );

      this.els.stackCarouselStage.addEventListener('pointerdown', (e) => {
        if (
          e.target.closest('.stack-card-edit-btn') ||
          e.target.closest('.journal-photo-remove-btn') ||
          e.target.closest('.journal-photo-add-second-pill') ||
          e.target.closest('.stack-retro-empty-slot') ||
          e.target.closest('.task-inline-input') ||
          e.target.closest('.task-inline-delete-btn')
        ) {
          return;
        }
        // In Edit Mode, allow swiping on a task row to cross it out
        if (this.state.isStackEditMode && e.target.closest('.task-row')) {
          return;
        }
        const pt = this.getPointerXY(e);
        startX = pt.x;
        startY = pt.y;
        lastX = pt.x;
        lastTime = performance.now();
        vx = 0;
        isDraggingCarousel = false;
      });

      window.addEventListener(
        'pointermove',
        (e) => {
          if (startX === null || startY === null) return;
          const pt = this.getPointerXY(e);
          const dx = pt.x - startX;
          const dy = pt.y - startY;
          const now = performance.now();
          const dt = Math.max(1, now - lastTime);

          if (!isDraggingCarousel && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy) * 1.1) {
            isDraggingCarousel = true;
            if (document.activeElement && document.activeElement.blur) {
              document.activeElement.blur();
            }
          }

          if (isDraggingCarousel && centerPerspective) {
            if (e.cancelable) e.preventDefault();
            vx = 0.7 * ((pt.x - lastX) / dt) + 0.3 * vx;
            lastX = pt.x;
            lastTime = now;
            const offset = Math.max(-165, Math.min(165, dx * 0.78));
            const scale = (1 - Math.min(0.05, Math.abs(dx) / 2600)).toFixed(3);
            centerPerspective.style.transition = 'none';
            centerPerspective.style.transform = `translate3d(${offset.toFixed(1)}px, 0, 0) scale(${scale})`;
            if (this.els.stackPeekLeft) {
              this.els.stackPeekLeft.style.transition = 'none';
              this.els.stackPeekLeft.style.transform = `translateY(-50%) translateX(${Math.max(0, offset * 0.32).toFixed(1)}px)`;
            }
            if (this.els.stackPeekRight) {
              this.els.stackPeekRight.style.transition = 'none';
              this.els.stackPeekRight.style.transform = `translateY(-50%) translateX(${Math.min(0, offset * 0.32).toFixed(1)}px)`;
            }
          }
        },
        { passive: false }
      );

      const endCarouselDrag = (e) => {
        if (startX === null || startY === null) return;
        const pt = e && e.clientX !== undefined ? this.getPointerXY(e) : { x: lastX, y: startY };
        const dx = pt.x - startX;
        const dy = pt.y - startY;
        const releaseOffset = Math.max(-165, Math.min(165, dx * 0.78));
        startX = null;
        startY = null;

        if (centerPerspective) {
          centerPerspective.style.transition = '';
          centerPerspective.style.transform = '';
        }
        if (this.els.stackPeekLeft) {
          this.els.stackPeekLeft.style.transition = '';
          this.els.stackPeekLeft.style.transform = '';
        }
        if (this.els.stackPeekRight) {
          this.els.stackPeekRight.style.transition = '';
          this.els.stackPeekRight.style.transform = '';
        }

        if (!isDraggingCarousel) return;
        isDraggingCarousel = false;
        this._justFinishedCardSwipe = true;
        clearTimeout(this._swipeGuardTimer);
        this._swipeGuardTimer = setTimeout(() => {
          this._justFinishedCardSwipe = false;
        }, 220);

        const flicked = Math.abs(vx) > 0.25 && Math.abs(dx) >= 10;
        if ((Math.abs(dx) >= 18 || flicked) && Math.abs(dx) > Math.abs(dy) * 1.05) {
          if (dx > 0) {
            this.stepStackCard(-1, releaseOffset);
          } else {
            this.stepStackCard(1, releaseOffset);
          }
        }
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

          // Smooth wheel/trackpad scrolling through the chronological stack of cards
          const now = Date.now();
          if (now - this._lastStackWheelTime < 220) return;
          const dominantDelta =
            Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
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
      this.showNotificationBanner('No archived card remaining to delete.');
      return;
    }

    if (this.els.deleteModalTitle) {
      this.els.deleteModalTitle.textContent = `Permanently delete ${card.shortDate} card?`;
    }
    if (this.els.deleteModalDesc) {
      this.els.deleteModalDesc.textContent =
        'This action cannot be undone. This archived card and its reflection will be permanently removed from your stack.';
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
      this.showNotificationBanner('Card permanently deleted');
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
          this.showTelemetryToast('Switch to Countdown to set duration');
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

    this.els.heroTimeInput.addEventListener('input', () => {
      const rawVal = this.els.heroTimeInput.value;
      if (this.els.heroTimeUnitBadge) {
        this.els.heroTimeUnitBadge.textContent = rawVal.includes(':') ? 'HH:MM' : 'MIN';
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
      if (e.key === 'Enter') {
        e.preventDefault();
        this.commitHeroTimeEditor();
      } else if (e.key === 'Escape') {
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
    const slot = this.state.timers[this.state.selectedQuadrant] || this.state.timers[0];
    if (!slot || !this.els.heroTimeEditor || !this.els.heroTimeInput) return;

    if (slot.mode === 'stopwatch') {
      this.showTelemetryToast('Switch to Countdown to set duration');
      return;
    }

    const currentMinutes = Math.round(slot.remainingSeconds / 60);
    this.els.heroReadout.classList.add('hidden');
    this.els.heroTimeEditor.classList.remove('hidden');
    this.els.heroTimeInput.value = String(currentMinutes);
    if (this.els.heroTimeUnitBadge) {
      this.els.heroTimeUnitBadge.textContent = 'MIN';
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
    this.showTelemetryToast(`Timer set to ${clampedMins} min`);
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
        }
      };
      document.addEventListener('visibilitychange', this._boundVisibilityRefresh);
      window.addEventListener('focus', this._boundVisibilityRefresh);
    }

    this.tickInterval = setInterval(() => {
      // QA #3: Automatically roll over / refresh the daily card when the system logical date advances
      if (checkSystemDateRefresh()) {
        return;
      }

      let anyUpdated = false;
      let anyCompletedTransition = false;
      const now = Date.now();

      for (const slot of this.state.timers) {
        if (slot.runState !== 'running') continue;

        if (slot.mode === 'countdown') {
          if (slot.remainingSeconds > 0) {
            slot.remainingSeconds = Math.max(0, slot.remainingSeconds - 1);
            slot.angleDegrees = OdometerDialPhysics.secondsToAngleDegrees(slot.remainingSeconds);
            slot.lastTickTimestamp = now;
            anyUpdated = true;

            if (slot.remainingSeconds === 0) {
              anyCompletedTransition = true;
              this.endTimerToSilver(slot.quadrant, true);
              this.showNotificationBanner(
                `Timer completed: ${(slot.customTitle || 'Timer').toUpperCase()}`
              );
            }
          }
        } else {
          const prevWholeMinutes = Math.floor(slot.remainingSeconds / 60);
          slot.remainingSeconds += 1;
          const newWholeMinutes = Math.floor(slot.remainingSeconds / 60);
          slot.angleDegrees = OdometerDialPhysics.stopwatchSecondsToMinuteAngleDegrees(
            slot.remainingSeconds
          );
          if (newWholeMinutes > prevWholeMinutes) {
            this.sensory.playDialRatchetNotch(true);
          }
          slot.lastTickTimestamp = now;
          anyUpdated = true;
        }
      }

      if (anyUpdated) {
        this.saveState();
        if (this.state.activePillar === 'timer') {
          if (this.state.timerSubMode === 'hero') {
            this.renderHeroScreen();
          } else if (anyCompletedTransition) {
            this.renderGridScreen();
          } else {
            this.updateGridTimersInPlace();
          }
        }
      }
    }, 1000);
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

  endTimerToSilver(quadrant, completedNaturally = false) {
    this.closeHeroTimeEditorDOM();
    const slot = this.state.timers[quadrant];
    if (!slot) return;

    slot._justTransitionedSilver = slot.runState !== 'completed';
    slot.runState = 'completed';
    slot.lastTickTimestamp = null;

    this.sensory.playCompletionChime();
    if (!completedNaturally) {
      this.showTelemetryToast('Timer ended');
    }

    this.saveState();
    this.renderAll();
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
    this.showTelemetryToast('Tomato reset to 00:00');

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
      this.showTelemetryToast('Stopwatch mode');
    } else {
      slot.mode = 'countdown';
      slot.configuredMinutes = 25;
      slot.remainingSeconds = 25 * 60;
      slot.angleDegrees = 25 * 6.0;
      this.showTelemetryToast('Countdown mode');
    }
    this.sensory.playDialRatchetNotch(true);
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

    this.state.openDropdownQuadrant = null;
    this.state.isHeroDropdownOpen = false;
    this.sensory.playDialRatchetNotch(true);
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

    this.state.openDropdownQuadrant = null;
    this.state.isHeroDropdownOpen = false;
    this.sensory.playDialRatchetNotch(true);
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

    this.state.openDropdownQuadrant = null;
    this.state.isHeroDropdownOpen = false;
    this.sensory.playDialRatchetNotch(false);
    this.showTelemetryToast('Tomato unassigned');
    this.saveState();
    this.renderAll();
  }

  handleCardTaskTomatoClick(task) {
    if (task.assignedQuadrant !== null && task.assignedQuadrant !== undefined) {
      this.clearQuadrantAssignment(task.assignedQuadrant);
      return;
    }

    const freeSlot = this.state.timers.find(
      (s) => !s.assignedTaskId && !s.customTitle
    );
    const targetQuad = freeSlot ? freeSlot.quadrant : 0;
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
    container.innerHTML = '';

    const totalTasks = this.state.tasks.length;
    const rowVertPad = 9;

    this.state.tasks.forEach((task, idx) => {
      task.orderIndex = idx + 1;
      const row = document.createElement('div');
      row.className = 'task-row';
      row.dataset.taskId = task.id;
      row.dataset.completed = task.isCompleted ? 'true' : 'false';
      row.style.paddingTop = `${rowVertPad}px`;
      row.style.paddingBottom = `${rowVertPad}px`;

      const fontSizePx = this.computeTaskFontSizePx(task.title, totalTasks);

      const numSpan = document.createElement('span');
      numSpan.className = 'task-index';
      numSpan.style.fontSize = `${fontSizePx}px`;
      numSpan.textContent = String(task.orderIndex).padStart(2, '0');

      const titleWrap = document.createElement('div');
      titleWrap.className = 'task-title-wrap';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'task-title';
      titleSpan.style.fontSize = `${fontSizePx}px`;
      titleSpan.textContent = task.title;
      titleWrap.appendChild(titleSpan);

      const strikeCanvas = document.createElement('canvas');
      strikeCanvas.className = 'pencil-strike-canvas';
      strikeCanvas.width = 720;
      strikeCanvas.height = 120;

      const tomatoBtn = document.createElement('button');
      tomatoBtn.className = 'task-tomato-btn';
      tomatoBtn.type = 'button';
      const isLit =
        task.assignedQuadrant !== null && task.assignedQuadrant !== undefined;
      tomatoBtn.title = isLit
        ? 'Click lit-up tomato to unassign (return to grey)'
        : 'Click grey tomato to light up and open Timer page';

      const miniImg = document.createElement('img');
      miniImg.className = 'task-mini-tomato-img';
      const assignedSlot = isLit ? this.state.timers[task.assignedQuadrant] : null;
      const miniPaletteKey = !isLit
        ? 'unassigned'
        : assignedSlot && assignedSlot.runState === 'completed'
        ? 'completed'
        : task.assignedQuadrant;
      miniImg.src = this.gridRenderer.getMiniDataURL(miniPaletteKey);
      miniImg.alt = isLit ? 'Assigned Tomato' : 'Unassigned Grey Tomato';
      tomatoBtn.appendChild(miniImg);

      tomatoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleCardTaskTomatoClick(task);
      });

      row.appendChild(numSpan);
      row.appendChild(titleWrap);
      row.appendChild(strikeCanvas);
      row.appendChild(tomatoBtn);

      container.appendChild(row);

      this.bindTaskRowPencilGesture(row, task, strikeCanvas, false);
    });

    if (this.state.tasks.length < 6) {
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
    containerEl.innerHTML = '';

    const photos = Array.isArray(photosArray) ? photosArray.slice(0, 2) : [];
    const isStackViewMode = targetType === 'stack' && !this.state.isStackEditMode;
    const bodyEl = containerEl.closest('.card-back-body');

    // 1. If 0 photos on a Past Card when NOT in Edit mode: hide photo boxes completely
    if (photos.length === 0 && isStackViewMode) {
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

    if (photos.length === 0) {
      const addSlot = document.createElement('div');
      addSlot.className = 'journal-photo-slot';
      addSlot.title = 'Click to attach a photo';
      const label = document.createElement('span');
      label.className = 'journal-photo-add-label';
      label.textContent = '+ Attach Photo (up to 2)';
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
        ? 'Tap photo to view in detail'
        : 'Tap photo to view in detail, or tap × to remove';

      const img = document.createElement('img');
      img.className = 'journal-photo-img';
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
          addSecondPill.textContent = '+ 2nd Photo';
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
      secondSlot.title = 'Click to attach a second photo';
      const label = document.createElement('span');
      label.className = 'journal-photo-add-label';
      label.textContent = '+ Add 2nd Photo';
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

    if (this.els.stackDateStrip) {
      const stripKeys = this.getStackStripDateKeys();
      const stripSignature = stripKeys.join(',');
      let monthBtn = this.els.stackDateStrip.querySelector('.stack-month-label');
      let pillsTrack = this.els.stackDateStrip.querySelector('.stack-date-pills-track');

      if (!monthBtn || !pillsTrack || pillsTrack.dataset.keysSignature !== stripSignature) {
        this.els.stackDateStrip.innerHTML = '';
        monthBtn = document.createElement('button');
        monthBtn.type = 'button';
        monthBtn.className = 'stack-month-label';
        monthBtn.title = 'Tap to jump between months';
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
        requestAnimationFrame(() => {
          this.centerActiveDatePill(false);
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
        const dPadded = String(meta.dayNum).padStart(2, '0');
        emptySlotBtn.innerHTML = `
          <span class="stack-retro-plus-icon">+</span>
          <span class="stack-retro-slot-title">+ Add Card for ${meta.shortMonth} ${dPadded}</span>
          <span class="stack-retro-slot-sub">Add daily to-dos &amp; reflection retrospectively</span>
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
    if (this.els.stackBtnTrash) this.els.stackBtnTrash.classList.remove('hidden');
    const isEditing = Boolean(this.state.isStackEditMode);
    if (this.els.stackFrontEditBtn) {
      this.els.stackFrontEditBtn.classList.remove('hidden');
      this.els.stackFrontEditBtn.textContent = isEditing ? 'Done' : 'Edit';
      this.els.stackFrontEditBtn.classList.toggle('is-editing', isEditing);
    }
    if (this.els.stackBackEditBtn) {
      this.els.stackBackEditBtn.classList.remove('hidden');
      this.els.stackBackEditBtn.textContent = isEditing ? 'Done' : 'Edit';
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
    listEl.innerHTML = '';

    const stackTasks = selectedCard.tasks || [];
    const totalTasks = stackTasks.length;
    const rowVertPad = 9;

    stackTasks.forEach((task, idx) => {
      task.orderIndex = idx + 1;
      const row = document.createElement('div');
      row.className = 'task-row';
      row.dataset.taskId = task.id;
      row.dataset.completed = task.isCompleted ? 'true' : 'false';
      row.style.paddingTop = `${rowVertPad}px`;
      row.style.paddingBottom = `${rowVertPad}px`;

      const fontSizePx = this.computeTaskFontSizePx(task.title, totalTasks);

      const numSpan = document.createElement('span');
      numSpan.className = 'task-index';
      numSpan.style.fontSize = `${fontSizePx}px`;
      numSpan.textContent = String(task.orderIndex).padStart(2, '0');

      const titleWrap = document.createElement('div');
      titleWrap.className = 'task-title-wrap';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'task-title';
      titleSpan.style.fontSize = `${fontSizePx}px`;
      titleSpan.textContent = task.title;
      titleWrap.appendChild(titleSpan);

      const strikeCanvas = document.createElement('canvas');
      strikeCanvas.className = 'pencil-strike-canvas';
      strikeCanvas.width = 720;
      strikeCanvas.height = 120;

      row.appendChild(numSpan);
      row.appendChild(titleWrap);
      row.appendChild(strikeCanvas);

      listEl.appendChild(row);

      this.bindTaskRowPencilGesture(row, task, strikeCanvas, true);
    });

    if (this.els.stackAddItemRow) {
      this.els.stackAddItemRow.classList.toggle(
        'hidden',
        !isEditing || stackTasks.length >= 6
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
        ? 'Write or update your reflection for this day...'
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
    container.innerHTML = '';

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
          if (isTodayCard) {
            this.sensory.playCardFlipSwoosh();
            this.state.activePillar = 'card';
            this.state.isCardFlipped = false;
            this._todayFlipDeg = 0;
            this.saveState();
            this.renderAll();
          } else if (isFutureDate) {
            this.showTelemetryToast('Future date');
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
    const rowW = Math.max(280, rowRect.width || rowEl.clientWidth || 362);
    const rowH = Math.max(36, rowRect.height || rowEl.clientHeight || 48);

    const numSpan = rowEl.querySelector('.task-index');
    const titleSpan = rowEl.querySelector('.task-title');
    const tomatoBtn = rowEl.querySelector('.task-tomato-btn');

    // Safe right boundary so strikethrough lines NEVER touch the mini-tomato or card edge
    let maxSafeRightX = rowW - 30;
    if (tomatoBtn && tomatoBtn.getBoundingClientRect().width > 0) {
      const tomRect = tomatoBtn.getBoundingClientRect();
      maxSafeRightX = Math.min(maxSafeRightX, tomRect.left - rowRect.left - 16);
    }

    const indexLeftX =
      numSpan && numSpan.getBoundingClientRect().width > 0
        ? Math.max(18, numSpan.getBoundingClientRect().left - rowRect.left - 3)
        : 22;

    if (titleSpan) {
      const clientRects = Array.from(titleSpan.getClientRects()).filter(
        (r) => r.width > 2 && r.height > 4
      );
      if (clientRects.length > 0) {
        return clientRects.map((r, lineIdx) => {
          const lineStartX =
            lineIdx === 0
              ? indexLeftX
              : Math.max(58, r.left - rowRect.left - 3);
          const rawEndX = r.right - rowRect.left + 14;
          const lineEndX = Math.max(
            lineStartX + 36,
            Math.min(maxSafeRightX, rawEndX)
          );
          const lineCenterY = (r.top + r.bottom) * 0.5 - rowRect.top;
          return {
            minX: lineStartX,
            maxX: lineEndX,
            centerY: lineCenterY,
          };
        });
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
    let startX = null;
    let startY = null;
    let isTracking = false;
    let startedAtLeftEdgeBezel = false;

    rowEl.addEventListener('pointerdown', (e) => {
      if (isStackCard && !this.state.isStackEditMode) {
        return;
      }
      if (
        e.target.closest('.task-tomato-btn') ||
        e.target.closest('.task-inline-input') ||
        e.target.closest('.task-inline-delete-btn')
      ) {
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

      startedAtLeftEdgeBezel = relX < 24 || relX > maxTextRightX + 18;
      isTracking = true;
      try {
        rowEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    rowEl.addEventListener('pointermove', (e) => {
      if (!isTracking || startX === null) return;
      const pt = this.getPointerXY(e);
      const dx = pt.x - startX;
      const dy = pt.y - startY;

      const activeWrapper = isStackCard ? this.els.stackCard3D : this.els.card3DWrapper;
      const baseDeg = isStackCard ? this._stackFlipDeg : this._todayFlipDeg;

      if (startedAtLeftEdgeBezel || dx < -10) {
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
        if (!task.isCompleted) {
          this.drawGraphiteStroke(strikeCanvas, 0.0, progress);
        } else {
          this.drawGraphiteStroke(strikeCanvas, progress, 1.0);
        }
      }
    });

    const finishGesture = (e) => {
      if (!isTracking || startX === null) return;
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
        this.drawGraphiteStroke(strikeCanvas, 0.0, task.isCompleted ? 1.0 : 0.0);
        if (isStackCard) {
          if (this.state.isStackEditMode) {
            this.startInlineEditTask(rowEl, task, true);
          }
        } else {
          this.startInlineEditTask(rowEl, task, false);
        }
        return;
      }

      const gesture = CardGestureMath.classifyGesture(dx, dy, !startedAtLeftEdgeBezel);
      if (gesture === 'strikethrough') {
        task.isCompleted = !task.isCompleted;
        rowEl.dataset.completed = task.isCompleted ? 'true' : 'false';
        this.sensory.playPencilStrikethrough(!task.isCompleted);
        this.drawGraphiteStroke(strikeCanvas, 0.0, task.isCompleted ? 1.0 : 0.0);
        this.saveState();
      } else if (
        gesture === 'flipCard' ||
        ((startedAtLeftEdgeBezel || dx < -10) &&
          Math.abs(dx) >= 22 &&
          Math.abs(dx) > Math.abs(dy) * 1.15)
      ) {
        this.drawGraphiteStroke(strikeCanvas, 0.0, task.isCompleted ? 1.0 : 0.0);
        const dir = dx >= 0 ? 1 : -1;
        if (isStackCard) {
          this.triggerStackCardFlip(dir);
        } else {
          this.triggerCardFlip(dir);
        }
      } else {
        this.drawGraphiteStroke(strikeCanvas, 0.0, task.isCompleted ? 1.0 : 0.0);
      }
    };

    rowEl.addEventListener('pointerup', finishGesture);
    rowEl.addEventListener('pointercancel', finishGesture);
  }

  /**
   * Renders Screen 2: 6-Pomodoro 2x3 Grid View (Mockup 03-grid-timer.png)
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
        slot.customTitle || '',
        2,
        13
      );
      const isDropdownOpen = this.state.openDropdownQuadrant === qIdx;

      quadEl.innerHTML = '';

      const tomatoWrap = document.createElement('div');
      tomatoWrap.className = 'grid-tomato-wrap';

      if (isAssigned && isCompleted && !slot._justTransitionedSilver) {
        tomatoWrap.classList.add('is-silver-completed');
      } else if (isAssigned && !isCompleted && slot._justTransitionedFromSilver) {
        tomatoWrap.classList.add('is-silver-completed');
      }

      const img = document.createElement('img');
      img.className = 'grid-tomato-img grid-tomato-base-img';
      img.src = imgDataUrl;
      img.alt = isAssigned
        ? `${shortTitleText} Tomato Timer`
        : 'Unassigned Tomato Timer';
      tomatoWrap.appendChild(img);

      if (isAssigned) {
        const silverImg = document.createElement('img');
        silverImg.className = 'grid-tomato-img grid-tomato-silver-img';
        silverImg.src = silverImgDataUrl;
        silverImg.alt = '';
        silverImg.setAttribute('aria-hidden', 'true');
        tomatoWrap.appendChild(silverImg);
      }

      if (slot._justTransitionedSilver) {
        slot._justTransitionedSilver = false;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            tomatoWrap.classList.add('is-silver-completed');
          });
        });
      } else if (slot._justTransitionedFromSilver) {
        slot._justTransitionedFromSilver = false;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            tomatoWrap.classList.remove('is-silver-completed');
          });
        });
      }

      const overlay = document.createElement('div');
      overlay.className = 'grid-tomato-overlay';

      if (isAssigned) {
        tomatoWrap.title = 'Tap tomato body to open Hero Timer; tap title text to edit/reassign';

        const titleEl = document.createElement('div');
        titleEl.className = 'grid-tomato-title';
        titleEl.title = 'Tap title to edit or reassign task';
        titleEl.textContent = shortTitleText;
        titleEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.openDropdownQuadrant =
            this.state.openDropdownQuadrant === qIdx ? null : qIdx;
          this.renderGridScreen();
        });

        const timeEl = document.createElement('div');
        timeEl.className = 'grid-tomato-time';
        timeEl.classList.toggle('has-hours', slot.remainingSeconds > 3600);
        timeEl.textContent = readoutText;

        overlay.appendChild(titleEl);
        overlay.appendChild(timeEl);

        tomatoWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.openDropdownQuadrant = null;
          this.state.selectedQuadrant = qIdx;
          this.state.timerSubMode = 'hero';
          this.saveState();
          this.renderAll();
        });
      } else {
        tomatoWrap.title = 'Tap to assign a task to this tomato';
        if (!isDropdownOpen) {
          const tapLabel = document.createElement('div');
          tapLabel.className = 'grid-tap-to-assign';
          tapLabel.textContent = 'Tap to assign';
          overlay.appendChild(tapLabel);
        }

        tomatoWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.openDropdownQuadrant =
            this.state.openDropdownQuadrant === qIdx ? null : qIdx;
          this.renderGridScreen();
        });
      }

      tomatoWrap.appendChild(overlay);

      if (isDropdownOpen) {
        const dropdown = this.buildTaskDropdownDOM(qIdx);
        tomatoWrap.appendChild(dropdown);
      }

      quadEl.appendChild(tomatoWrap);

      const controlsRow = document.createElement('div');
      controlsRow.className = 'grid-controls-row';

      if (isAssigned) {
        const playPauseBtn = document.createElement('button');
        playPauseBtn.type = 'button';
        playPauseBtn.className = 'grid-ctrl-btn';
        playPauseBtn.setAttribute(
          'aria-label',
          slot.runState === 'running' ? 'Pause Timer' : 'Start Timer'
        );
        playPauseBtn.innerHTML =
          slot.runState === 'running'
            ? `<svg width="20" height="24" viewBox="0 0 24 28"><rect x="3" y="2" width="6.5" height="24" rx="1.5" fill="#0F0F0F"/><rect x="14.5" y="2" width="6.5" height="24" rx="1.5" fill="#0F0F0F"/></svg>`
            : `<svg width="20" height="24" viewBox="0 0 24 28"><path d="M4 2.5 L22 14 L4 25.5 Z" fill="#0F0F0F" stroke="#0F0F0F" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
        playPauseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePlayPause(qIdx);
        });

        const stopBtn = document.createElement('button');
        stopBtn.type = 'button';
        stopBtn.className = 'grid-ctrl-btn';
        stopBtn.setAttribute(
          'aria-label',
          isCompleted ? 'Reset Timer to 00:00' : 'End Timer (Turn Silver Metallic)'
        );
        stopBtn.title = isCompleted
          ? 'Reset Tomato Timer to 00:00'
          : 'End Timer (Turns tomato Silver Metallic without clearing)';
        stopBtn.innerHTML = isCompleted
          ? `<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M4.8 9.8C6.2 6.1 9.8 3.6 13.8 3.6C18.9 3.6 22.4 7.8 22.4 12.6C22.4 17.6 18.4 21.4 13.5 21.4C9.5 21.4 6.1 18.9 4.9 15.3" stroke="#0F0F0F" stroke-width="2.3" stroke-linecap="round"/><path d="M3.5 4.5V10.3H9.3" stroke="#0F0F0F" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<svg width="20" height="20" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2.5" fill="#0F0F0F"/></svg>`;
        stopBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleEndOrResetButton(qIdx);
        });

        controlsRow.appendChild(playPauseBtn);
        if (this.isTimerSlotSet(slot)) {
          controlsRow.appendChild(stopBtn);
        }
      }

      quadEl.appendChild(controlsRow);
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
    const headerLabel = hasExistingTitle ? '✎ Edit Title...' : '+ Custom Title...';
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
      itemBtn.textContent = t.title;
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
      unassignBtn.textContent = '✕ Unassign Tomato';
      unassignBtn.addEventListener('click', () => {
        this.clearQuadrantAssignment(quadrant);
      });
      listBody.appendChild(unassignBtn);
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

    this.els.heroReadout.textContent = OdometerDialPhysics.formatMockupReadout(
      slot.remainingSeconds
    );
    this.els.heroReadout.classList.toggle('has-hours', slot.remainingSeconds > 3600);

    if (slot.assignedTaskId || slot.customTitle) {
      const orderStr = String(slot.assignedTaskOrder || slot.quadrant + 1).padStart(
        2,
        '0'
      );
      const shortTitle = OdometerDialPhysics.formatShortTomatoTitle(
        slot.customTitle || 'EXAMPLE TASK',
        4,
        22
      );
      this.els.heroSubtitle.textContent = `${orderStr} / ${shortTitle}`;
    } else {
      const orderStr = String(slot.quadrant + 1).padStart(2, '0');
      this.els.heroSubtitle.textContent = `${orderStr} / TAP TO ASSIGN`;
    }

    if (this.els.heroSubtitleDropdownMount) {
      this.els.heroSubtitleDropdownMount.innerHTML = '';
      if (this.state.isHeroDropdownOpen) {
        this.els.heroSubtitleDropdownMount.appendChild(
          this.buildTaskDropdownDOM(slot.quadrant)
        );
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

    this.els.heroBtnPlayPause.innerHTML =
      slot.runState === 'running'
        ? `<svg width="36" height="44" viewBox="0 0 36 44"><rect x="4" y="2" width="10" height="40" rx="3" fill="#0F0F0F"/><rect x="22" y="2" width="10" height="40" rx="3" fill="#0F0F0F"/></svg>`
        : `<svg width="36" height="44" viewBox="0 0 36 44"><path d="M6 3 L33 22 L6 41 Z" fill="#0F0F0F" stroke="#0F0F0F" stroke-width="2" stroke-linejoin="round"/></svg>`;

    if (this.els.heroBtnStop) {
      const isSet = this.isTimerSlotSet(slot);
      this.els.heroBtnStop.classList.toggle('hidden', !isSet);
      this.els.heroBtnStop.setAttribute(
        'aria-label',
        isCompleted ? 'Reset Timer to 00:00' : 'End Timer (Turn Silver Metallic)'
      );
      this.els.heroBtnStop.title = isCompleted
        ? 'Reset Tomato Timer to 00:00'
        : 'End Timer (Turns tomato Silver Metallic without clearing)';
      this.els.heroBtnStop.innerHTML = isCompleted
        ? `<svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M7.5 14.5C9.5 9.2 14.6 5.5 20.5 5.5C28.2 5.5 33.5 11.8 33.5 18.8C33.5 26.2 27.6 31.8 20.2 31.8C14.2 31.8 9.2 28.1 7.4 22.8" stroke="#0F0F0F" stroke-width="3.0" stroke-linecap="round"/><path d="M5.5 6.8V15.2H13.9" stroke="#0F0F0F" stroke-width="3.0" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : `<svg width="36" height="36" viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="4.5" fill="#0F0F0F"/></svg>`;
    }

    this.els.heroBtnStopwatch.classList.toggle(
      'stopwatch-active',
      slot.mode === 'stopwatch'
    );
  }

  // =========================================================================
  // INLINE CARD TASK TYPING & EDITING (NO POPUP BOX ON CARD)
  // =========================================================================

  startInlineAddTask(isStackCard = false) {
    const card = isStackCard ? this.getSelectedStackCard() : null;
    if (isStackCard && !card) return;
    if (isStackCard && !Array.isArray(card.tasks)) card.tasks = [];

    const tasksArr = isStackCard ? card.tasks : this.state.tasks;
    if (tasksArr.length >= 6) {
      this.showNotificationBanner('Maximum 6 tasks per card reached.');
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
    input.maxLength = MAX_TASK_CHARS;
    input.placeholder = 'Type item...';
    input.setAttribute('aria-label', 'Type task directly on card');

    const syncHeight = () => {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight}px`;
    };

    titleWrap.appendChild(input);
    row.appendChild(numSpan);
    row.appendChild(titleWrap);
    container.appendChild(row);

    if (addItemEl) {
      addItemEl.classList.add('hidden');
    }

    this.fitUnifiedCardTaskTypography(container, addItemEl);
    syncHeight();
    setTimeout(() => {
      syncHeight();
      input.focus();
    }, 10);

    let finished = false;
    const commitOrCancel = (shouldSave) => {
      if (finished) return;
      finished = true;
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

    input.addEventListener('input', () => {
      const clamped = this.clampTaskInputText(input.value.replace(/\r?\n/g, ' '));
      if (input.value !== clamped) {
        input.value = clamped;
        this.showTelemetryToast('Task length limit reached');
      }
      syncHeight();
      this.fitUnifiedCardTaskTypography(container, addItemEl);
      syncHeight();
    });

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commitOrCancel(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        commitOrCancel(false);
      }
    });

    input.addEventListener('blur', () => {
      commitOrCancel(true);
    });
  }

  startInlineEditTask(rowEl, task, isStackCard = false) {
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
    input.maxLength = MAX_TASK_CHARS;
    input.value = task.title || '';
    input.setAttribute('aria-label', 'Edit task directly on card');

    const syncEditHeight = () => {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight}px`;
    };

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'task-inline-delete-btn';
    delBtn.title = 'Delete item';
    delBtn.setAttribute('aria-label', 'Delete item');
    delBtn.textContent = '×';

    titleWrap.appendChild(input);
    titleWrap.appendChild(delBtn);

    this.fitUnifiedCardTaskTypography(container, addItemEl);
    syncEditHeight();
    setTimeout(() => {
      syncEditHeight();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 10);

    let finished = false;
    const deleteThisTask = () => {
      if (finished) return;
      finished = true;
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

    delBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    delBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteThisTask();
    });

    input.addEventListener('input', () => {
      const clamped = this.clampTaskInputText(input.value.replace(/\r?\n/g, ' '));
      if (input.value !== clamped) {
        input.value = clamped;
        this.showTelemetryToast('Task length limit reached');
      }
      syncEditHeight();
      this.fitUnifiedCardTaskTypography(container, addItemEl);
      syncEditHeight();
    });

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commitOrCancel(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        commitOrCancel(false);
      }
    });

    input.addEventListener('blur', () => {
      commitOrCancel(true);
    });
  }

  openAddTaskModal() {
    if (this.state.tasks.length >= 6) {
      this.showNotificationBanner('Maximum 6 tasks per Daily Card reached.');
      return;
    }
    this.openInputModal(
      'Add Task',
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
    if (card.tasks.length >= 6) {
      this.showNotificationBanner('Maximum 6 tasks per Daily Card reached.');
      return;
    }
    this.openInputModal(
      `Add Task to ${card.shortDate}`,
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
      `Edit ${card.shortDate} Task ${String(task.orderIndex).padStart(2, '0')}`,
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
          this.showNotificationBanner('Task removed from archived card');
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
        this.showNotificationBanner('Task removed from archived card');
      },
      true
    );
  }

  openEditTaskModal(task) {
    this.openInputModal(
      `Edit Task ${String(task.orderIndex).padStart(2, '0')}`,
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
      this.els.deleteModalTitle.textContent = 'Permanently delete this item?';
    }
    if (this.els.deleteModalDesc) {
      this.els.deleteModalDesc.textContent =
        'This action cannot be undone. The item will be permanently removed from Today’s Card.';
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
      this.showNotificationBanner('Task deleted');
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
      isEditingExisting ? 'Edit Timer Title' : 'Assign Custom Timer Title',
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
    this.els.modalInput.maxLength = enforceTaskCap ? MAX_TASK_CHARS : 48;
    if (this.els.modalDelete) {
      this.els.modalDelete.classList.toggle('hidden', !onDelete);
    }
    this.els.modalOverlay.classList.remove('hidden');
    setTimeout(() => this.els.modalInput.focus(), 30);

    const onInput = () => {
      if (!enforceTaskCap) return;
      const clamped = this.clampTaskInputText(this.els.modalInput.value);
      if (this.els.modalInput.value !== clamped) {
        this.els.modalInput.value = clamped;
        this.showTelemetryToast('Task length limit reached');
      }
      const len = this.els.modalInput.value.length;
      this.els.modalInput.style.fontSize = len > 26 ? '14.5px' : len > 18 ? '15.5px' : '16.5px';
    };
    onInput();

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
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') close();
    };
    const cleanup = () => {
      this.els.modalCancel.removeEventListener('click', close);
      this.els.modalConfirm.removeEventListener('click', confirm);
      if (this.els.modalDelete) {
        this.els.modalDelete.removeEventListener('click', handleDelete);
      }
      this.els.modalInput.removeEventListener('keydown', onKey);
      this.els.modalInput.removeEventListener('input', onInput);
    };

    this.els.modalCancel.addEventListener('click', close);
    this.els.modalConfirm.addEventListener('click', confirm);
    if (this.els.modalDelete && onDelete) {
      this.els.modalDelete.addEventListener('click', handleDelete);
    }
    this.els.modalInput.addEventListener('keydown', onKey);
    this.els.modalInput.addEventListener('input', onInput);
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
        desc: 'Add up to 6 tasks, swipe text to cross out',
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

          const period = 2100;
          const t = (elapsedMs % period) / period;
          const startX = box.left + 4;
          const endX = box.left + Math.max(76, box.width + 8);
          const centerY = box.y;

          let dotX = startX;
          let opacity = 0;
          let scale = 1;
          let strokeProg = 0;

          if (t < 0.15) {
            const p = t / 0.15;
            opacity = p;
            scale = 1.06 - 0.12 * p;
            dotX = startX;
            strokeProg = 0;
          } else if (t < 0.72) {
            const p = this.easeInOutCubic((t - 0.15) / 0.57);
            opacity = 1;
            scale = 0.94;
            dotX = startX + p * (endX - startX);
            strokeProg = p;
          } else if (t < 0.90) {
            const p = (t - 0.72) / 0.18;
            opacity = 1 - p * 0.92;
            scale = 0.94 + 0.08 * p;
            dotX = endX;
            strokeProg = 1.0;
          } else {
            opacity = 0.06;
            dotX = startX;
            strokeProg = 0;
          }

          if (canvas) {
            this.drawGraphiteStroke(canvas, 0.0, strokeProg);
          }
          this.setTourDotState(this.els.tourPageDot, dotX, centerY, opacity, scale, false);
          this.setTourDotState(this.els.tourPageDot2, null, null, 0);
        },
      },
      // STEP 3: BACK OF CARD (DAILY REFLECTION)
      {
        title: 'Flip Page · Daily Reflection',
        desc: 'Swipe card to write reflection & attach photos',
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
          const swipeY = box.y - 16;

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
        desc: 'Twist tomato equator or tap digits to set time',
        applyPage: () => {
          this.restoreTourDemoArchiveCards();
          this.state.activePillar = 'timer';
          this.state.timerSubMode = 'hero';
          this.state.isHeroDropdownOpen = false;
        },
        animateFrame: (elapsedMs) => {
          if (this.els.heroSubtitle) {
            this.els.heroSubtitle.textContent = '01 / EXAMPLE TASK';
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
        desc: 'Swipe left or right to scroll through past cards',
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
          const centerY = stageBox.y - 8;

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
    ];
  }

  stopTourDemoLoop() {
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
      this.els.tourStepTitle.textContent = step.title;
    }
    if (this.els.tourStepDesc) {
      this.els.tourStepDesc.textContent = step.desc;
    }
    if (this.els.tourPrevBtn) {
      this.els.tourPrevBtn.disabled = clampedIdx === 0;
    }
    if (this.els.tourNextBtn) {
      this.els.tourNextBtn.textContent =
        clampedIdx === steps.length - 1 ? 'Done' : 'Next';
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
      this.state.activePillar = 'home';
      this.renderAll();
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
    blocks.forEach((b) => b.classList.remove('visible'));
    this.els.aboutModalOverlay.classList.remove('hidden');
    this.fitAboutCardTypography();

    // Unhurried, calm reading cadence (~1.55s between blocks with a 1.15s soft fade-in)
    const delaysMs = [250, 1550, 3100, 4650, 6200, 7750, 9300];
    blocks.forEach((blockEl, idx) => {
      const waitMs = delaysMs[idx] !== undefined ? delaysMs[idx] : 250 + idx * 1550;
      const timerId = setTimeout(() => {
        blockEl.classList.add('visible');
      }, waitMs);
      this._aboutTimers.push(timerId);
    });
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
