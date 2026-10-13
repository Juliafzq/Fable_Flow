/**
 * OdometerDialPhysics — Pure math & state machine for the 3-Turn Bidirectional
 * Heirloom Tomato Odometer Dial (0..180 minutes, 5-minute / 30° ratchet notches).
 *
 * Rules from PRD v4 & User Feedback:
 * - Dragging Right -> Left (negative deltaX) winds the timer UP (+5 min per 30° notch, max 180 min).
 * - Dragging Left -> Right (positive deltaX) unwinds the timer DOWN (-5 min per 30° notch, min 0 min).
 * - In Stopwatch Mode, the tomato turns ON THE MINUTES, NOT SECONDS (steps +6° every full 60s minute).
 * - On the tomato body, only show the first few words so the text never overflows.
 */

export class OdometerDialPhysics {
  static DEGREES_PER_MINUTE = 6.0;
  static MINUTES_PER_NOTCH = 1;
  static DEGREES_PER_NOTCH = 6.0;
  static MAX_TURNS = 3;
  static MAX_MINUTES = 180;
  static MAX_ANGLE_DEGREES = 1080.0;
  static PIXELS_PER_DEGREE = 1.6; // ~9.6px horizontal drag = 6° (1 minute)

  /**
   * Convert horizontal drag delta (pixels) from a starting angle into a new clamped angle & notch info.
   * Right -> Left drag (deltaX < 0) increases angle/minutes.
   * Left -> Right drag (deltaX > 0) decreases angle/minutes.
   */
  static computeDragUpdate(startAngleDegrees, translationX, lastNotchIndex) {
    const deltaDegrees = -translationX / OdometerDialPhysics.PIXELS_PER_DEGREE;
    const rawAngle = Math.min(
      Math.max(startAngleDegrees + deltaDegrees, 0.0),
      OdometerDialPhysics.MAX_ANGLE_DEGREES
    );
    const currentNotchIndex = Math.round(rawAngle / OdometerDialPhysics.DEGREES_PER_NOTCH);
    const crossedNotch = currentNotchIndex !== lastNotchIndex;
    const snappedMinutes = Math.min(
      Math.max(currentNotchIndex * OdometerDialPhysics.MINUTES_PER_NOTCH, 0),
      OdometerDialPhysics.MAX_MINUTES
    );
    const turnIndex = OdometerDialPhysics.turnIndex(rawAngle);

    return {
      rawAngleDegrees: rawAngle,
      snappedAngleDegrees: currentNotchIndex * OdometerDialPhysics.DEGREES_PER_NOTCH,
      notchIndex: currentNotchIndex,
      crossedNotch,
      snappedMinutes,
      turnIndex,
    };
  }

  /**
   * Snap any continuous angle (0..1080°) to the nearest 30° (5-minute) notch.
   */
  static snapAngleToNotch(angleDegrees) {
    const clamped = Math.min(
      Math.max(angleDegrees, 0.0),
      OdometerDialPhysics.MAX_ANGLE_DEGREES
    );
    const notch = Math.round(clamped / OdometerDialPhysics.DEGREES_PER_NOTCH);
    const snappedAngle = notch * OdometerDialPhysics.DEGREES_PER_NOTCH;
    const minutes = notch * OdometerDialPhysics.MINUTES_PER_NOTCH;
    return { snappedAngle, minutes, notch };
  }

  /**
   * Determine active turn index (0 for Turn 1 [0..60m], 1 for Turn 2 [60..120m], 2 for Turn 3 [120..180m]).
   */
  static turnIndex(angleDegrees) {
    if (angleDegrees <= 360.0) return 0;
    if (angleDegrees <= 720.0) return 1;
    return 2;
  }

  /**
   * Convert remaining countdown seconds to total angle in degrees (0..1080°).
   */
  static secondsToAngleDegrees(seconds) {
    const clampedSeconds = Math.min(
      Math.max(seconds, 0),
      OdometerDialPhysics.MAX_MINUTES * 60
    );
    return (clampedSeconds / 60.0) * OdometerDialPhysics.DEGREES_PER_MINUTE;
  }

  /**
   * In Stopwatch Mode, the tomato turns ON THE MINUTES, NOT SECONDS:
   * Only advances by 6° (1 minute mark) for each completed 60-second minute.
   */
  static stopwatchSecondsToMinuteAngleDegrees(elapsedSeconds) {
    const wholeMinutes = Math.floor(Math.max(0, elapsedSeconds) / 60);
    return (wholeMinutes * OdometerDialPhysics.DEGREES_PER_MINUTE) % OdometerDialPhysics.MAX_ANGLE_DEGREES;
  }

  /**
   * Truncates a task title to the first few words so text never overflows on a tomato body.
   */
  static formatShortTomatoTitle(rawTitle, maxWords = 2, maxChars = 13) {
    const cleaned = String(rawTitle || '')
      .replace(/\u2006/g, '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!cleaned) return '';
    const hasCJK =
      /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/.test(
        cleaned
      );
    if (hasCJK) {
      const cjkLimit = maxChars <= 13 ? 7 : 12;
      if (cleaned.length > cjkLimit) {
        return cleaned.slice(0, cjkLimit - 1).trimEnd() + '…';
      }
      return cleaned;
    }
    const words = cleaned.split(' ');
    let candidate = words.slice(0, maxWords).join(' ');
    const hadMoreWords = words.length > maxWords;

    if (candidate.length > maxChars) {
      candidate = candidate.slice(0, maxChars - 1).trimEnd() + '…';
    } else if (hadMoreWords) {
      if (candidate.length + 1 <= maxChars + 1) {
        candidate += '…';
      }
    }
    // Keep the exact upper/lower case the person typed (no forced ALL CAPS)
    return candidate;
  }

  /**
   * Formats timer readout:
   * - Longer than 60 minutes (totalSeconds > 3600): HH:MM:SS (e.g., "02:30:00" for 150 min, "01:15:00" for 75 min).
   * - 60 minutes or less (totalSeconds <= 3600): MM:SS (e.g., "25:00" -> "24:59", "45:00", "00:00").
   */
  static formatMockupReadout(totalSeconds) {
    const clamped = Math.max(0, Math.floor(totalSeconds));

    if (clamped > 3600) {
      const hours = Math.floor(clamped / 3600);
      const mins = Math.floor((clamped % 3600) / 60);
      const secs = clamped % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    const totalMinutes = Math.floor(clamped / 60);
    const remSeconds = clamped % 60;
    return `${String(totalMinutes).padStart(2, '0')}:${String(remSeconds).padStart(2, '0')}`;
  }

  /**
   * Compute the visible 10-minute odometer labels around the current minute value
   * (e.g., at 150 minutes -> [130, 140, 150, 160, 170] as shown in 02-hero-timer.png).
   */
  static getVisibleEquatorialLabels(currentMinutes) {
    const centerTen = Math.round(currentMinutes / 10) * 10;
    const offsets = [-20, -10, 0, 10, 20];
    return offsets.map((offset) => {
      const val = centerTen + offset;
      return Math.max(0, Math.min(180, val));
    });
  }

  /**
   * Parses a user-typed time string (when tapping on the digital readout) into minutes [0..180].
   * Supports:
   * - Plain minutes: "25" -> 25, "90" -> 90, "150" -> 150, "180" -> 180
   * - HH:MM readout format: "02:30" or "2:30" -> 150, "01:15" -> 75, "00:45" -> 45
   * - MM:SS format: "25:00" -> 25, "90:00" -> 90
   * - Shorthand units: "2h", "2.5h", "1h30m", "120m"
   * Returns null if input is empty or contains no valid digits.
   */
  static parseTypedTimeInput(rawInput) {
    if (rawInput === null || rawInput === undefined) return null;
    const cleaned = String(rawInput)
      .replace(/\u2006/g, '')
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/：/g, ':')
      .trim()
      .toLowerCase();
    if (!cleaned) return null;

    // 1. Check for "Xh Ym" or "Xh" or "Ym" unit format
    const hmMatch = cleaned.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|r|rs?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?$/);
    if (hmMatch && (hmMatch[1] !== undefined || hmMatch[2] !== undefined)) {
      const hours = hmMatch[1] ? parseFloat(hmMatch[1]) : 0;
      const mins = hmMatch[2] ? parseFloat(hmMatch[2]) : 0;
      const totalMins = Math.round(hours * 60 + mins);
      return Math.max(0, Math.min(OdometerDialPhysics.MAX_MINUTES, totalMins));
    }

    // 2. Check for colon-separated format "A:B" or "A:B:C"
    if (cleaned.includes(':')) {
      const parts = cleaned.split(':').map((p) => p.trim());
      if (parts.some((p) => p === '' || isNaN(Number(p)))) return null;
      const nums = parts.map((p) => Number(p));

      if (nums.length === 2) {
        const [a, b] = nums;
        if (a < 0 || b < 0) return null;
        // If user typed "25:00" or "120:00" (MM:00 where A >= 4 and B === 0)
        if (a >= 4 && b === 0) {
          return Math.max(0, Math.min(OdometerDialPhysics.MAX_MINUTES, Math.round(a)));
        }
        // If A <= 3 and B < 60 (e.g. "02:30", "2:30", "01:15", "00:45", "03:00"), interpret as HH:MM
        if (a <= 3 && b < 60) {
          const totalMins = Math.round(a * 60 + b);
          return Math.max(0, Math.min(OdometerDialPhysics.MAX_MINUTES, totalMins));
        }
        // Otherwise interpret A as minutes and B as seconds
        const totalMins = Math.round(a + b / 60);
        return Math.max(0, Math.min(OdometerDialPhysics.MAX_MINUTES, totalMins));
      }

      if (nums.length === 3) {
        const [h, m, s] = nums;
        if (h < 0 || m < 0 || s < 0) return null;
        const totalMins = Math.round(h * 60 + m + s / 60);
        return Math.max(0, Math.min(OdometerDialPhysics.MAX_MINUTES, totalMins));
      }
      return null;
    }

    // 3. Plain numeric value -> minutes (0..180)
    const numeric = Number(cleaned);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    return Math.max(0, Math.min(OdometerDialPhysics.MAX_MINUTES, Math.round(numeric)));
  }
}
