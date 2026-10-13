/**
 * SensoryEngine — Synchronized Haptics + Web Audio API Foley Engine for Fable / Flow Phase 1 Beta.
 *
 * Synthesizes authentic organic physical sounds with zero external network dependencies:
 * - playDialRatchetNotch(isWindingUp): Crisp mechanical gear detent click (higher pitch winding up, slightly lower unwinding).
 * - playMechanicalTick(): Subtle muted clockwork escapement tick.
 * - playCompletionChime(): One mechanical kitchen-timer bell ring (e.g. when you end a timer yourself).
 * - playCompletionAlarm(): The bell rings several times when a Pomodoro reaches 00:00 (tap to stop).
 * - playPencilStrikethrough(isErasing): Textured graphite-on-cotton-cardstock scratch sound.
 * - playCardFlipSwoosh(): Soft 300gsm cardstock air turn + tabletop snap.
 *
 * Strictly suppresses all audio when `isSilentMode === true` while preserving haptic pulses.
 */

export class SensoryEngine {
  constructor() {
    this.isSilentMode = false;
    this.audioCtx = null;
    this._iosUnlocked = false;
    this._hapticLabel = null;
    this.onHapticPulse = null; // Optional callback for UI haptic indicator pill
    this._installIOSAudioUnlock();
  }

  _syncIOSAudioSession() {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      try {
        // Always use 'ambient' (AVAudioSessionCategoryAmbient + mixWithOthers)
        // so sound effects layer on top of Spotify / Apple Music without ever pausing the user's music.
        if (navigator.audioSession.type !== 'ambient') {
          navigator.audioSession.type = 'ambient';
        }
      } catch (_) {}
    }
  }

  _installIOSAudioUnlock() {
    if (typeof window === 'undefined') return;
    this._syncIOSAudioSession();
    const unlock = () => {
      this._syncIOSAudioSession();
      this._ensureIOSHapticSwitch();
      if (this.isSilentMode) return;
      if (this._iosUnlocked && this.audioCtx && this.audioCtx.state === 'running') {
        return;
      }
      // iOS can leave a Home Screen app's audio stuck ("interrupted") after it was in the
      // background, even after resume(). If the last resume didn't take, start a fresh context
      // here, inside the tap, where iOS allows it.
      if (this._needsFreshContext && this.audioCtx) {
        this._needsFreshContext = false;
        try {
          this.audioCtx.close();
        } catch (_) {}
        this.audioCtx = null;
        this._iosUnlocked = false;
      }
      const ctx = this._ensureContext();
      if (!ctx) return;
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
        this._syncIOSAudioSession();
        ctx.resume().catch(() => {});
        setTimeout(() => {
          if (this.audioCtx === ctx && ctx.state !== 'running') this._needsFreshContext = true;
        }, 400);
      }
      if (!this._iosUnlocked) {
        try {
          const silentBuf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = silentBuf;
          src.connect(ctx.destination);
          src.start(0);
          if (ctx.state === 'running') {
            this._iosUnlocked = true;
          }
        } catch (_) {}
      }
    };
    ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, unlock, { capture: true, passive: true });
    });
  }

  _ensureIOSHapticSwitch() {
    if (this._hapticLabel || typeof document === 'undefined' || !document.body) return;
    try {
      const wrap = document.createElement('div');
      wrap.setAttribute('aria-hidden', 'true');
      wrap.style.cssText =
        'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1;';
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      wrap.appendChild(label);
      document.body.appendChild(wrap);
      this._hapticLabel = label;
    } catch (_) {}
  }

  _ensureContext() {
    if (this.isSilentMode) return null;
    this._syncIOSAudioSession();
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (
      this.audioCtx &&
      (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted')
    ) {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  _triggerHaptic(label, durationMs = 12) {
    let vibrated = false;
    const nativeBridge =
      typeof window !== 'undefined'
        ? (window.webkit &&
            window.webkit.messageHandlers &&
            window.webkit.messageHandlers.untoNative) ||
          window.__untoNativeBridge ||
          null
        : null;
    if (nativeBridge && typeof nativeBridge.postMessage === 'function') {
      try {
        const style =
          durationMs >= 20 ? 'complete' : durationMs >= 14 ? 'heavy' : durationMs >= 9 ? 'notch' : 'tick';
        nativeBridge.postMessage({ action: 'haptic', style });
        vibrated = true;
      } catch (_) {}
    }
    if (!vibrated && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        vibrated = Boolean(navigator.vibrate(durationMs));
      } catch (_) {}
    }
    if (!vibrated) {
      this._ensureIOSHapticSwitch();
      if (this._hapticLabel) {
        try {
          this._hapticLabel.click();
        } catch (_) {}
      }
    }
    if (typeof this.onHapticPulse === 'function') {
      this.onHapticPulse(label);
    }
  }

  /**
   * 1-minute (6°) mechanical ratchet notch click + crisp transient haptic.
   */
  playDialRatchetNotch(isWindingUp = true) {
    this._triggerHaptic(
      isWindingUp ? 'Haptic: Ratchet Wind (+1m)' : 'Haptic: Ratchet Unwind (-1m)',
      10
    );
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const baseFreq = isWindingUp ? 980 : 780;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.022);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.026);
  }

  /**
   * Subtle clockwork escapement tick while a timer is actively running.
   */
  playMechanicalTick() {
    this._triggerHaptic('Haptic: Escapement Tick', 6);
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.008);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.009);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.01);
  }

  /**
   * Authentic physical mechanical Pomodoro kitchen timer ending bell ("k-DING!").
   * Models the physical escapement release clapper + steel hammer strike + inharmonic
   * hemispherical brass/chrome bell modes (Rayleigh/Chladni modal ratios with natural
   * doublet acoustic beating and frequency-dependent metallic decay).
   * One ring, e.g. when you end a timer yourself.
   */
  playCompletionChime() {
    this._triggerHaptic('Haptic: Pomodoro Bell Ring', [18, 35, 45]);
    this._whenAudioRunning((ctx) => this._scheduleBellRing(ctx, ctx.currentTime + 0.01, ctx.destination));
  }

  /**
   * Runs `fn(ctx)` once the audio clock is actually running. iOS pauses web audio while the app
   * is in the background and may need a moment (or a tap) after it comes back; a sound queued on
   * a paused clock would otherwise burst out late, on some later tap. So: play now if running,
   * else try to resume and play only if that works within ~1.5 s; otherwise skip it.
   */
  _whenAudioRunning(fn) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    if (ctx.state === 'running') {
      fn(ctx);
      return;
    }
    const deadline = performance.now() + 1500;
    let done = false;
    const tryPlay = () => {
      if (done || this.audioCtx !== ctx) return;
      if (ctx.state === 'running') {
        done = true;
        fn(ctx);
      } else if (performance.now() < deadline) {
        ctx.resume().catch(() => {});
        setTimeout(tryPlay, 100);
      }
    };
    ctx.resume().then(tryPlay, () => {});
    setTimeout(tryPlay, 100);
  }

  /**
   * A timer reached 00:00: ring the bell several times (default 3 rings, ~1.8 s apart).
   * Every ring is queued on the audio clock up front, so the later rings still play when a
   * background tab's JS timers are throttled. Any tap stops it (stopCompletionAlarm).
   */
  playCompletionAlarm(rings = 3, gapSec = 1.8) {
    this.stopCompletionAlarm();
    const hapticTimers = [];
    for (let k = 0; k < rings; k++) {
      hapticTimers.push(
        setTimeout(() => this._triggerHaptic('Haptic: Pomodoro Bell Ring', [18, 35, 45]), k * gapSec * 1000)
      );
    }
    const alarm = {
      hapticTimers,
      gain: null,
      endsAt: performance.now() + ((rings - 1) * gapSec + 2.4) * 1000,
    };
    this._alarm = alarm;
    this._whenAudioRunning((ctx) => {
      if (this._alarm !== alarm) return; // silenced before the audio came up
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.connect(ctx.destination);
      const t0 = ctx.currentTime + 0.02;
      for (let k = 0; k < rings; k++) {
        this._scheduleBellRing(ctx, t0 + k * gapSec, gain);
      }
      alarm.gain = gain;
    });
  }

  isAlarmRinging() {
    return Boolean(this._alarm) && performance.now() < this._alarm.endsAt;
  }

  /** Silences a ringing alarm with a short fade (no click). */
  stopCompletionAlarm() {
    const alarm = this._alarm;
    if (!alarm) return;
    this._alarm = null;
    alarm.hapticTimers.forEach((t) => clearTimeout(t));
    if (alarm.gain && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        alarm.gain.gain.cancelScheduledValues(now);
        alarm.gain.gain.setValueAtTime(alarm.gain.gain.value, now);
        alarm.gain.gain.linearRampToValueAtTime(0, now + 0.12);
      } catch (_) {}
      setTimeout(() => {
        try {
          alarm.gain.disconnect();
        } catch (_) {}
      }, 400);
    }
  }

  /** One "k-DING" (escapement grace tap + full bell strike) at audio time `when` into `dest`. */
  _scheduleBellRing(ctx, when, dest) {
    const triggerBellStrike = (strikeTime, velocity) => {
      // 1. Physical metallic hammer-on-brass impact impulse (short filtered burst)
      const clickDur = 0.018;
      const bufLen = Math.max(1, Math.floor(ctx.sampleRate * clickDur));
      const clickBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const ch = clickBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        const env = Math.exp(-i / (bufLen * 0.22));
        ch[i] = (Math.random() * 2 - 1) * env;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = clickBuf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3850, strikeTime);
      bp.Q.setValueAtTime(3.2, strikeTime);

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.38 * velocity, strikeTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, strikeTime + clickDur);

      noise.connect(bp);
      bp.connect(clickGain);
      clickGain.connect(dest);
      noise.start(strikeTime);

      // 2. Inharmonic spun-brass Pomodoro bell modal partials (fundamental D6 ~ 1174.6 Hz)
      //    Includes closely spaced doublet modes (1174.6/1177.1 Hz and 2349.2/2355.0 Hz)
      //    that produce the unmistakable acoustic "shimmer/wah-wah" of a real metal bell!
      const partials = [
        { freq: 587.3, amp: 0.11, decay: 2.35 },   // Sub-hum resonance
        { freq: 1174.6, amp: 0.34, decay: 2.15 },  // Primary strike tone (Mode A)
        { freq: 1177.1, amp: 0.24, decay: 2.05 },  // Primary strike doublet (2.5 Hz acoustic beat)
        { freq: 1421.3, amp: 0.15, decay: 1.05 },  // Minor-third tierce bell mode (1.21x)
        { freq: 1773.8, amp: 0.12, decay: 0.72 },  // Quint mode (1.51x)
        { freq: 2349.2, amp: 0.22, decay: 0.88 },  // Nominal upper ring (2.00x Mode A)
        { freq: 2355.0, amp: 0.14, decay: 0.82 },  // Nominal upper ring (2.005x Mode B)
        { freq: 3242.0, amp: 0.13, decay: 0.34 },  // Super-quint metallic clang (2.76x)
        { freq: 4534.0, amp: 0.09, decay: 0.14 },  // Initial hammer-ping overtone (3.86x)
        { freq: 5920.0, amp: 0.05, decay: 0.065 }, // Crisp metallic transient edge (5.04x)
      ];

      partials.forEach((p) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.freq, strikeTime);

        const peak = Math.max(0.002, p.amp * velocity);
        gain.gain.setValueAtTime(0.0005, strikeTime);
        gain.gain.linearRampToValueAtTime(peak, strikeTime + 0.0025);
        gain.gain.exponentialRampToValueAtTime(0.0004, strikeTime + p.decay);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(strikeTime);
        osc.stop(strikeTime + p.decay + 0.02);
      });
    };

    // Mechanical Pomodoro bell double-clapper action:
    // Quick escapement release grace tap ("k-") followed 52ms later by the full bell ring ("-DING!")
    triggerBellStrike(when, 0.32);
    triggerBellStrike(when + 0.052, 1.0);
  }

  /**
   * Textured graphite pencil strikethrough (or erase) across 300gsm cotton cardstock.
   */
  playPencilStrikethrough(isErasing = false) {
    this._triggerHaptic(
      isErasing ? 'Haptic: Erase Strikethrough' : 'Haptic: Graphite Strikethrough',
      18
    );
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.19;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      const grain = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i * 0.08));
      data[i] = grain * env * 0.25;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isErasing ? 950 : 1650, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Card flip / drag handler (kept silent per user preference — no whoop/swoosh audio).
   */
  playCardFlipSwoosh() {
    // Intentionally silent: user requested removing the whoop sound when flipping or dragging cards.
  }

  /**
   * Card stack scroll/drag handler (kept silent per user preference — no whoop/swoosh audio when dragging cards).
   */
  playStackRiffleTick() {
    // Intentionally silent when dragging or scrolling cards.
  }

  /**
   * Soft paper crumple / discard audio + double-tap haptic when permanently deleting via Trash Can.
   */
  playTrashDelete() {
    this._triggerHaptic('Haptic: Permanent Card Discard', [14, 24, 18]);
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.16;
    const bufLen = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const env = Math.sin((i / bufLen) * Math.PI) * Math.exp(-i / (bufLen * 0.6));
      ch[i] = (Math.random() * 2 - 1) * env * 0.22;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(820, now);
    bp.frequency.exponentialRampToValueAtTime(360, now + duration);
    bp.Q.setValueAtTime(1.4, now);

    noise.connect(bp);
    bp.connect(ctx.destination);
    noise.start(now);
  }
}
